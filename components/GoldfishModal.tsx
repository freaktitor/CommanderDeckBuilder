
import React, { useState, useEffect } from 'react';
import { CollectionCard } from '@/lib/types';
import { X, RefreshCw, Hand } from 'lucide-react';

interface GoldfishModalProps {
    isOpen: boolean;
    onClose: () => void;
    deck: CollectionCard[];
}

export function GoldfishModal({ isOpen, onClose, deck }: GoldfishModalProps) {
    const [hand, setHand] = useState<CollectionCard[]>([]);
    const [isShuffling, setIsShuffling] = useState(false);

    const drawHand = () => {
        setIsShuffling(true);
        setTimeout(() => {
            const shuffled = [...deck].sort(() => 0.5 - Math.random());
            setHand(shuffled.slice(0, 7));
            setIsShuffling(false);
        }, 500);
    };

    useEffect(() => {
        if (isOpen) {
            drawHand();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-500/20 rounded-lg text-violet-400">
                            <Hand className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Opening Hand Simulator</h2>
                            <p className="text-slate-400 text-sm">Test your draws and mulligans</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Hand Display */}
                <div className="flex-1 p-8 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/felt.png')] bg-slate-900 relative">
                    {isShuffling ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-violet-500"></div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap justify-center gap-4 perspective-1000">
                            {hand.map((card, index) => (
                                <div
                                    key={`${card.scryfallId}-${index}`}
                                    className="relative group w-48 aspect-[2.5/3.5] transition-all duration-300 hover:-translate-y-6 hover:scale-110 hover:z-10 hover:rotate-0"
                                    style={{
                                        transform: `rotate(${(index - 3) * 2}deg) translateY(${Math.abs(index - 3) * 5}px)`,
                                        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
                                    }}
                                >
                                    <img
                                        src={card.details?.image_uris?.normal || card.details?.image_uris?.small}
                                        alt={card.name}
                                        className="w-full h-full object-cover rounded-xl border border-slate-800"
                                    />
                                    <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>
                                </div>
                            ))}
                        </div>
                    )}

                    {hand.length === 0 && !isShuffling && (
                        <div className="text-center text-slate-500 mt-20">
                            <p>Deck is empty!</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-center gap-4">
                    <button
                        onClick={drawHand}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-full font-bold transition-all border border-slate-700 hover:border-slate-600"
                    >
                        <RefreshCw className={`w-5 h-5 ${isShuffling ? 'animate-spin' : ''}`} />
                        Mulligan
                    </button>
                    <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-full font-bold text-slate-400 hover:text-white transition-colors"
                    >
                        Keep Hand (Close)
                    </button>
                </div>
            </div>
        </div>
    );
}
