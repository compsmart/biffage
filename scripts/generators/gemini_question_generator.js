require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const { getDiverseSeeds, getSeedStats } = require('./seed_loader');

const STATE_FILE = path.join(__dirname, '../state/generator_state.json');
const CACHE_FILE = path.join(__dirname, '../../server/data/questions_cache.json');
const QUESTIONS_FILE = path.join(__dirname, '../../server/data/questions.json');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Load generator state
 */
function loadState() {
    if (!fs.existsSync(STATE_FILE)) {
        return {
            used_seeds: [],
            generated_questions_count: 0,
            last_batch_id: null,
            last_generation_time: null,
            total_api_calls: 0,
            failed_generations: 0
        };
    }
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

/**
 * Save generator state
 */
function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Load question cache
 */
function loadCache() {
    if (!fs.existsSync(CACHE_FILE)) {
        return { available: [], served: [] };
    }
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
}

/**
 * Save question cache
 */
function saveCache(cache) {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Build the prompt for Gemini
 */
function buildPrompt(seeds) {
    const seedList = seeds.map((s, i) => {
        let entry = `${i + 1}. "${s.name}" (Category: ${s.category})`;
        if (s.context) {
            entry += ` - Context: ${s.context}`;
        }
        return entry;
    }).join('\n');

    return `You are a trivia question writer for Fibbage, a party game where players guess the truth among believable lies.

TASK: Generate ${seeds.length} Fibbage-style trivia questions based on these seeds:
${seedList}

CRITICAL REQUIREMENTS:
1. Each question MUST be about a REAL, VERIFIABLE obscure fact related to the seed
2. The blank (use exactly "________") should be where the SURPRISING answer goes
3. Include exactly 4 plausible-sounding fake answers ("houseLies")
4. The real answer should be surprising but ABSOLUTELY TRUE
5. Fake answers should be believable but definitely NOT true
6. Questions should be fun, weird, or unusual - not boring trivia
7. Keep answers SHORT (1-4 words ideally)

STYLE EXAMPLES (for inspiration, but create NEW questions):
- "The national animal of Scotland is the ________." → "Unicorn"
- "A group of flamingos is called a ________." → "Flamboyance"
- "In 1932, Australia declared war on ________." → "Emus"
- "The inventor of the Pringles can is now buried in a ________." → "Pringles can"
- "Before toilet paper was invented, Americans commonly used ________." → "Corn cobs"

OUTPUT FORMAT (strict JSON, no markdown, no code blocks):
{
  "questions": [
    {
      "seed": "exact seed name from the list",
      "text": "Question text with ________ for the blank",
      "correctAnswer": "The real surprising answer (short)",
      "houseLies": ["Fake 1", "Fake 2", "Fake 3", "Fake 4"],
      "category": "One of: History, Science, Animals, Geography, Pop Culture, Language, Food, Sports, Art, Weird Laws, Human Body, Inventions, Nature, Entertainment, Random Facts",
      "difficulty": "easy or medium or hard"
    }
  ]
}

Generate the questions now. Output ONLY valid JSON, no other text:`;
}

/**
 * Call Gemini API to generate questions
 */
async function callGeminiAPI(prompt) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not found in environment variables');
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.9,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
                responseMimeType: "application/json"
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract the text content from Gemini response
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid Gemini response structure');
    }

    const textContent = data.candidates[0].content.parts[0].text;

    // Parse the JSON response
    try {
        // Try to extract JSON if wrapped in code blocks
        let jsonStr = textContent;
        if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.replace(/```\n?/g, '');
        }
        return JSON.parse(jsonStr.trim());
    } catch (e) {
        console.error('Failed to parse Gemini response:', textContent);
        throw new Error('Failed to parse Gemini JSON response');
    }
}

/**
 * Generate a batch of questions
 * @param {number} count - Number of questions to generate
 * @returns {Array} - Array of generated questions
 */
async function generateBatch(count = 10) {
    const state = loadState();
    const usedIds = new Set(state.used_seeds);

    console.log(`\n📝 Generating ${count} new questions...`);
    console.log(`   Used seeds so far: ${usedIds.size}`);

    // Select diverse unused seeds
    const seeds = getDiverseSeeds(count, usedIds);

    if (seeds.length === 0) {
        console.log('❌ No unused seeds remaining!');
        return [];
    }

    if (seeds.length < count) {
        console.log(`⚠️  Only ${seeds.length} unused seeds available`);
    }

    console.log(`   Selected seeds: ${seeds.map(s => s.name).join(', ')}`);

    // Build and send prompt
    const prompt = buildPrompt(seeds);

    try {
        console.log('🤖 Calling Gemini API...');
        const result = await callGeminiAPI(prompt);
        state.total_api_calls++;

        if (!result.questions || !Array.isArray(result.questions)) {
            throw new Error('Invalid response format: missing questions array');
        }

        // Process and validate questions
        const validQuestions = [];
        const batchId = `batch_${Date.now()}`;

        for (const q of result.questions) {
            // Validate required fields
            if (!q.text || !q.correctAnswer || !q.houseLies || !Array.isArray(q.houseLies)) {
                console.warn(`   ⚠️  Skipping invalid question for seed: ${q.seed}`);
                continue;
            }

            // Find matching seed
            const matchingSeed = seeds.find(s => s.name.toLowerCase() === (q.seed || '').toLowerCase());
            const seedId = matchingSeed ? matchingSeed.id : `unknown_${Date.now()}_${Math.random()}`;

            // Create question object
            const question = {
                id: `q_${Date.now()}_${validQuestions.length}`,
                text: q.text.includes('________') ? q.text : q.text.replace(/_{2,}|_+/g, '________'),
                spokenText: q.text.replace(/_{2,}|________/g, 'BLANK'),
                correctAnswer: q.correctAnswer.toLowerCase(),
                houseLies: q.houseLies.slice(0, 4).map(l => l.toLowerCase()),
                category: q.category || 'Random Facts',
                difficulty: q.difficulty || 'medium',
                seed: q.seed,
                seedId: seedId,
                batchId: batchId,
                generatedAt: new Date().toISOString()
            };

            validQuestions.push(question);

            // Mark seed as used
            if (matchingSeed) {
                state.used_seeds.push(matchingSeed.id);
            }
        }

        console.log(`✅ Generated ${validQuestions.length} valid questions`);

        // Update state
        state.generated_questions_count += validQuestions.length;
        state.last_batch_id = batchId;
        state.last_generation_time = new Date().toISOString();
        saveState(state);

        // Add to cache
        const cache = loadCache();
        cache.available.push(...validQuestions);
        saveCache(cache);

        return validQuestions;

    } catch (error) {
        console.error('❌ Generation failed:', error.message);
        state.failed_generations++;
        saveState(state);
        return [];
    }
}

/**
 * Get questions from cache, generating more if needed
 * @param {number} count - Number of questions needed
 * @returns {Array} - Array of questions
 */
async function getQuestions(count = 10) {
    const cache = loadCache();

    // Check if we have enough cached questions
    if (cache.available.length >= count) {
        const questions = cache.available.splice(0, count);
        cache.served.push(...questions);
        saveCache(cache);
        return questions;
    }

    // Need to generate more
    const needed = count - cache.available.length;
    console.log(`📦 Cache has ${cache.available.length} questions, need ${needed} more`);

    // Generate in batches of 10
    while (cache.available.length < count) {
        const batchSize = Math.min(10, count - cache.available.length);
        const newQuestions = await generateBatch(batchSize);

        if (newQuestions.length === 0) {
            console.log('⚠️  Could not generate more questions');
            break;
        }

        // Reload cache (generateBatch saves to it)
        const updatedCache = loadCache();
        cache.available = updatedCache.available;
    }

    // Return what we have
    const questions = cache.available.splice(0, Math.min(count, cache.available.length));
    cache.served.push(...questions);
    saveCache(cache);

    return questions;
}

/**
 * Generate questions and add them to the main questions.json as games
 * @param {number} gameCount - Number of games to generate (10 questions each)
 */
async function generateGames(gameCount = 1) {
    console.log(`\n🎮 Generating ${gameCount} game(s) (${gameCount * 10} questions total)\n`);

    const games = [];

    for (let g = 0; g < gameCount; g++) {
        console.log(`\n--- Game ${g + 1} of ${gameCount} ---`);

        const questions = await getQuestions(10);

        if (questions.length < 10) {
            console.log(`⚠️  Only got ${questions.length} questions for game ${g + 1}`);
        }

        // Assign question types (3 normal, 3 double, 3 triple, 1 final)
        const gameQuestions = questions.map((q, idx) => {
            let type = 'normal';
            if (idx >= 3 && idx < 6) type = 'double';
            else if (idx >= 6 && idx < 9) type = 'triple';
            else if (idx === 9) type = 'final';

            return {
                ...q,
                id: `game${games.length + 1}_q${idx + 1}`,
                type: type,
                year: new Date().getFullYear()
            };
        });

        games.push({
            id: `game_${Date.now()}_${g}`,
            questions: gameQuestions
        });
    }

    // Append to existing questions or create new file
    let existingGames = [];
    if (fs.existsSync(QUESTIONS_FILE)) {
        try {
            existingGames = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8'));
        } catch (e) {
            console.log('⚠️  Could not parse existing questions.json, starting fresh');
        }
    }

    const allGames = [...existingGames, ...games];
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(allGames, null, 2));

    console.log(`\n✅ Generated ${games.length} game(s) with ${games.reduce((sum, g) => sum + g.questions.length, 0)} questions`);
    console.log(`📁 Total games in questions.json: ${allGames.length}`);

    return games;
}

/**
 * Show stats
 */
function showStats() {
    const state = loadState();
    const cache = loadCache();
    const seedStats = getSeedStats();

    console.log('\n📊 Question Generator Stats\n');
    console.log('Seed Database:');
    console.log(`  Total seeds: ${seedStats.total}`);
    for (const [cat, count] of Object.entries(seedStats.byCategory)) {
        console.log(`    ${cat}: ${count}`);
    }

    console.log('\nGeneration State:');
    console.log(`  Used seeds: ${state.used_seeds.length}`);
    console.log(`  Remaining seeds: ${seedStats.total - state.used_seeds.length}`);
    console.log(`  Questions generated: ${state.generated_questions_count}`);
    console.log(`  API calls: ${state.total_api_calls}`);
    console.log(`  Failed generations: ${state.failed_generations}`);
    console.log(`  Last batch: ${state.last_batch_id || 'None'}`);

    console.log('\nCache Status:');
    console.log(`  Available questions: ${cache.available.length}`);
    console.log(`  Served questions: ${cache.served.length}`);
}

/**
 * Reset state (use with caution!)
 */
function resetState() {
    saveState({
        used_seeds: [],
        generated_questions_count: 0,
        last_batch_id: null,
        last_generation_time: null,
        total_api_calls: 0,
        failed_generations: 0
    });
    saveCache({ available: [], served: [] });
    console.log('🔄 State and cache reset');
}

// CLI handling
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    (async () => {
        switch (command) {
            case 'batch':
                const batchCount = parseInt(args[1]) || 10;
                await generateBatch(batchCount);
                break;

            case 'games':
                const gameCount = parseInt(args[1]) || 1;
                await generateGames(gameCount);
                break;

            case 'stats':
                showStats();
                break;

            case 'reset':
                if (args[1] === '--confirm') {
                    resetState();
                } else {
                    console.log('⚠️  To reset, run: node gemini_question_generator.js reset --confirm');
                }
                break;

            default:
                console.log(`
Fibbage Question Generator
===========================

Usage:
  node gemini_question_generator.js <command> [options]

Commands:
  batch [count]    Generate a batch of questions (default: 10)
  games [count]    Generate complete games (10 questions each)
  stats            Show generation statistics
  reset --confirm  Reset all state and cache

Examples:
  node gemini_question_generator.js batch 5
  node gemini_question_generator.js games 3
  node gemini_question_generator.js stats
                `);
        }
    })();
}

module.exports = {
    generateBatch,
    getQuestions,
    generateGames,
    showStats,
    resetState
};

