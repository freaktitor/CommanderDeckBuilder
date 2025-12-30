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
                'Aristocrats': ['sacrifice', 'die', 'deaths', 'graveyard', 'whenever a creature you control dies', 'drain', 'loses life'],
                'Tokens': ['token', 'create', 'whenever you create', 'each creature you control gets +'],
                'Artifacts': ['artifact', 'whenever an artifact'],
                'Enchantments': ['enchantment', 'whenever an enchantment'],
                'Spellslinger': ['instant', 'sorcery', 'whenever you cast an instant'],
                'Counters': ['counter', 'proliferate'],
                'Lifegain': ['life', 'gain', 'whenever you gain life'],
                'Equipment': ['equip', 'equipment', 'attached'],
                'VanillaMatters': ['no abilities', 'no ability', 'creatures you control with no abilities'],
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

        function isVanilla(details: any) {
            if (!details || !details.type_line?.includes('Creature')) return false;
            // Clean oracle text of reminder text (parentheses) and trim
            const text = (details.oracle_text || "").replace(/\(.*\)/g, "").trim();
            return text.length === 0;
        }

        function isCreature(t: string) { return t.includes("Creature") && !t.includes("Legendary"); }
        function isRemoval(details: any) {
            const t = details?.type_line || "";
            const n = (details?.name || "").toLowerCase();
            const o = (details?.oracle_text || "").toLowerCase();
            const removalTerms = /destroy|exile|counter target|loses all abilities|return target .* to its owner's hand|deals .* damage to target creature|damage to each creature/i;
            const names = /path to exile|swords to plowshares|beast within|generous gift|pongify|rapid hybridization|chaos warp|stroke of midnight|assassin's trophy|anguished unmaking|utter end|deadly dispute|village rites/i;
            return /Instant|Sorcery/.test(t) && (removalTerms.test(o) || names.test(n));
        }
        function isRamp(details: any) {
            const t = details?.type_line ?? "";
            const n = details?.name?.toLowerCase() ?? "";
            const text = details?.oracle_text?.toLowerCase() ?? "";
            const cmc = details?.cmc ?? 0;
            if (/(Artifact|Enchantment|Sorcery|Creature)/.test(t) && (/(sol ring|mana|ramp|cultivate|kodama|reach|signet|talisman|arcane|fellwar|treasure|add)/.test(n) || (text.includes('search your library for a') && text.includes('land card')))) {
                if (cmc >= 3 && /(manalith|geode|prizm|sphere)/.test(n)) return false;
                return true;
            }
            return false;
        }
        function isDraw(n: string) { return /(draw|rhystic|study|mystic|remora|phyrexian arena|necropotence|sylvan library|dispute|rites|night's whisper|sign in blood)/.test(n.toLowerCase()); }
        function isFinisher(details: any) {
            const text = (details?.oracle_text || "").toLowerCase();
            const n = (details?.name || "").toLowerCase();
            return /(each opponent loses.*life|loses.*life.*you gain|whenever.*token.*dies|whenever.*creature.*dies|damage to each opponent|scute swarm|mirkwood bats|craterhoof|moonshaker|overrun|insurrection|torment of hailfire)/i.test(text) ||
                /(blood artist|zulaport cutthroat|cruel celebrant|bastion of remembrance|mirkwood bats)/.test(n);
        }

        function isSynergyCard(card: CollectionCard, sObj: any) {
            const details = card.details;
            if (!details) return false;
            const text = (details.oracle_text || "").toLowerCase();
            const typeLine = (details.type_line || "").toLowerCase();
            if (sObj.exclusiveTypes.some((t: string) => typeLine.includes(t.toLowerCase()))) return true;
            const strategyMap: Record<string, string[]> = {
                'Aristocrats': ['sacrifice', 'die', 'deaths', 'graveyard', 'drain', 'loses life'],
                'Tokens': ['token', 'create', 'whenever you create', 'each creature you control gets +'],
                'Artifacts': ['artifact', 'whenever an artifact'],
                'Enchantments': ['enchantment', 'whenever an enchantment'],
                'Spellslinger': ['instant', 'sorcery', 'whenever you cast an instant'],
                'Lifegain': ['life', 'gain', 'whenever you gain life'],
                'Equipment': ['equip', 'equipment', 'attached'],
                'Counters': ['counter', 'proliferate'],
                'LandMatters': ['landfall', 'play an additional land', 'lands you control']
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
            const blacklist = ['mystic skull', 'breaching dragonstorm', 'kill shot', 'fountainport bell', 'world map', 'item shopkeep', 'town greeter', 'zulaport duelist', 'beloved chaplain', 'borderland ranger', 'jaddi offshoot', 'champion of the flame', 'wojek bodyguard', 'dakra mystic', 'tithe taker'];
            if (blacklist.some(b => lowerName.includes(b))) return false;
            if (cmc >= 5 && type.includes('Creature') && !/whenever|when|at the beginning|flying|trample|ward|lifelink|deathtouch|menace|vigilance|reach|defender/i.test(text)) return false;
            if (type.includes('Creature')) {
                if (cmc <= 2 && !isSynergyCard({ details: cardObj } as any, synergies) && !/when .* enters|draw|add|ramp/i.test(text) && text.length < 50) return false;
            }
            if (synergies.primaryStrategy && cardNames.length > TARGET_NON_LAND * 0.6 && !isSynergyCard({ details: cardObj } as any, { ...synergies, strategies: [synergies.primaryStrategy] }) && !/when .* enters|whenever|draw|destroy|exile|add|ramp/i.test(text)) return false;

            // Fixed currentCreatures check to avoid blocking builds
            const currentCreatures = cardNames.filter(n => {
                const c = collection.find((cc: any) => cc.name === n);
                return c?.details?.type_line?.includes('Creature');
            }).length;

            if (synergies.primaryStrategy === 'VanillaMatters' && type.includes('Creature') && !isVanilla(cardObj) && !isRamp(cardObj) && !isDraw(lowerName) && !isRemoval(cardObj)) return false;

            if (currentCreatures > 35 && type.includes('Creature') && !/when .* enters|whenever|draw|destroy|exile|add|ramp/i.test(text) && !isFinisher(cardObj) && !isSynergyCard({ details: cardObj } as any, synergies)) return false;
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

        // Initialize payload counts
        let auraCount = 0;
        let equipCount = 0;

        // Tracking counts separately for correct cap enforcement
        let landCount = 0;
        let nonLandCount = 0;

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

                // v13: Vanilla Synergy Boost
                if (synergies.primaryStrategy === 'VanillaMatters') {
                    if (isVanilla(a.details)) aGrav += 10;
                    if (isVanilla(b.details)) bGrav += 10;
                }

                // v12: Hardened Parasitic Filter (Disqualification)
                const parasiticCards = { 'umbra mystic': 'Aura', 'siona, captain': 'Aura', 'puresteel paladin': 'Equipment' };
                const aLow = a.name.toLowerCase();
                const bLow = b.name.toLowerCase();
                if (parasiticCards[aLow as keyof typeof parasiticCards] === 'Aura' && auraCount < 6) return 1; // Put b first
                if (parasiticCards[bLow as keyof typeof parasiticCards] === 'Aura' && auraCount < 6) return -1; // Put a first

                // v12: Tribal Engine Weighting (+5 Gravity for match + trigger)
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
                const type = card?.details?.type_line || "";
                const isLand = type.includes('Land');

                if (!isLand && nonLandCount >= MAX_NON_LANDS) continue;
                if (isLand && landCount >= TARGET_LANDS) continue;
                if (added >= maxToAdd) break;

                // v12: Hardened Parasitic Filter (Disqualification)
                const parasiticCards = { 'umbra mystic': 'Aura', 'siona, captain': 'Aura', 'puresteel paladin': 'Equipment' };
                const cLow = card.name.toLowerCase();
                if (parasiticCards[cLow as keyof typeof parasiticCards] === 'Aura' && auraCount < 6) continue;
                if (parasiticCards[cLow as keyof typeof parasiticCards] === 'Equipment' && equipCount < 6) continue;

                if (!cardNames.includes(card.name)) {
                    cardNames.push(card.name);
                    if (isLand) landCount++; else nonLandCount++;
                    if (type.includes('Aura')) auraCount++;
                    if (type.includes('Equipment')) equipCount++;
                    added++;
                }
            }
            return added;
        }

        const colorQuery = commanderColors.length === 0 ? "id:c" : `id<=${commanderColors.join("")}`;
        let rampCount = 0, removalCount = 0, drawCount = 0;

        // v13: Vanilla Scryfall Fetch (e.g. Jasmine Boreal)
        if (synergies.primaryStrategy === 'VanillaMatters') {
            console.log("Fetching vanilla staples...");
            try {
                const vanQuery = `${colorQuery} is:vanilla legal:commander order:edhrec limit:10`;
                const vanResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(vanQuery)}`);
                if (vanResp.ok) {
                    const vanData = await vanResp.json();
                    let vanAdded = 0;
                    for (const v of vanData.data) {
                        if (nonLandCount < MAX_NON_LANDS && !cardNames.includes(v.name) && vanAdded < 8) {
                            cardNames.push(v.name);
                            suggestedDetails.push(v);
                            nonLandCount++;
                            vanAdded++;
                        }
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
                    if (cData.data[0]) {
                        cardNames.push(cData.data[0].name);
                        suggestedDetails.push(cData.data[0]);
                        nonLandCount++;
                    }
                }
            } catch { }
        }

        // Phase 1: High Strategy Staples (Owned only)
        addUniqueCards(uniqueEligible.filter(c => /zulaport|blood artist|cruel celebrant|manufactor|plunderer|sol ring|signet|talisman|arcane signet|fellwar stone/.test(c.name.toLowerCase())), 15);

        // v10.1: Signature Staple Fetching (e.g. Traveling Chocobo)
        if (synergies.creatureTypes.length > 0) {
            console.log("Fetching signature staples for tribes:", synergies.creatureTypes);
            try {
                const tribeQuery = synergies.creatureTypes.slice(0, 2).map(t => `t:${t}`).join(' OR ');
                const signatureQuery = `${colorQuery} (${tribeQuery}) (o:trigger OR o:whenever OR o:additional OR o:"top of your library") order:edhrec limit:5`;
                const sigResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(signatureQuery)}`);
                if (sigResp.ok) {
                    const sigData = await sigResp.json();
                    let sigAdded = 0;
                    for (const l of sigData.data) {
                        if (nonLandCount < MAX_NON_LANDS && !cardNames.includes(l.name) && sigAdded < 5) {
                            cardNames.push(l.name);
                            suggestedDetails.push(l);
                            nonLandCount++;
                            sigAdded++;
                        }
                    }
                }
            } catch (e) { console.error("Failed to fetch signature staples", e); }
        }

        // v8: Synergy Land Fetching (e.g. Towns) - These don't count towards Non-Land cap - LIMIT 5
        if (synergies.landSubtypes.length > 0) {
            console.log("Fetching synergy lands for subtypes:", synergies.landSubtypes);
            try {
                const subQuery = synergies.landSubtypes.map(s => `t:${s}`).join(' OR ');
                const landQuery = `${colorQuery} (${subQuery}) t:land legal:commander`;
                const landResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(landQuery)}&order=edhrec`);
                if (landResp.ok) {
                    const landData = await landResp.json();
                    let landAdded = 0;
                    for (const l of landData.data) {
                        if (landCount < TARGET_LANDS && !cardNames.includes(l.name) && landAdded < 5) {
                            cardNames.push(l.name);
                            suggestedDetails.push(l);
                            landCount++;
                            landAdded++;
                        }
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
                const rr = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${colorQuery} (t:artifact OR t:enchantment OR t:sorcery) (o:add OR o:"search your library for a land") order:edhrec limit:10`)}`);
                if (rr.ok) {
                    let rampAdded = 0;
                    for (const r of (await rr.json()).data) {
                        if (nonLandCount < MAX_NON_LANDS && !cardNames.includes(r.name) && rampAdded < 5) {
                            cardNames.push(r.name); suggestedDetails.push(r); nonLandCount++; rampCount++; rampAdded++;
                        }
                    }
                }
            } catch { }
        }

        // 2. Card Draw (Target 10)
        drawCount += addUniqueCards(uniqueEligible.filter(c => isDraw(c.name)), 10);

        // 3. Interaction (Target 10-12)
        removalCount += addUniqueCards(uniqueEligible.filter(c => isRemoval(c.details)), 12);
        const INTER_MIN = commanderColors.length >= 4 ? 12 : 10;
        if (removalCount < INTER_MIN) {
            console.log("Fetching additional interaction staples...");
            try {
                const interQuery = `${colorQuery} (t:instant OR t:sorcery) (o:destroy OR o:exile OR o:counter) legal:commander order:edhrec limit:10`;
                const interResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(interQuery)}`);
                if (interResp.ok) {
                    const interData = await interResp.json();
                    let interAdded = 0;
                    for (const r of interData.data) {
                        if (nonLandCount < MAX_NON_LANDS && !cardNames.includes(r.name) && interAdded < 6) {
                            cardNames.push(r.name); suggestedDetails.push(r); nonLandCount++; removalCount++; interAdded++;
                        }
                    }
                }
            } catch { }
        }

        // SYNERGY PHASE (Permanents and Engine pieces)
        // Prioritize non-creature synergy pieces (Artifacts/Enchantments) to set payloads
        addUniqueCards(uniqueEligible.filter(c => isSynergyCard(c, synergies) && (c.details?.type_line?.includes('Artifact') || c.details?.type_line?.includes('Enchantment'))), 15);
        addUniqueCards(uniqueEligible.filter(c => isSynergyCard(c, synergies)), 20);

        const addedFins = addUniqueCards(uniqueEligible.filter(c => !cardNames.includes(c.name) && isFinisher(c.details)), 5);
        if (addedFins < 3) {
            try {
                const fr = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${colorQuery} (o:"each opponent loses" OR o:"whenever you create a token" OR o:"whenever a creature you control dies") legal:commander order:edhrec limit:5`)}`);
                if (fr.ok) {
                    for (const f of (await fr.json()).data) {
                        if (nonLandCount < MAX_NON_LANDS && !cardNames.includes(f.name)) {
                            cardNames.push(f.name); suggestedDetails.push(f); nonLandCount++;
                        }
                    }
                }
            } catch { }
        }

        // Fill remaining Non-Lands (Explicitly focusing on density now)
        addUniqueCards(uniqueEligible.filter(c => !cardNames.includes(c.name) && (c.details?.type_line?.includes('Artifact') || c.details?.type_line?.includes('Enchantment'))), MAX_NON_LANDS);
        addUniqueCards(uniqueEligible.filter(c => !cardNames.includes(c.name) && isCreature(c.details?.type_line || '')), MAX_NON_LANDS);
        addUniqueCards(uniqueEligible.filter(c => !cardNames.includes(c.name)), MAX_NON_LANDS);

        const basicMap: Record<string, string> = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };

        uniqueEligible.filter(c => c.details?.type_line?.includes('Land') && isSynergyCard(c, synergies)).forEach(c => {
            if (landCount < TARGET_LANDS && !cardNames.includes(c.name)) { cardNames.push(c.name); landCount++; }
        });
        const utilityLands = uniqueEligible.filter(c => c.details?.type_line?.includes('Land') && !c.details?.type_line?.includes('Basic') && !cardNames.includes(c.name));
        while (landCount < Math.floor(TARGET_LANDS * 0.5) && utilityLands.length > 0) {
            const l = utilityLands.shift();
            if (l && !cardNames.includes(l.name)) { cardNames.push(l.name); landCount++; }
        }

        // Fill remaining slots to exactly 100 with basics, even if non-lands weren't full
        const totalTarget = 100 - allCommanderNames.length;
        const remainingToFill = totalTarget - cardNames.length;
        if (remainingToFill > 0) {
            const perColor = Math.floor(remainingToFill / commanderColors.length);
            const extra = remainingToFill % commanderColors.length;
            commanderColors.forEach((color, i) => {
                const landName = basicMap[color];
                if (landName) {
                    let count = perColor + (i < extra ? 1 : 0);
                    for (let x = 0; x < count; x++) cardNames.push(landName);
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
