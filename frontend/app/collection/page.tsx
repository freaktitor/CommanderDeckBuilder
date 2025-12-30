'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CollectionCard, Deck, CardAvailability, ScryfallCard } from '@/lib/types';
import { CardGrid } from '@/components/CardGrid';
import { ColorPicker } from '@/components/ColorPicker';
import { Search, Filter, Package, ArrowDownUp, DollarSign, X } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { TopBar } from '@/components/TopBar';
import { AdvancedFilters } from '@/components/AdvancedFilters';
import { CardDetailModal } from '@/components/CardDetailModal';

export default function CollectionPage() {
    const router = useRouter();
    const [collection, setCollection] = useState<CollectionCard[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
    const [selectedSynergies, setSelectedSynergies] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCard, setSelectedCard] = useState<CollectionCard | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'cmc-asc' | 'cmc-desc' | 'price-desc' | 'price-asc'>('name');
    const [currency, setCurrency] = useState<'usd' | 'eur' | 'tix' | 'cad'>('usd');
    const [savedDecks, setSavedDecks] = useState<Deck[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load saved decks for availability
    useEffect(() => {
        const fetchDecks = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/decks`);
                if (res.ok) {
                    const { decks } = await res.json();
                    setSavedDecks(decks || []);
                }
            } catch (e) {
                console.error('Failed to fetch decks', e);
            }
        };
        fetchDecks();
    }, []);

    const availabilityMap = useMemo(() => {
        const map: Record<string, CardAvailability> = {};
        collection.forEach(card => {
            if (!map[card.name]) {
                map[card.name] = { total: 0, used: 0, available: 0 };
            }
            map[card.name].total += card.quantity;
        });
        savedDecks.forEach(d => {
            const usedInThisDeck = new Set<string>();
            const cards: CollectionCard[] = d.card_ids || [];
            const commanderIds: string[] = d.commander_ids || [];

            cards.forEach(c => {
                if (!usedInThisDeck.has(c.name)) {
                    if (!map[c.name]) map[c.name] = { total: 0, used: 0, available: 0 };
                    map[c.name].used += 1;
                    usedInThisDeck.add(c.name);
                }
            });

            commanderIds.forEach(id => {
                const found = collection.find(cc => cc.scryfallId === id);
                if (found && !usedInThisDeck.has(found.name)) {
                    if (!map[found.name]) map[found.name] = { total: 0, used: 0, available: 0 };
                    map[found.name].used += 1;
                    usedInThisDeck.add(found.name);
                }
            });
        });
        Object.keys(map).forEach(name => {
            map[name].available = map[name].total - map[name].used;
        });
        return map;
    }, [collection, savedDecks]);

    // Initialize from localStorage
    useEffect(() => {
        const savedSort = localStorage.getItem('collection_sortBy');
        const savedCurrency = localStorage.getItem('collection_currency');

        if (savedSort) setSortBy(savedSort as any);
        if (savedCurrency) setCurrency(savedCurrency as any);
        setIsInitialized(true);
    }, []);

    // Save to localStorage
    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem('collection_sortBy', sortBy);
            localStorage.setItem('collection_currency', currency);
        }
    }, [sortBy, currency, isInitialized]);

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
            } finally {
                setIsLoading(false);
            }
        };

        fetchCollection();
    }, [router]);

    // Get unique card types from collection
    const cardTypes = useMemo(() => {
        const types = new Set<string>();
        collection.forEach(card => {
            const typeLine = card.details?.type_line || '';
            const mainType = typeLine.split('—')[0].trim();

            if (mainType.includes('Creature')) types.add('Creature');
            else if (mainType.includes('Instant')) types.add('Instant');
            else if (mainType.includes('Sorcery')) types.add('Sorcery');
            else if (mainType.includes('Enchantment')) types.add('Enchantment');
            else if (mainType.includes('Artifact')) types.add('Artifact');
            else if (mainType.includes('Planeswalker')) types.add('Planeswalker');
            else if (mainType.includes('Land')) types.add('Land');
        });
        return Array.from(types).sort();
    }, [collection]);

    // Filter cards
    const filteredCards = useMemo(() => {
        let filtered = [...collection];

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(q)
            );
        }

        // Color filter
        if (selectedColors.length > 0) {
            filtered = filtered.filter(c => {
                const identity = c.details?.color_identity || [];

                // Handle colorless cards - only show if colorless is explicitly selected
                if (identity.length === 0) {
                    return selectedColors.includes('C');
                }

                // All colors in the card must be in the selected colors
                return identity.every(color => selectedColors.includes(color));
            });
        }

        // Type filter
        if (selectedTypes.length > 0) {
            filtered = filtered.filter(c => {
                const typeLine = c.details?.type_line || '';
                return selectedTypes.some(type => typeLine.includes(type));
            });
        }

        // Effects filter (keywords)
        if (selectedEffects.length > 0) {
            filtered = filtered.filter(c => {
                const oracleText = c.details?.oracle_text?.toLowerCase() || '';
                const keywords = c.details?.keywords || [];

                return selectedEffects.some(effect => {
                    const effectLower = effect.toLowerCase();
                    // Check both keywords array and oracle text
                    return keywords.some(k => k.toLowerCase() === effectLower) ||
                        oracleText.includes(effectLower);
                });
            });
        }

        // Synergies filter
        if (selectedSynergies.length > 0) {
            filtered = filtered.filter(c => {
                const oracleText = c.details?.oracle_text?.toLowerCase() || '';
                const typeLine = c.details?.type_line?.toLowerCase() || '';

                return selectedSynergies.some(synergy => {
                    const synergyLower = synergy.toLowerCase();

                    // Special handling for specific synergies
                    if (synergyLower === 'artifact') {
                        return typeLine.includes('artifact') || oracleText.includes('artifact');
                    }
                    if (synergyLower === 'enchantment') {
                        return typeLine.includes('enchantment') || oracleText.includes('enchantment');
                    }
                    if (synergyLower === 'token') {
                        return oracleText.includes('token');
                    }
                    if (synergyLower === 'graveyard') {
                        return oracleText.includes('graveyard') || oracleText.includes('from your graveyard');
                    }
                    if (synergyLower === 'draw') {
                        return oracleText.includes('draw a card') || oracleText.includes('draw cards');
                    }
                    if (synergyLower === 'ramp') {
                        return oracleText.includes('search your library for a') && oracleText.includes('land');
                    }
                    if (synergyLower === 'removal') {
                        return oracleText.includes('destroy') || oracleText.includes('exile');
                    }
                    if (synergyLower === 'counter') {
                        return oracleText.includes('counter target');
                    }

                    // Default: check if synergy appears in oracle text
                    return oracleText.includes(synergyLower);
                });
            });
        }

        // Sorting
        filtered.sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name);
            } else if (sortBy === 'cmc-asc') {
                return (a.details?.cmc || 0) - (b.details?.cmc || 0);
            } else if (sortBy === 'cmc-desc') {
                return (b.details?.cmc || 0) - (a.details?.cmc || 0);
            } else if (sortBy.startsWith('price-')) {
                const getPrice = (c: CollectionCard) => {
                    const p = c.details?.prices;
                    if (!p) return 0;

                    let val: string | null = null;
                    if (currency === 'usd' || currency === 'cad') val = p.usd || p.usd_foil;
                    else if (currency === 'eur') val = p.eur || p.eur_foil;
                    else if (currency === 'tix') val = p.tix;

                    if (!val) return 0;
                    const num = parseFloat(val);
                    if (isNaN(num)) return 0;
                    return currency === 'cad' ? num * 1.4 : num;
                };

                const priceA = getPrice(a);
                const priceB = getPrice(b);

                // Handle missing prices: always push them to the end
                if (priceA === 0 && priceB === 0) return a.name.localeCompare(b.name);
                if (priceA === 0) return 1;
                if (priceB === 0) return -1;

                return sortBy === 'price-asc' ? priceA - priceB : priceB - priceA;
            }
            return 0;
        });

        return filtered;
    }, [collection, searchQuery, selectedColors, selectedTypes, selectedEffects, selectedSynergies, sortBy, currency]);



    const totalCards = collection.reduce((sum, card) => sum + card.quantity, 0);
    const totalUnique = new Set(collection.map(c => c.name)).size;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading collection...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200">
            {/* Fixed Top Bar */}
            <TopBar
                title="My Collection"
                subtitle={`${totalCards} cards • ${totalUnique} unique`}
            />

            {/* Main Content with padding for fixed header */}
            <div className="pt-24">
                {/* Filters Bar */}
                <div className="bg-slate-900/50 backdrop-blur border-b border-slate-800 p-4 sticky top-20 z-10">
                    <div className="max-w-full mx-auto px-6">
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search cards..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:border-violet-500 w-full transition-colors"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>


                            {/* Color Filter */}
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-slate-500" />
                                <ColorPicker
                                    selectedColors={selectedColors}
                                    onChange={setSelectedColors}
                                />
                            </div>

                            {/* Type Filter */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {cardTypes.map(type => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            setSelectedTypes(prev =>
                                                prev.includes(type)
                                                    ? prev.filter(t => t !== type)
                                                    : [...prev, type]
                                            );
                                        }}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selectedTypes.includes(type)
                                            ? 'bg-violet-500 text-white'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>

                            {/* Advanced Filters */}
                            <div className="w-full">
                                <AdvancedFilters
                                    selectedEffects={selectedEffects}
                                    selectedSynergies={selectedSynergies}
                                    onEffectsChange={setSelectedEffects}
                                    onSynergiesChange={setSelectedSynergies}
                                />
                            </div>

                            {/* Clear Filters */}
                            {(searchQuery || selectedColors.length > 0 || selectedTypes.length > 0 || selectedEffects.length > 0 || selectedSynergies.length > 0) && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedColors([]);
                                        setSelectedTypes([]);
                                        setSelectedEffects([]);
                                        setSelectedSynergies([]);
                                    }}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    Clear all filters
                                </button>
                            )}
                            {/* Sort Dropdown */}
                            {/* Sort Dropdown */}
                            <div className="relative group">
                                <button className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium py-2">
                                    <ArrowDownUp className="w-4 h-4" />
                                    <span className="hidden xl:inline">Sort</span>
                                </button>
                                <div className="absolute left-0 top-full pt-2 w-40 hidden group-hover:block z-50">
                                    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden py-1">
                                        <button onClick={() => setSortBy('name')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 ${sortBy === 'name' ? 'text-violet-400' : 'text-slate-300'}`}>Name (A-Z)</button>
                                        <button onClick={() => setSortBy('cmc-asc')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 ${sortBy === 'cmc-asc' ? 'text-violet-400' : 'text-slate-300'}`}>Mana Value (Low)</button>
                                        <button onClick={() => setSortBy('cmc-desc')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 ${sortBy === 'cmc-desc' ? 'text-violet-400' : 'text-slate-300'}`}>Mana Value (High)</button>
                                        <button onClick={() => setSortBy('price-desc')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 ${sortBy === 'price-desc' ? 'text-violet-400' : 'text-slate-300'}`}>Price (High)</button>
                                        <button onClick={() => setSortBy('price-asc')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 ${sortBy === 'price-asc' ? 'text-violet-400' : 'text-slate-300'}`}>Price (Low)</button>
                                    </div>
                                </div>
                            </div>

                            {/* Currency Dropdown */}
                            <div className="relative group">
                                <button className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium uppercase min-w-[3ch] py-2">
                                    <DollarSign className="w-4 h-4" />
                                    {currency === 'cad' ? 'CAD' : currency}
                                </button>
                                <div className="absolute left-0 top-full pt-2 w-32 hidden group-hover:block z-50">
                                    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden py-1">
                                        <button onClick={() => setCurrency('usd')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 ${currency === 'usd' ? 'text-violet-400' : 'text-slate-300'}`}>TCGPlayer ($)</button>
                                        <button onClick={() => setCurrency('eur')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 ${currency === 'eur' ? 'text-violet-400' : 'text-slate-300'}`}>Cardmarket (€)</button>
                                        <button onClick={() => setCurrency('tix')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 ${currency === 'tix' ? 'text-violet-400' : 'text-slate-300'}`}>MTGO (TIX)</button>
                                        <button onClick={() => setCurrency('cad')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 ${currency === 'cad' ? 'text-violet-400' : 'text-slate-300'}`}>CAD (approx)</button>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Content */}
                <main className="p-6">
                    <div className="max-w-full mx-auto">
                        <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Package className="w-5 h-5" />
                                <span className="text-sm">
                                    Showing {filteredCards.length} cards
                                </span>
                            </div>
                        </div>

                        {filteredCards.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-slate-600 mb-2">
                                    <Package className="w-16 h-16 mx-auto mb-4" />
                                </div>
                                <p className="text-slate-400 text-lg mb-2">No cards found</p>
                                <p className="text-slate-500 text-sm">Try adjusting your filters</p>
                            </div>
                        ) : (
                            <CardGrid
                                cards={filteredCards}
                                onCardClick={(card) => {
                                    setSelectedCard(card);
                                    setIsModalOpen(true);
                                }}
                                actionLabel="view"
                                currency={currency}
                                availabilityMap={availabilityMap}
                            />
                        )}
                    </div>
                </main>

                {/* Card Detail Modal */}
                <CardDetailModal
                    card={selectedCard}
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedCard(null);
                    }}
                />
            </div>
        </div >
    );
}
