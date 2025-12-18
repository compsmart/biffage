import { useCallback, useEffect, useRef } from 'react';
import { soundManager } from '../lib/SoundManager';
import type { SoundType } from '../lib/SoundManager';

/**
 * Hook for using game sounds
 * 
 * Provides easy access to play sound effects and control music.
 * Automatically handles audio context resumption on user interaction.
 */
export function useSounds() {
  const hasResumed = useRef(false);

  // Resume audio context on mount (will actually happen on first user interaction)
  const resumeAudio = useCallback(async () => {
    if (!hasResumed.current) {
      await soundManager.resume();
      hasResumed.current = true;
    }
  }, []);

  // Play a sound effect
  const playSound = useCallback((type: SoundType) => {
    resumeAudio(); // Ensure context is active
    soundManager.play(type);
  }, [resumeAudio]);

  // Start background music
  const startMusic = useCallback(() => {
    resumeAudio();
    soundManager.startMusic();
  }, [resumeAudio]);

  // Stop background music
  const stopMusic = useCallback(() => {
    soundManager.stopMusic();
  }, []);

  // Toggle all sound
  const setEnabled = useCallback((enabled: boolean) => {
    soundManager.setEnabled(enabled);
  }, []);

  // Toggle music only
  const setMusicEnabled = useCallback((enabled: boolean) => {
    soundManager.setMusicEnabled(enabled);
  }, []);

  // Set master volume (0-1)
  const setVolume = useCallback((volume: number) => {
    soundManager.setMasterVolume(volume);
  }, []);

  return {
    playSound,
    startMusic,
    stopMusic,
    setEnabled,
    setMusicEnabled,
    setVolume,
    resumeAudio,
  };
}

/**
 * Hook to play a sound when a value changes
 */
export function useSoundOnChange<T>(
  value: T,
  soundType: SoundType,
  options?: {
    skipInitial?: boolean;
    condition?: (prev: T | undefined, current: T) => boolean;
  }
) {
  const { playSound } = useSounds();
  const prevValue = useRef<T | undefined>(undefined);
  const isInitial = useRef(true);

  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      prevValue.current = value;
      if (!options?.skipInitial) {
        return;
      }
      return;
    }

    const shouldPlay = options?.condition
      ? options.condition(prevValue.current, value)
      : prevValue.current !== value;

    if (shouldPlay) {
      playSound(soundType);
    }

    prevValue.current = value;
  }, [value, soundType, playSound, options]);
}

/**
 * Hook for countdown timer sounds
 */
export function useCountdownSounds(
  timeRemaining: number | null,
  isActive: boolean = true
) {
  const { playSound } = useSounds();
  const lastSecond = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || timeRemaining === null) {
      lastSecond.current = null;
      return;
    }

    const currentSecond = Math.ceil(timeRemaining);
    
    if (lastSecond.current !== null && currentSecond !== lastSecond.current && currentSecond > 0) {
      if (currentSecond <= 3) {
        playSound('countdownFinal');
      } else if (currentSecond <= 10) {
        playSound('countdown');
      }
    }

    lastSecond.current = currentSecond;
  }, [timeRemaining, isActive, playSound]);
}

export default useSounds;

