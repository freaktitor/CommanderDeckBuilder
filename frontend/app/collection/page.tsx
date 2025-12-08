'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CollectionCard } from '@/lib/types';
import { CardGrid } from '@/components/CardGrid';
import { ColorPicker } from '@/components/ColorPicker';
import { ArrowLeft, Search, Filter, Package } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { NavigationPill } from '@/components/NavigationPill';
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
        let filtered = collection;

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.details?.type_line.toLowerCase().includes(q) ||
                c.details?.oracle_text?.toLowerCase().includes(q)
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

        return filtered;
    }, [collection, searchQuery, selectedColors, selectedTypes, selectedEffects, selectedSynergies]);

    // Group cards by name and count quantities
    const uniqueCards = useMemo(() => {
        const cardMap = new Map<string, CollectionCard & { totalQuantity: number }>();

        filteredCards.forEach(card => {
            if (cardMap.has(card.name)) {
                const existing = cardMap.get(card.name)!;
                existing.totalQuantity += card.quantity;
            } else {
                cardMap.set(card.name, { ...card, totalQuantity: card.quantity });
            }
        });

        return Array.from(cardMap.values());
    }, [filteredCards]);

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
            {/* Header */}
            <header className="bg-slate-900/50 backdrop-blur border-b border-slate-800 p-4 sticky top-0 z-10">
                <div className="max-w-full mx-auto px-6">
                    <div className="flex items-center justify-between gap-4 mb-4 min-h-[44px]">
                        <div className="flex items-center gap-4 flex-shrink-0">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400">
                                    My Collection
                                </h1>
                                <p className="text-sm text-slate-400">
                                    {totalCards} cards • {totalUnique} unique
                                </p>
                            </div>
                        </div>

                        <div className="flex-shrink-0 mr-80">
                            <NavigationPill />
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search cards..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-violet-500 w-full transition-colors"
                            />
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
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="p-6">
                <div className="max-w-full mx-auto">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Package className="w-5 h-5" />
                            <span className="text-sm">
                                Showing {uniqueCards.length} unique cards
                            </span>
                        </div>
                    </div>

                    {uniqueCards.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-slate-600 mb-2">
                                <Package className="w-16 h-16 mx-auto mb-4" />
                            </div>
                            <p className="text-slate-400 text-lg mb-2">No cards found</p>
                            <p className="text-slate-500 text-sm">Try adjusting your filters</p>
                        </div>
                    ) : (
                        <CardGrid
                            cards={uniqueCards}
                            onCardClick={(card) => {
                                setSelectedCard(card);
                                setIsModalOpen(true);
                            }}
                            actionLabel="view"
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
    );
}
