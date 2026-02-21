'use client';

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn, signOut } from "next-auth/react";
import { CollectionCard, Deck, ScryfallCard, CardAvailability } from '@/lib/types';
import { ColorPicker } from '@/components/ColorPicker';
import { CardGrid } from '@/components/CardGrid';
import { DeckSidebar } from '@/components/DeckSidebar';
import { GoldfishModal } from '@/components/GoldfishModal';
import { ArrowLeft, Filter, Search, Sparkles, Hand, Package } from 'lucide-react';
import { TopBar } from '@/components/TopBar';

import { AlertModal } from '@/components/AlertModal';
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
    const [isSavingDeck, setIsSavingDeck] = useState(false);
    const [isAutoBuilt, setIsAutoBuilt] = useState(false);

    const hasLoadedDeck = useRef(false);
    const [savedDecks, setSavedDecks] = useState<any[]>([]);

    const fetchDecks = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/decks`);
            if (res.ok) {
                const { decks } = await res.json();
                setSavedDecks(decks || []);
            }
        } catch (e) {
            console.error('Failed to fetch decks for availability', e);
        }
    };

    // Load saved decks to track availability
    useEffect(() => {
        fetchDecks();
    }, []);

    // Calculate Availability Map
    const availabilityMap = useMemo(() => {
        const map: Record<string, CardAvailability> = {};

        // 1. Initial collection counts
        collection.forEach(card => {
            if (!map[card.name]) {
                map[card.name] = { total: 0, used: 0, available: 0 };
            }
            map[card.name].total += card.quantity;
        });

        // 2. Used in OTHER decks
        savedDecks.forEach(d => {
            // Skip the current deck being edited
            if (deckId && d.id === deckId) return;

            // Database uses 'card_ids' and 'commander_ids'
            const cards = d.card_ids || [];
            const commanderIds = d.commander_ids || [];

            // Track used names in THIS saved deck
            const usedInThisDeck = new Set<string>();

            // Account for library cards (full objects stored in card_ids JSONB)
            cards.forEach((c: CollectionCard) => {
                if (!usedInThisDeck.has(c.name)) {
                    if (!map[c.name]) map[c.name] = { total: 0, used: 0, available: 0 };
                    map[c.name].used += 1;
                    usedInThisDeck.add(c.name);
                }
            });

            // Account for commanders (only have IDs normally, we need names)
            // But wait, the user's collection has these cards.
            // Let's try to match IDs back to names using the collection.
            commanderIds.forEach((id: string) => {
                const found = collection.find(cc => cc.scryfallId === id);
                if (found && !usedInThisDeck.has(found.name)) {
                    if (!map[found.name]) map[found.name] = { total: 0, used: 0, available: 0 };
                    map[found.name].used += 1;
                    usedInThisDeck.add(found.name);
                }
            });
        });

        // 3. Used in CURRENT deck
        const usedInCurrentDeck = new Set<string>();
        (deck.commanders || []).forEach(c => {
            if (!usedInCurrentDeck.has(c.name)) {
                if (!map[c.name]) map[c.name] = { total: 0, used: 0, available: 0 };
                map[c.name].used += 1;
                usedInCurrentDeck.add(c.name);
            }
        });
        deck.cards.forEach(c => {
            // For basic lands, availability is usually infinite or not a concern, 
            // but let's follow the collection strictly if they're there.
            // If it's a basic land, we might want to skip usage tracking if we don't care.
            const isBasic = c.details?.type_line?.includes('Basic Land');
            if (!isBasic) {
                if (!usedInCurrentDeck.has(c.name)) {
                    if (!map[c.name]) map[c.name] = { total: 0, used: 0, available: 0 };
                    map[c.name].used += 1;
                    usedInCurrentDeck.add(c.name);
                }
            }
        });

        // 4. Calculate final availability
        Object.keys(map).forEach(name => {
            map[name].available = map[name].total - map[name].used;
        });

        return map;
    }, [collection, savedDecks, deck, deckId]);

    // ... Alert State ...



    // ... existing code ...


    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
        showCancel?: boolean;
        onConfirm?: () => void;
        confirmLabel?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setAlertState({ isOpen: true, title, message, type, showCancel: false });
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setAlertState({
            isOpen: true,
            title,
            message,
            type: 'info',
            showCancel: true,
            onConfirm,
            confirmLabel: 'Clear Deck'
        });
    };

    const handleSaveDeck = async () => {
        console.log('[Save] handleSaveDeck initiated. isUpdate:', !!deckId, 'deckId:', deckId);

        if (!session && process.env.NODE_ENV !== 'development') {
            showAlert('Sign In Required', 'Please sign in to save your deck!', 'error');
            return;
        }

        if (!deck.commanders || deck.commanders.length === 0) {
            console.log('[Save] Aborted: No commander selected');
            showAlert('Commander Missing', 'Please select a commander first!', 'error');
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

                // Refresh decks list to update availability maps
                await fetchDecks();

                if (!isUpdate && data.deck?.id) {
                    console.log('[Save] New deck created, updating URL to deckId:', data.deck.id);
                    hasLoadedDeck.current = true;
                    // Force a hard navigation-like update to clear any stale state
                    router.replace(`/builder?deckId=${data.deck.id}`);
                }

                showAlert('Success', isUpdate ? 'Deck updated successfully!' : 'Deck saved successfully!', 'success');
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
        showConfirm(
            'Clear Workspace',
            'Are you sure you want to clear this workspace and start a fresh deck? This action cannot be undone.',
            () => {
                console.log('[Reset] Clearing workspace verified');
                // 1. Clear State
                setDeck({ commanders: [], cards: [], colors: [], missingCards: [] });
                setActiveTab('commander');
                setSelectedColors([]);
                hasLoadedDeck.current = false;

                // 2. Clear URL
                console.log('[Reset] Clearing URL and redirecting to /builder');
                router.replace('/builder');
            }
        );
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
            filtered = filtered.filter(c => c.name.toLowerCase().includes(q));
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

            return potentialCommanders;
        } else {
            // Library Mode
            if (!deck.commanders || deck.commanders.length === 0) return []; // Need commander first

            const commanderIdentity = deck.colors || [];

            let result = filtered.filter(c => {
                // Exclude if it is one of the commanders
                if (deck.commanders?.some(cmdr => cmdr.name === c.name)) return false;

                // Exclude cards already in deck (by specific card instance/ID)
                // Exception: Basic Lands
                const isBasicLand = c.details?.type_line?.includes('Basic Land');

                if (!isBasicLand) {
                    const alreadyInDeck = deck.cards.some(dc => dc.scryfallId === c.scryfallId);
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

        // Clear search query after selection
        setSearchQuery('');

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
        setSearchQuery('');
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
        // Send all commander names for partner support
        const commanderNames = deck.commanders.map(c => c.name);

        setIsAutoBuilding(true);
        try {
            const response = await fetch(`${API_BASE_URL}/auto-build`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commanderNames: commanderNames, // Send array of all commanders
                    commanderName: commanderNames[0], // Backwards compatibility
                    collection: collection
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to auto-build');
            }

            const data = await response.json();
            const { cardNames = [], cardIds = [], deckList = [], suggestedDetails = [] } = data;

            const addedCards: CollectionCard[] = [];
            const missing: ScryfallCard[] = [];

            // 1. Prefer the structured deckList (guarantees count and artwork variety)
            if (deckList.length > 0) {
                deckList.forEach((item: { name: string; scryfallId: string | null }) => {
                    const isBasicLand = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'].includes(item.name);

                    // Try to find the specific version in collection if ID provided
                    let cardInCollection = item.scryfallId
                        ? collection.find(c => c.scryfallId === item.scryfallId)
                        : null;

                    // Fallback to name match if specific ID not in collection (sanity check)
                    if (!cardInCollection) {
                        cardInCollection = collection.find(c => c.name === item.name);
                    }

                    if (cardInCollection) {
                        addedCards.push({
                            ...cardInCollection,
                            scryfallId: isBasicLand ? `${cardInCollection.scryfallId}-${Math.random()}` : cardInCollection.scryfallId
                        });
                    } else {
                        // Card not in collection, it's missing
                        const details = suggestedDetails.find((d: ScryfallCard) => d.name === item.name);

                        if (details) {
                            missing.push(details);
                        } else if (isBasicLand) {
                            // Dummy basic land generation for completeness
                            addedCards.push({
                                quantity: 1,
                                name: item.name,
                                scryfallId: `basic-${item.name}-${Math.random()}`,
                                details: { id: `dummy-${item.name}`, name: item.name, type_line: "Basic Land", image_uris: { normal: "" } } as any
                            });
                        }
                    }
                });
            } else {
                // Legacy fallback: Match by name
                const addedCounts: Record<string, number> = {};
                cardNames.forEach((cardName: string) => {
                    const isBasicLand = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'].includes(cardName);
                    if (!isBasicLand && addedCounts[cardName]) return;

                    const cardInCollection = collection.find(c => c.name.toLowerCase() === cardName.toLowerCase());

                    if (cardInCollection) {
                        addedCards.push({
                            ...cardInCollection,
                            scryfallId: isBasicLand ? `${cardInCollection.scryfallId}-${Math.random()}` : cardInCollection.scryfallId
                        });
                        addedCounts[cardName] = (addedCounts[cardName] || 0) + 1;
                    } else {
                        const details = suggestedDetails.find((d: ScryfallCard) => d.name === cardName);
                        if (details) {
                            missing.push(details);
                            addedCounts[cardName] = (addedCounts[cardName] || 0) + 1;
                        } else if (isBasicLand) {
                            addedCards.push({
                                quantity: 1,
                                name: cardName,
                                scryfallId: `basic-${cardName}-${Math.random()}`,
                                details: { id: `dummy-${cardName}`, name: cardName, type_line: "Basic Land", image_uris: { normal: "" } } as any
                            });
                        }
                    }
                });
            }

            // Update deck with new cards and missing list
            setDeck(prev => ({
                ...prev,
                cards: addedCards,
                missingCards: missing
            }));
            setIsAutoBuilt(true);

        } catch (error) {
            console.error('Auto-build failed:', error);
            showAlert('Auto-Build Failed', 'Failed to auto-build deck. Please try again.', 'error');
        } finally {
            setIsAutoBuilding(false);
        }
    };

    const handleBalanceDeck = () => {
        if (!deck.commanders || deck.commanders.length === 0) return;

        const missingCards = deck.missingCards || [];

        if (missingCards.length === 0) {
            showAlert('Deck Complete', "No missing cards to replace! Your deck is already complete.", 'success');
            return;
        }

        const commanderIdentity = deck.colors || [];
        const commanderCount = deck.commanders?.length || 1;
        const TARGET_TOTAL = 100 - commanderCount; // 99 for 1 commander, 98 for 2 partners
        const currentDeckSize = deck.cards.length;
        const slotsAvailable = Math.max(0, TARGET_TOTAL - currentDeckSize);

        console.log('Balance Deck - Replacing missing cards:', {
            missingCount: missingCards.length,
            currentDeckSize,
            slotsAvailable,
            commanderIdentity
        });

        if (slotsAvailable === 0) {
            showAlert('Deck Full', "Your deck is already at 100 cards! Remove some cards first if you want to add replacements.", 'info');
            return;
        }

        // Helper to check relevance (exclude cards that reference off-color)
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

        // Get available cards from collection (not in deck, matches color identity)
        const availableCards = collection.filter(c => {
            // Exclude cards already in deck (by name for singleton)
            if (deck.cards.some(dc => dc.name === c.name)) return false;
            // Exclude commanders
            if (deck.commanders?.some(cmdr => cmdr.name === c.name)) return false;
            // Exclude basic lands (we handle those separately)
            if (c.details?.type_line?.includes('Basic Land')) return false;
            // Color identity check
            const identity = c.details?.color_identity || [];
            if (!identity.every(color => commanderIdentity.includes(color))) return false;
            // Relevance check
            if (!isCardRelevant(c)) return false;
            return true;
        });

        // Deduplicate available cards by name
        const uniqueAvailable = Array.from(
            new Map(availableCards.map(c => [c.name, c])).values()
        );

        // Helper to categorize a card
        const getCardCategory = (typeLine: string, name: string, oracleText: string = ""): string => {
            const t = typeLine.toLowerCase();
            const n = name.toLowerCase();
            const o = oracleText.toLowerCase();

            if (t.includes('land')) return 'land';
            if (t.includes('creature')) return 'creature';
            if ((t.includes('instant') || t.includes('sorcery')) &&
                /destroy|exile|kill|damage|wrath|damnation|wipe|murder|terminate/.test(n + o)) return 'removal';
            if (/(artifact|enchantment|sorcery)/.test(t) &&
                /(mana|ramp|cultivate|kodama|signet|talisman|sol ring|arcane|fellwar)/.test(n)) return 'ramp';
            if (/(draw|rhystic|study|mystic|remora|arena|necropotence|library|divination)/.test(n + o)) return 'draw';
            if (t.includes('instant') || t.includes('sorcery')) return 'spell';
            if (t.includes('artifact')) return 'artifact';
            if (t.includes('enchantment')) return 'enchantment';
            return 'other';
        };

        // Categorize available cards
        const availableByCategory: Record<string, CollectionCard[]> = {};
        uniqueAvailable.forEach(c => {
            const category = getCardCategory(
                c.details?.type_line || '',
                c.name,
                c.details?.oracle_text || ''
            );
            if (!availableByCategory[category]) availableByCategory[category] = [];
            availableByCategory[category].push(c);
        });

        // Sort each category by rarity (prefer higher rarity for replacements)
        const rarityScore = (rarity?: string) => {
            switch (rarity) {
                case 'mythic': return 4;
                case 'rare': return 3;
                case 'uncommon': return 2;
                default: return 1;
            }
        };
        Object.values(availableByCategory).forEach(cards => {
            cards.sort((a, b) => rarityScore(b.details?.rarity) - rarityScore(a.details?.rarity));
        });

        console.log('Available by category:', Object.fromEntries(
            Object.entries(availableByCategory).map(([k, v]) => [k, v.length])
        ));

        // Find replacements for missing cards (limited by available slots)
        const replacements: CollectionCard[] = [];
        const usedNames = new Set<string>();
        let unreplaceableCount = 0;

        for (const missingCard of missingCards) {
            // Stop if we've filled all available slots
            if (replacements.length >= slotsAvailable) {
                console.log(`Reached slot limit (${slotsAvailable}), stopping replacements`);
                break;
            }

            const category = getCardCategory(
                missingCard.type_line || '',
                missingCard.name,
                missingCard.oracle_text || ''
            );

            // Try to find a replacement in the same category
            const candidates = availableByCategory[category] || [];
            const replacement = candidates.find(c => !usedNames.has(c.name));

            if (replacement) {
                replacements.push(replacement);
                usedNames.add(replacement.name);
                console.log(`Replaced "${missingCard.name}" (${category}) with "${replacement.name}"`);
            } else {
                // Try to find ANY available card as fallback
                const fallbackCategories = ['other', 'creature', 'spell', 'artifact', 'enchantment'];
                let found = false;
                for (const fallbackCategory of fallbackCategories) {
                    if (found) break;
                    const fallbackCandidates = availableByCategory[fallbackCategory] || [];
                    const fallback = fallbackCandidates.find(c => !usedNames.has(c.name));
                    if (fallback) {
                        replacements.push(fallback);
                        usedNames.add(fallback.name);
                        console.log(`Replaced "${missingCard.name}" (${category}) with fallback "${fallback.name}" (${fallbackCategory})`);
                        found = true;
                    }
                }
                if (!found) {
                    console.warn(`Could not find replacement for "${missingCard.name}" (${category})`);
                    unreplaceableCount++;
                }
            }
        }

        if (replacements.length === 0) {
            showAlert('No Matches', "No suitable replacements found in your collection. Try adding more cards manually.", 'error');
            return;
        }

        // Update deck: add replacements and clear missing cards
        setDeck(prev => ({
            ...prev,
            cards: [...prev.cards, ...replacements],
            missingCards: unreplaceableCount > 0
                ? prev.missingCards?.slice(replacements.length) // Keep only the ones we couldn't replace
                : []
        }));

        if (unreplaceableCount > 0) {
            console.log(`Replaced ${replacements.length} missing cards. ${unreplaceableCount} could not be replaced.`);
        } else {
            console.log(`Successfully replaced all ${replacements.length} missing cards.`);
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
                            disabled={!isAutoBuilt}
                            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3 rounded-full font-bold transition-all shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1 border border-emerald-400/20 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0 disabled:from-emerald-900 disabled:to-teal-900"
                        >
                            Balance Deck
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
                availabilityMap={availabilityMap}
            />


            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
                showCancel={alertState.showCancel}
                onConfirm={alertState.onConfirm}
                confirmLabel={alertState.confirmLabel}
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
