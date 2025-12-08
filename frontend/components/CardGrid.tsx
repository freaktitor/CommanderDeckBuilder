'use client';

import { CollectionCard } from '@/lib/types';
import { Plus, Minus } from 'lucide-react';

interface CardGridProps {
    cards: CollectionCard[];
    onAdd?: (card: CollectionCard) => void;
    onRemove?: (card: CollectionCard) => void;
    onCardClick?: (card: CollectionCard) => void;
    actionLabel?: 'add' | 'remove' | 'view';
}

export function CardGrid({ cards, onAdd, onRemove, onCardClick, actionLabel = 'add' }: CardGridProps) {
    if (cards.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                No cards found matching criteria.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {cards.map((card, index) => (
                <div
                    key={`${card.scryfallId}-${index}`}
                    className={`group relative bg-slate-800 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1 ${onCardClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onCardClick?.(card)}
                >
                    {/* Image */}
                    <div className="aspect-[2.5/3.5] relative bg-slate-900">
                        {(card.details?.image_uris?.normal || card.details?.card_faces?.[0]?.image_uris?.normal) ? (
                            <img
                                src={card.details?.image_uris?.normal || card.details?.card_faces?.[0]?.image_uris?.normal}
                                alt={card.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600 p-4 text-center text-sm">
                                {card.name} (No Image)
                            </div>
                        )}

                        {/* Overlay Actions - Only show if not in click mode */}
                        {!onCardClick && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                {onAdd && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAdd(card);
                                        }}
                                        className="p-3 bg-violet-600 text-white rounded-full hover:bg-violet-500 transition-colors"
                                        title="Add to Deck"
                                    >
                                        <Plus className="w-6 h-6" />
                                    </button>
                                )}
                                {onRemove && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemove(card);
                                        }}
                                        className="p-3 bg-red-600 text-white rounded-full hover:bg-red-500 transition-colors"
                                        title="Remove from Deck"
                                    >
                                        <Minus className="w-6 h-6" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Info Footer */}
                    <div className="p-3 bg-slate-800 border-t border-slate-700">
                        <h3 className="font-medium text-slate-200 truncate text-sm" title={card.name}>
                            {card.name}
                        </h3>
                        <div className="flex justify-between items-center mt-1 text-xs text-slate-400">
                            <span>{card.details?.type_line?.split('—')[0].trim()}</span>
                            {card.quantity > 1 && (
                                <span className="bg-slate-700 px-2 py-0.5 rounded-full text-slate-300">
                                    x{card.quantity}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
