import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SocketProvider } from './context/SocketContext';
import { HostPage } from './pages/Host';
import { PlayerPage } from './pages/Player';
import { Background } from './components';

const Landing = () => (
  <div className="min-h-screen relative overflow-hidden">
    <Background />
    
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
      {/* Floating decorations */}
      <motion.div 
        className="absolute top-10 left-10 text-6xl"
        animate={{ y: [0, -20, 0], rotate: [-10, 10, -10] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        🎉
      </motion.div>
      <motion.div 
        className="absolute top-20 right-16 text-5xl"
        animate={{ y: [0, -15, 0], rotate: [10, -10, 10] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
      >
        🎮
      </motion.div>
      <motion.div 
        className="absolute bottom-20 left-20 text-5xl"
        animate={{ y: [0, -10, 0], rotate: [-5, 5, -5] }}
        transition={{ duration: 2, repeat: Infinity, delay: 1 }}
      >
        🤣
      </motion.div>
      <motion.div 
        className="absolute bottom-32 right-24 text-6xl"
        animate={{ y: [0, -20, 0], rotate: [5, -5, 5] }}
        transition={{ duration: 3.5, repeat: Infinity, delay: 0.3 }}
      >
        🏆
      </motion.div>

      {/* Logo / Title */}
      <motion.div 
        className="text-center mb-12"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, type: 'spring' }}
      >
        <motion.h1 
          className="font-fun font-black mb-6"
          style={{
            fontSize: 'clamp(4rem, 15vw, 10rem)',
            color: '#ffe66d',
            textShadow: '6px 6px 0 #ff6b35, 12px 12px 0 #ff6eb4, 18px 18px 0 rgba(0,0,0,0.4)',
          }}
          animate={{ rotate: [-1, 1, -1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          FIBBAGE
        </motion.h1>
        
        <motion.p 
          className="text-2xl text-white font-fun"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ textShadow: '2px 2px 0 #000' }}
        >
          The Bluffing Party Game! 🤥
        </motion.p>
      </motion.div>

      {/* Action Buttons */}
      <motion.div 
        className="flex flex-col md:flex-row gap-6"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6, type: 'spring' }}
      >
        <Link to="/host">
          <motion.button 
            className="btn-cartoon btn-blue text-2xl px-10 py-5"
            whileHover={{ scale: 1.05, rotate: 2 }}
            whileTap={{ scale: 0.95 }}
          >
            📺 Host Game
          </motion.button>
        </Link>
        
        <Link to="/play">
          <motion.button 
            className="btn-cartoon btn-pink text-2xl px-10 py-5"
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            🎮 Join Game
          </motion.button>
        </Link>
      </motion.div>

      {/* How to play hint */}
      <motion.div
        className="mt-16 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p className="text-white/60 text-lg font-fun mb-6">How to Play 👇</p>
        
        <motion.div 
          className="flex flex-wrap justify-center gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <motion.div 
            className="card-cartoon px-6 py-5 text-center max-w-[220px]"
            whileHover={{ scale: 1.05, rotate: -2 }}
          >
            <div className="text-4xl mb-3">🤔</div>
            <p className="text-white font-fun text-sm">Read the question and write a convincing lie!</p>
          </motion.div>
          
          <motion.div 
            className="card-cartoon px-6 py-5 text-center max-w-[220px]"
            whileHover={{ scale: 1.05, rotate: 2 }}
          >
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-white font-fun text-sm">Try to pick the real answer from the options!</p>
          </motion.div>
          
          <motion.div 
            className="card-cartoon px-6 py-5 text-center max-w-[220px]"
            whileHover={{ scale: 1.05, rotate: -2 }}
          >
            <div className="text-4xl mb-3">😈</div>
            <p className="text-white font-fun text-sm">Fool others with your lie to earn bonus points!</p>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Footer */}
      <motion.footer
        className="absolute bottom-6 text-center text-white/40 text-sm font-fun"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        Made with ❤️ for game nights
      </motion.footer>
    </div>
  </div>
);

function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/host" element={<HostPage />} />
          <Route path="/play" element={<PlayerPage />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}

export default App;
