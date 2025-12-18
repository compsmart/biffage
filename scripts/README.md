# Fibbage Question Generator

An infinite question generator for Fibbage-style trivia games using the Gemini Flash API.

## Overview

This system generates unique, high-quality trivia questions by:
1. Selecting unused seeds from a database of 2,179 topics
2. Calling Gemini Flash API to create surprising-but-true facts
3. Tracking used seeds to ensure questions never repeat

## Quick Start

```bash
# From the project root directory:

# Generate 10 questions
npm run generate:batch

# Generate 5 complete games (50 questions)
npm run generate:games -- 5

# Check generation stats
npm run generate:stats
```

## Directory Structure

```
scripts/
├── generators/
│   ├── gemini_question_generator.js   # Main generator (Gemini API)
│   └── seed_loader.js                 # Loads and manages seed database
├── seeds/
│   ├── animals.json      # 540 unusual animals
│   ├── people.json       # 435 historical figures
│   ├── places.json       # 355 landmarks & locations
│   ├── objects.json      # 330 artifacts & inventions
│   ├── events.json       # 205 historical events
│   ├── concepts.json     # 235 phobias, terms, phenomena
│   └── decades.json      # 79 time periods with context
├── state/
│   └── generator_state.json   # Tracks used seeds & stats
└── README.md
```

## Commands

### Generate Questions

```bash
# Generate a batch of questions (default: 10)
npm run generate:batch
npm run generate:batch -- 20   # Generate 20 questions

# Generate complete games (10 questions per game)
npm run generate:games         # 1 game
npm run generate:games -- 10   # 10 games (100 questions)
```

### View Statistics

```bash
npm run generate:stats
```

Output:
```
📊 Question Generator Stats

Seed Database:
  Total seeds: 2179
    Animals: 540
    People: 435
    Places: 355
    ...

Generation State:
  Used seeds: 10
  Remaining seeds: 2169
  Questions generated: 10
  API calls: 2
```

### Reset State

```bash
# Clears used seeds and cache (start fresh)
npm run generate:reset
```

## How It Works

### 1. Seed Selection
The generator picks diverse, unused seeds from different categories to ensure variety:
- Animals, People, Places, Objects
- Historical Events, Decades
- Concepts (phobias, phenomena, terms)

### 2. Gemini API Call
Seeds are sent to Gemini Flash with a carefully crafted prompt:
```
Generate Fibbage-style questions about: Platypus, 1920s, Einstein...
```

### 3. Response Parsing
Gemini returns JSON with:
- Question text with blank (`________`)
- Correct answer (surprising but true)
- 4 plausible fake answers ("house lies")
- Category and difficulty

### 4. State Tracking
Used seeds are recorded in `state/generator_state.json` so they're never reused.

## Question Format

Generated questions are stored in `server/data/questions.json`:

```json
{
  "id": "game_123_q1",
  "text": "A baby platypus is called a ________.",
  "spokenText": "A baby platypus is called a BLANK.",
  "correctAnswer": "puggle",
  "houseLies": ["duckling", "platypup", "billie", "squab"],
  "category": "Animals",
  "type": "normal",
  "difficulty": "medium"
}
```

## Capacity

| Metric | Value |
|--------|-------|
| Total Seeds | 2,179 |
| Unique Questions | 2,179+ minimum |
| With Combinations | 50,000+ possible |
| API Cost | ~$0.02 per 1000 questions |

## Environment Variables

Requires `GEMINI_API_KEY` in `.env` file at project root:

```
GEMINI_API_KEY=your_api_key_here
```

## Adding More Seeds

To expand the seed database, edit files in `seeds/`:

```json
// seeds/animals.json
{
  "category": "Animals",
  "seeds": [
    "Axolotl",
    "Pangolin",
    "Your New Animal"
  ]
}
```

Run `npm run seed:stats` to verify the new count.

## Troubleshooting

**"No unused seeds remaining"**
- You've used all seeds! Run `npm run generate:reset` to start fresh.

**"GEMINI_API_KEY not found"**
- Create a `.env` file in the project root with your API key.

**"Failed to parse Gemini JSON response"**
- Rare API hiccup. The generator will retry automatically.

