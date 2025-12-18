# Fibbage Clone with Gemini Live Host

A clone of the popular game Fibbage, featuring a real-time AI host powered by Gemini Live API.

## Features
- **Real-time AI Host**: Gemini Live narrates the game, roasts players, and reads questions with a sarcastic persona.
- **Mobile Controller**: Players join using their phones via a responsive web interface.
- **Game Logic**: Full game loop with lying, voting, scoring, and rounds (Double/Triple points).
- **100 Games Generated**: Includes a script to generate 1000 questions (100 games).

## Setup

1. **Install Dependencies**
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

2. **Generate Questions**
   ```bash
   node scripts/generate_questions.js
   ```

3. **Configure Environment**
   - Ensure you have a `.env` file in the root with `GEMINI_API_KEY`.

4. **Run Server**
   ```bash
   cd server
   npm start
   # Runs on port 3001
   ```

5. **Run Client**
   ```bash
   cd client
   npm run dev
   # Runs on port 5173
   ```

## How to Play
1. Open `http://localhost:5173/host` on a big screen (TV/Monitor).
2. Click "Enable AI Host" (requires API Key).
3. Players open `http://localhost:5173/play` on their phones.
4. Enter the Room Code shown on the Host screen.
5. Host clicks "Start Game" once players are in.
6. Follow the AI's instructions!

## Tech Stack
- **Backend**: Node.js, Express, Socket.io
- **Frontend**: React, Vite, Tailwind CSS
- **AI**: Gemini Live API (Multimodal WebSocket)

