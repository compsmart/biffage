import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  musicVolume: number;
  sfxVolume: number;
  autoProgress: boolean;
  familyMode: boolean;
  onMusicVolumeChange: (volume: number) => void;
  onSfxVolumeChange: (volume: number) => void;
  onAutoProgressChange: (enabled: boolean) => void;
  onFamilyModeChange: (enabled: boolean) => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isOpen,
  onClose,
  musicVolume,
  sfxVolume,
  autoProgress,
  familyMode,
  onMusicVolumeChange,
  onSfxVolumeChange,
  onAutoProgressChange,
  onFamilyModeChange,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/70 z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Settings Panel */}
          <motion.div
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="card-cartoon p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.8, y: 50, rotate: -5 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.8, y: 50, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <motion.h2
                  className="text-4xl font-fun text-[#ffe66d]"
                  style={{ textShadow: '3px 3px 0 #000' }}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  ⚙️ Settings
                </motion.h2>
                <motion.button
                  className="card-cartoon px-4 py-2 text-2xl cursor-pointer"
                  onClick={onClose}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  ✕
                </motion.button>
              </div>

              <div className="space-y-8">
                {/* Music Volume */}
                <motion.div
                  className="space-y-3"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-2xl font-fun text-white flex items-center gap-3">
                      🎵 Music Volume
                    </label>
                    <span className="text-xl font-fun text-[#ffe66d]">
                      {Math.round(musicVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={musicVolume}
                    onChange={(e) => onMusicVolumeChange(parseFloat(e.target.value))}
                    className="w-full h-4 bg-white/20 rounded-lg appearance-none cursor-pointer slider-cartoon"
                    style={{
                      background: `linear-gradient(to right, #ffe66d 0%, #ffe66d ${musicVolume * 100}%, rgba(255,255,255,0.2) ${musicVolume * 100}%, rgba(255,255,255,0.2) 100%)`
                    }}
                  />
                </motion.div>

                {/* SFX Volume */}
                <motion.div
                  className="space-y-3"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-2xl font-fun text-white flex items-center gap-3">
                      🔊 SFX Volume
                    </label>
                    <span className="text-xl font-fun text-[#ffe66d]">
                      {Math.round(sfxVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={sfxVolume}
                    onChange={(e) => onSfxVolumeChange(parseFloat(e.target.value))}
                    className="w-full h-4 bg-white/20 rounded-lg appearance-none cursor-pointer slider-cartoon"
                    style={{
                      background: `linear-gradient(to right, #ffe66d 0%, #ffe66d ${sfxVolume * 100}%, rgba(255,255,255,0.2) ${sfxVolume * 100}%, rgba(255,255,255,0.2) 100%)`
                    }}
                  />
                </motion.div>

                {/* Auto Progress Toggle */}
                <motion.div
                  className="flex items-center justify-between p-4 card-cartoon"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">▶️</span>
                    <div>
                      <div className="text-xl font-fun text-white">Auto Progress</div>
                      <div className="text-sm font-fun text-white/70">
                        Automatically advance after AI host finishes speaking
                      </div>
                    </div>
                  </div>
                  <motion.button
                    className={`relative w-16 h-8 rounded-full transition-colors ${
                      autoProgress ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                    onClick={() => onAutoProgressChange(!autoProgress)}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg"
                      animate={{ x: autoProgress ? 32 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </motion.button>
                </motion.div>

                {/* Family Mode Toggle */}
                <motion.div
                  className="flex items-center justify-between p-4 card-cartoon"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{familyMode ? '👨‍👩‍👧‍👦' : '🍻'}</span>
                    <div>
                      <div className="text-xl font-fun text-white">Family Mode</div>
                      <div className="text-sm font-fun text-white/70">
                        {familyMode 
                          ? 'AI host uses family-friendly humor'
                          : 'AI host uses adult-oriented humor'}
                      </div>
                    </div>
                  </div>
                  <motion.button
                    className={`relative w-16 h-8 rounded-full transition-colors ${
                      familyMode ? 'bg-blue-500' : 'bg-purple-500'
                    }`}
                    onClick={() => onFamilyModeChange(!familyMode)}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg"
                      animate={{ x: familyMode ? 32 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

