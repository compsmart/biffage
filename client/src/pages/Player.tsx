import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { useSounds } from '../hooks/useSounds';
import { 
  Background, 
  CountdownTimer,
  PlayerStatusBar 
} from '../components';

interface Player {
  id: string;
  name: string;
  score: number;
  hasLied: boolean;
  hasVoted: boolean;
}

interface Lie {
  id: string;
  text: string;
  isTruth: boolean;
  author: string;
}

interface GameState {
  state: 'LOBBY' | 'ROUND_INTRO' | 'LIE_INPUT' | 'VOTING' | 'REVEAL' | 'MINI_SCOREBOARD' | 'SCOREBOARD';
  players: Player[];
  currentQuestion: {
    text: string;
    category: string;
    answer?: string;
  } | null;
  lies: Lie[];
  round: string;
  roundNumber: number;
  roundMultiplier: number;
  isFinalFibbage: boolean;
  currentRevealId: string | null;
  revealedIds: string[];
}

const STORAGE_KEY_ROOM = 'fibbage_room_code';
const STORAGE_KEY_NAME = 'fibbage_player_name';

const JoinScreen = ({ 
  onJoin,
  initialRoomCode,
  initialName 
}: { 
  onJoin: (name: string, roomCode: string) => void;
  initialRoomCode?: string;
  initialName?: string;
}) => {
  const [name, setName] = useState(initialName || '');
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter the room code');
      return;
    }
    onJoin(name.trim(), roomCode.trim().toUpperCase());
  };

  return (
    <motion.div 
      className="flex flex-col items-center justify-center min-h-screen p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Fun header */}
      <motion.div
        className="text-5xl mb-4"
        animate={{ rotate: [-5, 5, -5], y: [0, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        🎮
      </motion.div>
      
      <motion.h1
        className="text-4xl font-fun text-[#ff6eb4] mb-2"
        style={{ textShadow: '3px 3px 0 #000' }}
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        Join Game!
      </motion.h1>
      
      <motion.p
        className="text-white/70 mb-8 font-fun text-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Enter your details to play 👇
      </motion.p>

      <motion.form
        onSubmit={handleSubmit}
        className="card-cartoon p-8 w-full max-w-sm space-y-6"
        initial={{ y: 30, opacity: 0, rotate: -2 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ delay: 0.3, type: 'spring' }}
      >
        <div className="space-y-3">
          <label className="block text-lg font-fun text-white uppercase tracking-wider flex items-center gap-2">
            <span>🔑</span> Room Code
          </label>
          <input
            type="text"
            className="input-cartoon w-full text-center text-2xl uppercase tracking-[0.2em]"
            placeholder="XXXX"
            value={roomCode}
            onChange={(e) => {
              setRoomCode(e.target.value.toUpperCase());
              setError('');
            }}
            maxLength={4}
            autoComplete="off"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-lg font-fun text-white uppercase tracking-wider flex items-center gap-2">
            <span>😎</span> Your Name
          </label>
          <input
            type="text"
            className="input-cartoon w-full text-center text-xl"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            maxLength={20}
            autoComplete="off"
          />
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              className="text-[#ef4444] text-lg text-center font-fun p-3 bg-red-500/20 rounded-lg border-2 border-red-500"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              ⚠️ {error}
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          type="submit" 
          className="btn-cartoon btn-pink w-full text-xl py-4"
        >
          🚀 Join Game!
        </button>
      </motion.form>
    </motion.div>
  );
};

const LobbyWaitingScreen = ({ name, score }: { name: string; score: number }) => (
  <motion.div 
    className="flex flex-col items-center justify-center min-h-screen p-6"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    <motion.div
      className="card-cartoon p-10 text-center"
      initial={{ scale: 0.9, opacity: 0, rotate: -3 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring' }}
    >
      <motion.div
        className="text-7xl mb-6"
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 10, -10, 0]
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        🎮
      </motion.div>
      
      <h2 className="text-4xl font-fun text-[#4ade80] mb-4" style={{ textShadow: '3px 3px 0 #000' }}>
        You're In!
      </h2>
      
      <p className="text-white text-xl font-fun mb-6">
        Welcome, <span className="text-[#ffe66d] font-bold">{name}</span>! 👋
      </p>
      
      <div className="score-cartoon text-xl mb-8">
        ⭐ Score: {score}
      </div>
      
      <motion.div
        className="text-white/60 text-lg font-fun flex items-center justify-center gap-2"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <motion.span
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          ⏳
        </motion.span>
        Waiting for host to start...
      </motion.div>
    </motion.div>
  </motion.div>
);

const LieInputScreen = ({ 
  question, 
  category,
  round,
  hasSubmitted,
  players,
  onSubmit 
}: { 
  question: string;
  category?: string;
  round?: string;
  hasSubmitted: boolean;
  players: Player[];
  onSubmit: (lie: string) => void;
}) => {
  const [lieText, setLieText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lieText.trim()) {
      onSubmit(lieText.trim());
    }
  };

  if (hasSubmitted) {
    return (
      <motion.div 
        className="flex flex-col items-center justify-center min-h-screen p-6 pt-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="card-cartoon p-10 text-center"
          initial={{ scale: 0.8, rotate: -5 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring' }}
        >
          <motion.div
            className="text-7xl mb-4"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            ✅
          </motion.div>
          
          <h2 className="text-3xl font-fun text-[#4ade80] mb-3" style={{ textShadow: '2px 2px 0 #000' }}>
            Lie Submitted!
          </h2>
          <p className="text-white/70 text-lg font-fun mb-6">
            Nice one! 🤥 Waiting for others...
          </p>
          
          <PlayerStatusBar players={players} phase="lie" />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="flex flex-col min-h-screen p-6 pt-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Timer */}
      <motion.div 
        className="flex justify-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <CountdownTimer size="md" />
      </motion.div>

      {/* Round & Category */}
      <motion.div 
        className="flex justify-between items-center mb-4 px-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {round && (
          <span className="text-sm font-fun text-white/60 uppercase tracking-wider">
            {round}
          </span>
        )}
        {category && (
          <span className="category-cartoon text-sm">
            {category}
          </span>
        )}
      </motion.div>

      {/* Question */}
      <motion.div
        className="card-cartoon p-6 mb-6"
        initial={{ opacity: 0, y: 20, rotate: -1 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ delay: 0.2, type: 'spring' }}
      >
        <div className="flex items-start gap-2 mb-2">
          <span className="text-2xl">❓</span>
          <h2 className="text-xl font-fun leading-relaxed">
            {question}
          </h2>
        </div>
      </motion.div>

      {/* Input Form */}
      <motion.form
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex-1 flex flex-col">
          <label className="text-lg font-fun text-white mb-2 flex items-center gap-2">
            <span>🤥</span> Write a convincing lie!
          </label>
          <textarea
            className="input-cartoon flex-1 min-h-[120px] resize-none text-lg"
            placeholder="Type your lie here..."
            value={lieText}
            onChange={(e) => setLieText(e.target.value)}
            maxLength={150}
          />
          <div className="text-right text-sm text-white/50 mt-2 font-fun">
            {lieText.length}/150
          </div>
        </div>

        <button 
          type="submit" 
          className={`btn-cartoon btn-yellow w-full text-xl py-4 ${!lieText.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!lieText.trim()}
        >
          📤 Submit Lie!
        </button>
      </motion.form>
    </motion.div>
  );
};

const VotingScreen = ({ 
  question,
  lies,
  hasVoted,
  players,
  mySocketId,
  onVote 
}: { 
  question: string;
  lies: Lie[];
  hasVoted: boolean;
  players: Player[];
  mySocketId?: string;
  onVote: (choiceId: string) => void;
}) => {
  if (hasVoted) {
    return (
      <motion.div 
        className="flex flex-col items-center justify-center min-h-screen p-6 pt-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="card-cartoon p-10 text-center"
          initial={{ scale: 0.8, rotate: 5 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring' }}
        >
          <motion.div
            className="text-7xl mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            🎯
          </motion.div>
          
          <h2 className="text-3xl font-fun text-[#38bdf8] mb-3" style={{ textShadow: '2px 2px 0 #000' }}>
            Vote Submitted!
          </h2>
          <p className="text-white/70 text-lg font-fun mb-6">
            Fingers crossed! 🤞
          </p>
          
          <PlayerStatusBar players={players} phase="vote" />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="flex flex-col min-h-screen p-6 pt-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Timer */}
      <motion.div 
        className="flex justify-center mb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <CountdownTimer size="sm" />
      </motion.div>

      {/* Question */}
      <motion.div
        className="card-cartoon p-4 mb-4 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-lg font-fun">{question}</h2>
      </motion.div>

      {/* Instruction */}
      <motion.div
        className="text-center text-[#ffe66d] font-fun text-xl mb-4 flex items-center justify-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <span>🎯</span>
        <span>Pick the TRUTH!</span>
        <span>🎯</span>
      </motion.div>

      {/* Answer Options */}
      <motion.div 
        className="flex-1 flex flex-col gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {lies.map((lie, index) => {
          const isOwnLie = lie.id === mySocketId;
          
          return (
            <motion.button
              key={lie.id}
              className={`
                answer-cartoon text-left lowercase text-lg py-5
                ${isOwnLie ? 'opacity-40 cursor-not-allowed' : ''}
              `}
              onClick={() => !isOwnLie && onVote(lie.id)}
              disabled={isOwnLie}
              initial={{ opacity: 0, x: -30, rotate: -2 }}
              animate={{ opacity: isOwnLie ? 0.4 : 1, x: 0, rotate: 0 }}
              transition={{ delay: 0.1 * index, type: 'spring' }}
              whileHover={!isOwnLie ? { scale: 1.02, rotate: 1 } : {}}
              whileTap={!isOwnLie ? { scale: 0.98 } : {}}
            >
              {lie.text}
              {isOwnLie && (
                <span className="text-sm text-black/50 ml-2 normal-case">(Your lie 🤫)</span>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </motion.div>
  );
};

const RevealWaitingScreen = () => (
  <motion.div 
    className="flex flex-col items-center justify-center min-h-screen p-6"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    <motion.div
      className="card-cartoon p-10 text-center"
      initial={{ scale: 0.9, rotate: -3 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring' }}
    >
      <motion.div
        className="text-7xl mb-4"
        animate={{ 
          scale: [1, 1.3, 1],
          rotate: [-10, 10, -10]
        }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        👀
      </motion.div>
      
      <h2 className="text-3xl font-fun text-white mb-3" style={{ textShadow: '2px 2px 0 #000' }}>
        Look at the Screen!
      </h2>
      <p className="text-white/70 text-lg font-fun">
        🔍 The results are being revealed...
      </p>
    </motion.div>
  </motion.div>
);

// Round Intro waiting screen for players
const RoundIntroWaitingScreen = ({ roundNumber, isFinal }: { roundNumber: number; isFinal: boolean }) => {
  const getRoundInfo = () => {
    if (isFinal) {
      return { emoji: '🏆', title: 'Final Fibbage!', color: '#ffe66d' };
    }
    switch (roundNumber) {
      case 1: return { emoji: '🎮', title: 'Round 1!', color: '#38bdf8' };
      case 2: return { emoji: '⚡', title: 'Round 2 - Double Points!', color: '#a855f7' };
      case 3: return { emoji: '🔥', title: 'Round 3 - Triple Points!', color: '#ff6b35' };
      default: return { emoji: '🎯', title: `Round ${roundNumber}`, color: '#ffe66d' };
    }
  };
  
  const info = getRoundInfo();
  
  return (
    <motion.div 
      className="flex flex-col items-center justify-center min-h-screen p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="card-cartoon p-10 text-center"
        initial={{ scale: 0.9, rotate: 3 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring' }}
      >
        <motion.div
          className="text-8xl mb-6"
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [-5, 5, -5]
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {info.emoji}
        </motion.div>
        
        <h2 
          className="text-3xl font-fun mb-3" 
          style={{ color: info.color, textShadow: '2px 2px 0 #000' }}
        >
          {info.title}
        </h2>
        <p className="text-white/70 text-lg font-fun">
          Get ready... 🎯
        </p>
      </motion.div>
    </motion.div>
  );
};

// Mini scoreboard waiting screen for players
const MiniScoreboardWaitingScreen = ({ score, name }: { score: number; name: string }) => (
  <motion.div 
    className="flex flex-col items-center justify-center min-h-screen p-6"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    <motion.div
      className="card-cartoon p-10 text-center"
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring' }}
    >
      <motion.div
        className="text-7xl mb-4"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        📊
      </motion.div>
      
      <h2 className="text-3xl font-fun text-[#38bdf8] mb-3" style={{ textShadow: '2px 2px 0 #000' }}>
        Score Check!
      </h2>
      
      <div className="score-cartoon text-2xl mb-4">
        ⭐ {score.toLocaleString()}
      </div>
      
      <p className="text-white/70 text-lg font-fun">
        Look at the big screen, {name}! 👀
      </p>
    </motion.div>
  </motion.div>
);

export const PlayerPage = () => {
  const socket = useSocket();
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [storedRoomCode, setStoredRoomCode] = useState<string | null>(null);
  const [storedName, setStoredName] = useState<string | null>(null);
  const prevStateRef = useRef<string | null>(null);
  const reconnectAttempted = useRef(false);
  
  const { playSound, resumeAudio } = useSounds();
  
  // Load stored values on mount
  useEffect(() => {
    const savedRoom = localStorage.getItem(STORAGE_KEY_ROOM);
    const savedName = localStorage.getItem(STORAGE_KEY_NAME);
    if (savedRoom) setStoredRoomCode(savedRoom);
    if (savedName) setStoredName(savedName);
  }, []);
  
  // Auto-reconnect logic
  useEffect(() => {
    if (!socket || reconnectAttempted.current || joined) return;
    
    const savedRoom = localStorage.getItem(STORAGE_KEY_ROOM);
    const savedName = localStorage.getItem(STORAGE_KEY_NAME);
    
    if (savedRoom && savedName) {
      reconnectAttempted.current = true;
      setIsReconnecting(true);
      
      // Check if room is still active
      socket.emit('check_room', { roomCode: savedRoom });
    }
  }, [socket, joined]);
  
  // Handle room check response
  useEffect(() => {
    if (!socket) return;
    
    const handleRoomCheckResult = ({ roomCode: code, active }: { roomCode: string; active: boolean }) => {
      setIsReconnecting(false);
      
      if (active) {
        const savedName = localStorage.getItem(STORAGE_KEY_NAME);
        if (savedName) {
          // Room is active, reconnect automatically
          setName(savedName);
          setRoomCode(code);
          socket.emit('join_player', { roomCode: code, playerName: savedName });
          setJoined(true);
        }
      } else {
        // Room no longer exists, clear storage
        localStorage.removeItem(STORAGE_KEY_ROOM);
        localStorage.removeItem(STORAGE_KEY_NAME);
        setStoredRoomCode(null);
        setStoredName(null);
      }
    };
    
    socket.on('room_check_result', handleRoomCheckResult);
    
    return () => {
      socket.off('room_check_result', handleRoomCheckResult);
    };
  }, [socket]);
  
  // Handle game state sound effects
  useEffect(() => {
    if (!gameState) return;
    
    const prevState = prevStateRef.current;
    const currentState = gameState.state;
    
    // State transition sounds
    if (prevState !== currentState) {
      switch (currentState) {
        case 'LIE_INPUT':
          playSound('whoosh');
          if (prevState === 'LOBBY') {
            playSound('gameStart');
          }
          break;
        case 'VOTING':
          playSound('whoosh');
          break;
        case 'REVEAL':
          playSound('pop');
          break;
        case 'SCOREBOARD':
          playSound('roundEnd');
          break;
      }
      prevStateRef.current = currentState;
    }
  }, [gameState, playSound]);
  
  useEffect(() => {
    if (!socket) return;
    
    socket.on('game_state', (state) => {
      setGameState(state);
    });
    
    return () => {
      socket.off('game_state');
    };
  }, [socket]);

  const handleJoin = (playerName: string, code: string) => {
    if (!socket) return;
    resumeAudio(); // Resume audio on first interaction
    playSound('click');
    setName(playerName);
    setRoomCode(code);
    
    // Save to localStorage for reconnection
    localStorage.setItem(STORAGE_KEY_ROOM, code);
    localStorage.setItem(STORAGE_KEY_NAME, playerName);
    
    socket.emit('join_player', { roomCode: code, playerName });
    setJoined(true);
    playSound('playerJoin');
  };
  
  const handleSubmitLie = (lie: string) => {
    if (!socket) return;
    playSound('lieSubmit');
    socket.emit('submit_lie', { roomCode, lie });
  };
  
  const handleSubmitVote = (choiceId: string) => {
    if (!socket) return;
    playSound('voteSubmit');
    socket.emit('submit_vote', { roomCode, choiceId });
  };

  // Find self in player list
  const myState = gameState?.players.find(p => p.id === socket?.id) || { score: 0, hasLied: false, hasVoted: false };

  return (
    <div className="min-h-screen relative">
      <Background />
      
      {/* Header bar when in game */}
      {joined && gameState && (
        <motion.div 
          className="fixed top-0 left-0 right-0 z-50 px-4 py-3 flex justify-between items-center"
          style={{
            background: 'linear-gradient(135deg, #2a2a4a 0%, #1f1f3a 100%)',
            borderBottom: '4px solid #000',
            boxShadow: '0 4px 0 0 rgba(0,0,0,0.3)'
          }}
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.5, type: 'spring' }}
        >
          <span className="font-fun text-[#38bdf8] text-lg">😎 {name}</span>
          <span className="score-cartoon text-sm">⭐ {myState.score}</span>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {isReconnecting && (
          <motion.div 
            key="reconnecting"
            className="flex flex-col items-center justify-center min-h-screen p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="card-cartoon p-10 text-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring' }}
            >
              <motion.div
                className="text-7xl mb-6"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                🔄
              </motion.div>
              <h2 className="text-3xl font-fun text-[#38bdf8] mb-4" style={{ textShadow: '2px 2px 0 #000' }}>
                Reconnecting...
              </h2>
              <p className="text-white/70 text-lg font-fun">
                Looking for your game 🎮
              </p>
            </motion.div>
          </motion.div>
        )}

        {!joined && !isReconnecting && (
          <JoinScreen 
            key="join" 
            onJoin={handleJoin} 
            initialRoomCode={storedRoomCode || undefined}
            initialName={storedName || undefined}
          />
        )}

        {joined && (!gameState || gameState.state === 'LOBBY') && (
          <LobbyWaitingScreen 
            key="lobby"
            name={name} 
            score={myState.score} 
          />
        )}

        {joined && gameState?.state === 'ROUND_INTRO' && (
          <RoundIntroWaitingScreen 
            key="round-intro"
            roundNumber={gameState.roundNumber}
            isFinal={gameState.isFinalFibbage}
          />
        )}

        {joined && gameState?.state === 'LIE_INPUT' && gameState.currentQuestion && (
          <LieInputScreen
            key="lie-input"
            question={gameState.currentQuestion.text}
            category={gameState.currentQuestion.category}
            round={gameState.round}
            hasSubmitted={myState.hasLied}
            players={gameState.players}
            onSubmit={handleSubmitLie}
          />
        )}

        {joined && gameState?.state === 'VOTING' && gameState.currentQuestion && (
          <VotingScreen
            key="voting"
            question={gameState.currentQuestion.text}
            lies={gameState.lies}
            hasVoted={myState.hasVoted}
            players={gameState.players}
            mySocketId={socket?.id}
            onVote={handleSubmitVote}
          />
        )}

        {joined && gameState?.state === 'REVEAL' && (
          <RevealWaitingScreen key="reveal" />
        )}

        {joined && gameState?.state === 'MINI_SCOREBOARD' && (
          <MiniScoreboardWaitingScreen 
            key="mini-scoreboard"
            score={myState.score}
            name={name}
          />
        )}

        {joined && gameState?.state === 'SCOREBOARD' && (
          <LobbyWaitingScreen 
            key="scoreboard"
            name={name} 
            score={myState.score} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};
