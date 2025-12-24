'use client';

import { useState } from 'react';
import { CollectionCard, Deck } from '@/lib/types';
import { Trash2, Download, Save } from 'lucide-react';

import { SaltMeter } from './SaltMeter';

interface DeckSidebarProps {
    deck: Deck;
    onRemoveCard: (card: CollectionCard) => void;
    onRemoveCommander: (cmdr: any) => void;
    onRemoveMissingCard: (cardName: string) => void;
    onClearDeck: () => void;
    onSave: () => void;
    isSaving?: boolean;
}

export function DeckSidebar({ deck, onRemoveCard, onRemoveCommander, onRemoveMissingCard, onClearDeck, onSave, isSaving }: DeckSidebarProps) {
    const [hoveredCard, setHoveredCard] = useState<CollectionCard | null>(null);
    const totalCards = deck.cards.reduce((acc, card) => acc + 1, 0) + (deck.commanders?.length || 0);

    // Group cards by type
    const groupedCards = deck.cards.reduce((acc, card) => {
        let type = card.details?.type_line?.split('—')[0].trim() || 'Unknown';

        // Normalize types
        if (type.includes('Land')) {
            type = 'Land';
        } else if (type.includes('Creature')) {
            type = 'Creature';
        }

        if (!acc[type]) acc[type] = [];
        acc[type].push(card);
        return acc;
    }, {} as Record<string, CollectionCard[]>);


    const downloadDeck = () => {
        // Group cards by name to calculate quantities
        const cardCounts = deck.cards.reduce((acc, card) => {
            acc[card.name] = (acc[card.name] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const content = [
            ...(deck.commanders || []).map(c => `1 ${c.name}`),
            ...Object.entries(cardCounts).map(([name, count]) => `${count} ${name}`),
        ].filter(Boolean).join('\n');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = deck.commanders && deck.commanders.length > 0
            ? `${deck.commanders[0].name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_deck.txt`
            : 'commander_deck.txt';
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <>
            <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col fixed right-0 top-20 bottom-0 z-20 shadow-2xl">
                <div className="p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-lg text-slate-200">Your Deck</h2>
                        <span className={`text-sm font-mono px-2 py-1 rounded ${totalCards === 100 ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                            {totalCards}/100
                        </span>
                    </div>

                    <SaltMeter cards={deck.cards} />

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={onSave}
                            disabled={totalCards === 0 || isSaving}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-500/10 active:scale-[0.98] ${isSaving
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white'
                                }`}
                        >
                            <Save className={`w-4 h-4 ${isSaving ? 'animate-pulse' : ''}`} />
                            {isSaving ? 'Saving...' : 'Save Deck to Profile'}
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={downloadDeck}
                                disabled={totalCards === 0}
                                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                            <button
                                onClick={onClearDeck}
                                disabled={totalCards === 0}
                                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-900/30 text-slate-300 hover:text-red-400 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" />
                                Clear
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Commanders Section */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Commanders</h3>
                        {deck.commanders && deck.commanders.length > 0 ? (
                            <div className="space-y-2">
                                {deck.commanders.map((cmdr, idx) => (
                                    <div key={idx} className="relative group">
                                        <div className="flex items-center gap-3 p-2 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                                            {cmdr.image_uris?.art_crop && (
                                                <img src={cmdr.image_uris.art_crop} alt="" className="w-10 h-10 rounded-full object-cover" />
                                            )}
                                            <span className="text-sm font-medium text-violet-200 truncate flex-1">{cmdr.name}</span>
                                            <button
                                                onClick={() => onRemoveCommander(cmdr)}
                                                className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-600 italic px-2">No commander selected</div>
                        )}
                    </div>

                    {/* Main Deck */}
                    {Object.entries(groupedCards).map(([type, cards]) => {
                        // Group by name within type
                        const cardsByName = cards.reduce((acc, card) => {
                            if (!acc[card.name]) acc[card.name] = [];
                            acc[card.name].push(card);
                            return acc;
                        }, {} as Record<string, CollectionCard[]>);

                        return (
                            <div key={type} className="space-y-2">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between">
                                    <span>{type}</span>
                                    <span>{cards.length}</span>
                                </h3>
                                <ul className="space-y-1">
                                    {Object.entries(cardsByName).map(([name, instances]) => (
                                        <li
                                            key={name}
                                            className="group flex items-center justify-between text-sm text-slate-300 hover:bg-slate-800/50 p-1 rounded cursor-default relative"
                                            onMouseEnter={() => setHoveredCard(instances[0])}
                                            onMouseLeave={() => setHoveredCard(null)}
                                        >
                                            <span className="truncate flex-1">
                                                {name} {instances.length > 1 && <span className="text-slate-500 ml-1">x{instances.length}</span>}
                                            </span>
                                            <button
                                                onClick={() => onRemoveCard(instances[0])}
                                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all px-1"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}

                    {/* Missing Cards Section */}
                    {deck.missingCards && deck.missingCards.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex justify-between">
                                <span>Missing Cards</span>
                                <span>{deck.missingCards.length}</span>
                            </h3>
                            <ul className="space-y-1">
                                {deck.missingCards.map((card, idx) => (
                                    <li
                                        key={idx}
                                        className="group text-sm text-amber-300/70 p-1 rounded cursor-default flex items-center gap-2 hover:bg-slate-800/50 relative"
                                        onMouseEnter={() => setHoveredCard({
                                            name: card.name,
                                            scryfallId: card.id,
                                            quantity: 0,
                                            details: card
                                        })}
                                        onMouseLeave={() => setHoveredCard(null)}
                                    >
                                        <span className="text-amber-500">⚠</span>
                                        <span className="truncate flex-1">{card.name}</span>
                                        <button
                                            onClick={() => onRemoveMissingCard(card.name)}
                                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all px-1"
                                            title="Remove from list"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-xs text-slate-500 italic px-1">
                                These cards are not in your collection
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Hover Preview */}
            {hoveredCard && (hoveredCard.details?.image_uris?.normal || hoveredCard.details?.card_faces?.[0]?.image_uris?.normal) && (
                <div className="fixed right-80 top-1/2 -translate-y-1/2 z-30 mr-4 pointer-events-none">
                    <div className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-slate-900/50 w-64">
                        <img
                            src={hoveredCard.details?.image_uris?.normal || hoveredCard.details?.card_faces?.[0]?.image_uris?.normal}
                            alt={hoveredCard.name}
                            className="w-full h-auto"
                        />
                    </div>
                </div>
            )}
        </>
    );
}

