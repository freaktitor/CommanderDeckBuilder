import { NextRequest, NextResponse } from 'next/server';
import { CollectionCard, ScryfallCard } from '@/lib/types';

export async function POST(req: NextRequest) {
    try {
        const { commanderName, collection = [] } = await req.json();

        if (!commanderName) {
            return NextResponse.json({ error: "Commander name is required" }, { status: 400 });
        }

        console.log("Building deck for:", commanderName);

        // Fetch commander data
        const commanderResponse = await fetch(
            `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(commanderName)}`
        );

        if (!commanderResponse.ok) {
            return NextResponse.json({ error: "Commander not found" }, { status: 404 });
        }

        const commander: ScryfallCard = await commanderResponse.json();
        const commanderColors = commander.color_identity ?? [];

        const TARGET_NON_LAND = 60;
        const TARGET_LANDS = 39;
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

            if (card.name.toLowerCase() === commanderName.toLowerCase()) return false;
            if (type.includes("Basic Land")) return false;
            if (!ci.every((c: string) => commanderColors.includes(c))) return false;

            return isCardRelevant(card.details);
        });

        const uniqueEligible = Array.from(new Map(eligible.map((c: CollectionCard) => [c.name, c])).values()) as CollectionCard[];

        // Fetch Staples
        const TARGET_STAPLES = 15;
        const staples: ScryfallCard[] = [];
        const suggestedDetails: ScryfallCard[] = [];

        try {
            const colorQuery = commanderColors.length === 0 ? "id:c" : `id<=${commanderColors.join("")}`;
            const staplesResp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${colorQuery} legal:commander -t:land -t:basic`)}&order=edhrec&dir=asc&page=1`);
            if (staplesResp.ok) {
                const data = await staplesResp.json();
                const list = data.data.filter((c: any) =>
                    c.name !== commanderName &&
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

        let rampCount = 0;
        let drawCount = 0;
        let removalCount = 0;
        let creatureCount = 0;

        staples.forEach(c => {
            cardNames.push(c.name);
            const t = c.type_line || "";
            const n = c.name;

            if (isRamp(t, n)) rampCount++;
            else if (isDraw(n)) drawCount++;
            else if (isRemoval(t, n)) removalCount++;
            else if (isCreature(t, n)) creatureCount++;
        });

        // Categorize Collection
        const creatures = uniqueEligible.filter((c: CollectionCard) => {
            if (cardNames.includes(c.name)) return false;
            const t = c.details?.type_line ?? "";
            const n = c.name;
            return isCreature(t, n);
        });

        const removal = uniqueEligible.filter((c: CollectionCard) => {
            if (cardNames.includes(c.name)) return false;
            const t = c.details?.type_line ?? "";
            const n = c.name;
            return isRemoval(t, n);
        });

        const ramp = uniqueEligible.filter((c: CollectionCard) => {
            if (cardNames.includes(c.name)) return false;
            const t = c.details?.type_line ?? "";
            const n = c.name;
            return isRamp(t, n);
        });

        const draw = uniqueEligible.filter((c: CollectionCard) => {
            if (cardNames.includes(c.name)) return false;
            const n = c.name;
            return isDraw(n);
        });

        const nonBasicLands = uniqueEligible.filter((c: CollectionCard) => {
            const t = c.details?.type_line ?? "";
            return t.includes("Land") && !t.includes("Basic");
        });

        const other = uniqueEligible.filter(
            (c: CollectionCard) => !cardNames.includes(c.name) &&
                !creatures.includes(c) && !removal.includes(c) &&
                !ramp.includes(c) && !draw.includes(c) && !nonBasicLands.includes(c)
        );

        const addCards = (list: CollectionCard[], max: number) => {
            const chosen = list.slice(0, max).map((c) => c.name);
            cardNames.push(...chosen);
            return chosen.length;
        };

        addCards(ramp, Math.max(0, 10 - rampCount));
        addCards(draw, Math.max(0, 5 - drawCount));
        addCards(removal, Math.max(0, 10 - removalCount));
        addCards(creatures, Math.max(0, 30 - creatureCount));

        const remainingSlots = Math.max(0, TARGET_NON_LAND - cardNames.length);
        addCards(other, remainingSlots);

        // Suggest Scryfall fillers
        if (cardNames.length < TARGET_NON_LAND) {
            const need = TARGET_NON_LAND - cardNames.length;
            const colorQuery = commanderColors.length === 0 ? "id:c" : `id<=${commanderColors.join("")}`;
            const scryQuery = `${colorQuery} -t:basic f:commander legal:commander usd<=2`;

            const resp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(scryQuery)}&order=edhrec&dir=asc&page=1`);

            if (resp.ok) {
                const data: { data: ScryfallCard[] } = await resp.json();
                const suggestions = data.data
                    .filter((c) =>
                        c.name.toLowerCase() !== commanderName.toLowerCase() &&
                        !cardNames.includes(c.name) &&
                        isCardRelevant(c)
                    )
                    .slice(0, need);

                suggestions.forEach(c => {
                    cardNames.push(c.name);
                    suggestedDetails.push(c);
                });
            }
        }

        // Add lands
        const basicMap: Record<string, string> = {
            W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest",
        };

        let landCount = 0;
        const eligibleNonBasicLands = uniqueEligible.filter((c: CollectionCard) => {
            const type = c.details?.type_line ?? "";
            const ci = c.details?.color_identity ?? [];
            return (
                type.includes("Land") &&
                !type.includes("Basic") &&
                ci.every((x) => commanderColors.includes(x))
            );
        });

        const nonBasicToAdd = Math.min(eligibleNonBasicLands.length, Math.floor(TARGET_LANDS / 2));
        eligibleNonBasicLands.slice(0, nonBasicToAdd).forEach((c: CollectionCard) => cardNames.push(c.name));
        landCount += nonBasicToAdd;

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
            deckName: `Auto-built ${commanderName} deck`,
            cardNames,
            suggestedDetails,
            deckUrl: `https://edhrec.com/commanders/${commander.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        });

    } catch (err) {
        console.error("Auto-build error:", err);
        return NextResponse.json({
            error: "Failed to build deck",
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
