/**
 * SoundManager - Web Audio API based sound effects generator
 * 
 * Generates synthesized game sounds for a party trivia game.
 * No external assets needed - all sounds are created programmatically!
 */

export type SoundType = 
  | 'click'
  | 'playerJoin'
  | 'countdown'
  | 'countdownFinal'
  | 'gameStart'
  | 'lieSubmit'
  | 'voteSubmit'
  | 'revealLie'
  | 'revealTruth'
  | 'scoreUp'
  | 'roundEnd'
  | 'victory'
  | 'tick'
  | 'whoosh'
  | 'pop'
  | 'error';

class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicOscillators: OscillatorNode[] = [];
  private isMusicPlaying = false;
  private isEnabled = true;
  private isMusicEnabled = true;

  constructor() {
    // Audio context will be created on first user interaction
  }

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.audioContext.destination);
      
      // Create separate gains for music and SFX
      this.musicGain = this.audioContext.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.masterGain);
      
      this.sfxGain = this.audioContext.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.masterGain);
    }
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    return this.audioContext;
  }

  // Enable/disable all audio
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = enabled ? 0.7 : 0;
    }
  }

  // Enable/disable music only
  setMusicEnabled(enabled: boolean) {
    this.isMusicEnabled = enabled;
    if (this.musicGain) {
      this.musicGain.gain.value = enabled ? 0.3 : 0;
    }
  }

  setMasterVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  // Play a synthesized sound effect
  play(type: SoundType) {
    if (!this.isEnabled) return;
    
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    
    switch (type) {
      case 'click':
        this.playClick(ctx, now);
        break;
      case 'playerJoin':
        this.playPlayerJoin(ctx, now);
        break;
      case 'countdown':
        this.playCountdown(ctx, now);
        break;
      case 'countdownFinal':
        this.playCountdownFinal(ctx, now);
        break;
      case 'gameStart':
        this.playGameStart(ctx, now);
        break;
      case 'lieSubmit':
        this.playLieSubmit(ctx, now);
        break;
      case 'voteSubmit':
        this.playVoteSubmit(ctx, now);
        break;
      case 'revealLie':
        this.playRevealLie(ctx, now);
        break;
      case 'revealTruth':
        this.playRevealTruth(ctx, now);
        break;
      case 'scoreUp':
        this.playScoreUp(ctx, now);
        break;
      case 'roundEnd':
        this.playRoundEnd(ctx, now);
        break;
      case 'victory':
        this.playVictory(ctx, now);
        break;
      case 'tick':
        this.playTick(ctx, now);
        break;
      case 'whoosh':
        this.playWhoosh(ctx, now);
        break;
      case 'pop':
        this.playPop(ctx, now);
        break;
      case 'error':
        this.playError(ctx, now);
        break;
    }
  }

  // Simple button click
  private playClick(ctx: AudioContext, time: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(600, time + 0.05);
    
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    
    osc.start(time);
    osc.stop(time + 0.05);
  }

  // Player joined the game
  private playPlayerJoin(ctx: AudioContext, time: number) {
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 (major chord arpeggio)
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const noteTime = time + i * 0.08;
      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.25, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.3);
      
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      
      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });
  }

  // Countdown tick (non-final)
  private playCountdown(ctx: AudioContext, time: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.value = 440;
    
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    
    osc.start(time);
    osc.stop(time + 0.1);
  }

  // Countdown final seconds (more urgent)
  private playCountdownFinal(ctx: AudioContext, time: number) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc1.type = 'square';
    osc1.frequency.value = 880;
    
    osc2.type = 'square';
    osc2.frequency.value = 440;
    
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain!);
    
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.15);
    osc2.stop(time + 0.15);
  }

  // Game start fanfare
  private playGameStart(ctx: AudioContext, time: number) {
    const notes = [392, 523.25, 659.25, 783.99, 1046.50]; // G4, C5, E5, G5, C6
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = i < 3 ? 'sawtooth' : 'square';
      osc.frequency.value = freq;
      
      const noteTime = time + i * 0.1;
      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.02);
      gain.gain.setValueAtTime(0.2, noteTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.4);
      
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      
      osc.start(noteTime);
      osc.stop(noteTime + 0.4);
    });
  }

  // Lie submitted
  private playLieSubmit(ctx: AudioContext, time: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, time);
    osc.frequency.exponentialRampToValueAtTime(600, time + 0.1);
    
    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
    
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    
    osc.start(time);
    osc.stop(time + 0.15);

    // Add confirmation blip
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 800;
      gain2.gain.setValueAtTime(0.2, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc2.connect(gain2);
      gain2.connect(this.sfxGain!);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.08);
    }, 100);
  }

  // Vote submitted
  private playVoteSubmit(ctx: AudioContext, time: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 523.25;
    
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    
    osc.start(time);
    osc.stop(time + 0.2);
  }

  // Reveal a lie (wrong answer buzzer)
  private playRevealLie(ctx: AudioContext, time: number) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Dissonant interval for "wrong" feeling
    osc1.type = 'sawtooth';
    osc1.frequency.value = 150;
    
    osc2.type = 'sawtooth';
    osc2.frequency.value = 158; // Slightly detuned for buzz
    
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.setValueAtTime(0.15, time + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain!);
    
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.4);
    osc2.stop(time + 0.4);
  }

  // Reveal the truth (correct answer ding)
  private playRevealTruth(ctx: AudioContext, time: number) {
    const notes = [783.99, 987.77, 1174.66]; // G5, B5, D6 (G major)
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.25, time + 0.01);
      gain.gain.setValueAtTime(0.25, time + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.8);
      
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      
      osc.start(time);
      osc.stop(time + 0.8);
    });
    
    // Add shimmer effect
    for (let i = 0; i < 3; i++) {
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.value = 2000 + Math.random() * 2000;
      shimmerGain.gain.setValueAtTime(0.05, time + 0.1 * i);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3 + 0.1 * i);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(this.sfxGain!);
      shimmer.start(time + 0.1 * i);
      shimmer.stop(time + 0.4 + 0.1 * i);
    }
  }

  // Score increase
  private playScoreUp(ctx: AudioContext, time: number) {
    const notes = [523.25, 587.33, 659.25, 783.99]; // C5, D5, E5, G5
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const noteTime = time + i * 0.05;
      gain.gain.setValueAtTime(0.2, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.15);
      
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      
      osc.start(noteTime);
      osc.stop(noteTime + 0.15);
    });
  }

  // Round end / transition
  private playRoundEnd(ctx: AudioContext, time: number) {
    const notes = [659.25, 587.33, 523.25, 392]; // E5, D5, C5, G4 (descending)
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = freq;
      
      const noteTime = time + i * 0.15;
      gain.gain.setValueAtTime(0.2, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.3);
      
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      
      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });
  }

  // Victory fanfare
  private playVictory(ctx: AudioContext, time: number) {
    // Triumphant chord progression
    const chords = [
      [523.25, 659.25, 783.99],    // C major
      [587.33, 739.99, 880],       // D major  
      [659.25, 783.99, 987.77],    // E minor
      [783.99, 987.77, 1174.66],   // G major
      [1046.50, 1318.51, 1567.98], // C major (high)
    ];
    
    chords.forEach((chord, chordIndex) => {
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = chordIndex < 4 ? 'sawtooth' : 'square';
        osc.frequency.value = freq;
        
        const noteTime = time + chordIndex * 0.2;
        gain.gain.setValueAtTime(0, noteTime);
        gain.gain.linearRampToValueAtTime(0.1, noteTime + 0.02);
        gain.gain.setValueAtTime(0.1, noteTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.5);
        
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        
        osc.start(noteTime);
        osc.stop(noteTime + 0.5);
      });
    });
  }

  // Simple tick
  private playTick(ctx: AudioContext, time: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 1200;
    
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.03);
    
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    
    osc.start(time);
    osc.stop(time + 0.03);
  }

  // Whoosh/transition sound
  private playWhoosh(ctx: AudioContext, time: number) {
    // White noise burst with filter sweep
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(100, time);
    filter.frequency.exponentialRampToValueAtTime(3000, time + 0.15);
    filter.frequency.exponentialRampToValueAtTime(100, time + 0.3);
    filter.Q.value = 1;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.05);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    
    noise.start(time);
    noise.stop(time + 0.3);
  }

  // Pop sound
  private playPop(ctx: AudioContext, time: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.1);
    
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    
    osc.start(time);
    osc.stop(time + 0.1);
  }

  // Error/invalid action
  private playError(ctx: AudioContext, time: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.setValueAtTime(150, time + 0.1);
    
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.setValueAtTime(0.15, time + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    
    osc.start(time);
    osc.stop(time + 0.2);
  }

  // Background music - simple looping chiptune-style
  startMusic() {
    if (!this.isMusicEnabled || this.isMusicPlaying) return;
    
    const ctx = this.ensureContext();
    this.isMusicPlaying = true;
    
    this.playMusicLoop(ctx);
  }

  private playMusicLoop(ctx: AudioContext) {
    if (!this.isMusicPlaying || !this.isMusicEnabled) return;
    
    // Simple bass pattern
    const bassNotes = [130.81, 146.83, 164.81, 146.83]; // C3, D3, E3, D3
    const melodyNotes = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33]; // C5, D5, E5, G5, E5, D5
    
    const now = ctx.currentTime;
    const beatLength = 0.25;
    
    // Play a musical phrase
    bassNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = freq;
      
      const noteTime = now + i * beatLength * 2;
      gain.gain.setValueAtTime(0.08, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.02, noteTime + beatLength * 1.5);
      
      osc.connect(gain);
      gain.connect(this.musicGain!);
      
      osc.start(noteTime);
      osc.stop(noteTime + beatLength * 2);
      
      this.musicOscillators.push(osc);
    });
    
    // Melody
    melodyNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.value = freq;
      
      const noteTime = now + i * beatLength + 0.05;
      gain.gain.setValueAtTime(0.05, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + beatLength * 0.8);
      
      osc.connect(gain);
      gain.connect(this.musicGain!);
      
      osc.start(noteTime);
      osc.stop(noteTime + beatLength);
      
      this.musicOscillators.push(osc);
    });
    
    // Schedule next loop
    const loopLength = bassNotes.length * beatLength * 2;
    setTimeout(() => {
      if (this.isMusicPlaying && this.isMusicEnabled) {
        this.playMusicLoop(ctx);
      }
    }, loopLength * 1000);
  }

  stopMusic() {
    this.isMusicPlaying = false;
    this.musicOscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {
        // Already stopped
      }
    });
    this.musicOscillators = [];
  }

  // Resume audio context (needed after user interaction)
  async resume() {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }
}

// Singleton instance
export const soundManager = new SoundManager();

