const fs = require('fs');
const path = require('path');

const SEEDS_DIR = path.join(__dirname, '../seeds');

/**
 * Load all seed files and combine them into a unified structure
 */
function loadAllSeeds() {
    const seedFiles = fs.readdirSync(SEEDS_DIR).filter(f => f.endsWith('.json'));
    const allSeeds = [];

    for (const file of seedFiles) {
        const filePath = path.join(SEEDS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const category = data.category;

        // Handle decades differently (they have structured data)
        if (category === 'Decades') {
            for (const item of data.seeds) {
                allSeeds.push({
                    id: `decade_${item.decade}`,
                    name: item.decade,
                    category: 'Decades',
                    context: `${item.era}: ${item.context}`
                });
            }
        } else {
            for (const seed of data.seeds) {
                allSeeds.push({
                    id: `${category.toLowerCase()}_${seed.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                    name: seed,
                    category: category,
                    context: null
                });
            }
        }
    }

    return allSeeds;
}

/**
 * Get random unused seeds for a batch
 * @param {number} count - Number of seeds to select
 * @param {Set} usedIds - Set of already used seed IDs
 * @returns {Array} - Array of selected seeds
 */
function selectUnusedSeeds(count, usedIds = new Set()) {
    const allSeeds = loadAllSeeds();
    const available = allSeeds.filter(s => !usedIds.has(s.id));

    if (available.length < count) {
        console.warn(`Only ${available.length} unused seeds remaining!`);
        return available;
    }

    // Shuffle and pick
    const shuffled = available.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * Get seeds by category
 * @param {string} category - Category name
 * @param {number} count - Number to select
 * @returns {Array} - Array of seeds from that category
 */
function getSeedsByCategory(category, count = 10) {
    const allSeeds = loadAllSeeds();
    const filtered = allSeeds.filter(s => s.category === category);
    const shuffled = filtered.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * Get a diverse mix of seeds from different categories
 * @param {number} count - Total seeds to select
 * @param {Set} usedIds - Set of already used seed IDs
 * @returns {Array} - Array of seeds from various categories
 */
function getDiverseSeeds(count, usedIds = new Set()) {
    const allSeeds = loadAllSeeds();
    const available = allSeeds.filter(s => !usedIds.has(s.id));

    // Group by category
    const byCategory = {};
    for (const seed of available) {
        if (!byCategory[seed.category]) {
            byCategory[seed.category] = [];
        }
        byCategory[seed.category].push(seed);
    }

    // Pick from each category round-robin
    const categories = Object.keys(byCategory);
    const selected = [];
    let catIndex = 0;

    while (selected.length < count && categories.length > 0) {
        const cat = categories[catIndex % categories.length];
        const catSeeds = byCategory[cat];

        if (catSeeds.length > 0) {
            // Pick random from this category
            const idx = Math.floor(Math.random() * catSeeds.length);
            selected.push(catSeeds.splice(idx, 1)[0]);
        } else {
            // Remove empty category
            categories.splice(catIndex % categories.length, 1);
            if (categories.length === 0) break;
        }
        catIndex++;
    }

    return selected;
}

/**
 * Get stats about the seed database
 */
function getSeedStats() {
    const allSeeds = loadAllSeeds();
    const byCategory = {};

    for (const seed of allSeeds) {
        byCategory[seed.category] = (byCategory[seed.category] || 0) + 1;
    }

    return {
        total: allSeeds.length,
        byCategory
    };
}

module.exports = {
    loadAllSeeds,
    selectUnusedSeeds,
    getSeedsByCategory,
    getDiverseSeeds,
    getSeedStats
};

// Test if run directly
if (require.main === module) {
    const stats = getSeedStats();
    console.log('Seed Database Stats:');
    console.log(`Total seeds: ${stats.total}`);
    console.log('By category:');
    for (const [cat, count] of Object.entries(stats.byCategory)) {
        console.log(`  ${cat}: ${count}`);
    }

    console.log('\nSample diverse selection (10 seeds):');
    const sample = getDiverseSeeds(10);
    for (const seed of sample) {
        console.log(`  [${seed.category}] ${seed.name}`);
    }
}

