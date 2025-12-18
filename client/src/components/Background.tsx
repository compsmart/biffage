import React from 'react';
import { motion } from 'framer-motion';

export const Background: React.FC = () => {
  return (
    <>
      {/* Base gradient background */}
      <div className="bg-party" />
      
      {/* Floating shapes */}
      <div className="bg-shapes">
        <div className="floating-shape" />
        <div className="floating-shape" />
        <div className="floating-shape" />
      </div>
      
      {/* Floating emojis */}
      {['🎉', '🎮', '🤪', '😂', '🔥', '✨', '💫', '🎯'].map((emoji, i) => (
        <motion.div
          key={i}
          className="fixed text-4xl pointer-events-none opacity-20"
          style={{
            left: `${10 + (i * 12)}%`,
            top: `${20 + ((i * 17) % 60)}%`,
          }}
          animate={{
            y: [0, -30, 0],
            rotate: [0, 10, -10, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 4 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.3,
            ease: 'easeInOut',
          }}
        >
          {emoji}
        </motion.div>
      ))}
    </>
  );
};
