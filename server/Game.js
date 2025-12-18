const fs = require('fs');
const path = require('path');
const GeminiService = require('./GeminiService');

// Load questions
const questionsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/questions.json'), 'utf8'));

// Timer constants
const PHASE_DURATION = 60; // 60 seconds per phase
const TIMER_TICK_INTERVAL = 1000; // Broadcast every second

class Game {
  constructor(io, roomCode, hostSocketId) {
    this.io = io;
    this.roomCode = roomCode;
    this.hostSocketId = hostSocketId;
    
    this.players = new Map(); 
    this.state = 'LOBBY'; 
    
    // Game Content
    this.gameData = questionsData[Math.floor(Math.random() * questionsData.length)];
    this.currentQuestionIndex = 0;
    
    // Round data
    this.currentLies = []; 
    this.revealOrder = []; // Separate order for reveal (truth last)
    this.revealIndex = 0; // For stepwise reveal
    
    // Timer management
    this.phaseStartTime = null;
    this.timerInterval = null;
    this.remainingTime = PHASE_DURATION;
    
    // Auto-progress settings
    this.autoProgress = false;
    this.audioPlaying = false;
    
    // Gemini Service
    this.gemini = null;
  }
  
  initializeGemini() {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
          this.gemini = new GeminiService(
              apiKey, 
              (audioBuffer) => {
                  this.io.to(this.hostSocketId).emit('audio_chunk', audioBuffer);
              },
              () => {
                  // onTurnComplete callback
                  this.audioPlaying = false;
                  this.io.to(this.hostSocketId).emit('audio_complete');
                  
                  // If auto-progress is enabled, advance after audio completes
                  if (this.autoProgress) {
                      this.handleAutoProgress();
                  }
              }
          );
          this.gemini.connect();
      } else {
          console.warn("No GEMINI_API_KEY found. AI features disabled.");
      }
  }
  
  setAutoProgress(enabled) {
      this.autoProgress = enabled;
      console.log(`Auto-progress ${enabled ? 'enabled' : 'disabled'} for room ${this.roomCode}`);
  }
  
  handleAutoProgress() {
      // Auto-advance based on current state
      if (this.state === 'ROUND_INTRO') {
          setTimeout(() => this.nextState(), 1000);
      } else if (this.state === 'MINI_SCOREBOARD') {
          setTimeout(() => this.nextState(), 2000);
      }
  }

  addPlayer(socketId, name) {
    let existingId = null;
    for (const [id, p] of this.players) {
        if (p.name === name && !this.io.sockets.sockets.get(id)) {
            existingId = id;
            break;
        }
    }

    if (existingId) {
        const p = this.players.get(existingId);
        this.players.delete(existingId);
        this.players.set(socketId, p);
        console.log(`Player ${name} reconnected`);
    } else {
        this.players.set(socketId, { name, score: 0, currentLie: '', currentVote: null });
    }

    this.broadcastState();
  }

  removePlayer(socketId) {
    if (this.state === 'LOBBY') {
        this.players.delete(socketId);
        this.broadcastState();
    }
  }
  
  // Round detection helpers
  getRoundNumber() {
      if (this.currentQuestionIndex < 3) return 1;
      if (this.currentQuestionIndex < 6) return 2;
      if (this.currentQuestionIndex < 9) return 3;
      return 4; // Final Fibbage
  }
  
  getRoundMultiplier() {
      const round = this.getRoundNumber();
      if (round === 1) return 1;
      if (round === 2) return 2;
      return 3; // Round 3 and Final are triple
  }
  
  getQuestionInRound() {
      const idx = this.currentQuestionIndex;
      if (idx < 3) return idx + 1;
      if (idx < 6) return idx - 2;
      if (idx < 9) return idx - 5;
      return 1; // Final Fibbage is always question 1
  }
  
  isFirstQuestionOfRound() {
      return [0, 3, 6, 9].includes(this.currentQuestionIndex);
  }
  
  isFinalFibbage() {
      return this.currentQuestionIndex >= 9;
  }

  broadcastState() {
    const playerList = Array.from(this.players.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      score: p.score,
      hasLied: !!p.currentLie,
      hasVoted: !!p.currentVote
    }));
    
    const question = this.getCurrentQuestionPublic();
    const round = this.getRoundName();

    // Always use currentLies for display (random order, truth can be anywhere)
    // During reveal, send the ID of the currently revealed item (not index)
    // This way UI order stays random, but reveal PROCESS saves truth for last
    const currentRevealId = (this.state === 'REVEAL' && this.revealIndex >= 0 && this.revealIndex < this.revealOrder.length)
      ? this.revealOrder[this.revealIndex].id
      : null;

    this.io.to(this.roomCode).emit('game_state', {
      state: this.state,
      players: playerList,
      currentQuestion: question,
      lies: this.state === 'VOTING' || this.state === 'REVEAL' ? this.currentLies : [],
      round: round,
      roundNumber: this.getRoundNumber(),
      roundMultiplier: this.getRoundMultiplier(),
      questionInRound: this.getQuestionInRound(),
      isFinalFibbage: this.isFinalFibbage(),
      currentRevealId: currentRevealId,
      revealedIds: this.state === 'REVEAL' ? this.revealOrder.slice(0, this.revealIndex + 1).map(l => l.id) : [],
      autoProgress: this.autoProgress
    });
    
    // Send Context to Gemini Server-Side
    if (this.gemini && this.gemini.isConnected) {
        this.audioPlaying = true;
        this.sendGeminiUpdate(question);
    }
  }

  sendGeminiUpdate(question) {
        const context = {
            state: this.state,
            question: question,
            playerCount: this.players.size,
            leader: this.getLeader(),
            currentReveal: this.state === 'REVEAL' ? this.revealOrder[this.revealIndex] : null,
            roundNumber: this.getRoundNumber(),
            roundMultiplier: this.getRoundMultiplier()
        };
        
        let prompt = "";
        if (context.state === 'LOBBY') {
            prompt = `A new player joined! We have ${context.playerCount} players. The leader is ${context.leader || "nobody yet"}. Encourage them to start.`;
        } else if (context.state === 'ROUND_INTRO') {
            // Round introduction prompts
            if (context.roundNumber === 1) {
                prompt = `Welcome to Fibbage! This is Round 1. Here's how it works: I'll ask a question, you write a convincing lie, then everyone tries to find the real answer among the lies. You get 1000 points for finding the truth, and 500 points for every player you fool with your lie. Let's do this!`;
            } else if (context.roundNumber === 2) {
                prompt = `Round 2 - Double Trouble! Things are heating up. All points are now DOUBLED! That's 2000 for finding the truth and 1000 for each fool. The pressure is on!`;
            } else if (context.roundNumber === 3) {
                prompt = `Round 3 - Triple Threat! This is where legends are made. All points are TRIPLED! 3000 for truth, 1500 per fool. Make every answer count!`;
            } else {
                prompt = `THE FINAL FIBBAGE! One question. One chance. Triple points. Everything you've done leads to this moment. Winner takes all the glory. Losers get roasted. Let's go!`;
            }
        } else if (context.state === 'LIE_INPUT') {
            // Use spokenText for clearer narration
            prompt = `Read this question for the players: "${question.spokenText}". Tell them to write a convincing lie.`;
        } else if (context.state === 'VOTING') {
            prompt = "Time to vote! Pick the truth if you can find it.";
        } else if (context.state === 'REVEAL') {
             if (context.currentReveal) {
                 const lie = context.currentReveal;
                 if (lie.isTruth) {
                     prompt = `And the truth is... "${lie.text}"! `;
                     // Find winners
                     const winners = Array.from(this.players.values()).filter(p => p.currentVote === 'truth');
                     if (winners.length > 0) prompt += `Nice job ${winners.map(p=>p.name).join(', ')}.`;
                     else prompt += "Nobody got it right! Wow.";
                 } else {
                     prompt = `Let's see... "${lie.text}". `;
                     if (lie.author === 'House AI') {
                         prompt += "That was one of mine. Did I trick anyone?";
                     } else {
                         prompt += `That was written by ${lie.author}. `;
                         // Find suckers
                         const suckers = Array.from(this.players.values()).filter(p => p.currentVote === lie.id);
                         if (suckers.length > 0) prompt += `${suckers.map(p=>p.name).join(', ')} fell for it!`;
                         else prompt += "Nobody voted for that garbage.";
                     }
                 }
             }
        } else if (context.state === 'MINI_SCOREBOARD') {
            const leader = this.getLeader();
            const scores = Array.from(this.players.values()).sort((a,b) => b.score - a.score);
            if (scores.length > 0) {
                prompt = `Quick score check! ${leader} is in the lead with ${scores[0].score} points. `;
                if (scores.length > 1) {
                    prompt += `${scores[1].name} is right behind with ${scores[1].score}. `;
                }
                prompt += "Let's keep going!";
            }
        } else if (context.state === 'SCOREBOARD') {
            prompt = `Final scores! The winner is ${context.leader}! What a game!`;
        }
        
        if (prompt) this.gemini.sendContext(prompt);
  }
  
  getLeader() {
      if (this.players.size === 0) return null;
      return Array.from(this.players.values()).sort((a,b) => b.score - a.score)[0].name;
  }

  // Timer Management
  startTimer() {
    this.stopTimer(); // Clear any existing timer
    this.phaseStartTime = Date.now();
    this.remainingTime = PHASE_DURATION;
    
    // Broadcast initial time
    this.broadcastTimer();
    
    // Set up interval to broadcast timer updates
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.phaseStartTime) / 1000);
      this.remainingTime = Math.max(0, PHASE_DURATION - elapsed);
      
      this.broadcastTimer();
      
      // Auto-advance when timer expires
      if (this.remainingTime <= 0) {
        this.handleTimerExpired();
      }
    }, TIMER_TICK_INTERVAL);
  }
  
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.remainingTime = PHASE_DURATION;
  }
  
  broadcastTimer() {
    this.io.to(this.roomCode).emit('timer_sync', {
      remaining: this.remainingTime,
      total: PHASE_DURATION
    });
  }
  
  handleTimerExpired() {
    this.stopTimer();
    
    if (this.state === 'LIE_INPUT') {
      // Auto-submit empty lies for players who haven't submitted
      this.players.forEach((player, id) => {
        if (!player.currentLie) {
          player.currentLie = '...'; // Default placeholder
        }
      });
      this.startVoting();
    } else if (this.state === 'VOTING') {
      // Auto-vote randomly for players who haven't voted
      const lieOptions = this.currentLies.filter(l => l.id !== 'truth');
      this.players.forEach((player, id) => {
        if (!player.currentVote) {
          // Pick a random lie (not their own)
          const validOptions = lieOptions.filter(l => l.id !== id);
          if (validOptions.length > 0) {
            player.currentVote = validOptions[Math.floor(Math.random() * validOptions.length)].id;
          } else {
            player.currentVote = 'truth';
          }
        }
      });
      this.calculateScores();
      this.startReveal();
    }
  }

  getCurrentQuestionPublic() {
    if (this.state === 'LOBBY' || this.state === 'ROUND_INTRO') return null;
    if (this.currentQuestionIndex >= this.gameData.questions.length) return null;
    const q = this.gameData.questions[this.currentQuestionIndex];
    return {
      text: q.text,
      spokenText: q.spokenText, // Send spoken text for frontend/AI if needed
      category: q.category,
      answer: this.state === 'REVEAL' ? q.correctAnswer : null
    };
  }
  
  getRoundName() {
      if (this.currentQuestionIndex < 3) return "Round 1";
      if (this.currentQuestionIndex < 6) return "Round 2";
      if (this.currentQuestionIndex < 9) return "Round 3";
      return "Final Fibbage";
  }

  receiveLie(socketId, lieText) {
    if (this.state !== 'LIE_INPUT') return;
    const player = this.players.get(socketId);
    if (player) {
      player.currentLie = lieText.toLowerCase().trim();
      this.checkAllLiesSubmitted();
      this.broadcastState();
    }
  }

  checkAllLiesSubmitted() {
    const allSubmitted = Array.from(this.players.values()).every(p => p.currentLie);
    if (allSubmitted && this.players.size > 0) {
      this.stopTimer(); // Stop lie input timer
      this.startVoting();
    }
  }

  startVoting() {
    this.state = 'VOTING';
    const q = this.gameData.questions[this.currentQuestionIndex];
    this.currentLies = [];
    
    // Add Truth
    this.currentLies.push({ id: 'truth', text: q.correctAnswer.toLowerCase(), isTruth: true, author: 'House' });
    
    // Add Player Lies
    this.players.forEach((p, id) => {
        this.currentLies.push({ id: id, text: p.currentLie, isTruth: false, author: p.name });
    });
    
    // Fill with House Lies (Specific to Question now)
    const availableLies = q.houseLies || [];
    let lieIndex = 0;
    while (this.currentLies.length < 5) {
        // Use specific house lies first, then fall back to generics if needed (though generator ensures enough)
        const text = availableLies[lieIndex] || `Random Lie ${lieIndex}`;
        this.currentLies.push({ 
            id: `house_lie_${lieIndex}`, 
            text: text.toLowerCase(), 
            isTruth: false, 
            author: 'House AI' 
        });
        lieIndex++;
    }
    
    // Shuffle fully for voting display (so truth isn't always in same spot)
    this.currentLies = this.currentLies.sort(() => Math.random() - 0.5);
    
    this.broadcastState();
    this.startTimer(); // Start voting timer
  }

  receiveVote(socketId, choiceId) {
    if (this.state !== 'VOTING') return;
    const player = this.players.get(socketId);
    if (choiceId === socketId) return; 
    
    if (player) {
      player.currentVote = choiceId;
      this.checkAllVotes();
      this.broadcastState();
    }
  }

  checkAllVotes() {
     const allVoted = Array.from(this.players.values()).every(p => p.currentVote);
     if (allVoted && this.players.size > 0) {
         this.calculateScores();
         this.startReveal();
     }
  }

  calculateScores() {
      const multiplier = this.getRoundMultiplier();

      this.players.forEach(p => {
          if (p.currentVote === 'truth') {
              p.score += (1000 * multiplier);
          } else {
              const liarId = p.currentVote;
              const liar = this.players.get(liarId);
              if (liar) {
                  liar.score += (500 * multiplier);
              }
          }
      });
  }
  
  startReveal() {
      this.stopTimer(); // Stop voting timer
      this.state = 'REVEAL';
      this.revealIndex = -1;
      
      // Create reveal order: shuffle lies randomly, but save truth for last
      const truth = this.currentLies.find(l => l.isTruth);
      const lies = this.currentLies.filter(l => !l.isTruth);
      lies.sort(() => Math.random() - 0.5);
      this.revealOrder = [...lies, truth];
      
      this.broadcastState();
      
      // Start stepping through lies
      this.nextRevealStep();
  }
  
  nextRevealStep() {
      if (this.state !== 'REVEAL') return;
      
      this.revealIndex++;
      if (this.revealIndex >= this.revealOrder.length) {
          // Done revealing - go to mini scoreboard
          this.broadcastState(); 
          
          // Auto-advance to mini scoreboard after a delay
          setTimeout(() => {
              this.state = 'MINI_SCOREBOARD';
              this.broadcastState();
          }, 2000);
          return;
      }
      
      this.broadcastState();
      
      // Schedule next step (approx time for narration + reading)
      // In a real implementation, we might wait for Gemini to finish speaking
      // For now, fixed timer
      setTimeout(() => this.nextRevealStep(), 6000); 
  }

  nextState() {
      if (this.state === 'LOBBY') {
          // Start game -> go to round intro
          this.state = 'ROUND_INTRO';
          this.broadcastState();
      } else if (this.state === 'ROUND_INTRO') {
          // After round intro -> start questions
          this.state = 'LIE_INPUT'; 
          this.broadcastState();
          this.startTimer();
      } else if (this.state === 'REVEAL') {
           // Skip remaining reveals if clicked early
           this.state = 'MINI_SCOREBOARD';
           this.broadcastState();
      } else if (this.state === 'MINI_SCOREBOARD') {
          // Clear current round data
          this.players.forEach(p => {
              p.currentLie = '';
              p.currentVote = null;
          });
          
          this.currentQuestionIndex++;
          
          // Check if game is over
          if (this.currentQuestionIndex >= this.gameData.questions.length) {
              this.state = 'SCOREBOARD';
              this.broadcastState();
          } else if (this.isFirstQuestionOfRound()) {
              // New round - show round intro
              this.state = 'ROUND_INTRO';
              this.broadcastState();
          } else {
              // Same round - continue to next question
              this.state = 'LIE_INPUT';
              this.broadcastState();
              this.startTimer();
          }
      } else if (this.state === 'SCOREBOARD') {
          this.stopTimer();
          this.currentQuestionIndex = 0;
          this.gameData = questionsData[Math.floor(Math.random() * questionsData.length)];
          this.players.forEach(p => {
              p.score = 0;
              p.currentLie = '';
              p.currentVote = null;
          });
          this.state = 'LOBBY';
          this.broadcastState();
      }
  }
}

module.exports = Game;
