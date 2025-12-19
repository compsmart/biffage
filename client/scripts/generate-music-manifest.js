/**
 * Script to generate manifest.json file for music directory
 * Run this script to automatically discover all music files and create a manifest
 * 
 * Usage: node scripts/generate-music-manifest.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const musicDir = path.join(__dirname, '../public/music');
const audioExtensions = ['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.webm'];

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

function generateManifest() {
  console.log('Generating music manifest...\n');
  
  const files = getFilesInDirectory(musicDir);
  
  if (files.length > 0) {
    const manifestPath = path.join(musicDir, 'manifest.json');
    const manifest = {
      files: files.sort(),
      generated: new Date().toISOString()
    };
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✓ Found ${files.length} music file(s):`);
    files.forEach(file => console.log(`  - ${file}`));
    console.log(`\n✓ Generated manifest at ${manifestPath}`);
  } else {
    console.log(`○ No music files found in ${musicDir}`);
  }
}

generateManifest();

