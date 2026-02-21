'use client';

import { CollectionCard, CardAvailability } from '@/lib/types';
import { Plus, Minus, AlertTriangle } from 'lucide-react';

interface CardGridProps {
    cards: CollectionCard[];
    onAdd?: (card: CollectionCard) => void;
    onRemove?: (card: CollectionCard) => void;
    onCardClick?: (card: CollectionCard) => void;
    actionLabel?: 'add' | 'remove' | 'view';
    currency?: 'usd' | 'eur' | 'tix' | 'cad';
    availabilityMap?: Record<string, CardAvailability>;
}

export function CardGrid({ cards, onAdd, onRemove, onCardClick, actionLabel = 'add', currency, availabilityMap }: CardGridProps) {
    if (cards.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                No cards found matching criteria.
            </div>
        );
    }

    const getPriceString = (card: CollectionCard) => {
        if (!currency || !card.details?.prices) return null;

        const prices = card.details.prices;
        if (currency === 'usd') {
            const val = prices.usd || prices.usd_foil;
            return val ? `$${val}` : null;
        } else if (currency === 'eur') {
            const val = prices.eur || prices.eur_foil;
            return val ? `€${val}` : null;
        } else if (currency === 'tix') {
            const val = prices.tix;
            return val ? `${val} TIX` : null;
        } else if (currency === 'cad') {
            const val = prices.usd || prices.usd_foil;
            if (val) {
                const cadVal = (parseFloat(val) * 1.40).toFixed(2);
                return `CAD$${cadVal}`;
            }
            return null;
        }
        return null;
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {cards.map((card, index) => {
                const priceString = getPriceString(card);
                return (
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
                            <div className="flex justify-between items-start gap-2">
                                <h3 className="font-medium text-slate-200 truncate text-sm flex-1" title={card.name}>
                                    {card.name}
                                </h3>
                                {availabilityMap && availabilityMap[card.name] && availabilityMap[card.name].available <= 0 && (
                                    <span title="No copies available in collection (already used in other decks)">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                    </span>
                                )}
                            </div>
                            <div className="flex justify-between items-center mt-1 text-xs text-slate-400">
                                <span>{card.details?.type_line?.split('—')[0].trim()}</span>
                                <div className="flex items-center gap-2">
                                    {priceString && (
                                        <span className="text-emerald-400 font-medium">{priceString}</span>
                                    )}
                                    {card.quantity > 1 && (
                                        <span className="bg-slate-700 px-2 py-0.5 rounded-full text-slate-300">
                                            x{card.quantity}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
