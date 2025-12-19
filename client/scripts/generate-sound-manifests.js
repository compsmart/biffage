/**
 * Script to generate manifest.json files for each sound effect directory
 * Run this script to automatically discover all sound files and create manifests
 * 
 * Usage: node scripts/generate-sound-manifests.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const soundsDir = path.join(__dirname, '../public/sounds');
const audioExtensions = ['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.webm'];

const soundTypes = [
  'click', 'playerJoin', 'countdown', 'countdownFinal', 'gameStart',
  'lieSubmit', 'voteSubmit', 'revealLie', 'revealTruth', 'scoreUp',
  'roundEnd', 'victory', 'tick', 'whoosh', 'pop', 'error',
  'answerFocus', 'playersFooled', 'pointsAwarded', 'truthReveal', 'correctPlayers', 'drumroll'
];

function getFilesInDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    const files = fs.readdirSync(dirPath);
    return files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return audioExtensions.includes(ext);
    });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

function generateManifests() {
  console.log('Generating sound manifests...\n');
  
  let totalFiles = 0;
  
  soundTypes.forEach(type => {
    const typeDir = path.join(soundsDir, type);
    const files = getFilesInDirectory(typeDir);
    
    if (files.length > 0) {
      const manifestPath = path.join(typeDir, 'manifest.json');
      const manifest = {
        type,
        files: files.sort(),
        generated: new Date().toISOString()
      };
      
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`✓ ${type}: Found ${files.length} file(s)`);
      files.forEach(file => console.log(`  - ${file}`));
      totalFiles += files.length;
    } else {
      console.log(`○ ${type}: No sound files found`);
    }
  });
  
  console.log(`\n✓ Generated manifests for ${totalFiles} total sound files`);
}

generateManifests();

