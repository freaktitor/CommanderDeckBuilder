"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const papaparse_1 = __importDefault(require("papaparse"));
const scryfall_1 = require("./scryfall");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
const COLLECTION_PATH = path_1.default.join(DATA_DIR, 'collection.json');
// In-memory cache for enriched cards (simple version)
let cardCache = {};
// Ensure data dir exists
const initDataDir = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield promises_1.default.mkdir(DATA_DIR, { recursive: true });
    }
    catch (e) {
        console.error("Failed to create data dir", e);
    }
});
initDataDir();
//
// Routes
//
// GET /api/collection
app.get('/api/collection', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = yield promises_1.default.readFile(COLLECTION_PATH, 'utf-8');
        const collection = JSON.parse(data);
        res.json({ collection });
    }
    catch (error) {
        console.error('Error reading collection:', error);
        res.json({ collection: [] });
    }
}));
// POST /api/upload
app.post('/api/upload', upload.single('file'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const text = req.file.buffer.toString('utf-8');
        let rows = [];
        if (req.file.originalname.endsWith('.csv')) {
            // Parse CSV
            const parseResult = papaparse_1.default.parse(text, {
                header: true,
                skipEmptyLines: true,
            });
            if (parseResult.errors.length > 0) {
                return res.status(400).json({ error: 'CSV parsing error', details: parseResult.errors });
            }
            rows = parseResult.data;
        }
        else if (req.file.originalname.endsWith('.txt')) {
            // Parse TXT
            const lines = text.split('\n');
            console.log(`[TXT Import] Found ${lines.length} lines`);
            rows = lines.map(line => {
                const match = line.trim().match(/^(\d+)\s+(.+)\s+\(([A-Z0-9]+)\)\s+([A-Z0-9-]+)(?:\s+\*([A-Z]+)\*)?$/);
                if (match) {
                    return {
                        'Quantity': match[1],
                        'Name': match[2],
                        'Set Code': match[3].toLowerCase(),
                        'Collector Number': match[4],
                        'source': 'txt'
                    };
                }
                return null;
            }).filter(Boolean);
            console.log(`[TXT Import] Parsed ${rows.length} rows`);
        }
        // Extract Scryfall IDs and basic info
        const collection = rows.map((row) => ({
            quantity: parseInt(row['Quantity'] || '1', 10),
            scryfallId: row['Scryfall ID'] || '',
            name: row['Name'],
            set: row['Set Code'],
            collectorNumber: row['Collector Number']
        })).filter(c => c.scryfallId || (c.set && c.collectorNumber));
        console.log(`[TXT Import] Collection size: ${collection.length}`);
        // Identify missing cards in cache
        const missingIdentifiers = [];
        collection.forEach(c => {
            if (c.scryfallId) {
                if (!cardCache[c.scryfallId]) {
                    missingIdentifiers.push({ id: c.scryfallId });
                }
            }
            else if (c.set && c.collectorNumber) {
                missingIdentifiers.push({ set: c.set, collector_number: c.collectorNumber });
            }
        });
        console.log(`[TXT Import] Missing identifiers: ${missingIdentifiers.length}`);
        // Fetch missing cards
        if (missingIdentifiers.length > 0) {
            const fetchedCards = yield (0, scryfall_1.fetchCardCollection)(missingIdentifiers);
            console.log(`[TXT Import] Fetched ${fetchedCards.length} cards from Scryfall`);
            fetchedCards.forEach(card => {
                cardCache[card.id] = card;
            });
        }
        // Enrich collection
        const enrichedCollection = collection.map(c => {
            let details;
            if (c.scryfallId) {
                details = cardCache[c.scryfallId];
            }
            else if (c.set && c.collectorNumber) {
                details = Object.values(cardCache).find(card => card.set === c.set && card.collector_number === c.collectorNumber);
                if (details) {
                    c.scryfallId = details.id;
                }
            }
            return Object.assign(Object.assign({}, c), { details });
        });
        // Save to file
        yield promises_1.default.writeFile(COLLECTION_PATH, JSON.stringify(enrichedCollection, null, 2));
        res.json({ success: true, count: enrichedCollection.length });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// POST /api/auto-build
app.post('/api/auto-build', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Support both single commanderName and array of commanderNames (for partners)
        const { commanderNames = [], commanderName, collection = [] } = req.body;
        const allCommanderNames = commanderNames.length > 0 ? commanderNames : (commanderName ? [commanderName] : []);
        if (allCommanderNames.length === 0) {
            return res.status(400).json({ error: "Commander name is required" });
        }
        console.log("Building deck for commanders:", allCommanderNames);
        console.log("Collection size:", collection.length);
        // Fetch all commander data and merge color identities
        let commanderColors = [];
        for (const cmdName of allCommanderNames) {
            const commanderResponse = yield fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cmdName)}`);
            if (!commanderResponse.ok) {
                console.error("Commander not found:", cmdName);
                return res.status(404).json({ error: `Commander not found: ${cmdName}` });
            }
            const commander = yield commanderResponse.json();
            const colors = (_a = commander.color_identity) !== null && _a !== void 0 ? _a : [];
            // Merge colors (avoid duplicates)
            colors.forEach(c => {
                if (!commanderColors.includes(c)) commanderColors.push(c);
            });
        }
        console.log("Merged commander colors:", commanderColors);
        const TARGET_NON_LAND = 60;
        const TARGET_LANDS = 39;
        const cardNames = [];
        // Helper to check relevance
        const isCardRelevant = (cardObj) => {
            if (!cardObj)
                return true;
            let text = cardObj.oracle_text || "";
            if (!text && cardObj.card_faces) {
                text = cardObj.card_faces.map((f) => f.oracle_text || "").join("\n");
            }
            const colorMap = {
                'White': 'W', 'Blue': 'U', 'Black': 'B', 'Red': 'R', 'Green': 'G'
            };
            for (const [colorName, colorCode] of Object.entries(colorMap)) {
                if (!commanderColors.includes(colorCode)) {
                    const regex = new RegExp(`\\b${colorName}\\b`, 'i');
                    if (regex.test(text)) {
                        if (/protection from/i.test(text) ||
                            /destroy/i.test(text) ||
                            /exile/i.test(text) ||
                            /opponent/i.test(text) ||
                            /choose a color/i.test(text) ||
                            /any color/i.test(text) ||
                            /landwalk/i.test(text)) {
                            continue;
                        }
                        return false;
                    }
                }
            }
            return true;
        };
        // Filter collection
        const eligible = collection.filter((card) => {
            var _a, _b, _c, _d;
            const type = (_b = (_a = card.details) === null || _a === void 0 ? void 0 : _a.type_line) !== null && _b !== void 0 ? _b : "";
            const ci = (_d = (_c = card.details) === null || _c === void 0 ? void 0 : _c.color_identity) !== null && _d !== void 0 ? _d : [];
            if (allCommanderNames.some(n => card.name.toLowerCase() === n.toLowerCase()))
                return false;
            if (type.includes("Basic Land"))
                return false;
            if (!ci.every((c) => commanderColors.includes(c)))
                return false;
            return isCardRelevant(card.details);
        });
        const uniqueEligible = Array.from(new Map(eligible.map((c) => [c.name, c])).values());
        console.log("Eligible:", uniqueEligible.length);
        // Fetch Staples
        const TARGET_STAPLES = 15;
        const staples = [];
        const suggestedDetails = [];
        try {
            const colorQuery = commanderColors.length === 0 ? "id:c" : `id<=${commanderColors.join("")}`;
            const staplesResp = yield fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${colorQuery} legal:commander -t:land -t:basic`)}&order=edhrec&dir=asc&page=1`);
            if (staplesResp.ok) {
                const data = yield staplesResp.json();
                const list = data.data.filter((c) => !allCommanderNames.includes(c.name) &&
                    isCardRelevant(c)).slice(0, TARGET_STAPLES);
                staples.push(...list);
                suggestedDetails.push(...list);
            }
        }
        catch (e) {
            console.error("Failed to fetch staples", e);
        }
        // Helper predicates
        const isCreature = (t, n) => t.includes("Creature") && !t.includes("Legendary");
        const isRemoval = (t, n) => /Instant|Sorcery/.test(t) && /destroy|exile|kill|terminate|path|swords|wrath|damnation|wipe/.test(n.toLowerCase());
        const isRamp = (t, n) => /(Artifact|Enchantment|Sorcery)/.test(t) && /(sol ring|mana|ramp|cultivate|kodama|reach|signet|talisman|arcane|fellwar)/.test(n.toLowerCase());
        const isDraw = (n) => /(draw|rhystic|study|mystic|remora|phyrexian arena|necropotence|sylvan library)/.test(n.toLowerCase());
        let rampCount = 0;
        let drawCount = 0;
        let removalCount = 0;
        let creatureCount = 0;
        staples.forEach(c => {
            cardNames.push(c.name);
            const t = c.type_line || "";
            const n = c.name;
            if (isRamp(t, n))
                rampCount++;
            else if (isDraw(n))
                drawCount++;
            else if (isRemoval(t, n))
                removalCount++;
            else if (isCreature(t, n))
                creatureCount++;
        });
        console.log(`Added ${staples.length} staples.`);
        // Categorize Collection
        const creatures = uniqueEligible.filter((c) => {
            var _a, _b;
            if (cardNames.includes(c.name))
                return false;
            const t = (_b = (_a = c.details) === null || _a === void 0 ? void 0 : _a.type_line) !== null && _b !== void 0 ? _b : "";
            const n = c.name;
            return isCreature(t, n);
        });
        const removal = uniqueEligible.filter((c) => {
            var _a, _b;
            if (cardNames.includes(c.name))
                return false;
            const t = (_b = (_a = c.details) === null || _a === void 0 ? void 0 : _a.type_line) !== null && _b !== void 0 ? _b : "";
            const n = c.name;
            return isRemoval(t, n);
        });
        const ramp = uniqueEligible.filter((c) => {
            var _a, _b;
            if (cardNames.includes(c.name))
                return false;
            const t = (_b = (_a = c.details) === null || _a === void 0 ? void 0 : _a.type_line) !== null && _b !== void 0 ? _b : "";
            const n = c.name;
            return isRamp(t, n);
        });
        const draw = uniqueEligible.filter((c) => {
            if (cardNames.includes(c.name))
                return false;
            const n = c.name;
            return isDraw(n);
        });
        const nonBasicLands = uniqueEligible.filter((c) => {
            var _a, _b;
            const t = (_b = (_a = c.details) === null || _a === void 0 ? void 0 : _a.type_line) !== null && _b !== void 0 ? _b : "";
            return t.includes("Land") && !t.includes("Basic");
        });
        const other = uniqueEligible.filter((c) => !cardNames.includes(c.name) &&
            !creatures.includes(c) && !removal.includes(c) &&
            !ramp.includes(c) && !draw.includes(c) && !nonBasicLands.includes(c));
        const addCards = (list, max) => {
            const chosen = list.slice(0, max).map((c) => c.name);
            cardNames.push(...chosen);
            return chosen.length;
        };
        let added = 0;
        added += addCards(ramp, Math.max(0, 10 - rampCount));
        added += addCards(draw, Math.max(0, 5 - drawCount));
        added += addCards(removal, Math.max(0, 10 - removalCount));
        added += addCards(creatures, Math.max(0, 30 - creatureCount));
        const remainingSlots = Math.max(0, TARGET_NON_LAND - cardNames.length);
        added += addCards(other, remainingSlots);
        console.log("Added from collection:", added);
        // Suggest Scryfall fillers
        if (cardNames.length < TARGET_NON_LAND) {
            const need = TARGET_NON_LAND - cardNames.length;
            console.log("Need additional:", need);
            const colorQuery = commanderColors.length === 0
                ? "id:c"
                : `id<=${commanderColors.join("")}`;
            const scryQuery = `${colorQuery} -t:basic f:commander legal:commander usd<=2`;
            const resp = yield fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(scryQuery)}&order=edhrec&dir=asc&page=1`);
            if (resp.ok) {
                const data = yield resp.json();
                const suggestions = data.data
                    .filter((c) => !allCommanderNames.some(n => c.name.toLowerCase() === n.toLowerCase()) &&
                        !cardNames.includes(c.name) &&
                        isCardRelevant(c))
                    .slice(0, need);
                suggestions.forEach(c => {
                    cardNames.push(c.name);
                    suggestedDetails.push(c);
                });
            }
        }
        // Add lands
        const basicMap = {
            W: "Plains",
            U: "Island",
            B: "Swamp",
            R: "Mountain",
            G: "Forest",
        };
        let landCount = 0;
        const eligibleNonBasicLands = uniqueEligible.filter((c) => {
            var _a, _b, _c, _d;
            const type = (_b = (_a = c.details) === null || _a === void 0 ? void 0 : _a.type_line) !== null && _b !== void 0 ? _b : "";
            const ci = (_d = (_c = c.details) === null || _c === void 0 ? void 0 : _c.color_identity) !== null && _d !== void 0 ? _d : [];
            return (type.includes("Land") &&
                !type.includes("Basic") &&
                ci.every((x) => commanderColors.includes(x)));
        });
        const nonBasicToAdd = Math.min(eligibleNonBasicLands.length, Math.floor(TARGET_LANDS / 2));
        eligibleNonBasicLands.slice(0, nonBasicToAdd).forEach((c) => cardNames.push(c.name));
        landCount += nonBasicToAdd;
        const remaining = TARGET_LANDS - landCount;
        const perColor = commanderColors.length ? Math.floor(remaining / commanderColors.length) : 0;
        const extra = commanderColors.length ? remaining % commanderColors.length : 0;
        commanderColors.forEach((color, i) => {
            const landName = basicMap[color];
            if (!landName)
                return;
            let count = perColor + (i < extra ? 1 : 0);
            for (let x = 0; x < count; x++)
                cardNames.push(landName);
        });
        console.log("Total cards:", cardNames.length);
        res.json({
            success: true,
            deckName: `Auto-built ${allCommanderNames.join(' & ')} deck`,
            cardNames,
            suggestedDetails,
            deckUrl: `https://edhrec.com/commanders/${allCommanderNames[0]
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")}`,
        });
    }
    catch (err) {
        console.error("Auto-build error:", err);
        res.status(500).json({
            error: "Failed to build deck",
            details: err instanceof Error ? err.message : String(err),
        });
    }
}));
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
