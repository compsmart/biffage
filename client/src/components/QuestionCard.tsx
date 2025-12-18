import React from 'react';
import { motion } from 'framer-motion';

interface QuestionCardProps {
  text: string;
  category?: string;
  round?: string;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ 
  text, 
  category,
  round 
}) => {
  return (
    <motion.div
      className="card-glow p-8 max-w-3xl mx-auto relative"
      initial={{ opacity: 0, y: 50, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ 
        duration: 0.5, 
        type: 'spring',
        stiffness: 200
      }}
    >
      {/* Corner decorations */}
      <div className="absolute -top-4 -left-4 text-3xl animate-bounce">🤔</div>
      <div className="absolute -top-4 -right-4 text-3xl animate-bounce" style={{ animationDelay: '0.2s' }}>❓</div>
      
      {/* Header with round and category */}
      <div className="flex items-center justify-between mb-6">
        {round && (
          <motion.span 
            className="text-sm font-fun text-white/60 uppercase tracking-wider"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {round}
          </motion.span>
        )}
        
        {category && (
          <motion.span 
            className="category-cartoon"
            initial={{ opacity: 0, x: 20, rotate: 5 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            transition={{ delay: 0.3, type: 'spring' }}
          >
            {category}
          </motion.span>
        )}
      </div>
      
      {/* Question text */}
      <motion.h2 
        className="font-fun text-2xl md:text-3xl lg:text-4xl font-bold text-center leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {text}
      </motion.h2>
      
      {/* Fun underline */}
      <motion.div 
        className="mt-6 mx-auto h-2 rounded-full"
        style={{
          background: 'linear-gradient(90deg, #ffe66d, #ff6b35, #ff6eb4, #a855f7, #38bdf8)',
        }}
        initial={{ width: 0 }}
        animate={{ width: '80%' }}
        transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
      />
    </motion.div>
  );
};
