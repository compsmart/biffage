#!/bin/bash
# Deployment script for Fibbage Clone
# Run this on your production server after git pull

set -e  # Exit on error

echo "🎮 Deploying Fibbage Clone..."

# Navigate to project root
cd "$(dirname "$0")/.."

echo "📦 Installing root dependencies..."
npm install

echo "📦 Installing server dependencies..."
cd server
npm install

echo "📦 Installing client dependencies..."
cd ../client
npm install

echo "🔨 Building client..."
npm run build

echo "🔄 Restarting server with PM2..."
cd ../server
pm2 restart fibbage 2>/dev/null || pm2 start index.js --name fibbage

echo "✅ Deployment complete!"
echo ""
echo "📊 Server status:"
pm2 status fibbage

