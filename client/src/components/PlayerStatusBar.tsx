import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Player {
  id: string;
  name: string;
  score: number;
  hasLied?: boolean;
  hasVoted?: boolean;
}

interface PlayerStatusBarProps {
  players: Player[];
  phase: 'lie' | 'vote' | 'lobby' | 'reveal';
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const avatarColors = [
  'bg-[#ffe66d]',
  'bg-[#ff6eb4]',
  'bg-[#38bdf8]',
  'bg-[#4ade80]',
  'bg-[#a855f7]',
  'bg-[#ff6b35]',
];

const getAvatarColor = (name: string) => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
};

const waitingEmojis = ['🤔', '💭', '✍️', '🧠', '💡', '😏'];

export const PlayerStatusBar: React.FC<PlayerStatusBarProps> = ({ 
  players, 
  phase 
}) => {
  const isSubmitted = (player: Player) => {
    if (phase === 'lie') return player.hasLied;
    if (phase === 'vote') return player.hasVoted;
    return false;
  };

  return (
    <motion.div 
      className="w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <motion.div 
        className="text-center text-lg text-white/70 font-fun mb-4 flex items-center justify-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <span>👥</span>
        <span>Players</span>
        <span>👥</span>
      </motion.div>
      
      <div className="flex justify-center gap-6 flex-wrap">
        <AnimatePresence>
          {players.map((player, index) => {
            const submitted = isSubmitted(player);
            
            return (
              <motion.div
                key={player.id}
                className="flex flex-col items-center gap-2"
                initial={{ opacity: 0, scale: 0, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ 
                  delay: 0.1 * index,
                  type: 'spring',
                  stiffness: 300,
                  damping: 15
                }}
              >
                {/* Avatar */}
                <motion.div
                  className={`
                    avatar-cartoon ${getAvatarColor(player.name)}
                    ${submitted ? 'submitted' : (phase !== 'lobby' && phase !== 'reveal') ? 'waiting' : ''}
                  `}
                  animate={submitted ? {
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0]
                  } : {}}
                  transition={{ duration: 0.4 }}
                >
                  {getInitials(player.name)}
                  
                  {/* Checkmark badge for submitted */}
                  <AnimatePresence>
                    {submitted && (
                      <motion.div
                        className="avatar-check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <span className="text-white text-xs">✓</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                
                {/* Name */}
                <span className="text-sm font-fun text-white max-w-[80px] truncate">
                  {player.name}
                </span>
                
                {/* Status indicator */}
                {phase !== 'lobby' && phase !== 'reveal' && (
                  <motion.div
                    className="flex items-center gap-1"
                    animate={!submitted ? { y: [0, -3, 0] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    {submitted ? (
                      <span className="text-[#4ade80] text-xs font-fun">Done! ✨</span>
                    ) : (
                      <span className="text-white/50 text-xs font-fun">
                        {waitingEmojis[index % waitingEmojis.length]} Thinking...
                      </span>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
