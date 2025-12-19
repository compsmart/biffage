/**
 * SoundManager - Plays sound effects from files with fallback to synthesized sounds
 * 
 * Supports random sound selection from directories for each sound type.
 * Falls back to synthesized sounds if no files are available.
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
  private musicElement: HTMLAudioElement | null = null;
  private musicFiles: string[] = [];
  private isMusicPlaying = false;
  private isEnabled = true;
  private isMusicEnabled = true;
  private musicFadeTimeout: number | null = null;
  
  // Cache of available sound files for each type (discovered dynamically)
  private soundFiles: Map<SoundType, string[]> = new Map();
  // Cache of loaded audio buffers
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  // Currently playing audio sources (for cleanup)
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  // Track which directories we've already scanned
  private scannedDirectories: Set<SoundType> = new Set();
  // Common audio file extensions to try
  private readonly audioExtensions = ['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.webm'];

  constructor() {
    // Audio context will be created on first user interaction
    // Initialize empty arrays for all sound types
    const allTypes: SoundType[] = [
      'click', 'playerJoin', 'countdown', 'countdownFinal', 'gameStart',
      'lieSubmit', 'voteSubmit', 'revealLie', 'revealTruth', 'scoreUp',
      'roundEnd', 'victory', 'tick', 'whoosh', 'pop', 'error'
    ];
    allTypes.forEach(type => {
      this.soundFiles.set(type, []);
    });
    
    // Discover music files
    this.discoverMusicFiles();
  }

  /**
   * Discover available music files
   */
  private async discoverMusicFiles() {
    // Try to load a manifest file first
    try {
      const manifestUrl = '/music/manifest.json';
      const manifestResponse = await fetch(manifestUrl);
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        if (Array.isArray(manifest.files)) {
          this.musicFiles = manifest.files;
          return;
        }
      }
    } catch (e) {
      // No manifest file, continue with discovery
    }

    // Try common file patterns
    const audioExtensions = ['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.webm'];
    const discoveredFiles: string[] = [];

    // Try numbered and common patterns
    const patterns = [
      ...audioExtensions.map(ext => `music${ext}`),
      ...Array.from({ length: 20 }, (_, i) => 
        audioExtensions.map(ext => `music${i + 1}${ext}`)
      ).flat(),
    ];

    // Test each pattern
    const testPromises = patterns.map(async (filename) => {
      const url = `/music/${filename}`;
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          return filename;
        }
      } catch (e) {
        // File doesn't exist
      }
      return null;
    });

    const results = await Promise.all(testPromises);
    discoveredFiles.push(...results.filter((f): f is string => f !== null));

    // Also try to discover files with common names
    const commonNames = ['Farty-McSty'];
    for (const name of commonNames) {
      for (const ext of audioExtensions) {
        const filename = `${name}${ext}`;
        try {
          const response = await fetch(`/music/${filename}`, { method: 'HEAD' });
          if (response.ok && !discoveredFiles.includes(filename)) {
            discoveredFiles.push(filename);
          }
        } catch (e) {
          // File doesn't exist
        }
      }
    }

    this.musicFiles = discoveredFiles;
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

    // Control volume or pause/resume the background track
    if (this.musicElement) {
      if (!enabled) {
        this.musicElement.pause();
      } else if (this.isMusicPlaying) {
        // Resume if music is supposed to be playing
        this.musicElement.play().catch(() => {
          // Ignore play errors (e.g. autoplay restrictions)
        });
      }
    }
  }

  setMasterVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  setMusicVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (this.musicGain) {
      this.musicGain.gain.value = clampedVolume;
    }
    // Also update the HTML audio element directly since it's not connected to the gain node
    if (this.musicElement) {
      this.musicElement.volume = clampedVolume;
    }
  }

  setSfxVolume(volume: number) {
    if (this.sfxGain) {
      this.sfxGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  getMusicVolume(): number {
    return this.musicGain ? this.musicGain.gain.value : 0.3;
  }

  getSfxVolume(): number {
    return this.sfxGain ? this.sfxGain.gain.value : 0.8;
  }

  getMasterVolume(): number {
    return this.masterGain ? this.masterGain.gain.value : 0.7;
  }

  /**
   * Discover sound files in a directory by trying common patterns
   * This is a best-effort approach since we can't list directory contents in the browser
   */
  private async discoverSoundFiles(type: SoundType): Promise<string[]> {
    if (this.scannedDirectories.has(type)) {
      // Already scanned, return cached results
      return this.soundFiles.get(type) || [];
    }

    const discoveredFiles: string[] = [];
    const ctx = this.ensureContext();
    
    // Try to load a manifest file first (if it exists)
    try {
      const manifestUrl = `/sounds/${type}/manifest.json`;
      const manifestResponse = await fetch(manifestUrl);
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        if (Array.isArray(manifest.files)) {
          discoveredFiles.push(...manifest.files);
          this.soundFiles.set(type, discoveredFiles);
          this.scannedDirectories.add(type);
          return discoveredFiles;
        }
      }
    } catch (e) {
      // No manifest file, continue with discovery
    }

    // Try common file patterns
    const patterns = [
      // Common names
      `${type}.mp3`, `${type}.ogg`, `${type}.wav`,
      // Numbered variations
      ...Array.from({ length: 10 }, (_, i) => [
        `${type}${i + 1}.mp3`,
        `${type}${i + 1}.ogg`,
        `${type}${i + 1}.wav`,
        `${type}_${i + 1}.mp3`,
        `${type}_${i + 1}.ogg`,
        `${type}_${i + 1}.wav`,
      ]).flat(),
      // Generic numbered
      ...Array.from({ length: 20 }, (_, i) => [
        `sound${i + 1}.mp3`,
        `sound${i + 1}.ogg`,
        `sound${i + 1}.wav`,
      ]).flat(),
    ];

    // Test each pattern by attempting to fetch it
    const testPromises = patterns.map(async (filename) => {
      const url = `/sounds/${type}/${filename}`;
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          return filename;
        }
      } catch (e) {
        // File doesn't exist or can't be accessed
      }
      return null;
    });

    const results = await Promise.all(testPromises);
    discoveredFiles.push(...results.filter((f): f is string => f !== null));

    // Cache the results
    this.soundFiles.set(type, discoveredFiles);
    this.scannedDirectories.add(type);

    return discoveredFiles;
  }

  /**
   * Load an audio file and return its buffer
   */
  private async loadAudioFile(type: SoundType, filename: string): Promise<AudioBuffer | null> {
    const cacheKey = `${type}/${filename}`;
    
    // Return cached buffer if available
    if (this.audioBuffers.has(cacheKey)) {
      return this.audioBuffers.get(cacheKey)!;
    }

    const ctx = this.ensureContext();
    const url = `/sounds/${type}/${filename}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      
      // Cache the buffer
      this.audioBuffers.set(cacheKey, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.warn(`Failed to load sound file: ${url}`, error);
      return null;
    }
  }

  /**
   * Play a sound file from the given buffer
   */
  private playAudioBuffer(buffer: AudioBuffer) {
    const ctx = this.ensureContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    gain.connect(this.sfxGain!);
    
    source.connect(gain);
    
    // Track active sources for cleanup
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
    };
    
    source.start(0);
  }

  /**
   * Play a random sound file for the given type, or fall back to synthesized sound
   */
  private async playSoundFile(type: SoundType): Promise<boolean> {
    // Discover files if we haven't scanned this directory yet
    let files = this.soundFiles.get(type) || [];
    if (!this.scannedDirectories.has(type)) {
      files = await this.discoverSoundFiles(type);
    }
    
    if (files.length === 0) {
      // No files available, use synthesized sound
      return false;
    }

    // Pick a random file
    const randomFile = files[Math.floor(Math.random() * files.length)];
    
    // Try to load and play the file
    try {
      const buffer = await this.loadAudioFile(type, randomFile);
      if (buffer) {
        this.playAudioBuffer(buffer);
        console.log(`[Sound] Played file: ${type}/${randomFile}`);
        return true;
      }
    } catch (error) {
      console.warn(`Failed to play sound file: ${type}/${randomFile}`, error);
    }
    
    // File failed to load, fall back to synthesized
    return false;
  }

  // Play a sound effect (file or synthesized)
  play(type: SoundType) {
    if (!this.isEnabled) {
      console.log(`[Sound] Skipped (disabled): ${type}`);
      return;
    }
    
    console.log(`[Sound] Playing: ${type}`);
    
    // Try to play a sound file first (async, fire-and-forget)
    this.playSoundFile(type).then(played => {
      // If no file was played, fall back to synthesized sound
      if (!played) {
        console.log(`[Sound] Using synthesized: ${type}`);
        this.playSynthesizedSound(type);
      }
    }).catch(() => {
      // Error occurred, fall back to synthesized sound
      console.log(`[Sound] Error, using synthesized: ${type}`);
      this.playSynthesizedSound(type);
    });
  }

  // Play synthesized sound (fallback)
  private playSynthesizedSound(type: SoundType) {
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

  // Background music
  startMusic() {
    if (!this.isMusicEnabled || this.isMusicPlaying) {
      console.log(`[Sound] Music start skipped (enabled=${this.isMusicEnabled}, playing=${this.isMusicPlaying})`);
      return;
    }

    // Discover music files if not already done
    if (this.musicFiles.length === 0) {
      this.discoverMusicFiles();
    }

    // Select a random music file
    let musicFile: string;
    if (this.musicFiles.length > 0) {
      musicFile = this.musicFiles[Math.floor(Math.random() * this.musicFiles.length)];
    } else {
      // Fallback to default if no files found
      musicFile = 'Quirky-Puzzle-Game-Menu.ogg';
    }

    // Create or update the audio element
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement = null;
    }

    this.musicElement = new Audio(`/music/${musicFile}`);
    this.musicElement.loop = true;
    // Use the current music volume setting
    this.musicElement.volume = this.musicGain ? this.musicGain.gain.value : 0.3;

    this.isMusicPlaying = true;

    console.log(`[Sound] Starting music: ${musicFile}`);
    this.musicElement.currentTime = 0;
    this.musicElement.play().catch((err) => {
      console.log(`[Sound] Music autoplay blocked: ${err.message}`);
    });
  }

  /**
   * Fade out music over the specified duration (in seconds)
   */
  fadeOutMusic(duration: number = 2.0) {
    console.log(`[Sound] Fading out music over ${duration}s`);
    if (!this.musicElement || !this.isMusicPlaying) {
      this.stopMusic();
      return;
    }

    // Clear any existing fade timeout
    if (this.musicFadeTimeout !== null) {
      clearTimeout(this.musicFadeTimeout);
    }

    const startVolume = this.musicElement.volume;
    const fadeSteps = 20;
    const stepDuration = (duration * 1000) / fadeSteps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      currentStep++;
      const newVolume = startVolume * (1 - currentStep / fadeSteps);
      
      if (this.musicElement) {
        this.musicElement.volume = Math.max(0, newVolume);
      }

      if (currentStep >= fadeSteps) {
        clearInterval(fadeInterval);
        this.stopMusic();
      }
    }, stepDuration);

    // Store timeout ID for cleanup
    this.musicFadeTimeout = window.setTimeout(() => {
      clearInterval(fadeInterval);
    }, duration * 1000);
  }

  stopMusic() {
    console.log('[Sound] Stopping music');
    this.isMusicPlaying = false;

    // Clear any fade timeout
    if (this.musicFadeTimeout !== null) {
      clearTimeout(this.musicFadeTimeout);
      this.musicFadeTimeout = null;
    }

    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.currentTime = 0;
      this.musicElement.volume = 0.3; // Reset volume for next play
    }
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
