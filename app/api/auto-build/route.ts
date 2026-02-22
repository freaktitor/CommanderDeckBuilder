import { NextRequest, NextResponse } from 'next/server';
import { CollectionCard, ScryfallCard } from '@/lib/types';

export async function POST(req: NextRequest) {
    try {
        const { commanderNames = [], commanderName, collection = [] } = await req.json();
        const allCommanderNames: string[] = commanderNames.length > 0 ? commanderNames : (commanderName ? [commanderName] : []);

        if (allCommanderNames.length === 0) {
            return NextResponse.json({ error: "Commander name is required" }, { status: 400 });
        }

        let commanderColors: string[] = [];
        for (const cmdName of allCommanderNames) {
            const commanderResponse = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cmdName)}`);
            if (!commanderResponse.ok) return NextResponse.json({ error: `Commander not found: ${cmdName}` }, { status: 404 });
            const commander: ScryfallCard = await commanderResponse.json();
            (commander.color_identity ?? []).forEach(c => { if (!commanderColors.includes(c)) commanderColors.push(c); });
        }

        const detectCommanderSynergies = (commanders: ScryfallCard[]) => {
            const synergies = {
                landSubtypes: [] as string[],
                strategies: [] as string[],
                primaryStrategy: null as string | null,
                creatureTypes: [] as string[],
                exclusiveTypes: [] as string[],
                mechanics: [] as string[],
            };
            const strategyWeights: Record<string, number> = {};
            const landSubtypes = ['Town', 'Gate', 'Desert', 'Cave', 'Lair', 'Sphere', 'Locus'];
            const strategyMap: Record<string, string[]> = {
                'Aristocrats': ['sacrifice', 'die', 'deaths', 'graveyard', 'whenever a creature you control dies', 'drain', 'loses life', 'sacrificed'],
                'Tokens': ['token', 'create', 'whenever you create', 'each creature you control gets +', 'populate'],
                'Artifacts': ['artifact', 'whenever an artifact'],
                'Enchantments': ['enchantment', 'whenever an enchantment'],
                'Spellslinger': ['instant', 'sorcery', 'whenever you cast an instant', 'whenever you cast a noncreature', 'magecraft'],
                'Counters': ['counter', 'proliferate', 'doubling season', 'hardened scales'],
                'Lifegain': ['life', 'gain', 'whenever you gain life', 'lifelink'],
                'Equipment': ['equip', 'equipment', 'attached'],
                'VanillaMatters': ['no abilities', 'no ability', 'creatures you control with no abilities'],
                'Blink': ['exile', 'return', 'enters the battlefield', 'flicker', 'whenever a creature enters'],
                'Reanimator': ['graveyard', 'return', 'put from a graveyard', 'reanimate', 'mill'],
                'Voltron': ['equipment', 'aura', 'attached', 'unblockable', 'commander damage', 'double strike'],
                'Graveyard': ['graveyard', 'mill', 'dredge', 'delve', 'undergrowth'],
            };
            const allDetectedTypes: string[] = [];

            for (const cmd of commanders) {
                const text = cmd.oracle_text?.toLowerCase() || '';
                const typeLine = cmd.type_line?.toLowerCase() || '';

                for (const subtype of landSubtypes) {
                    if (text.includes(subtype.toLowerCase()) && !synergies.landSubtypes.includes(subtype)) synergies.landSubtypes.push(subtype);
                }

                for (const [strategy, keywords] of Object.entries(strategyMap)) {
                    let weight = 0;
                    keywords.forEach(k => { weight += (text.match(new RegExp(k, 'g')) || []).length * 1.5; });
                    if (weight > 0) {
                        strategyWeights[strategy] = (strategyWeights[strategy] || 0) + weight;
                        if (!synergies.strategies.includes(strategy)) synergies.strategies.push(strategy);
                    }
                }

                if (synergies.landSubtypes.length > 0 || /landfall|lands you control|number of lands|play an additional land/i.test(text)) {
                    strategyWeights['LandMatters'] = (strategyWeights['LandMatters'] || 0) + 2;
                    if (!synergies.strategies.includes('LandMatters')) synergies.strategies.push('LandMatters');
                }

                const match = typeLine.match(/legendary creature — ([\w\s]+)/);
                if (match) {
                    match[1].split(' ').forEach(t => {
                        const cap = t.charAt(0).toUpperCase() + t.slice(1);
                        if (cap !== 'Legendary' && cap !== 'Creature') {
                            allDetectedTypes.push(cap);
                            if (!synergies.creatureTypes.includes(cap)) synergies.creatureTypes.push(cap);
                        }
                    });
                }

                const mechanicKeywords = text.match(/\b(flying|trample|lifelink|deathtouch|menace|vigilance|reach|ward|toxic|proliferate|investigate|adventure|cascade|scry|surveil|training|modified|creature tokens|artifact tokens)\b/g);
                if (mechanicKeywords) mechanicKeywords.forEach(k => { if (!synergies.mechanics.includes(k)) synergies.mechanics.push(k); });
            }

            const sortedStrategies = Object.entries(strategyWeights).sort((a, b) => b[1] - a[1]);
            if (sortedStrategies.length > 0) synergies.primaryStrategy = sortedStrategies[0][0];

            const typeCounts = allDetectedTypes.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>);
            synergies.exclusiveTypes = Object.entries(typeCounts)
                .filter(([type, count]) => {
                    if (commanders.length > 1 && count > 1) return true;
                    if (['Warrior', 'Cleric', 'Soldier', 'Knight', 'Wizard', 'Scout', 'Berserker', 'Druid', 'Ranger', 'Rogue', 'Advisor'].includes(type) && commanders.length === 1) return false;
                    return true;
                }).map(([type]) => type);

            return synergies;
        };

        const commanders: ScryfallCard[] = [];
        for (const cmdName of allCommanderNames) {
            const resp = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cmdName)}`);
            if (resp.ok) commanders.push(await resp.json());
        }
        const synergies = detectCommanderSynergies(commanders);

        const TARGET_NON_LAND = 100 - allCommanderNames.length - Math.floor((100 - allCommanderNames.length) * 0.38);
        const MAX_NON_LANDS = TARGET_NON_LAND;
        const TARGET_LANDS = (100 - allCommanderNames.length) - TARGET_NON_LAND;

        const cardNames: string[] = [];
        const suggestedDetails: ScryfallCard[] = [];

        // Global counters
        let landCount = 0;
        let nonLandCount = 0;
        let creatureCount = 0;
        let auraCount = 0;
        let equipCount = 0;

        const CREATURE_LIMIT = (synergies.creatureTypes.length > 0) ? 40 : 32;

        /**
         * Centralized helper to add a card to the deck while respecting limits and preventing duplicates.
         * Returns true if the card was successfully added.
         */
        function tryAddCard(card: ScryfallCard | CollectionCard, isScryfallFetch = false) {
            const details = 'details' in card ? card.details : card;
            if (!details) return false;

            const name = details.name;
            const typeLine = details.type_line || "";
            const isLand = typeLine.includes('Land');
            const isBasic = typeLine.includes('Basic Land');

            // 1. Prevent adding commanders to the main deck
            if (allCommanderNames.some(cn => cn.toLowerCase() === name.toLowerCase())) {
                return false;
            }

            // 2. Prevent duplicates (except basic lands which are handled later or added here)
            if (!isBasic && cardNames.includes(name)) {
                return false;
            }

            // 3. Respect limits
            if (!isLand && nonLandCount >= MAX_NON_LANDS) return false;
            if (!isLand && typeLine.includes('Creature') && creatureCount >= CREATURE_LIMIT) return false;
            if (isLand && landCount >= TARGET_LANDS) return false;

            // 4. Parasitic Filter (Disqualification)
            const parasiticCards = { 'umbra mystic': 'Aura', 'siona, captain': 'Aura', 'puresteel paladin': 'Equipment' };
            const cLow = name.toLowerCase();
            if (parasiticCards[cLow as keyof typeof parasiticCards] === 'Aura' && auraCount < 6) return false;
            if (parasiticCards[cLow as keyof typeof parasiticCards] === 'Equipment' && equipCount < 6) return false;

            // 5. Success - Update state
            cardNames.push(name);
            if (isScryfallFetch) suggestedDetails.push(details as ScryfallCard);

            if (isLand) {
                landCount++;
            } else {
                nonLandCount++;
                if (typeLine.includes('Creature')) creatureCount++;
                if (typeLine.includes('Aura')) auraCount++;
                if (typeLine.includes('Equipment')) equipCount++;
            }

            return true;
        }

        function isVanilla(details: any) {
            if (!details || !details.type_line?.includes('Creature')) return false;
            // A card is "vanilla" if it has no oracle text after removing reminder text
            const text = (details.oracle_text || "").replace(/\(.*\)/g, "").trim();
            return text.length === 0;
        }

        function isCreature(t: string) { return t.includes("Creature") && !t.includes("Legendary"); }
        function isRemoval(details: any) {
            const t = details?.type_line || "";
            const n = (details?.name || "").toLowerCase();
            const o = (details?.oracle_text || "").toLowerCase();
            const removalTerms = /destroy|exile|counter target|loses all abilities|return target .* to its owner's hand|deals .* damage to target creature|damage to each creature|each opponent sacrifices|sacrifices a creature/i;
            const names = /path to exile|swords to plowshares|beast within|generous gift|pongify|rapid hybridization|chaos warp|stroke of midnight|assassin's trophy|anguished unmaking|utter end|deadly dispute|village rites|infernal grasp|feed the swarm|go for the throat/i;
            return /Instant|Sorcery|Enchantment|Creature/.test(t) && (removalTerms.test(o) || names.test(n));
        }
        function isRamp(details: any) {
            const t = details?.type_line ?? "";
            const n = details?.name?.toLowerCase() ?? "";
            const text = details?.oracle_text?.toLowerCase() ?? "";
            const cmc = details?.cmc ?? 0;
            if (/(Artifact|Enchantment|Sorcery|Creature)/.test(t)) {
                if (/(sol ring|mana|ramp|cultivate|kodama|reach|signet|talisman|arcane|fellwar|treasure|add)/.test(n) ||
                    (text.includes('search your library for a') && text.includes('land card')) ||
                    text.includes('cost {1} less to cast') ||
                    text.includes('cost {2} less to cast') ||
                    text.includes('add one mana of any color')) {
                    if (cmc >= 4 && /(manalith|geode|prizm|sphere|lantern)/.test(n)) return false;
                    return true;
                }
            }
            return false;
        }
        function isDraw(details: any) {
            const n = (details?.name || "").toLowerCase();
            const o = (details?.oracle_text || "").toLowerCase();
            const t = (details?.type_line || "").toLowerCase();
            const drawKeywords = /draw a card|draw cards|draw two cards|draw three cards|exile the top card.*may play|whenever.*dies.*draw|whenever.*enters.*draw|at the beginning of your upkeep.*draw/i;
            const names = /rhystic|study|mystic|remora|phyrexian arena|necropotence|sylvan library|dispute|rites|night's whisper|sign in blood|face-breaker|opportunist|specialist|midnight reaper|grim haruspex/i;
            return drawKeywords.test(o) || names.test(n);
        }
        function isFinisher(details: any) {
            const text = (details?.oracle_text || "").toLowerCase();
            const n = (details?.name || "").toLowerCase();
            return /(each opponent loses.*life|loses.*life.*you gain|whenever.*token.*dies|whenever.*creature.*dies|damage to each opponent|scute swarm|mirkwood bats|craterhoof|moonshaker|overrun|insurrection|torment of hailfire|revel in riches)/i.test(text) ||
                /(blood artist|zulaport cutthroat|cruel celebrant|bastion of remembrance|mirkwood bats|syr konrad|meatbook|vito|sanguine bond)/.test(n);
        }

        function isSacOutlet(details: any) {
            const o = (details?.oracle_text || "").toLowerCase();
            return /sacrifice (a|another) creature\s*:/i.test(o) || /sacrifice \d+ (creatures|humans)\s*:/i.test(o) || /sacrifice (a|another) creature\s*((at|as) |to )/i.test(o);
        }
        function isFodder(details: any) {
            const o = (details?.oracle_text || "").toLowerCase();
            const n = (details?.name || "").toLowerCase();
            return /create (a|two|three) .* token/i.test(o) || /return .* from (your|a) graveyard to (the|your) hand/i.test(o) ||
                /persist|undying|afterlife|reassembling skeleton|bloodghast|nether traitor|ophiomancer/i.test(n) ||
                (details?.type_line?.includes('Creature') && (o.includes('when this creature dies') || o.includes('whenever another creature dies')));
        }
        function isSynergyCard(card: CollectionCard, sObj: any) {
            const details = card.details;
            if (!details) return false;
            const text = (details.oracle_text || "").toLowerCase();
            const typeLine = (details.type_line || "").toLowerCase();

            // Match cards based on the commander's primary strategy
            if (sObj.primaryStrategy === 'Aristocrats') {
                if (isSacOutlet(details) || isFodder(details) || isFinisher(details)) return true;
                if (typeLine.includes('human') && text.includes('create')) return true; // Synergy with Human-focused sac outlets
            }

            if (sObj.exclusiveTypes.some((t: string) => typeLine.includes(t.toLowerCase()))) return true;
            const strategyMap: Record<string, string[]> = {
                'Aristocrats': ['sacrifice', 'die', 'deaths', 'graveyard', 'drain', 'loses life'],
                'Tokens': ['token', 'create', 'whenever you create', 'each creature you control gets +', 'populate'],
                'Artifacts': ['artifact', 'whenever an artifact'],
                'Enchantments': ['enchantment', 'whenever an enchantment'],
                'Spellslinger': ['instant', 'sorcery', 'whenever you cast an instant', 'magecraft'],
                'Lifegain': ['life', 'gain', 'whenever you gain life'],
                'Equipment': ['equip', 'equipment', 'attached'],
                'Counters': ['counter', 'proliferate'],
                'LandMatters': ['landfall', 'play an additional land', 'lands you control'],
                'Blink': ['exile', 'return', 'enters'],
                'Reanimator': ['graveyard', 'return', 'reanimate'],
                'Graveyard': ['graveyard', 'mill', 'dredge']
            };
            for (const strategy of sObj.strategies) {
                if ((strategyMap[strategy] || []).some(k => text.includes(k))) return true;
            }
            if ((sObj.mechanics || []).some((m: string) => text.includes(m))) return true;
            return false;
        }

        function isCardRelevant(cardObj: any) {
            if (!cardObj) return true;
            const text = (cardObj.oracle_text || "").toLowerCase();
            const lowerName = (cardObj.name || "").toLowerCase();
            const type = cardObj.type_line || "";
            const cmc = cardObj.cmc ?? 0;

            const isLand = type.includes('Land');
            if (isLand) return true; // Always allow lands to be considered for addition

            const blacklist = ['mystic skull', 'breaching dragonstorm', 'kill shot', 'fountainport bell', 'world map', 'item shopkeep', 'town greeter', 'zulaport duelist', 'beloved chaplain', 'borderland ranger', 'jaddi offshoot', 'champion of the flame', 'wojek bodyguard', 'dakra mystic', 'tithe taker'];
            if (blacklist.some(b => lowerName.includes(b))) return false;
            if (cmc >= 5 && type.includes('Creature') && !/whenever|when|at the beginning|flying|trample|ward|lifelink|deathtouch|menace|vigilance|reach|defender/i.test(text)) return false;

            if (type.includes('Creature')) {
                const isHighlySynergistic = isSynergyCard({ details: cardObj } as any, synergies);
                if (cmc <= 2 && !isHighlySynergistic && !/when .* enters|draw|add|ramp/i.test(text) && text.length < 50) return false;

                // Filter out generic "combat" creatures that don't support the deck's synergy
                if (!isHighlySynergistic && !isRemoval(cardObj) && !isDraw(cardObj) && !isRamp(cardObj)) {
                    if (/attacks|blocks|double strike|first strike|vigilance|reach|trample|flying|protection from/i.test(text) &&
                        !/whenever you (cast|create|sacrifice)|whenever a creature dies/i.test(text)) {
                        return false;
                    }
                }
            }

            if (synergies.primaryStrategy && !isSynergyCard({ details: cardObj } as any, { ...synergies, strategies: [synergies.primaryStrategy] }) && !/when .* enters|whenever|draw|destroy|exile|add|ramp/i.test(text)) {
                // If it's not synergistic or a staple, be more critical as the deck fills
                if (cardNames.length > TARGET_NON_LAND * 0.6) return false;
            }

            if (synergies.primaryStrategy === 'VanillaMatters' && type.includes('Creature') && !isVanilla(cardObj) && !isRamp(cardObj) && !isDraw(cardObj) && !isRemoval(cardObj)) return false;

            if (creatureCount > 35 && type.includes('Creature') && !/when .* enters|whenever|draw|destroy|exile|add|ramp/i.test(text) && !isFinisher(cardObj) && !isSynergyCard({ details: cardObj } as any, synergies)) return false;

            const colorMap: Record<string, string> = { 'White': 'W', 'Blue': 'U', 'Black': 'B', 'Red': 'R', 'Green': 'G' };
            for (const [colorName, colorCode] of Object.entries(colorMap)) {
                if (!commanderColors.includes(colorCode) && new RegExp(`\\b${colorName}\\b`, 'i').test(text) && !/(protection from|destroy|exile|opponent|choose a color|any color|landwalk)/i.test(text)) return false;
            }
            return true;
        }

        const eligible = collection.filter((card: CollectionCard) => {
            if (allCommanderNames.some(n => card.name.toLowerCase() === n.toLowerCase())) return false;
            if (!(card.details?.color_identity ?? []).every((c: string) => commanderColors.includes(c))) return false;
            return isCardRelevant(card.details);
        });
        const uniqueEligible = Array.from(new Map(eligible.map((c: CollectionCard) => [c.name, c])).values()) as CollectionCard[];

        function addUniqueCards(candidates: any[], maxToAdd: number) {
            const sorted = [...candidates].sort((a, b) => {
                const aMentions = allCommanderNames.some(n => a.details?.oracle_text?.includes(n)) ? 2.5 : 0;
                const bMentions = allCommanderNames.some(n => b.details?.oracle_text?.includes(n)) ? 2.5 : 0;
                let aGrav = aMentions + (synergies.strategies.filter(s => isSynergyCard(a, { ...synergies, strategies: [s] })).length * 0.5);
                let bGrav = bMentions + (synergies.strategies.filter(s => isSynergyCard(b, { ...synergies, strategies: [s] })).length * 0.5);
                if (synergies.primaryStrategy) {
                    if (isSynergyCard(a, { ...synergies, strategies: [synergies.primaryStrategy] })) aGrav += 2;
                    if (isSynergyCard(b, { ...synergies, strategies: [synergies.primaryStrategy] })) bGrav += 2;
                }
                aGrav += ((synergies.mechanics || []).filter((m: string) => a.details?.oracle_text?.toLowerCase().includes(m)).length * 0.2);
                bGrav += ((synergies.mechanics || []).filter((m: string) => b.details?.oracle_text?.toLowerCase().includes(m)).length * 0.2);

                if (synergies.primaryStrategy === 'VanillaMatters') {
                    if (isVanilla(a.details)) aGrav += 10;
                    if (isVanilla(b.details)) bGrav += 10;
                }

                // Weight tribal "engines" (cards that trigger on tribe members) higher
                const engineKeywords = /whenever|trigger|additional|top of your library/i;
                if ((synergies.creatureTypes || []).some(t => a.details?.type_line?.includes(t)) && engineKeywords.test(a.details?.oracle_text || "")) aGrav += 5;
                if ((synergies.creatureTypes || []).some(t => b.details?.type_line?.includes(t)) && engineKeywords.test(b.details?.oracle_text || "")) bGrav += 5;

                if (aGrav !== bGrav) return bGrav - aGrav;
                const aCheap = (a.details?.cmc ?? 99) <= 2 && isRemoval(a.details) ? 1 : 0;
                const bCheap = (b.details?.cmc ?? 99) <= 2 && isRemoval(b.details) ? 1 : 0;
                if (aCheap !== bCheap) return bCheap - aCheap;
                return (isSynergyCard(b, synergies) ? 1 : 0) - (isSynergyCard(a, synergies) ? 1 : 0);
            });

            let added = 0;
            for (const card of sorted) {
                if (added >= maxToAdd) break;
                if (tryAddCard(card)) added++;
            }
            return added;
        }

        const colorQuery = commanderColors.length === 0 ? "id:c" : `id<=${commanderColors.join("")}`;
        let rampCount = 0, removalCount = 0, drawCount = 0;

        // v13: Vanilla Scryfall Fetch (e.g. Jasmine Boreal)
        if (synergies.primaryStrategy === 'VanillaMatters') {
            console.log("Fetching vanilla staples...");
            try {
                const vanQuery = `${colorQuery} is:vanilla legal:commander usd<5 order:edhrec limit:10`;
                const vanResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(vanQuery)}`);
                if (vanResp.ok) {
                    const vanData = await vanResp.json();
                    let vanAdded = 0;
                    for (const v of vanData.data) {
                        if (vanAdded >= 8) break;
                        if (tryAddCard(v, true)) vanAdded++;
                    }
                }
            } catch { }
        }

        // v12: Thematic Anchors (Explicitly forcing iconic cards)
        if (allCommanderNames.some(n => n.includes("Choco"))) {
            console.log("Forcing Thematic Anchor: Traveling Chocobo");
            try {
                const chocoResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent("name:\"Traveling Chocobo\"")}`);
                if (chocoResp.ok) {
                    const cData = await chocoResp.json();
                    if (cData.data[0]) tryAddCard(cData.data[0], true);
                }
            } catch { }
        }

        // Phase 1: High Strategy Staples (Owned only)
        addUniqueCards(uniqueEligible.filter(c => /zulaport|blood artist|cruel celebrant|manufactor|plunderer|sol ring|signet|talisman|arcane signet|fellwar stone/.test(c.name.toLowerCase())), 15);

        // Fetch signature staples for tribal decks
        if (synergies.creatureTypes.length > 0) {
            console.log("Fetching signature staples for tribes:", synergies.creatureTypes);
            try {
                const tribeQuery = synergies.creatureTypes.slice(0, 2).map(t => `t:${t}`).join(' OR ');
                const signatureQuery = `${colorQuery} (${tribeQuery}) (o:trigger OR o:whenever OR o:additional OR o:"top of your library") usd<5 order:edhrec limit:5`;
                const sigResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(signatureQuery)}`);
                if (sigResp.ok) {
                    const sigData = await sigResp.json();
                    let sigAdded = 0;
                    for (const l of sigData.data) {
                        if (sigAdded >= 5) break;
                        if (tryAddCard(l, true)) sigAdded++;
                    }
                }
            } catch (e) { console.error("Failed to fetch signature staples", e); }
        }

        // Ensure Aristocrats decks have a core set of sacrifice outlets
        if (synergies.primaryStrategy === 'Aristocrats') {
            const sacOutlets = ['Viscera Seer', 'Carrion Feeder', 'Woe Strider', 'Yahenni, Undying Partisan', 'Skullclamp', 'High Market'];
            console.log("Fetching mandatory sac outlets...");
            try {
                const sacQuery = `(${sacOutlets.map(n => `!"${n}"`).join(' OR ')}) legal:commander usd<5 limit:10`;
                const sacResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(sacQuery)}`);
                if (sacResp.ok) {
                    const sacData = await sacResp.json();
                    for (const s of sacData.data) {
                        tryAddCard(s, true);
                    }
                }
            } catch { }
        }

        // Fetch specialized lands for specific subtypes (e.g. Gates, Deserts)
        if (synergies.landSubtypes.length > 0) {
            console.log("Fetching synergy lands for subtypes:", synergies.landSubtypes);
            try {
                const subQuery = synergies.landSubtypes.map(s => `t:${s}`).join(' OR ');
                const landQuery = `${colorQuery} (${subQuery}) t:land legal:commander usd<5`;
                const landResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(landQuery)}&order=edhrec`);
                if (landResp.ok) {
                    const landData = await landResp.json();
                    let landAdded = 0;
                    for (const l of landData.data) {
                        if (landAdded >= 5) break;
                        if (tryAddCard(l, true)) landAdded++;
                    }
                }
            } catch (e) { console.error("Failed to fetch synergy lands", e); }
        }

        // ESSENTIALS PHASE (Draw/Interaction/Ramp) - Fill these before General Synergy

        // 1. Ramp (Target 10-12)
        const sortedRamp = uniqueEligible.filter(c => isRamp(c.details)).sort((a, b) => (a.details?.cmc ?? 0) - (b.details?.cmc ?? 0));
        rampCount += addUniqueCards(sortedRamp, 12);
        if (rampCount < (commanderColors.length >= 4 ? 12 : 10)) {
            try {
                const rr = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${colorQuery} (t:artifact OR t:enchantment OR t:sorcery) (o:add OR o:"search your library for a land") usd<5 order:edhrec limit:10`)}`);
                if (rr.ok) {
                    let rampAdded = 0;
                    for (const r of (await rr.json()).data) {
                        if (rampAdded >= 5) break;
                        if (tryAddCard(r, true)) {
                            rampAdded++;
                            rampCount++;
                        }
                    }
                }
            } catch { }
        }

        // 2. Card Draw (Target 10)
        drawCount += addUniqueCards(uniqueEligible.filter(c => isDraw(c.details)), 10);

        // 3. Interaction (Target 10-12)
        removalCount += addUniqueCards(uniqueEligible.filter(c => isRemoval(c.details)), 12);
        const INTER_MIN = commanderColors.length >= 4 ? 12 : 10;
        if (removalCount < INTER_MIN) {
            console.log("Fetching additional interaction staples...");
            try {
                const interQuery = `${colorQuery} (t:instant OR t:sorcery) (o:destroy OR o:exile OR o:counter) legal:commander usd<5 order:edhrec limit:10`;
                const interResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(interQuery)}`);
                if (interResp.ok) {
                    const interData = await interResp.json();
                    let interAdded = 0;
                    for (const r of interData.data) {
                        if (interAdded >= 6) break;
                        if (tryAddCard(r, true)) {
                            interAdded++;
                            removalCount++;
                        }
                    }
                }
            } catch { }
        }

        // Synergy Pieces (Artifacts/Enchantments)
        addUniqueCards(uniqueEligible.filter(c => isSynergyCard(c, synergies) && (c.details?.type_line?.includes('Artifact') || c.details?.type_line?.includes('Enchantment'))), 15);
        // General Synergy
        addUniqueCards(uniqueEligible.filter(c => isSynergyCard(c, synergies)), 20);

        const addedFins = addUniqueCards(uniqueEligible.filter(c => !cardNames.includes(c.name) && isFinisher(c.details)), 5);
        if (addedFins < 3) {
            try {
                const fr = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${colorQuery} (o:"each opponent loses" OR o:"whenever you create a token" OR o:"whenever a creature you control dies") legal:commander usd<5 order:edhrec limit:5`)}`);
                if (fr.ok) {
                    for (const f of (await fr.json()).data) {
                        tryAddCard(f, true);
                    }
                }
            } catch { }
        }

        // Fill remaining Non-Lands (Explicitly exclude lands here to preserve slots for basics)
        const isNotLand = (c: CollectionCard) => !c.details?.type_line?.includes('Land');

        addUniqueCards(uniqueEligible.filter(c => !cardNames.includes(c.name) && isNotLand(c) && !c.details?.type_line?.includes('Creature')), MAX_NON_LANDS);
        addUniqueCards(uniqueEligible.filter(c => !cardNames.includes(c.name) && isNotLand(c) && isCreature(c.details?.type_line || '')), MAX_NON_LANDS);
        addUniqueCards(uniqueEligible.filter(c => !cardNames.includes(c.name) && isNotLand(c)), MAX_NON_LANDS);

        const basicMap: Record<string, string> = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };

        // Dedicated Land Phase: Only add synergy lands or a limited number of utility lands
        uniqueEligible.filter(c => c.details?.type_line?.includes('Land') && isSynergyCard(c, synergies)).forEach(c => {
            tryAddCard(c);
        });

        const utilityLands = uniqueEligible.filter(c => c.details?.type_line?.includes('Land') && !c.details?.type_line?.includes('Basic') && !cardNames.includes(c.name));
        // Limit utility lands to 50% of the land target to ensure room for basics
        while (landCount < Math.floor(TARGET_LANDS * 0.5) && utilityLands.length > 0) {
            const l = utilityLands.shift();
            if (l) tryAddCard(l);
        }

        // Final Phase: Fill remaining slots exactly to 100 with basics
        const totalTarget = 100 - allCommanderNames.length;
        const remainingToFill = totalTarget - cardNames.length;

        if (remainingToFill > 0) {
            console.log(`[Auto-Build] Filling remaining ${remainingToFill} slots with basic lands`);
            const colors = commanderColors.length > 0 ? commanderColors : ['W', 'U', 'B', 'R', 'G', 'C'];
            const actualColors = colors.filter(c => basicMap[c] || c === 'C');
            const perColor = Math.floor(remainingToFill / actualColors.length);
            const extra = remainingToFill % actualColors.length;

            actualColors.forEach((color, i) => {
                const landName = basicMap[color] || 'Wastes';
                let count = perColor + (i < extra ? 1 : 0);
                for (let x = 0; x < count; x++) {
                    cardNames.push(landName);
                }
            });
        }

        return NextResponse.json({
            success: true,
            deckName: `Auto-built ${allCommanderNames.join(' & ')} deck`,
            cardNames,
            cardIds: cardNames.map(name => {
                const versions = eligible.filter((c: CollectionCard) => c.name === name);
                return versions.length > 0 ? versions[Math.floor(Math.random() * versions.length)].scryfallId : null;
            }).filter((id): id is string => id !== null),
            deckList: cardNames.map(name => {
                const versions = eligible.filter((c: CollectionCard) => c.name === name);
                return { name, scryfallId: versions.length > 0 ? versions[Math.floor(Math.random() * versions.length)].scryfallId : null };
            }),
            suggestedDetails,
            deckUrl: `https://edhrec.com/commanders/${allCommanderNames[0].toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        });
    } catch (err) {
        console.error("Auto-build error:", err);
        return NextResponse.json({ error: "Failed to build deck", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
