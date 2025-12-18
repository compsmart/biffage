import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { soundManager } from '../lib/SoundManager';

interface CountdownTimerProps {
  size?: 'sm' | 'md' | 'lg';
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ 
  size = 'md' 
}) => {
  const socket = useSocket();
  const [remaining, setRemaining] = useState(30);
  const [total, setTotal] = useState(30);
  const prevRemainingRef = useRef(30);

  useEffect(() => {
    if (!socket) return;

    const handleTimerSync = (data: { remaining: number; total: number }) => {
      setRemaining(data.remaining);
      setTotal(data.total);
    };

    socket.on('timer_sync', handleTimerSync);

    return () => {
      socket.off('timer_sync', handleTimerSync);
    };
  }, [socket]);
  
  // Play countdown sounds
  useEffect(() => {
    if (remaining !== prevRemainingRef.current && remaining > 0 && remaining < prevRemainingRef.current) {
      if (remaining <= 3) {
        soundManager.play('countdownFinal');
      } else if (remaining <= 10) {
        soundManager.play('countdown');
      }
    }
    prevRemainingRef.current = remaining;
  }, [remaining]);

  // Determine state
  const getState = () => {
    if (remaining <= 5) return 'danger';
    if (remaining <= 10) return 'warning';
    return 'normal';
  };

  const state = getState();
  
  const sizeClasses = {
    sm: 'w-16 h-16 text-xl border-4',
    md: 'w-24 h-24 text-3xl border-[6px]',
    lg: 'w-32 h-32 text-5xl border-[8px]',
  };

  return (
    <motion.div 
      className={`timer-cartoon ${state === 'warning' ? 'timer-warning' : ''} ${state === 'danger' ? 'timer-danger' : ''}`}
      animate={state === 'danger' ? { rotate: [-3, 3, -3] } : {}}
      transition={{ duration: 0.2, repeat: state === 'danger' ? Infinity : 0 }}
    >
      <div 
        className={`
          timer-face flex items-center justify-center
          ${sizeClasses[size]}
          ${state === 'warning' ? 'bg-[#ffe66d]' : ''}
          ${state === 'danger' ? 'bg-[#ef4444]' : ''}
        `}
        style={{
          boxShadow: size === 'lg' ? '8px 8px 0 0 #000' : size === 'md' ? '6px 6px 0 0 #000' : '4px 4px 0 0 #000'
        }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={remaining}
            className={`timer-number font-fun font-bold ${state === 'danger' ? 'text-white' : 'text-black'}`}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {remaining}
          </motion.span>
        </AnimatePresence>
      </div>
      
      {/* Emoji indicator */}
      <motion.div 
        className="absolute -top-3 -right-3 text-2xl"
        animate={{ 
          rotate: [0, 15, -15, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        {state === 'danger' ? '😱' : state === 'warning' ? '😰' : '⏰'}
      </motion.div>
    </motion.div>
  );
};
