# Infinite Fibbage Question Generator - Architecture Plan

## Overview

Generate unlimited unique Fibbage-style questions using **seed word lists** + **Gemini Flash API**. The system ensures no question ever repeats by tracking used seeds and combinations.

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SEED DATABASE                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Animals  │ │ People   │ │ Places   │ │ Objects  │ │ Decades  │     │
│  │ (1000)   │ │ (1000)   │ │ (1000)   │ │ (1000)   │ │ (100)    │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                │                                        │
│                                ▼                                        │
│                    ┌───────────────────────┐                           │
│                    │   Seed Selector       │                           │
│                    │   (10 per game batch) │                           │
│                    └───────────────────────┘                           │
│                                │                                        │
│                                ▼                                        │
│                    ┌───────────────────────┐                           │
│                    │   Gemini Flash API    │                           │
│                    │   Question Generator  │                           │
│                    └───────────────────────┘                           │
│                                │                                        │
│                                ▼                                        │
│                    ┌───────────────────────┐                           │
│                    │   Question Cache      │                           │
│                    │   (Used seeds DB)     │                           │
│                    └───────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Create

### 1. `scripts/seeds/` - Seed Data Files

| File | Count | Description |
|------|-------|-------------|
| `animals.json` | 1000 | Animals with interesting facts potential |
| `people.json` | 1000 | Historical figures, celebrities, inventors |
| `places.json` | 1000 | Cities, landmarks, geographical features |
| `objects.json` | 1000 | Artifacts, inventions, everyday items |
| `events.json` | 500 | Historical events, disasters, discoveries |
| `decades.json` | 100 | "1920s", "1950s", etc. with era context |
| `concepts.json` | 500 | Phobias, scientific terms, slang words |

**Total: ~5000 unique seeds = ~5000 unique questions minimum**

### 2. `scripts/generators/gemini_question_generator.js`

The main generator that:
- Loads available seeds
- Selects N unused seeds for a game batch
- Calls Gemini Flash API with a carefully crafted prompt
- Parses and validates the response
- Saves generated questions to cache
- Marks seeds as used

### 3. `scripts/state/generator_state.json`

Tracks:
```json
{
  "used_seeds": ["seed_id_1", "seed_id_2", ...],
  "generated_questions_count": 1234,
  "last_batch_id": "batch_20241218_001",
  "cache_file": "questions_cache.json"
}
```

### 4. `server/data/questions_cache.json`

Pre-generated questions ready to serve:
```json
{
  "available": [...],   // Queue of ready questions
  "served": [...]       // Already used in games
}
```

---

## Gemini Prompt Strategy

### The Prompt Template

```javascript
const PROMPT = `You are a trivia question writer for Fibbage, a party game where players guess the truth among lies.

TASK: Generate 10 Fibbage-style trivia questions based on these seeds:
${seeds.map((s, i) => `${i+1}. ${s.name} (Category: ${s.category})`).join('\n')}

REQUIREMENTS:
1. Each question must be about a REAL, verifiable obscure fact
2. The blank (________) should be where the surprising answer goes
3. Include 4 plausible-sounding fake answers ("house lies")
4. The real answer should be surprising but TRUE
5. Fake answers should be believable but NOT true

OUTPUT FORMAT (strict JSON):
{
  "questions": [
    {
      "seed": "seed name",
      "text": "Question text with ________ for the blank",
      "correctAnswer": "The real surprising answer",
      "houseLies": ["Fake 1", "Fake 2", "Fake 3", "Fake 4"],
      "category": "History|Science|Animals|etc",
      "difficulty": "easy|medium|hard"
    }
  ]
}

STYLE EXAMPLES:
- "The national animal of Scotland is the ________." → "Unicorn"
- "A group of flamingos is called a ________." → "Flamboyance"  
- "In 1932, Australia declared war on ________." → "Emus"

Generate questions now:`;
```

### Why This Works

1. **Seed-based**: Each seed guides Gemini to research a specific topic
2. **Structured output**: JSON format ensures parseable results
3. **Examples**: Shows the "surprising but true" style we want
4. **House lies**: Pre-generated fallback lies if players don't submit

---

## Implementation Steps

### Phase 1: Seed Database (Day 1)
- [ ] Create `scripts/seeds/` directory
- [ ] Generate `animals.json` (1000 animals)
- [ ] Generate `people.json` (1000 people)
- [ ] Generate `places.json` (1000 places)
- [ ] Generate `objects.json` (1000 objects)
- [ ] Generate `events.json` (500 events)
- [ ] Generate `concepts.json` (500 concepts)
- [ ] Create seed loader utility

### Phase 2: Gemini Integration (Day 2)
- [ ] Create `gemini_question_generator.js`
- [ ] Implement seed selection logic (random, unused)
- [ ] Implement Gemini API call with prompt
- [ ] Implement response parsing and validation
- [ ] Implement retry logic for failed generations
- [ ] Add rate limiting (respect API limits)

### Phase 3: State Management (Day 2)
- [ ] Create state file structure
- [ ] Implement used-seed tracking
- [ ] Implement question cache management
- [ ] Create "refill cache" script

### Phase 4: Game Integration (Day 3)
- [ ] Modify `Game.js` to pull from question cache
- [ ] Implement on-demand generation if cache low
- [ ] Add cache warming (pre-generate during idle)

### Phase 5: CLI & Automation (Day 3)
- [ ] Create `npm run generate:questions` command
- [ ] Create batch generation script
- [ ] Add logging and progress reporting

---

## Question Uniqueness Guarantee

### Mathematical Proof of Infinity

With **5000 seeds**, even using simple combinations:
- **Single-seed questions**: 5000 unique questions
- **Seed + decade combinations**: 5000 × 100 = 500,000 variations
- **Seed + category twist**: 5000 × 10 categories = 50,000 more

**Conservative estimate: 50,000+ unique questions before any repetition.**

### Tracking System

```javascript
// In generator_state.json
{
  "used_combinations": {
    "animal_lion_1920s": true,
    "person_einstein_invention": true,
    // ...
  }
}
```

---

## API Cost Estimate

| Model | Cost per 1M tokens | Avg tokens/question | Cost per 1000 Q |
|-------|-------------------|---------------------|-----------------|
| Gemini 2.5 Flash | ~$0.10 | ~200 | ~$0.02 |

**For 10,000 questions: ~$0.20** (extremely economical)

---

## File Structure After Implementation

```
mcp_test/
├── scripts/
│   ├── seeds/
│   │   ├── animals.json
│   │   ├── people.json
│   │   ├── places.json
│   │   ├── objects.json
│   │   ├── events.json
│   │   └── concepts.json
│   ├── generators/
│   │   ├── gemini_question_generator.js
│   │   ├── seed_loader.js
│   │   └── batch_generator.js
│   └── state/
│       └── generator_state.json
├── server/
│   └── data/
│       ├── questions_cache.json
│       └── used_questions.json
└── .env (GEMINI_API_KEY)
```

---

## Quick Start Commands

```bash
# 1. Populate seed database (one-time)
node scripts/generators/populate_seeds.js

# 2. Generate a batch of questions (10 questions)
node scripts/generators/gemini_question_generator.js --batch 10

# 3. Fill cache to 100 questions
node scripts/generators/batch_generator.js --target 100

# 4. Check generation stats
node scripts/generators/stats.js
```

---

## Next Steps

1. **Create the seed JSON files** with comprehensive lists
2. **Build the Gemini generator** with proper error handling
3. **Test with small batches** to tune the prompt
4. **Scale up** once quality is verified

Ready to implement? Start with Phase 1: Seed Database.

