import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { AudioStreamer } from '../lib/AudioStreamer';
import { useSounds } from '../hooks/useSounds';
import { 
  Background, 
  Button, 
  CountdownTimer, 
  QuestionCard, 
  PlayerStatusBar,
  SettingsMenu
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

interface HostPersona {
  id: string;
  name: string;
  description: string;
  avatarKey: string;
}

interface GameState {
  state: 'LOBBY' | 'ROUND_INTRO' | 'LIE_INPUT' | 'VOTING' | 'REVEAL' | 'MINI_SCOREBOARD' | 'SCOREBOARD';
  players: Player[];
  currentQuestion: {
    text: string;
    category: string;
    spokenText?: string;
    answer?: string;
  } | null;
  lies: Lie[];
  round: string;
  roundNumber: number;
  roundMultiplier: number;
  questionInRound: number;
  isFinalFibbage: boolean;
  currentRevealId: string | null;
  revealedIds: string[];
  votesByLie: Record<string, string[]>;
  votedLieIds: string[];
  autoProgress: boolean;
  hostPersona?: HostPersona | null;
  hostPersonas?: HostPersona[];
}

// Timer Progress Bar - shows countdown as shrinking bar
const TimerProgressBar = () => {
  const socket = useSocket();
  const [progress, setProgress] = useState(100);
  const [remaining, setRemaining] = useState(30);

  useEffect(() => {
    if (!socket) return;

    const handleTimerSync = (data: { remaining: number; total: number }) => {
      setRemaining(data.remaining);
      const pct = (data.remaining / data.total) * 100;
      setProgress(pct);
    };

    socket.on('timer_sync', handleTimerSync);

    return () => {
      socket.off('timer_sync', handleTimerSync);
    };
  }, [socket]);

  // Color based on time remaining
  const getBarColor = () => {
    if (remaining <= 5) return '#ef4444'; // Red
    if (remaining <= 10) return '#ffbe0b'; // Yellow
    return 'linear-gradient(90deg, #ffe66d, #ff6b35, #ff6eb4, #a855f7, #38bdf8)';
  };

  const isLow = remaining <= 10;

  return (
    <div className="w-full max-w-5xl mx-auto mt-8">
      {/* Background track */}
      <div 
        className="h-4 rounded-full overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.1)',
          border: '3px solid #000',
          boxShadow: '3px 3px 0 0 #000',
        }}
      >
        {/* Animated progress bar */}
        <motion.div
          className="h-full rounded-full"
          style={{
            background: getBarColor(),
            boxShadow: isLow ? '0 0 20px rgba(239, 68, 71, 0.8)' : '0 0 10px rgba(255, 230, 109, 0.5)',
          }}
          animate={{ 
            width: `${progress}%`,
            ...(remaining <= 5 ? { x: [-2, 2, -2, 2, 0] } : {})
          }}
          transition={{ 
            width: { duration: 0.5, ease: 'linear' },
            x: { duration: 0.3, repeat: remaining <= 5 ? Infinity : 0 }
          }}
        />
      </div>
    </div>
  );
};

const LoadingScreen = () => (
  <motion.div 
    className="flex flex-col items-center justify-center h-screen"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <Background />
    <motion.div
      className="text-7xl font-fun text-rainbow mb-12"
      animate={{ scale: [1, 1.05, 1], rotate: [-2, 2, -2] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      Connecting...
    </motion.div>
    <div className="loading-cartoon scale-150">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <motion.div 
      className="mt-12 text-6xl"
      animate={{ rotate: [0, 360] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
    >
      🎮
    </motion.div>
  </motion.div>
);

// Round Introduction Screen
const RoundIntroScreen = ({ 
  gameState, 
  onContinue 
}: { 
  gameState: GameState;
  onContinue: () => void;
}) => {
  const roundNumber = gameState.roundNumber;
  const isFinal = gameState.isFinalFibbage;
  
  // Round-specific content
  const getRoundContent = () => {
    if (isFinal) {
      return {
        title: "THE FINAL FIBBAGE",
        subtitle: "One Question. One Chance.",
        emoji: "🏆",
        points: "3000 pts for truth • 1500 pts per fool",
        message: "Everything you've done leads to this moment. Winner takes all!",
        color: '#ffe66d',
        bgGradient: 'from-yellow-500/20 to-orange-500/20'
      };
    }
    
    switch (roundNumber) {
      case 1:
        return {
          title: "ROUND 1",
          subtitle: "Let's Get Started!",
          emoji: "🤥",
          points: "1000 pts for truth • 500 pts per fool",
          message: "Write a convincing lie. Find the real answer!",
          color: '#38bdf8',
          bgGradient: 'from-blue-500/20 to-cyan-500/20'
        };
      case 2:
        return {
          title: "ROUND 2",
          subtitle: "Double Trouble! 2X POINTS",
          emoji: "⚡",
          points: "2000 pts for truth • 1000 pts per fool",
          message: "Stakes are higher! Think carefully!",
          color: '#a855f7',
          bgGradient: 'from-purple-500/20 to-pink-500/20'
        };
      case 3:
        return {
          title: "ROUND 3",
          subtitle: "Triple Threat! 3X POINTS",
          emoji: "🔥",
          points: "3000 pts for truth • 1500 pts per fool",
          message: "This is where legends are made!",
          color: '#ff6b35',
          bgGradient: 'from-orange-500/20 to-red-500/20'
        };
      default:
        return {
          title: `ROUND ${roundNumber}`,
          subtitle: "",
          emoji: "🎯",
          points: "",
          message: "",
          color: '#ffe66d',
          bgGradient: 'from-yellow-500/20 to-orange-500/20'
        };
    }
  };
  
  const content = getRoundContent();
  
  return (
    <motion.div 
      className="flex flex-col items-center justify-center h-screen p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      {/* Background glow */}
      <motion.div
        className={`absolute inset-0 bg-gradient-to-br ${content.bgGradient} opacity-50`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
      />
      
      {/* Main content */}
      <motion.div 
        className="text-center relative z-10"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        {/* Big emoji */}
        <motion.div
          className="text-9xl mb-8"
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [-5, 5, -5]
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {content.emoji}
        </motion.div>
        
        {/* Title */}
        <motion.h1
          className="font-fun font-black mb-4"
          style={{
            fontSize: 'clamp(3rem, 12vw, 8rem)',
            color: content.color,
            textShadow: '6px 6px 0 #000, 12px 12px 0 rgba(0,0,0,0.3)',
          }}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {content.title}
        </motion.h1>
        
        {/* Subtitle */}
        {content.subtitle && (
          <motion.h2
            className="text-4xl font-fun text-white mb-6"
            style={{ textShadow: '3px 3px 0 #000' }}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {content.subtitle}
          </motion.h2>
        )}
        
        {/* Points info */}
        <motion.div
          className="card-cartoon inline-block px-8 py-4 mb-8"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6, type: 'spring' }}
        >
          <span className="text-2xl font-fun" style={{ color: content.color }}>
            {content.points}
          </span>
        </motion.div>
        
        {/* Message */}
        <motion.p
          className="text-2xl font-fun text-white/80 max-w-2xl mx-auto mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {content.message}
        </motion.p>
        
        {/* Continue button */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <button 
            onClick={onContinue}
            className="btn-cartoon btn-green text-3xl py-6 px-12"
          >
            🎯 Let's Go! 🎯
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

// Mini Scoreboard (after each question)
const MiniScoreboardScreen = ({ 
  gameState, 
  onContinue 
}: { 
  gameState: GameState;
  onContinue: () => void;
}) => {
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
  const medals = ['🥇', '🥈', '🥉'];
  
  return (
    <motion.div 
      className="flex flex-col items-center justify-center h-screen p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <motion.div
        className="text-center mb-8"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <motion.div
          className="mb-4 flex justify-center items-center"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <img src="/images/score.png" alt="Scoreboard" className="w-50 h-50" />
        </motion.div>
        <h2 
          className="text-5xl font-fun"
          style={{ color: '#38bdf8', textShadow: '4px 4px 0 #000' }}
        >
          Score Check!
        </h2>
        <p className="text-xl font-fun text-white/60 mt-2">
          Question {gameState.questionInRound} of 3 • {gameState.round}
        </p>
      </motion.div>

      {/* Leaderboard */}
      <div className="card-cartoon p-8 w-full max-w-2xl mb-8">
        <div className="space-y-4">
          {sortedPlayers.slice(0, 5).map((player, index) => (
            <motion.div
              key={player.id}
              className={`
                flex justify-between items-center p-4 rounded-xl border-4 border-black
                ${index === 0 ? 'bg-[#ffe66d]' : index === 1 ? 'bg-[#c0c0c0]' : index === 2 ? 'bg-[#cd7f32]' : 'bg-white/10'}
              `}
              style={{ 
                boxShadow: '3px 3px 0 0 #000',
                color: index < 3 ? '#000' : '#fff'
              }}
              initial={{ x: index % 2 === 0 ? -100 : 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1, type: 'spring' }}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">
                  {medals[index] || `#${index + 1}`}
                </span>
                <span className="font-fun text-xl font-bold">{player.name}</span>
              </div>
              <motion.span 
                className="score-cartoon"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1, type: 'spring' }}
              >
                ⭐ {player.score.toLocaleString()}
              </motion.span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Continue button */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <button 
          onClick={onContinue}
          className="btn-cartoon btn-blue text-2xl py-5 px-10"
        >
          ➡️ Next Question ➡️
        </button>
      </motion.div>
    </motion.div>
  );
};

const LobbyScreen = ({ 
  players, 
  hostPersona,
  onStart,
  onChangeHost
}: { 
  players: Player[]; 
  hostPersona?: HostPersona | null;
  onStart: () => void;
  onChangeHost: () => void;
}) => (
  <motion.div 
    className="flex flex-col items-center h-screen p-6 pt-4 gap-10 overflow-y-auto"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
  >
    {/* Header decoration */}
    <motion.div 
      className="flex-shrink-0 mb-4"
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, type: 'spring' }}
    >
      <motion.img 
        src="/images/biffage-white-inline.png" 
        alt="Biffage" 
        className="max-w-sm w-full h-auto logo-glow"
        animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
      />
    </motion.div>

    {/* Waiting for players */}
    <motion.div 
      className="card-cartoon p-6 text-center w-full max-w-3xl flex-shrink-0 mb-4"
      initial={{ y: 30, opacity: 0, rotate: -2 }}
      animate={{ y: 0, opacity: 1, rotate: 0 }}
      transition={{ delay: 0.2, type: 'spring' }}
    >
      {players.length === 0 ? (
        <motion.div className="space-y-4">
          <motion.div
            className="text-6xl"
            animate={{ scale: [1, 1.2, 1], rotate: [-10, 10, -10] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            👀
          </motion.div>
          <div className="text-2xl font-fun text-white/70">
            Waiting for players to join...
          </div>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <div className="text-2xl font-fun text-white flex items-center justify-center gap-2">
            <span className="text-3xl">🎮</span>
            <span>{players.length} Player{players.length !== 1 ? 's' : ''} Ready!</span>
            <span className="text-3xl">🎮</span>
          </div>
          
          <div className="flex justify-center gap-4 flex-wrap">
            <AnimatePresence>
              {players.map((player, index) => (
                <motion.div
                  key={player.id}
                  className="speech-bubble text-lg font-fun px-5 py-2"
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 10 }}
                  transition={{ delay: index * 0.1, type: 'spring' }}
                  whileHover={{ scale: 1.05, rotate: 3 }}
                >
                  {player.name}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>

    {/* Host persona panel */}
    <motion.div
      className="card-cartoon p-4 w-full max-w-3xl flex items-center justify-between gap-4 flex-shrink-0 mb-4"
      initial={{ opacity: 0, y: 20, rotate: 1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay: 0.3, type: 'spring' }}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="relative w-16 h-16 rounded-full overflow-hidden border-3 border-black bg-white flex items-center justify-center flex-shrink-0">
          {hostPersona ? (
            <img
              src={`/images/personas/${hostPersona.avatarKey}.png`}
              alt={hostPersona.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl">🎙️</span>
          )}
        </div>
        <div className="text-left min-w-0 flex-1">
          <div className="text-xs font-fun text-white/60 uppercase tracking-wider">
            Your Host
          </div>
          <div className="text-xl font-fun text-[#ffe66d]">
            {hostPersona ? hostPersona.name : 'Mystery MC'}
          </div>
          {hostPersona && (
            <div className="text-sm font-fun text-white/70">
              {hostPersona.description}
            </div>
          )}
        </div>
      </div>
      <motion.button
        className="btn-cartoon btn-pink text-base px-5 py-2.5 whitespace-nowrap flex-shrink-0"
        onClick={onChangeHost}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        🎭 Change Host
      </motion.button>
    </motion.div>

    {/* Start Button - only show when at least 2 players have joined */}
    <AnimatePresence>
      {players.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.4, type: 'spring' }}
          className="starburst flex-shrink-0"
        >
          <button 
            onClick={onStart}
            className="btn-cartoon btn-green text-2xl py-4 px-8"
          >
            🚀 Start Game! 🚀
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

const QuestionScreen = ({ 
  gameState, 
  showTimer = true 
}: { 
  gameState: GameState; 
  showTimer?: boolean;
}) => (
  <motion.div 
    className="flex flex-col items-center justify-between h-screen p-8 py-12"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {/* Top section: Timer */}
    {showTimer && (
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: 0.2, type: 'spring' }}
        className="flex-shrink-0"
      >
        <CountdownTimer size="lg" />
      </motion.div>
    )}
    
    {/* Middle section: Question Card - takes up most space */}
    <div className="flex-1 flex items-center justify-center w-full py-4">
      {gameState.currentQuestion && (
        <motion.div
          className="card-glow p-8 w-full max-w-5xl relative"
          initial={{ opacity: 0, y: 50, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
        >
          {/* Corner decorations */}
          <div className="absolute -top-5 -left-5 text-4xl animate-bounce">🤔</div>
          <div className="absolute -top-5 -right-5 text-4xl animate-bounce" style={{ animationDelay: '0.2s' }}>❓</div>
          
          {/* Header with round and category */}
          <div className="flex items-center justify-between mb-4">
            {gameState.round && (
              <span className="text-lg font-fun text-white/60 uppercase tracking-wider">
                {gameState.round}
              </span>
            )}
            
            {gameState.currentQuestion.category && (
              <span className="category-cartoon text-base px-4 py-1.5">
                {gameState.currentQuestion.category}
              </span>
            )}
          </div>
          
          {/* Question text - sized to fit longer questions */}
          <h2 
            className="font-fun font-bold text-center leading-snug"
            style={{ fontSize: 'clamp(1.25rem, 2.5vw, 2rem)' }}
          >
            {gameState.currentQuestion.text}
          </h2>
          
          {/* Timer Progress Bar */}
          <TimerProgressBar />
        </motion.div>
      )}
    </div>
    
    {/* Bottom section: Player Status */}
    <div className="flex-shrink-0 w-full">
      <PlayerStatusBar 
        players={gameState.players}
        phase={gameState.state === 'LIE_INPUT' ? 'lie' : 'vote'}
      />
      
      {/* Status Message */}
      <motion.div
        className="text-2xl font-fun text-white/70 mt-6 flex items-center justify-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <motion.span
          className="text-3xl"
          animate={{ rotate: [0, 20, -20, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          ✏️
        </motion.span>
        {gameState.state === 'LIE_INPUT' 
          ? 'Players are writing their lies...' 
          : 'Players are picking answers...'}
        <motion.span
          className="text-3xl"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          {gameState.state === 'LIE_INPUT' ? '🤥' : '🎯'}
        </motion.span>
      </motion.div>
    </div>
  </motion.div>
);

const VotingScreen = ({ gameState }: { gameState: GameState }) => (
  <motion.div 
    className="flex flex-col h-screen p-8 py-10"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {/* Top: Timer and Question */}
    <div className="flex-shrink-0 text-center mb-6">
      <div className="flex justify-center mb-4">
        <CountdownTimer size="md" />
      </div>

      {gameState.currentQuestion && (
        <motion.div
          className="text-2xl font-fun max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {gameState.currentQuestion.text}
        </motion.div>
      )}

      <motion.div 
        className="text-2xl font-fun mt-4 flex items-center justify-center gap-3"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <span className="text-3xl">🎯</span>
        <span className="text-[#ffe66d]">Which one is the TRUTH?</span>
        <span className="text-3xl">🎯</span>
      </motion.div>
    </div>

    {/* Middle: Answer Options - fills available space */}
    <div className="flex-1 flex items-center justify-center">
      <motion.div 
        className="grid grid-cols-2 gap-6 w-full max-w-6xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {gameState.lies.map((lie, index) => (
          <motion.div
            key={lie.id}
            className="answer-cartoon text-2xl font-fun lowercase text-center py-8 px-6"
            initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50, rotate: index % 2 === 0 ? -5 : 5 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            transition={{ delay: 0.1 * index, type: 'spring' }}
          >
            {lie.text}
          </motion.div>
        ))}
      </motion.div>
    </div>

    {/* Bottom: Player Status */}
    <div className="flex-shrink-0">
      <PlayerStatusBar 
        players={gameState.players}
        phase="vote"
      />
    </div>
  </motion.div>
);

// Generate consistent random positions for scattered answers
const getScatteredPosition = (index: number, total: number) => {
  // Spread answers across 2-3 rows with slight randomness
  const cols = Math.min(4, total);
  const row = Math.floor(index / cols);
  const col = index % cols;
  
  // Base positions with some variation
  const baseX = (col - (cols - 1) / 2) * 220;
  const baseY = (row - 0.5) * 140;
  
  // Add deterministic "randomness" based on index
  const seedX = Math.sin(index * 7.3) * 30;
  const seedY = Math.cos(index * 4.7) * 20;
  const seedRotate = Math.sin(index * 3.1) * 8;
  
  return {
    x: baseX + seedX,
    y: baseY + seedY,
    rotate: seedRotate,
  };
};

const RevealScreen = ({ 
  gameState, 
  onNext,
  playSound
}: { 
  gameState: GameState; 
  onNext: () => void;
  playSound: (type: string) => void;
}) => {
  const [showVotersForId, setShowVotersForId] = useState<string | null>(null);
  const [showPointsForId, setShowPointsForId] = useState<string | null>(null);
  const prevRevealIdRef = useRef<string | null>(null);
  
  // Check if all lies that got votes + truth have been revealed
  const votedLiesCount = gameState.votedLieIds?.length || 0;
  const allRevealed = gameState.revealedIds.length >= votedLiesCount + 1; // +1 for truth
  
  // Handle reveal phase transitions based on currentRevealId changes
  useEffect(() => {
    if (gameState.currentRevealId && gameState.currentRevealId !== prevRevealIdRef.current) {
      const newLie = gameState.lies.find(l => l.id === gameState.currentRevealId);
      
      // Play focus sound
      if (newLie?.isTruth) {
        playSound('drumroll');
        setTimeout(() => playSound('truthReveal'), 1200);
      } else {
        playSound('answerFocus');
      }
      
      setShowVotersForId(null);
      setShowPointsForId(null);
      
      // After focus animation, show voters
      const voterDelay = newLie?.isTruth ? 2000 : 800;
      setTimeout(() => {
        setShowVotersForId(gameState.currentRevealId);
        if (newLie?.isTruth) {
          playSound('correctPlayers');
        } else {
          playSound('playersFooled');
        }
        
        // If it's a player lie, show points after voters
        if (!newLie?.isTruth && newLie?.author && newLie.author !== 'House AI') {
          setTimeout(() => {
            setShowPointsForId(gameState.currentRevealId);
            playSound('pointsAwarded');
          }, 1000);
        }
      }, voterDelay);
      
      prevRevealIdRef.current = gameState.currentRevealId;
    }
  }, [gameState.currentRevealId, gameState.lies, playSound]);
  
  // Get voters for the current reveal
  const getVotersForLie = (lieId: string) => {
    return gameState.votesByLie?.[lieId] || [];
  };
  
  // Get players who got the truth right
  const getTruthVoters = () => {
    return gameState.votesByLie?.['truth'] || [];
  };
  
  return (
    <motion.div 
      className="flex flex-col h-screen p-8 py-10 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Top: Header */}
      <div className="flex-shrink-0 text-center mb-4">
        <motion.div 
          className="text-3xl font-fun mb-3 flex items-center justify-center gap-4"
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-4xl">🔍</span>
          <span className="text-rainbow">Time for the Truth!</span>
          <span className="text-4xl">🔍</span>
        </motion.div>

        {gameState.currentQuestion && (
          <motion.div
            className="text-lg font-fun text-white/70 max-w-4xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {gameState.currentQuestion.text}
          </motion.div>
        )}
      </div>

      {/* Middle: Answer Reveals - Scattered Layout with Spotlight */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Dimming overlay when focusing */}
        <AnimatePresence>
          {gameState.currentRevealId && (
            <motion.div
              className="absolute inset-0 bg-black/60 z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>
        
        {/* Scattered answers container */}
        <div className="relative w-full max-w-6xl h-[400px] flex items-center justify-center">
          {gameState.lies.map((lie, index) => {
            const isRevealed = gameState.revealedIds.includes(lie.id);
            const isCurrent = gameState.currentRevealId === lie.id;
            const wasVoted = gameState.votedLieIds?.includes(lie.id) || lie.isTruth;
            const scatteredPos = getScatteredPosition(index, gameState.lies.length);
            const voters = getVotersForLie(lie.id);
            const truthVoters = lie.isTruth ? getTruthVoters() : [];
            const showingVoters = showVotersForId === lie.id;
            const showingPoints = showPointsForId === lie.id;
            
            // Skip rendering lies that weren't voted for (except truth)
            if (!wasVoted && !lie.isTruth) {
              return null;
            }
            
            return (
              <motion.div
                key={lie.id}
                className={`
                  absolute font-fun lowercase
                  ${isCurrent ? 'z-30' : isRevealed ? 'z-5' : 'z-20'}
                `}
                initial={{ 
                  opacity: 0, 
                  scale: 0.5,
                  x: scatteredPos.x,
                  y: scatteredPos.y,
                  rotate: scatteredPos.rotate,
                }}
                animate={{ 
                  opacity: isCurrent ? 1 : (gameState.currentRevealId && !isRevealed ? 0.3 : 1),
                  scale: isCurrent ? (lie.isTruth ? 1.4 : 1.2) : (isRevealed ? 0.7 : 0.85),
                  x: isCurrent ? 0 : scatteredPos.x,
                  y: isCurrent ? 0 : (isRevealed ? scatteredPos.y + 50 : scatteredPos.y),
                  rotate: isCurrent ? 0 : scatteredPos.rotate,
                }}
                transition={{ 
                  type: 'spring',
                  stiffness: 200,
                  damping: 20,
                  duration: 0.5
                }}
              >
                {/* Answer card */}
                <motion.div
                  className={`
                    answer-cartoon py-6 px-8 min-w-[200px] max-w-[500px]
                    ${isRevealed ? (lie.isTruth ? 'truth' : 'lie') : ''}
                    ${isCurrent && lie.isTruth ? 'ring-4 ring-yellow-400 ring-opacity-75' : ''}
                  `}
                  animate={isCurrent ? {
                    boxShadow: lie.isTruth 
                      ? ['0 0 20px rgba(255,215,0,0.5)', '0 0 60px rgba(255,215,0,0.8)', '0 0 20px rgba(255,215,0,0.5)']
                      : ['0 0 10px rgba(0,0,0,0.3)', '0 0 30px rgba(255,100,100,0.5)', '0 0 10px rgba(0,0,0,0.3)']
                  } : {}}
                  transition={{ duration: 1, repeat: isCurrent ? Infinity : 0 }}
                >
                  <div className={`font-bold text-center ${isCurrent ? 'text-3xl' : 'text-xl'}`}>
                    {lie.text}
                  </div>
                  
                  {/* Revealed info */}
                  <AnimatePresence>
                    {isRevealed && (
                      <motion.div
                        className="mt-3 text-center normal-case font-fun"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {lie.isTruth ? (
                          <motion.div
                            className="flex flex-col items-center gap-2"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                          >
                            <span className="flex items-center justify-center gap-2 text-xl">
                              <span className="text-3xl">✅</span>
                              <span className="text-black font-bold text-2xl">THE TRUTH!</span>
                              <span className="text-3xl">✅</span>
                            </span>
                          </motion.div>
                        ) : (
                          <span className="text-black text-lg">
                            🤥 Lie by: <span className="font-bold">{lie.author}</span>
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                
                {/* Voters reveal panel - shows below the card */}
                <AnimatePresence>
                  {isCurrent && showingVoters && (
                    <motion.div
                      className="absolute top-full left-1/2 mt-4 -translate-x-1/2 w-max"
                      initial={{ opacity: 0, y: -20, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <div className="card-cartoon bg-white/95 px-6 py-4 text-center">
                        {lie.isTruth ? (
                          <>
                            {truthVoters.length > 0 ? (
                              <>
                                <div className="text-lg font-fun text-green-700 mb-2">
                                  🎉 Got it right! 🎉
                                </div>
                                <div className="flex flex-wrap gap-2 justify-center">
                                  {truthVoters.map((name, i) => (
                                    <motion.span
                                      key={name}
                                      className="bg-green-500 text-white px-3 py-1 rounded-full font-fun text-lg"
                                      initial={{ opacity: 0, scale: 0 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ delay: i * 0.1, type: 'spring' }}
                                    >
                                      {name} +{1000 * gameState.roundMultiplier}
                                    </motion.span>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <div className="text-lg font-fun text-gray-600">
                                😱 Nobody found the truth!
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {voters.length > 0 ? (
                              <>
                                <div className="text-lg font-fun text-red-700 mb-2">
                                  😈 Fooled these players:
                                </div>
                                <div className="flex flex-wrap gap-2 justify-center">
                                  {voters.map((name, i) => (
                                    <motion.span
                                      key={name}
                                      className="bg-red-500 text-white px-3 py-1 rounded-full font-fun text-lg"
                                      initial={{ opacity: 0, scale: 0 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ delay: i * 0.1, type: 'spring' }}
                                    >
                                      {name}
                                    </motion.span>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <div className="text-lg font-fun text-gray-600">
                                Nobody fell for this one
                              </div>
                            )}
                          </>
                        )}
                        
                        {/* Points awarded to lie author */}
                        <AnimatePresence>
                          {showingPoints && !lie.isTruth && lie.author !== 'House AI' && voters.length > 0 && (
                            <motion.div
                              className="mt-3 pt-3 border-t-2 border-gray-200"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0 }}
                            >
                              <div className="text-lg font-fun text-purple-700">
                                💰 <span className="font-bold">{lie.author}</span> earns{' '}
                                <span className="text-xl font-bold text-green-600">
                                  +{voters.length * 500 * gameState.roundMultiplier}
                                </span>{' '}
                                points!
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Sparkle effect for truth */}
                {isCurrent && lie.isTruth && (
                  <>
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute text-2xl pointer-events-none"
                        style={{
                          left: '50%',
                          top: '50%',
                        }}
                        animate={{
                          x: [0, Math.cos(i * Math.PI / 4) * 120],
                          y: [0, Math.sin(i * Math.PI / 4) * 120],
                          opacity: [1, 0],
                          scale: [0.5, 1.5],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.15,
                        }}
                      >
                        ✨
                      </motion.div>
                    ))}
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom: Next Button */}
      <div className="flex-shrink-0 flex justify-center mt-4">
        <AnimatePresence>
          {allRevealed && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring' }}
            >
              <button onClick={onNext} className="btn-cartoon btn-blue text-2xl py-5 px-10">
                ➡️ Continue ➡️
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const ScoreboardScreen = ({ 
  gameState, 
  onNext 
}: { 
  gameState: GameState; 
  onNext: () => void;
}) => {
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
  const medals = ['🥇', '🥈', '🥉'];
  
  return (
    <motion.div 
      className="flex flex-col items-center justify-center h-screen p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-6xl font-fun text-pop mb-4"
        initial={{ y: -50, opacity: 0, rotate: -5 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring' }}
      >
        🏆 Scoreboard 🏆
      </motion.div>
      
      <motion.div
        className="text-5xl mb-10"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        🎉🎊🥳
      </motion.div>

      <div className="card-cartoon p-10 w-full max-w-3xl mb-10">
        <div className="space-y-5">
          {sortedPlayers.map((player, index) => (
            <motion.div
              key={player.id}
              className={`
                flex justify-between items-center p-5 rounded-xl border-4 border-black
                ${index === 0 ? 'bg-[#ffe66d]' : index === 1 ? 'bg-[#c0c0c0]' : index === 2 ? 'bg-[#cd7f32]' : 'bg-white/10'}
              `}
              style={{ 
                boxShadow: '4px 4px 0 0 #000',
                color: index < 3 ? '#000' : '#fff'
              }}
              initial={{ x: -100, opacity: 0, rotate: -5 }}
              animate={{ x: 0, opacity: 1, rotate: 0 }}
              transition={{ delay: index * 0.15, type: 'spring' }}
            >
              <div className="flex items-center gap-5">
                <span className="text-4xl">
                  {medals[index] || `${index + 1}.`}
                </span>
                <span className="font-fun text-2xl font-bold">{player.name}</span>
              </div>
              <motion.div 
                className="score-cartoon text-xl px-5 py-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1, type: 'spring' }}
              >
                ⭐ {player.score.toLocaleString()}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <button onClick={onNext} className="btn-cartoon btn-pink text-2xl py-5 px-10">
          🎮 Next Round! 🎮
        </button>
      </motion.div>
    </motion.div>
  );
};

// Welcome Modal - shown on first load to explain game and enable audio
const WelcomeModal = ({
  roomCode,
  onContinue
}: {
  roomCode: string;
  onContinue: () => void;
}) => (
  <motion.div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-2 sm:p-4"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.div
      className="card-cartoon p-3 sm:p-4 md:p-5 lg:p-6 max-w-xl w-full max-h-[95vh] overflow-y-auto text-center relative"
      initial={{ scale: 0.8, opacity: 0, y: 50 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: 50 }}
      transition={{ type: 'spring', damping: 20 }}
    >

      {/* Logo */}
      <motion.img
        src="/images/biffage-logo2.png"
        alt="Biffage"
        className="max-w-[140px] sm:max-w-[180px] md:max-w-[220px] lg:max-w-[240px] w-full h-auto mx-auto mb-2 sm:mb-3 md:mb-4 logo-glow"
        animate={{ rotate: [-2, 2, -2] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Title */}
      <h2
        className="text-lg sm:text-xl md:text-2xl font-fun font-bold mb-2 sm:mb-3 md:mb-4"
        style={{ color: '#ffe66d', textShadow: '3px 3px 0 #000' }}
      >
        Welcome to the Party! 🥳
      </h2>

      {/* How to play */}
      <div className="space-y-1.5 sm:space-y-2 md:space-y-2.5 mb-2 sm:mb-3 md:mb-4">
        <div className="flex items-center gap-2 sm:gap-3 text-left bg-white/10 rounded-xl p-1.5 sm:p-2 md:p-2.5 lg:p-3">
          <span className="text-lg sm:text-xl md:text-2xl flex-shrink-0">🤔</span>
          <p className="font-fun text-white text-xs sm:text-sm md:text-base">Read the question and write a <span className="text-[#ff6eb4] font-bold">convincing lie</span></p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-left bg-white/10 rounded-xl p-1.5 sm:p-2 md:p-2.5 lg:p-3">
          <span className="text-lg sm:text-xl md:text-2xl flex-shrink-0">🎯</span>
          <p className="font-fun text-white text-xs sm:text-sm md:text-base">Vote for what you think is the <span className="text-[#4ade80] font-bold">real answer</span></p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-left bg-white/10 rounded-xl p-1.5 sm:p-2 md:p-2.5 lg:p-3">
          <span className="text-lg sm:text-xl md:text-2xl flex-shrink-0">😈</span>
          <p className="font-fun text-white text-xs sm:text-sm md:text-base">Fool others with your lie to earn <span className="text-[#ffe66d] font-bold">bonus points</span>!</p>
        </div>
      </div>

      {/* Join instructions */}
      <div
        className="bg-gradient-to-r from-[#ff6b35]/20 to-[#ff6eb4]/20 rounded-xl p-2 sm:p-3 md:p-4 mb-2 sm:mb-3 md:mb-4 border-4 border-white/20"
      >
        <p className="font-fun text-white/80 text-xs sm:text-sm md:text-base mb-1 sm:mb-2">
          📱 Join on your phone or tablet at:
        </p>
        <p
          className="font-fun text-base sm:text-lg md:text-xl font-bold mb-1 sm:mb-2"
          style={{ color: '#38bdf8' }}
        >
          app.biffage.com
        </p>
        <p className="font-fun text-white/60 text-[10px] sm:text-xs md:text-sm mb-0.5 sm:mb-1">Enter this room code:</p>
        <motion.div
          className="font-fun font-bold tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.25em]"
          style={{
            fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
            color: '#ffe66d',
            textShadow: '3px 3px 0 #ff6b35, 6px 6px 0 rgba(0,0,0,0.3)',
          }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {roomCode}
        </motion.div>
      </div>

      {/* Continue button */}
      <motion.button
        className="btn-cartoon btn-green text-sm sm:text-base md:text-lg lg:text-xl py-2 sm:py-3 md:py-3.5 lg:py-4 px-5 sm:px-6 md:px-8 lg:px-10"
        onClick={onContinue}
        whileHover={{ scale: 1.05, rotate: 2 }}
        whileTap={{ scale: 0.95 }}
      >
        🚀 Let's Play! 🚀
      </motion.button>

      <p className="mt-1.5 sm:mt-2 md:mt-2.5 text-white/50 font-fun text-[10px] sm:text-xs md:text-sm">
        🔊 This will also enable sound
      </p>
    </motion.div>
  </motion.div>
);

export const HostPage = () => {
  const socket = useSocket();
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const hasJoined = useRef(false);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  // Load saved settings from localStorage
  const [autoProgress, setAutoProgress] = useState(() => {
    const saved = localStorage.getItem('biffage_auto_progress');
    return saved === 'true';
  });
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [familyMode, setFamilyMode] = useState(() => {
    const saved = localStorage.getItem('biffage_family_mode');
    return saved !== 'false'; // Default to true if not set
  });
  const [musicVolume, setMusicVolumeState] = useState(0.3);
  const [sfxVolume, setSfxVolumeState] = useState(0.8);
  const [currentEmoji, setCurrentEmoji] = useState<{ emoji: string; context?: string } | null>(null);
  const prevStateRef = useRef<string | null>(null);
  const prevPlayersRef = useRef<number>(0);
  const prevRevealIndexRef = useRef<number>(-1);
  
  const { playSound, startMusic, stopMusic, fadeOutMusic, setEnabled, setMusicEnabled: setSoundMusicEnabled, setMusicVolume, setSfxVolume, getMusicVolume, getSfxVolume, resumeAudio } = useSounds();

  // Initialize volumes from sound manager
  useEffect(() => {
    setMusicVolumeState(getMusicVolume());
    setSfxVolumeState(getSfxVolume());
  }, [getMusicVolume, getSfxVolume]);

  // Handle game state sound effects
  useEffect(() => {
    if (!gameState) return;
    
    const prevState = prevStateRef.current;
    const currentState = gameState.state;
    
    // State transition sounds
    if (prevState !== currentState) {
      // Fade out music when leaving lobby
      if (prevState === 'LOBBY' && currentState !== 'LOBBY') {
        fadeOutMusic(2.0); // 2 second fade out
      }
      
      switch (currentState) {
        case 'ROUND_INTRO':
          playSound('whoosh');
          if (prevState === 'LOBBY') {
            playSound('gameStart');
          }
          break;
        case 'LIE_INPUT':
          playSound('whoosh');
          break;
        case 'VOTING':
          playSound('whoosh');
          break;
        case 'REVEAL':
          playSound('whoosh');
          break;
        case 'MINI_SCOREBOARD':
          playSound('pop');
          break;
        case 'SCOREBOARD':
          playSound('roundEnd');
          setTimeout(() => playSound('victory'), 500);
          break;
      }
      prevStateRef.current = currentState;
    }
    
    // Player join sound
    if (gameState.players.length > prevPlayersRef.current) {
      playSound('playerJoin');
    }
    prevPlayersRef.current = gameState.players.length;
    
    // Reveal sounds are now handled directly in RevealScreen component with more precise timing
    prevRevealIndexRef.current = gameState.revealedIds.length;
  }, [gameState, playSound]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Set up audio streamer
    if (!audioStreamerRef.current) {
      audioStreamerRef.current = new AudioStreamer();
    }

    const handleRoomCreated = ({ roomCode: code }: { roomCode: string }) => {
      console.log('[Host] Room created:', code);
      setRoomCode(code);
      
      // Apply saved settings to the new room
      const savedAutoProgress = localStorage.getItem('biffage_auto_progress') === 'true';
      const savedFamilyMode = localStorage.getItem('biffage_family_mode') !== 'false';
      
      console.log('[Host] Applying saved settings - Auto Progress:', savedAutoProgress, 'Family Mode:', savedFamilyMode);
      
      if (savedAutoProgress) {
        socket.emit('set_auto_progress', { roomCode: code, enabled: true });
      }
      if (!savedFamilyMode) {
        socket.emit('set_family_mode', { roomCode: code, enabled: false });
      }
    };

    const handleGameState = (state: GameState) => {
      console.log('[Host] Game state received:', state.state);
      setGameState(state);
      setIsAudioPlaying(true);
    };

    const handleAudioChunk = async (chunk: ArrayBuffer) => {
      if (audioStreamerRef.current) {
        await audioStreamerRef.current.resume(); 
        audioStreamerRef.current.addPCM16(chunk);
      }
    };

    const handleAudioComplete = () => {
      setIsAudioPlaying(false);
    };

    const handleShowEmoji = ({ emoji, context }: { emoji: string; context?: string }) => {
      setCurrentEmoji({ emoji, context });
      setTimeout(() => {
        setCurrentEmoji((prev) => (prev && prev.emoji === emoji ? null : prev));
      }, 4000);
    };

    socket.on('room_created', handleRoomCreated);
    socket.on('game_state', handleGameState);
    socket.on('audio_chunk', handleAudioChunk);
    socket.on('audio_complete', handleAudioComplete);
    socket.on('show_emoji', handleShowEmoji);

    return () => {
      socket.off('room_created', handleRoomCreated);
      socket.off('game_state', handleGameState);
      socket.off('audio_chunk', handleAudioChunk);
      socket.off('audio_complete', handleAudioComplete);
      socket.off('show_emoji', handleShowEmoji);
    };
  }, [socket]);

  // Join as host (separate effect to avoid re-joining on listener setup)
  useEffect(() => {
    if (!socket || hasJoined.current) return;

    console.log('[Host] Emitting join_host');
    socket.emit('join_host');
    hasJoined.current = true;
  }, [socket]);
  
  const enableAudio = async () => {
    if (audioStreamerRef.current && !audioEnabled) {
      await audioStreamerRef.current.resume();
      await resumeAudio();
      setAudioEnabled(true);
      if (musicEnabled) {
        startMusic();
      }
    }
  };

  const handleWelcomeContinue = async () => {
    await enableAudio();
    setShowWelcomeModal(false);
  };
  
  const toggleMusic = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !musicEnabled;
    setMusicEnabled(newState);
    setSoundMusicEnabled(newState);
    if (newState && audioEnabled) {
      startMusic();
    } else {
      stopMusic();
    }
  };
  
  const toggleSfx = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !sfxEnabled;
    setSfxEnabled(newState);
    setEnabled(newState);
  };
  
  const toggleAutoProgress = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !autoProgress;
    setAutoProgress(newState);
    localStorage.setItem('biffage_auto_progress', String(newState));
    socket?.emit('set_auto_progress', { roomCode, enabled: newState });
  };

  const handleMusicVolumeChange = (volume: number) => {
    setMusicVolumeState(volume);
    setMusicVolume(volume);
  };

  const handleSfxVolumeChange = (volume: number) => {
    setSfxVolumeState(volume);
    setSfxVolume(volume);
  };

  const handleFamilyModeChange = (enabled: boolean) => {
    const previousMode = familyMode;
    setFamilyMode(enabled);
    localStorage.setItem('biffage_family_mode', String(enabled));
    if (previousMode !== enabled && roomCode) {
      socket?.emit('set_family_mode', { roomCode, enabled });
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    playSound('click');
    socket?.emit('request_next', { roomCode });
  };

  const handleRequestChangePersona = (personaId: string) => {
    if (!roomCode) return;
    playSound('click');
    socket?.emit('request_change_persona', { roomCode, personaId });
  };

  const handleQuitGame = () => {
    playSound('click');
    setShowSettingsMenu(false);
    // Emit quit game event to server
    socket?.emit('quit_game', { roomCode });
    // Reset local state to go back to lobby
    if (gameState) {
      // This will trigger the server to reset the game state to LOBBY
    }
  };

  // Debug: log available personas when modal opens
  useEffect(() => {
    if (showPersonaModal) {
      const availablePersonas = gameState?.hostPersonas || [];
      console.log('Persona modal opened. Available personas:', availablePersonas.length, availablePersonas);
      console.log('Game state:', gameState);
    }
  }, [showPersonaModal, gameState]);

  if (!roomCode) {
    return <LoadingScreen />;
  }

  const availablePersonas = gameState?.hostPersonas || [];

  return (
    <div onClick={enableAudio} className="h-screen cursor-pointer relative overflow-hidden">
      <Background />

      {/* Emoji thought bubble overlay */}
      <AnimatePresence>
        {currentEmoji && (
          <motion.div
            className="fixed top-24 right-10 z-40"
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
          >
            <div className="relative">
              <img
                src="/images/thought.png"
                alt="Thought bubble"
                className="w-32 h-32 object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-center text-4xl">
                {currentEmoji.emoji}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Room Code - Always visible in top-left */}
      <motion.div
        className="fixed top-6 left-6 z-50"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, type: 'spring' }}
      >
        <div 
          className="card-cartoon px-6 py-4 flex flex-col items-center"
          style={{
            background: 'linear-gradient(135deg, #2a2a4a 0%, #1f1f3a 100%)',
          }}
        >
          <span className="text-sm text-white/60 font-fun uppercase tracking-wider">Room</span>
          <span 
            className="text-4xl font-fun font-bold tracking-[0.2em]"
            style={{ color: '#ffe66d', textShadow: '3px 3px 0 #000' }}
          >
            {roomCode}
          </span>
        </div>
      </motion.div>

      {/* Audio controls */}
      <div className="fixed top-6 right-6 z-50 flex gap-3">
        {audioEnabled && (
          <motion.button
            className="card-cartoon px-4 py-2 text-xl cursor-pointer"
            onClick={() => setShowSettingsMenu(true)}
            whileHover={{ scale: 1.1, rotate: 15 }}
            whileTap={{ scale: 0.95 }}
            title="Settings"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            ⚙️
          </motion.button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {(!gameState || gameState.state === 'LOBBY') && roomCode && (
          <LobbyScreen 
            key="lobby"
            players={gameState?.players || []}
            hostPersona={gameState?.hostPersona}
            onStart={handleNext}
            onChangeHost={() => setShowPersonaModal(true)}
          />
        )}

        {gameState?.state === 'ROUND_INTRO' && (
          <RoundIntroScreen 
            key="round-intro"
            gameState={gameState}
            onContinue={handleNext}
          />
        )}

        {gameState?.state === 'LIE_INPUT' && (
          <QuestionScreen 
            key="lie-input"
            gameState={gameState} 
          />
        )}

        {gameState?.state === 'VOTING' && (
          <VotingScreen 
            key="voting"
            gameState={gameState} 
          />
        )}

        {gameState?.state === 'REVEAL' && (
          <RevealScreen 
            key="reveal"
            gameState={gameState}
            onNext={handleNext}
            playSound={playSound}
          />
        )}

        {gameState?.state === 'MINI_SCOREBOARD' && (
          <MiniScoreboardScreen 
            key="mini-scoreboard"
            gameState={gameState}
            onContinue={handleNext}
          />
        )}

        {gameState?.state === 'SCOREBOARD' && (
          <ScoreboardScreen 
            key="scoreboard"
            gameState={gameState}
            onNext={handleNext}
          />
        )}
      </AnimatePresence>

      {/* Persona selection modal */}
      <AnimatePresence>
        {showPersonaModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPersonaModal(false)}
          >
            <motion.div
              className="card-cartoon p-0 max-w-4xl w-full max-h-[85vh] flex flex-col relative"
              initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.9, opacity: 0, rotate: 2 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Fixed header */}
              <div className="flex items-center justify-between p-6 pb-4 border-b-4 border-black flex-shrink-0">
                <h2 className="text-3xl font-fun text-[#ffe66d]">
                  🎭 Choose Your Host
                </h2>
                <button
                  className="btn-cartoon btn-blue px-4 py-2 text-lg"
                  onClick={() => setShowPersonaModal(false)}
                >
                  ✖ Close
                </button>
              </div>

              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto p-6 pt-4">
                {availablePersonas.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🤷</div>
                    <div className="text-xl font-fun text-white/70">
                      No host personas available. Please refresh the page.
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availablePersonas.map((persona) => (
                  <motion.button
                    key={persona.id}
                    className={`card-cartoon flex items-center gap-4 text-left p-4 ${
                      gameState?.hostPersona?.id === persona.id
                        ? 'ring-4 ring-[#ffe66d]'
                        : ''
                    }`}
                    whileHover={{ scale: 1.02, rotate: 1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      handleRequestChangePersona(persona.id);
                      setShowPersonaModal(false);
                    }}
                  >
                    <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-black bg-white flex items-center justify-center flex-shrink-0">
                      <img
                        src={`/images/personas/${persona.avatarKey}.png`}
                        alt={persona.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="text-xl font-fun text-white">
                        {persona.name}
                      </div>
                      <div className="text-sm font-fun text-white/70 mt-1">
                        {persona.description}
                      </div>
                    </div>
                  </motion.button>
                ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Menu */}
      <SettingsMenu
        isOpen={showSettingsMenu}
        onClose={() => setShowSettingsMenu(false)}
        musicVolume={musicVolume}
        sfxVolume={sfxVolume}
        autoProgress={autoProgress}
        familyMode={familyMode}
        onMusicVolumeChange={handleMusicVolumeChange}
        onSfxVolumeChange={handleSfxVolumeChange}
        onAutoProgressChange={(enabled) => {
          setAutoProgress(enabled);
          localStorage.setItem('biffage_auto_progress', String(enabled));
          socket?.emit('set_auto_progress', { roomCode, enabled });
        }}
        onFamilyModeChange={handleFamilyModeChange}
        showQuitButton={gameState?.state !== 'LOBBY' && gameState?.state !== undefined}
        onQuitGame={handleQuitGame}
        isInLobby={!gameState?.state || gameState?.state === 'LOBBY'}
      />

      {/* Welcome Modal - shown on first load */}
      <AnimatePresence>
        {showWelcomeModal && roomCode && (
          <WelcomeModal 
            roomCode={roomCode} 
            onContinue={handleWelcomeContinue}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
