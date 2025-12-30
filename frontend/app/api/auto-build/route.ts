import { NextRequest, NextResponse } from 'next/server';
import { CollectionCard, ScryfallCard } from '@/lib/types';

export async function POST(req: NextRequest) {
    try {
        // Support both single commanderName and array of commanderNames (for partners)
        const { commanderNames = [], commanderName, collection = [] } = await req.json();
        const allCommanderNames: string[] = commanderNames.length > 0 ? commanderNames : (commanderName ? [commanderName] : []);

        if (allCommanderNames.length === 0) {
            return NextResponse.json({ error: "Commander name is required" }, { status: 400 });
        }

        console.log("Building deck for commanders:", allCommanderNames);

        // Fetch all commander data and merge color identities
        let commanderColors: string[] = [];
        for (const cmdName of allCommanderNames) {
            const commanderResponse = await fetch(
                `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cmdName)}`
            );

            if (!commanderResponse.ok) {
                return NextResponse.json({ error: `Commander not found: ${cmdName}` }, { status: 404 });
            }

            const commander: ScryfallCard = await commanderResponse.json();
            const colors = commander.color_identity ?? [];
            // Merge colors (avoid duplicates)
            colors.forEach(c => {
                if (!commanderColors.includes(c)) commanderColors.push(c);
            });
        }

        console.log("Merged commander colors:", commanderColors);

        // Helper to detect commander synergies
        const detectCommanderSynergies = (commanders: ScryfallCard[]) => {
            const synergies = {
                landSubtypes: [] as string[],
                strategies: [] as string[], // e.g., 'LandMatters', 'Tokens'
            };

            const landSubtypes = ['Town', 'Gate', 'Desert', 'Cave', 'Lair', 'Sphere', 'Locus'];

            for (const cmd of commanders) {
                const text = cmd.oracle_text?.toLowerCase() || '';

                // 1. Detect Land Subtypes
                for (const subtype of landSubtypes) {
                    if (text.includes(subtype.toLowerCase())) {
                        if (!synergies.landSubtypes.includes(subtype)) {
                            synergies.landSubtypes.push(subtype);
                        }
                    }
                }

                // 2. Detect Land Matters Strategy
                // If it cares about specific lands (Towns) or mentions "landfall", "lands you control"
                if (
                    synergies.landSubtypes.length > 0 ||
                    text.includes('landfall') ||
                    text.includes('lands you control') ||
                    text.includes('number of lands') ||
                    text.includes('land entering') ||
                    text.includes('play an additional land')
                ) {
                    if (!synergies.strategies.includes('LandMatters')) {
                        synergies.strategies.push('LandMatters');
                    }
                }
            }
            return synergies;
        };

        // Fetch commanders to detect synergies
        const commanders: ScryfallCard[] = [];
        for (const cmdName of allCommanderNames) {
            const commanderResponse = await fetch(
                `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cmdName)}`
            );
            if (commanderResponse.ok) {
                const cmdData = await commanderResponse.json();
                commanders.push(cmdData);
            }
        }
        const synergies = detectCommanderSynergies(commanders);
        console.log("Detected synergies:", synergies);

        // Calculate deck size based on number of commanders
        const commanderCount = allCommanderNames.length;
        const TARGET_DECK_SIZE = 100 - commanderCount; // 99 for 1 commander, 98 for 2 partners
        const TARGET_LANDS = Math.floor(TARGET_DECK_SIZE * 0.38); // ~38% lands
        const TARGET_NON_LAND = TARGET_DECK_SIZE - TARGET_LANDS;

        console.log(`Building ${TARGET_DECK_SIZE} cards (${TARGET_NON_LAND} non-lands, ${TARGET_LANDS} lands) for ${commanderCount} commander(s)`);

        const cardNames: string[] = [];

        // Helper to check relevance
        const isCardRelevant = (cardObj: any) => {
            if (!cardObj) return true;
            let text = cardObj.oracle_text || "";
            if (!text && cardObj.card_faces) {
                text = cardObj.card_faces.map((f: any) => f.oracle_text || "").join("\n");
            }

            const colorMap: Record<string, string> = {
                'White': 'W', 'Blue': 'U', 'Black': 'B', 'Red': 'R', 'Green': 'G'
            };

            for (const [colorName, colorCode] of Object.entries(colorMap)) {
                if (!commanderColors.includes(colorCode)) {
                    const regex = new RegExp(`\\b${colorName}\\b`, 'i');
                    if (regex.test(text)) {
                        if (
                            /protection from/i.test(text) ||
                            /destroy/i.test(text) ||
                            /exile/i.test(text) ||
                            /opponent/i.test(text) ||
                            /choose a color/i.test(text) ||
                            /any color/i.test(text) ||
                            /landwalk/i.test(text)
                        ) {
                            continue;
                        }
                        return false;
                    }
                }
            }
            return true;
        };

        // Filter collection
        const eligible = collection.filter((card: CollectionCard) => {
            const type = card.details?.type_line ?? "";
            const ci = card.details?.color_identity ?? [];

            if (allCommanderNames.some(n => card.name.toLowerCase() === n.toLowerCase())) return false;
            if (type.includes("Basic Land")) return false;
            if (!ci.every((c: string) => commanderColors.includes(c))) return false;

            return isCardRelevant(card.details);
        });

        const uniqueEligible = Array.from(new Map(eligible.map((c: CollectionCard) => [c.name, c])).values()) as CollectionCard[];

        // Fetch Staples
        const TARGET_STAPLES = 15;
        const staples: ScryfallCard[] = [];
        const suggestedDetails: ScryfallCard[] = [];

        const colorQuery = commanderColors.length === 0 ? "id:c" : `id<=${commanderColors.join("")}`;

        try {
            const staplesResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${colorQuery} legal:commander -t:land -t:basic`)}&order=edhrec&dir=asc&page=1`);
            if (staplesResp.ok) {
                const data = await staplesResp.json();
                const list = data.data.filter((c: any) =>
                    !allCommanderNames.includes(c.name) &&
                    isCardRelevant(c)
                ).slice(0, TARGET_STAPLES);
                staples.push(...list);
                suggestedDetails.push(...list);
            }
        } catch (e) {
            console.error("Failed to fetch staples", e);
        }

        // Helper predicates
        const isCreature = (t: string, n: string) => t.includes("Creature") && !t.includes("Legendary");
        const isRemoval = (t: string, n: string) => /Instant|Sorcery/.test(t) && /destroy|exile|kill|terminate|path|swords|wrath|damnation|wipe/.test(n.toLowerCase());
        const isRamp = (t: string, n: string) => /(Artifact|Enchantment|Sorcery)/.test(t) && /(sol ring|mana|ramp|cultivate|kodama|reach|signet|talisman|arcane|fellwar)/.test(n.toLowerCase());
        const isDraw = (n: string) => /(draw|rhystic|study|mystic|remora|phyrexian arena|necropotence|sylvan library)/.test(n.toLowerCase());

        // Helper to check for Synergy Cards
        const isSynergyCard = (card: CollectionCard, synergies: any) => {
            const text = (card.details?.oracle_text || "").toLowerCase();

            if (synergies.strategies.includes('LandMatters')) {
                // Return true if card has Landfall, extra lands, or land synergies
                return (
                    text.includes('landfall') ||
                    text.includes('play an additional land') ||
                    text.includes('play extra land') ||
                    text.includes('lands you control') ||
                    // Exclude basics/fetches from being counted as "synergy non-lands"
                    (text.includes('land enters the battlefield') && !text.includes('search your library'))
                );
            }
            return false;
        };

        let rampCount = 0;
        let drawCount = 0;
        let removalCount = 0;
        let creatureCount = 0;

        // Define strict limits
        const MAX_NON_LANDS = TARGET_NON_LAND;

        // Helper to safely add cards respecting limits
        const addUniqueCards = (candidates: CollectionCard[], maxToAdd: number) => {
            let added = 0;
            for (const card of candidates) {
                if (cardNames.length >= MAX_NON_LANDS) break; // STRICT STOP
                if (added >= maxToAdd) break;

                if (!cardNames.includes(card.name)) {
                    // Variety Fix: Pick a random version from the full eligible list
                    const versions = eligible.filter(c => c.name === card.name);
                    const selectedVersion = versions.length > 0
                        ? versions[Math.floor(Math.random() * versions.length)]
                        : card;

                    cardNames.push(selectedVersion.name);
                    // Update: Store the specific version metadata if needed
                    // The 'addedCards' logic in builder/page.tsx will match by name again, 
                    // but wait, if the auto-build response returns just names, the problem remains!
                    // I should return SUGGESTED FULL DATA or ensure the builder picks correctly.
                    added++;
                }
            }
            return added;
        };

        // 2. Fetch & Add Strategy Synergy Cards (High Priority)
        // This fetches "ideal" cards for the strategy from Scryfall
        if (synergies.strategies.includes('LandMatters')) {
            console.log("Fetching high-synergy Land Matters cards...");
            try {
                // Fetch top EDHREC cards for this strategy (Landfall, etc.)
                const themeQuery = `${colorQuery} (o:landfall OR o:"play an additional land" OR o:"lands you control") -t:land legal:commander order:edhrec`;
                const themeResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(themeQuery)}&page=1`);

                if (themeResp.ok) {
                    const themeData = await themeResp.json();
                    const topSynergyCards = themeData.data.slice(0, 20); // Top 20 synergy cards

                    // Separation: Owned vs Missing
                    const ownedSynergy: CollectionCard[] = [];
                    const missingSynergy: ScryfallCard[] = [];

                    topSynergyCards.forEach((scryCard: ScryfallCard) => {
                        // Check if we own it
                        // Variety Fix: Pick a random version if multiple exist in eligible
                        const ownedVersions = eligible.filter((c: CollectionCard) => c.name === scryCard.name);

                        if (ownedVersions.length > 0) {
                            const randomOwned = ownedVersions[Math.floor(Math.random() * ownedVersions.length)];
                            ownedSynergy.push(randomOwned);
                        } else {
                            // If missing, check if it's not the commander
                            if (!allCommanderNames.includes(scryCard.name)) {
                                missingSynergy.push(scryCard);
                            }
                        }
                    });

                    // A. Add OWNED synergy cards first (Priority 1)
                    const addedCount = addUniqueCards(ownedSynergy, 15);
                    console.log(`Added ${addedCount} owned key synergy cards`);

                    // B. Suggest Missing Synergy Cards
                    let addedMissing = 0;
                    for (const missing of missingSynergy) {
                        if (addedMissing >= 5) break;
                        // Suggest if we need to fill space OR just as a suggestion regardless?
                        // Let's add them to deck list ONLY if we have space, effectively treating them as "High Quality Fillers"
                        if (cardNames.length < MAX_NON_LANDS && !cardNames.includes(missing.name)) {
                            cardNames.push(missing.name);
                            suggestedDetails.push(missing); // Identify as suggestion
                            addedMissing++;
                        }
                    }
                    console.log(`Suggested ${addedMissing} missing key synergy cards`);
                }
            } catch (e) {
                console.error("Failed to fetch strategy cards", e);
            }
        }

        // 3. Add Synergy NON-LAND cards from Collection (Secondary Priority)
        // These are cards we own that match the strategy but weren't in the "Top 20" fetch above
        if (synergies.strategies.length > 0) {
            const synergyCards = uniqueEligible.filter(c =>
                !cardNames.includes(c.name) &&
                !c.details?.type_line?.includes('Land') &&
                isSynergyCard(c, synergies)
            );

            // Allocate specific slots for these
            addUniqueCards(synergyCards, 10);
            console.log(`Added secondary synergy non-land cards`);
        }

        // 4. Add Staples (Ramp, Draw, Removal, etc.)

        // Define lists
        const creatures = uniqueEligible.filter(c => !cardNames.includes(c.name) && isCreature(c.details?.type_line || "", c.name));
        const removal = uniqueEligible.filter(c => !cardNames.includes(c.name) && isRemoval(c.details?.type_line || "", c.name));
        const ramp = uniqueEligible.filter(c => !cardNames.includes(c.name) && isRamp(c.details?.type_line || "", c.name));
        const draw = uniqueEligible.filter(c => !cardNames.includes(c.name) && isDraw(c.name));

        // Add Staples with strict limits
        // We prioritize core function over random fillers
        addUniqueCards(ramp, Math.max(0, 10 - rampCount));
        addUniqueCards(draw, Math.max(0, 10 - drawCount));
        addUniqueCards(removal, Math.max(0, 10 - removalCount));

        // Add Creatures (if space permits)
        const currentCreatures = cardNames.filter(n => {
            const c = uniqueEligible.find(x => x.name === n);
            return c && isCreature(c.details?.type_line || "", c.name);
        }).length;
        addUniqueCards(creatures, Math.max(0, 25 - currentCreatures));

        // 5. Fill remaining slots with "Other" eligible cards
        const other = uniqueEligible.filter(c => !cardNames.includes(c.name) && !c.details?.type_line?.includes('Land'));
        addUniqueCards(other, MAX_NON_LANDS - cardNames.length); // Attempt to fill to cap

        // 6. Suggest Scryfall fillers (Only if we REALLY still have space)
        if (cardNames.length < MAX_NON_LANDS) {
            const need = MAX_NON_LANDS - cardNames.length;
            const colorQuery = commanderColors.length === 0 ? "id:c" : `id<=${commanderColors.join("")}`;
            // Use EDHREC rank order for better quality fillers
            const scryQuery = `${colorQuery} -t:basic f:commander legal:commander usd<=2`;

            try {
                const resp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(scryQuery)}&order=edhrec&dir=asc&page=1`);

                if (resp.ok) {
                    const data: { data: ScryfallCard[] } = await resp.json();
                    const suggestions = data.data
                        .filter((c) =>
                            !allCommanderNames.some(n => c.name.toLowerCase() === n.toLowerCase()) &&
                            !cardNames.includes(c.name) &&
                            isCardRelevant(c)
                        )
                        .slice(0, need);

                    suggestions.forEach(c => {
                        cardNames.push(c.name);
                        suggestedDetails.push(c);
                    });
                }
            } catch (e) {
                console.error("Failed to fetch filler suggestions", e);
            }
        }



        // Add lands
        const basicMap: Record<string, string> = {
            W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest",
        };

        let landCount = 0;

        // 1. Prioritize Synergy Lands
        if (synergies.landSubtypes.length > 0) {
            const synergyLands = uniqueEligible.filter((c: CollectionCard) => {
                const type = c.details?.type_line ?? "";
                const ci = c.details?.color_identity ?? [];

                // Must be a land
                if (!type.includes("Land")) return false;

                // Must have the synergistic subtype
                const isSynergistic = synergies.landSubtypes.some(subtype =>
                    type.toLowerCase().includes(subtype.toLowerCase())
                );
                if (!isSynergistic) return false;

                // Must allow color identity (lands can be colorless or match commander)
                // Note: Lands with no color identity (e.g. most Towns) are always valid if they are just lands
                const isValidColor = ci.length === 0 || ci.every((x) => commanderColors.includes(x));

                return isValidColor;
            });

            // Add as many unique synergy lands as possible (up to realistic land count)
            // We want to be generous with these as they are key to the deck
            synergyLands.forEach(c => {
                if (landCount < TARGET_LANDS && !cardNames.includes(c.name)) {
                    cardNames.push(c.name);
                    landCount++;
                }
            });
            console.log(`Added ${landCount} synergy lands (${synergies.landSubtypes.join(', ')})`);
        }

        // 2. Fill remaining slots with other eligible Non-Basic Lands
        const eligibleNonBasicLands = uniqueEligible.filter((c: CollectionCard) => {
            const type = c.details?.type_line ?? "";
            const ci = c.details?.color_identity ?? [];
            return (
                type.includes("Land") &&
                !type.includes("Basic") &&
                !cardNames.includes(c.name) && // Don't add if already added as synergy land
                ci.every((x) => commanderColors.includes(x))
            );
        });

        // We fill up to 50% of TOTAL lands with non-basics (including the already added synergy lands)
        // This ensures we still have room for basics
        const maxNonBasics = Math.floor(TARGET_LANDS * 0.5);
        const remainingNonBasicSlots = Math.max(0, maxNonBasics - landCount);

        const nonBasicToAdd = Math.min(eligibleNonBasicLands.length, remainingNonBasicSlots);
        eligibleNonBasicLands.slice(0, nonBasicToAdd).forEach((c: CollectionCard) => cardNames.push(c.name));
        landCount += nonBasicToAdd;

        // 3. Fill remaining with Basic Lands
        const remaining = TARGET_LANDS - landCount;
        const perColor = commanderColors.length ? Math.floor(remaining / commanderColors.length) : 0;
        const extra = commanderColors.length ? remaining % commanderColors.length : 0;

        commanderColors.forEach((color, i) => {
            const landName = basicMap[color as keyof typeof basicMap];
            if (!landName) return;

            let count = perColor + (i < extra ? 1 : 0);
            for (let x = 0; x < count; x++) cardNames.push(landName);
        });

        return NextResponse.json({
            success: true,
            deckName: `Auto-built ${allCommanderNames.join(' & ')} deck`,
            cardNames, // Keep for compatibility
            cardIds: cardNames.map(name => {
                // Find a version in eligible
                const versions = eligible.filter(c => c.name === name);
                return versions.length > 0 ? versions[Math.floor(Math.random() * versions.length)].scryfallId : null;
            }).filter(Boolean),
            suggestedDetails,
            deckUrl: `https://edhrec.com/commanders/${allCommanderNames[0].toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        });

    } catch (err) {
        console.error("Auto-build error:", err);
        return NextResponse.json({
            error: "Failed to build deck",
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
