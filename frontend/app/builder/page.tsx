'use client';

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn, signOut } from "next-auth/react";
import { CollectionCard, Deck, ScryfallCard } from '@/lib/types';
import { ColorPicker } from '@/components/ColorPicker';
import { CardGrid } from '@/components/CardGrid';
import { DeckSidebar } from '@/components/DeckSidebar';
import { GoldfishModal } from '@/components/GoldfishModal';
import { ArrowLeft, Filter, Search, Sparkles, Dices, Hand, Package } from 'lucide-react';
import { TopBar } from '@/components/TopBar';

import { API_BASE_URL } from '@/lib/api';

function BuilderContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deckId = searchParams.get('deckId');
    const { data: session } = useSession();
    const [collection, setCollection] = useState<CollectionCard[]>([]);
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [deck, setDeck] = useState<Deck>({ commanders: [], cards: [], colors: [], missingCards: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'commander' | 'library'>('commander');
    const [isAutoBuilding, setIsAutoBuilding] = useState(false);
    const [isGoldfishOpen, setIsGoldfishOpen] = useState(false);
    const [chaosLoading, setChaosLoading] = useState(false);
    const [isSavingDeck, setIsSavingDeck] = useState(false);
    const hasLoadedDeck = useRef(false);

    const handleSaveDeck = async () => {
        console.log('[Save] handleSaveDeck initiated. isUpdate:', !!deckId, 'deckId:', deckId);

        if (!session && process.env.NODE_ENV !== 'development') {
            alert('Please sign in to save your deck!');
            return;
        }

        if (!deck.commanders || deck.commanders.length === 0) {
            console.log('[Save] Aborted: No commander selected');
            alert('Please select a commander first!');
            return;
        }

        setIsSavingDeck(true);
        try {
            const isUpdate = !!deckId;
            let finalName = '';

            if (!isUpdate) {
                finalName = prompt('Enter a name for your deck:', `${deck.commanders[0].name} Deck`) || '';
                if (!finalName) {
                    console.log('[Save] Aborted: No name provided');
                    setIsSavingDeck(false);
                    return;
                }
            }

            const url = isUpdate ? `${API_BASE_URL}/decks/${deckId}` : `${API_BASE_URL}/decks`;
            const method = isUpdate ? 'PATCH' : 'POST';

            console.log(`[Save] Sending ${method} request to ${url}`);

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: finalName || undefined,
                    commanders: deck.commanders,
                    cards: deck.cards,
                    colors: deck.colors
                })
            });

            if (res.ok) {
                const data = await res.json();
                console.log('[Save] Request successful:', data);

                if (!isUpdate && data.deck?.id) {
                    console.log('[Save] New deck created, updating URL to deckId:', data.deck.id);
                    hasLoadedDeck.current = true;
                    // Force a hard navigation-like update to clear any stale state
                    router.replace(`/builder?deckId=${data.deck.id}`);
                }

                alert(isUpdate ? 'Deck updated successfully!' : 'Deck saved successfully!');
            } else {
                const err = await res.json();
                console.error('[Save] Request failed:', err);
                throw new Error(err.error || 'Failed to save deck');
            }
        } catch (e: any) {
            console.error('[Save] Fatal error:', e);
            alert(`Error saving deck: ${e.message}`);
        } finally {
            setIsSavingDeck(false);
        }
    };

    const handleResetWorkspace = () => {
        console.log('[Reset] handleResetWorkspace initiated');
        if (confirm('Are you sure you want to clear this workspace and start a fresh deck?')) {
            // 1. Clear State
            setDeck({ commanders: [], cards: [], colors: [], missingCards: [] });
            setActiveTab('commander');
            setSelectedColors([]);
            hasLoadedDeck.current = false;

            // 2. Clear URL - Use router.replace to /builder to remove ?deckId=...
            console.log('[Reset] Clearing URL and redirecting to /builder');
            router.replace('/builder');
        }
    };

    // Load collection on mount
    useEffect(() => {
        const fetchCollection = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/collection`);
                if (!res.ok) throw new Error('Failed to fetch collection');
                const data = await res.json();
                if (data.collection && data.collection.length > 0) {
                    setCollection(data.collection);
                } else {
                    router.push('/');
                }
            } catch (e) {
                console.error('Failed to load collection', e);
                router.push('/');
            }
        };

        fetchCollection();
    }, [router]);

    // Load deck if deckId is present
    useEffect(() => {
        if (!deckId || hasLoadedDeck.current) return;

        const loadSavedDeck = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/decks`);
                if (!res.ok) return;
                const { decks } = await res.json();
                const savedDeck = decks.find((d: any) => d.id === deckId);

                if (savedDeck) {
                    // Start by finding the full details of the commanders
                    // Since the user collection is already being fetched, we can wait for it
                    if (collection.length === 0) return;

                    const savedCommanders = collection.filter(c =>
                        savedDeck.commander_ids?.includes(c.scryfallId)
                    ).map(c => c.details).filter(Boolean);

                    if (savedCommanders.length > 0) {
                        setDeck({
                            commanders: savedCommanders as ScryfallCard[],
                            cards: savedDeck.card_ids || [],
                            colors: savedDeck.colors || [],
                            missingCards: []
                        });
                        if (savedDeck.colors) setSelectedColors(savedDeck.colors);
                        setActiveTab('library');
                        hasLoadedDeck.current = true; // Mark as loaded
                    }
                }
            } catch (e) {
                console.error('Failed to load saved deck', e);
            }
        };

        if (collection.length > 0) {
            loadSavedDeck();
        }
    }, [deckId, collection]);

    // Update deck colors when commanders change
    useEffect(() => {
        const commanders = deck.commanders || [];
        if (commanders.length > 0) {
            const allColors = new Set<string>();
            commanders.forEach(c => {
                (c.color_identity || []).forEach(color => allColors.add(color));
            });
            const mergedColors = Array.from(allColors);
            setDeck(prev => ({ ...prev, colors: mergedColors }));
        }
    }, [deck.commanders]);

    // Filter Logic
    const filteredCards = useMemo(() => {
        let filtered = collection;

        // 1. Filter by Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c.details?.type_line.toLowerCase().includes(q));
        }

        // 2. Filter by Mode (Commander vs Library)
        if (activeTab === 'commander') {
            const commanders = deck.commanders || [];

            const potentialCommanders = filtered.filter(c => {
                // Exclude already selected commanders
                if (commanders.some(cmdr => cmdr.name === c.name)) return false;

                const type = c.details?.type_line || '';
                const isLegendaryCreature = type.includes('Legendary Creature');
                const isBackground = type.includes('Background');
                const isPlaneswalkerCommander = type.includes('Planeswalker') && (c.details?.oracle_text?.includes('can be your commander') || false);

                if (!isLegendaryCreature && !isPlaneswalkerCommander && !isBackground) return false;

                // If we have one commander, filter for valid partners
                if (commanders.length === 1) {
                    const first = commanders[0];
                    const firstOracle = (first.oracle_text || "").toLowerCase();
                    const firstKeywords = first.keywords || [];

                    const isFirstPartner = firstKeywords.includes("Partner");
                    const isFirstPartnerWith = firstOracle.includes("partner with");
                    const isFirstBackgroundPicker = firstOracle.includes("choose a background");
                    const isFirstFriendsForever = firstKeywords.includes("Friends forever");

                    if (isFirstPartnerWith) {
                        // Extract specific partner name from text like "Partner with Alisaie Leveilleur"
                        const targetMatch = firstOracle.match(/partner with ([^\n]+)/);
                        if (targetMatch) {
                            let targetName = targetMatch[1].trim();
                            // Remove parenthetical text like "(When this...)"
                            targetName = targetName.split('(')[0].trim().toLowerCase();
                            // Only show cards that match this specific partner name
                            if (targetName && !c.name.toLowerCase().includes(targetName)) {
                                return false;
                            }
                        }
                    } else if (isFirstPartner) {
                        // Generic partner - show all cards with Partner
                        if (!c.details?.keywords?.includes("Partner")) return false;
                    } else if (isFirstBackgroundPicker) {
                        // Show only Backgrounds
                        if (!isBackground) return false;
                    } else if (isFirstFriendsForever) {
                        // Show only Friends Forever
                        if (!c.details?.keywords?.includes("Friends forever")) return false;
                    } else {
                        // First commander can't have partners
                        return false;
                    }
                }

                // Color Identity Check
                if (selectedColors.length > 0) {
                    const identity = c.details?.color_identity || [];
                    return identity.every(color => selectedColors.includes(color));
                }
                return true;
            });

            const uniqueCommanders = new Map();
            potentialCommanders.forEach(c => {
                if (!uniqueCommanders.has(c.name)) {
                    uniqueCommanders.set(c.name, c);
                }
            });
            return Array.from(uniqueCommanders.values());
        } else {
            // Library Mode
            if (!deck.commanders || deck.commanders.length === 0) return []; // Need commander first

            const commanderIdentity = deck.colors || [];

            let result = filtered.filter(c => {
                // Exclude if it is one of the commanders
                if (deck.commanders?.some(cmdr => cmdr.name === c.name)) return false;

                // Exclude cards already in deck (Singleton Rule by Name)
                // Exception: Basic Lands
                const isBasicLand = c.details?.type_line?.includes('Basic Land');

                if (!isBasicLand) {
                    const alreadyInDeck = deck.cards.some(dc => dc.name === c.name);
                    if (alreadyInDeck) return false;
                }

                // Color Identity Check: Must be subset of Commander's identity
                const identity = c.details?.color_identity || [];

                // Card identity must be subset of Commander identity
                // Exception: Colorless cards (identity []) are always allowed
                return identity.every(color => commanderIdentity.includes(color));
            });
            return result;
        }
    }, [collection, searchQuery, activeTab, selectedColors, deck.commanders, deck.cards, deck.colors]);

    // Actions
    // Actions
    const addCommander = (card: CollectionCard) => {
        if (!card.details) return;
        const newCommander = card.details as ScryfallCard;
        const currentCommanders = deck.commanders || [];

        // Check if commander can have partners
        const canAddMore = (cmdr: ScryfallCard) => {
            const oracle = cmdr.oracle_text || "";
            const keywords = cmdr.keywords || [];
            return keywords.includes("Partner") ||
                oracle.includes("Partner with") ||
                oracle.includes("Choose a Background") ||
                keywords.includes("Friends forever");
        };

        if (currentCommanders.length === 0) {
            setDeck(prev => ({ ...prev, commanders: [newCommander] }));
            if (!canAddMore(newCommander)) {
                setActiveTab('library');
            }
        } else if (currentCommanders.length === 1) {
            const first = currentCommanders[0];
            const firstOracle = first.oracle_text || "";
            const firstKeywords = first.keywords || [];

            const isSecondPartner = newCommander.keywords?.includes("Partner") || (newCommander.oracle_text?.includes("Partner with") && newCommander.oracle_text?.includes(first.name));
            const isSecondBackground = newCommander.type_line.includes("Background");
            const isFirstBackgroundPicker = firstOracle.includes("Choose a Background");
            const isFirstPartner = firstKeywords.includes("Partner") || firstOracle.includes("Partner with");
            const isFriendsForever = firstKeywords.includes("Friends forever") && newCommander.keywords?.includes("Friends forever");

            if ((isFirstPartner && isSecondPartner) || (isFirstBackgroundPicker && isSecondBackground) || isFriendsForever) {
                setDeck(prev => ({ ...prev, commanders: [...(prev.commanders || []), newCommander] }));
                setActiveTab('library');
            } else {
                // Replace first if not compatible
                setDeck(prev => ({ ...prev, commanders: [newCommander] }));
                if (!canAddMore(newCommander)) {
                    setActiveTab('library');
                }
            }
        } else {
            // Replace all
            setDeck(prev => ({ ...prev, commanders: [newCommander] }));
            if (!canAddMore(newCommander)) {
                setActiveTab('library');
            }
        }
    };

    const addToDeck = (card: CollectionCard) => {
        setDeck(prev => ({ ...prev, cards: [...prev.cards, card] }));
    };

    const removeFromDeck = (card: CollectionCard) => {
        setDeck(prev => {
            const idx = prev.cards.findIndex(c => c.scryfallId === card.scryfallId);
            if (idx === -1) return prev;
            const newCards = [...prev.cards];
            newCards.splice(idx, 1);
            return { ...prev, cards: newCards };
        });
    };

    const removeCommander = (cmdr: ScryfallCard) => {
        setDeck(prev => {
            const remainingCommanders = (prev.commanders || []).filter(c => c.id !== cmdr.id);
            return { ...prev, commanders: remainingCommanders };
        });
        if ((deck.commanders?.length || 0) <= 1) {
            setActiveTab('commander');
            setSelectedColors([]);
        }
    };

    const handleAutoBuild = async () => {
        if (!deck.commanders || deck.commanders.length === 0) return;
        const commanderName = deck.commanders[0].name;

        setIsAutoBuilding(true);
        try {
            const response = await fetch(`${API_BASE_URL}/auto-build`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commanderName: commanderName,
                    collection: collection
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to auto-build');
            }

            const data = await response.json();
            const { cardNames, suggestedDetails = [] } = data;

            const addedCards: CollectionCard[] = [];
            const missing: ScryfallCard[] = [];

            // Track added counts to handle basic lands and singleton enforcement
            const addedCounts: Record<string, number> = {};

            // Match suggested cards with collection
            cardNames.forEach((cardName: string) => {
                const isBasicLand = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'].includes(cardName);

                // If not basic land and already added, skip (enforce singleton for non-basics)
                if (!isBasicLand && addedCounts[cardName]) return;

                const cardInCollection = collection.find(
                    c => c.name.toLowerCase() === cardName.toLowerCase()
                );

                if (cardInCollection) {
                    // Check if already in deck (for non-basics)
                    const alreadyInDeck = deck.cards.some(dc => dc.name === cardInCollection.name);

                    if (isBasicLand || !alreadyInDeck) {
                        // For basic lands, we can add multiple. For others, just one.
                        // If we are adding a basic land from collection, we clone it to ensure unique IDs if needed, 
                        // or just reuse if we don't care about unique IDs for collection items (but we should for React keys)
                        // Better to create a copy for the deck.
                        addedCards.push({
                            ...cardInCollection,
                            scryfallId: isBasicLand ? `${cardInCollection.scryfallId}-${Math.random()}` : cardInCollection.scryfallId
                        });
                        addedCounts[cardName] = (addedCounts[cardName] || 0) + 1;
                    }
                } else {
                    // Find details in suggestedDetails
                    const details = suggestedDetails.find((d: ScryfallCard) => d.name === cardName);
                    if (details) {
                        missing.push(details);
                        addedCounts[cardName] = (addedCounts[cardName] || 0) + 1;
                    } else if (isBasicLand) {
                        // Generate dummy basic land
                        const basicMap: Record<string, string> = {
                            'Plains': 'W', 'Island': 'U', 'Swamp': 'B', 'Mountain': 'R', 'Forest': 'G', 'Wastes': 'C'
                        };
                        const color = basicMap[cardName] || 'C';

                        addedCards.push({
                            quantity: 1,
                            name: cardName,
                            scryfallId: `basic-${cardName}-${Math.random()}`,
                            details: {
                                id: `basic-${cardName}-dummy`,
                                name: cardName,
                                cmc: 0,
                                type_line: `Basic Land — ${cardName}`,
                                color_identity: [color],
                                rarity: 'common',
                                set_name: 'Basic Lands',
                                set: 'basic',
                                collector_number: '0',
                                image_uris: {
                                    small: `https://cards.scryfall.io/large/front/dummy/${cardName.toLowerCase()}.jpg`, // Placeholder, won't load but prevents crash
                                    normal: `https://cards.scryfall.io/large/front/dummy/${cardName.toLowerCase()}.jpg`,
                                    large: '',
                                    png: '',
                                    art_crop: '',
                                    border_crop: ''
                                }
                            } as ScryfallCard
                        });
                        addedCounts[cardName] = (addedCounts[cardName] || 0) + 1;
                    } else {
                        console.warn(`No details found for missing card: ${cardName}`);
                    }
                }
            });

            // Update deck with new cards and missing list
            setDeck(prev => ({
                ...prev,
                cards: [...prev.cards, ...addedCards],
                missingCards: missing,
            }));

        } catch (error) {
            console.error('Auto-build failed:', error);
            alert('Failed to auto-build deck. Please try again.');
        } finally {
            setIsAutoBuilding(false);
        }
    };

    const handleBalanceDeck = () => {
        if (!deck.commanders || deck.commanders.length === 0) return;

        const TARGET_LANDS = 35;
        const TARGET_TOTAL = 99; // 99 + 1 commander = 100

        // Separate lands from non-lands in current deck
        const currentLands = deck.cards.filter(c => c.details?.type_line?.includes('Land'));

        // Calculate needs
        const landsNeeded = Math.max(0, TARGET_LANDS - currentLands.length);
        const totalSlotsAvailable = TARGET_TOTAL - deck.cards.length;

        // Get available cards from collection
        const commanderIdentity = deck.colors || [];

        console.log('Balance Deck Debug:', {
            currentLandsCount: currentLands.length,
            currentTotalCards: deck.cards.length,
            landsNeeded,
            totalSlotsAvailable,
            commanderIdentity
        });

        if (totalSlotsAvailable <= 0) {
            alert("Deck is already full!");
            return;
        }

        // Helper to check relevance
        const isCardRelevant = (card: CollectionCard) => {
            let text = card.details?.oracle_text || "";
            if (!text && card.details?.card_faces) {
                text = card.details.card_faces.map(f => f.oracle_text).join("\n");
            }

            const colorMap: Record<string, string> = {
                'White': 'W', 'Blue': 'U', 'Black': 'B', 'Red': 'R', 'Green': 'G'
            };

            for (const [colorName, colorCode] of Object.entries(colorMap)) {
                if (!commanderIdentity.includes(colorCode)) {
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

        const availableCards = collection.filter(c => {
            // Allow basic lands even if already in deck (infinite supply)
            const isBasicLand = c.details?.type_line?.includes('Basic Land');
            if (!isBasicLand && deck.cards.some(dc => dc.name === c.name)) return false;
            if (deck.commanders?.some(cmdr => cmdr.name === c.name)) return false;
            const identity = c.details?.color_identity || [];
            if (!identity.every(color => commanderIdentity.includes(color))) return false;
            if (!isCardRelevant(c)) return false;
            return true;
        });

        // Deduplicate available cards (but NOT basic lands)
        const uniqueAvailable = Array.from(
            new Map(
                availableCards
                    .filter(c => !c.details?.type_line?.includes('Basic Land'))
                    .map(c => [c.name, c])
            ).values()
        );

        const availableNonBasicLands = uniqueAvailable.filter(c => c.details?.type_line?.includes('Land'));
        const availableNonLands = uniqueAvailable.filter(c => !c.details?.type_line?.includes('Land'));

        // Sort non-lands by rarity
        const rarityScore = (rarity?: string) => {
            switch (rarity) {
                case 'mythic': return 4;
                case 'rare': return 3;
                case 'uncommon': return 2;
                default: return 1;
            }
        };
        availableNonLands.sort((a, b) => rarityScore(b.details?.rarity) - rarityScore(a.details?.rarity));

        const cardsToAdd: CollectionCard[] = [];
        let slotsLeft = totalSlotsAvailable;

        // 1. Fill Lands First
        // We want to add up to 'landsNeeded', but limited by 'slotsLeft'
        const landsToAddCount = Math.min(landsNeeded, slotsLeft);

        console.log('Land filling:', { landsToAddCount, availableNonBasicLands: availableNonBasicLands.length });

        // Add a mix: up to 50% non-basic lands, rest basic lands
        const maxNonBasics = Math.floor(landsToAddCount * 0.5); // 50% max non-basics
        const nonBasicsToAdd = Math.min(maxNonBasics, availableNonBasicLands.length);

        // Add non-basic lands from collection
        for (let i = 0; i < nonBasicsToAdd; i++) {
            cardsToAdd.push(availableNonBasicLands[i]);
        }

        // Fill remaining land slots with Basics (infinite supply)
        const landsStillNeeded = landsToAddCount - cardsToAdd.length;
        console.log('Basic lands needed:', landsStillNeeded, 'Non-basics added:', nonBasicsToAdd);

        if (landsStillNeeded > 0 && commanderIdentity.length > 0) {
            const basicMap: Record<string, string> = {
                W: "Plains",
                U: "Island",
                B: "Swamp",
                R: "Mountain",
                G: "Forest",
            };

            const perColor = Math.floor(landsStillNeeded / commanderIdentity.length);
            let extra = landsStillNeeded % commanderIdentity.length;

            console.log('Generating basics:', { perColor, extra, colors: commanderIdentity });

            commanderIdentity.forEach(color => {
                const count = perColor + (extra > 0 ? 1 : 0);
                extra--;
                const landName = basicMap[color];

                console.log(`Adding ${count} ${landName}`);

                const realLand = collection.find(c => c.name === landName && c.details?.type_line?.includes('Basic'));

                for (let k = 0; k < count; k++) {
                    cardsToAdd.push({
                        quantity: 1,
                        name: landName,
                        scryfallId: `basic-${landName}-${Math.random()}`,
                        details: realLand?.details || {
                            id: `basic-${landName}-dummy`,
                            name: landName,
                            cmc: 0,
                            type_line: `Basic Land — ${landName}`,
                            color_identity: [color],
                            rarity: 'common',
                            set_name: 'Basic Lands',
                            set: 'basic',
                            collector_number: '0',
                            image_uris: {
                                small: '',
                                normal: '',
                                large: '',
                                png: '',
                                art_crop: '',
                                border_crop: ''
                            }
                        } as ScryfallCard
                    });
                }
            });
        }

        // Update slotsLeft
        slotsLeft -= cardsToAdd.length;

        // 2. Fill remaining slots with Non-Lands
        if (slotsLeft > 0) {
            for (let i = 0; i < Math.min(slotsLeft, availableNonLands.length); i++) {
                cardsToAdd.push(availableNonLands[i]);
            }
        }

        console.log('Total cards to add:', cardsToAdd.length, 'Lands:', cardsToAdd.filter(c => c.details?.type_line?.includes('Land')).length);

        // Update deck
        setDeck(prev => ({
            ...prev,
            cards: [...prev.cards, ...cardsToAdd],
            missingCards: []
        }));

        alert(`Deck balanced! Added ${cardsToAdd.length} cards (${cardsToAdd.filter(c => c.details?.type_line?.includes('Land')).length} lands).`);
    };

    const handleChaosOrb = async () => {
        if (!deck.commanders || deck.commanders.length === 0) return;
        setChaosLoading(true);
        try {
            const colors = deck.colors.join('');
            // If colorless, use id:c. Otherwise id:wubrg
            const query = `commander:${colors || 'c'} (game:paper) -type:conspiracy -type:scheme -type:vanguard`;
            const res = await fetch(`https://api.scryfall.com/cards/random?q=${encodeURIComponent(query)}`);
            const card = await res.json();

            if (card && card.id) {
                addToDeck({
                    name: card.name,
                    quantity: 1,
                    scryfallId: card.id,
                    details: card
                });
                // alert(`The Chaos Orb summoned: ${card.name}!`);
            }
        } catch (e) {
            console.error(e);
            alert("The Chaos Orb fizzled...");
        } finally {
            setChaosLoading(false);
        }
    };

    const getThemeClass = () => {
        if (!deck.commanders || deck.commanders.length === 0) return "bg-slate-950";
        const colors = deck.colors || [];
        if (colors.length === 0) return "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-zinc-900 to-slate-950";

        // Dynamic gradients based on primary color
        const colorMap: Record<string, string> = {
            'W': 'from-slate-900 via-yellow-950/20 to-slate-950',
            'U': 'from-slate-900 via-blue-950/20 to-slate-950',
            'B': 'from-slate-900 via-purple-950/20 to-slate-950',
            'R': 'from-slate-900 via-red-950/20 to-slate-950',
            'G': 'from-slate-900 via-green-950/20 to-slate-950'
        };

        // For multicolor, just pick the first one for now, or a special multi one
        if (colors.length > 1) return "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-fuchsia-950/20 to-slate-950";

        return `bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${colorMap[colors[0]] || 'from-slate-900 to-slate-950'}`;
    };

    return (
        <div className={`min-h-screen text-slate-200 flex transition-colors duration-1000 ${getThemeClass()}`}>
            {/* Fixed Top Bar */}
            <TopBar
                title="Deck Builder"
                subtitle={deck.commanders && deck.commanders.length > 0 ? `Building ${deck.commanders.map(c => c.name).join(' & ')}` : 'Choose your commander'}
            />

            {/* Main Content */}
            <div className="flex-1 mr-80 flex flex-col h-screen overflow-hidden pt-20">
                {/* Filters Bar */}
                {/* Filters Bar */}
                {/* Filters Bar */}
                <div className="bg-slate-900/50 backdrop-blur border-b border-slate-800 p-4 z-10">
                    <div className="max-w-full mx-auto px-6">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1">
                                {/* Search */}
                                <div className="relative flex-1 max-w-md">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Search cards..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-violet-500 w-full transition-colors"
                                    />
                                </div>

                                {/* Color Picker (Only active in Commander selection mode) */}
                                <div className={`flex items-center gap-2 transition-opacity duration-200 ${activeTab === 'library' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                    <Filter className="w-4 h-4 text-slate-500" />
                                    <ColorPicker selectedColors={selectedColors} onChange={setSelectedColors} />
                                </div>
                            </div>

                            {/* User Profile / Login */}
                            <div className="flex-shrink-0">
                                {session ? (
                                    <div className="flex items-center gap-3">
                                        {session.user?.image && (
                                            <img
                                                src={session.user.image}
                                                alt={session.user.name || "User"}
                                                className="w-8 h-8 rounded-full border border-slate-600"
                                            />
                                        )}
                                        <div className="text-right hidden sm:block">
                                            <div className="text-xs text-slate-400">Signed in as</div>
                                            <div className="text-sm font-bold text-slate-200">{session.user?.name}</div>
                                        </div>
                                        <button
                                            onClick={() => signOut()}
                                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-md transition-colors"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => signIn('google')}
                                        className="flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-full text-sm font-bold transition-colors"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        Sign in with Google
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800 bg-slate-900/30">
                    <button
                        onClick={() => setActiveTab('commander')}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'commander' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        1. Choose Commander
                    </button>
                    <button
                        onClick={() => setActiveTab('library')}
                        disabled={!deck.commanders || deck.commanders.length === 0}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'library' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed'}`}
                    >
                        2. Build Library
                    </button>
                </div>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <div className="max-w-full mx-auto">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-white">
                                {activeTab === 'commander' ? 'Select Your Commander' : `Available Cards (${filteredCards.length})`}
                            </h2>
                            {activeTab === 'library' && deck.commanders && deck.commanders.length > 0 && (
                                <div className="flex items-center gap-4">
                                    <div className="text-sm text-slate-400 flex items-center gap-2">
                                        <Filter className="w-4 h-4" />
                                        Filtered by identity:
                                        <div className="flex gap-1">
                                            {deck.colors.length === 0 ? 'Colorless' : deck.colors.map(c => (
                                                <span key={c} className="font-bold">{c}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <CardGrid
                            cards={filteredCards}
                            onAdd={activeTab === 'commander' ? addCommander : addToDeck}
                            actionLabel="add"
                        />
                    </div>
                </main>
            </div >

            {/* Floating Action Buttons */}
            {
                activeTab === 'library' && deck.commanders && deck.commanders.length > 0 && (
                    <div className="fixed bottom-8 right-96 flex gap-4 z-50">
                        <button
                            onClick={handleAutoBuild}
                            disabled={isAutoBuilding}
                            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-3 rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl hover:shadow-violet-500/20 hover:-translate-y-1 border border-violet-400/20 backdrop-blur-sm"
                        >
                            <Sparkles className="w-5 h-5" />
                            {isAutoBuilding ? 'Building...' : 'Auto-Build'}
                        </button>
                        <button
                            onClick={handleBalanceDeck}
                            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3 rounded-full font-bold transition-all shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1 border border-emerald-400/20 backdrop-blur-sm"
                        >
                            Balance Deck
                        </button>
                        <button
                            onClick={handleChaosOrb}
                            disabled={chaosLoading}
                            className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-4 py-3 rounded-full font-bold transition-all shadow-2xl hover:shadow-orange-500/20 hover:-translate-y-1 border border-orange-400/20 backdrop-blur-sm disabled:opacity-50"
                            title="Add a random card (Chaos Orb)"
                        >
                            <Dices className={`w-5 h-5 ${chaosLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => setIsGoldfishOpen(true)}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-full font-bold transition-all shadow-2xl hover:shadow-slate-500/20 hover:-translate-y-1 border border-slate-600/20 backdrop-blur-sm"
                            title="Test Hand (Goldfish)"
                        >
                            <Hand className="w-5 h-5" />
                        </button>
                    </div>
                )
            }

            {/* Sidebar */}
            <DeckSidebar
                deck={deck}
                onRemoveCard={removeFromDeck}
                onRemoveCommander={removeCommander}
                onRemoveMissingCard={(cardName) => {
                    setDeck(prev => ({
                        ...prev,
                        missingCards: prev.missingCards?.filter(c => c.name !== cardName)
                    }));
                }}
                onClearDeck={handleResetWorkspace}
                onSave={handleSaveDeck}
                isSaving={isSavingDeck}
            />


            <GoldfishModal
                isOpen={isGoldfishOpen}
                onClose={() => setIsGoldfishOpen(false)}
                deck={deck.cards}
            />
        </div >
    );
}

export default function BuilderPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
            </div>
        }>
            <BuilderContent />
        </Suspense>
    );
}
