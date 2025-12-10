'use client';

import { CollectionCard } from '@/lib/types';
import { X, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { ManaCost, ManaSymbol } from './ManaCost';

interface CardDetailModalProps {
    card: CollectionCard | null;
    isOpen: boolean;
    onClose: () => void;
}

export function CardDetailModal({ card, isOpen, onClose }: CardDetailModalProps) {
    // Close on ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen || !card || !card.details) return null;

    const details = card.details;
    const imageUrl = details.image_uris?.large || details.image_uris?.normal || details.card_faces?.[0]?.image_uris?.large;

    // Format EDHREC URL (card names need to be lowercase and hyphenated)
    const edhrecUrl = `https://edhrec.com/cards/${details.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

    // Helper to parse text with symbols
    const renderTextWithSymbols = (text: string) => {
        if (!text) return null;
        return text.split(/(\{[^}]+\})/g).map((part, index) => {
            if (part.match(/^\{[^}]+\}$/)) {
                return <ManaSymbol key={index} symbol={part} size={16} />;
            }
            return <span key={index}>{part}</span>;
        });
    };

    // Get oracle text (handle double-faced cards)
    const getOracleText = () => {
        if (details.oracle_text) return renderTextWithSymbols(details.oracle_text);
        if (details.card_faces) {
            return details.card_faces.map((face, idx) => (
                <div key={idx} className="mb-4">
                    <div className="font-bold text-violet-400 mb-1">{face.name}</div>
                    <div className="mb-2">
                        <ManaCost manaCost={face.mana_cost} size={18} />
                    </div>
                    <div className="text-slate-300">{renderTextWithSymbols(face.oracle_text)}</div>
                </div>
            ));
        }
        return 'No description available';
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-4 flex items-center justify-between z-10">
                    <h2 className="text-2xl font-bold text-white">{details.name}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Left Column - Image */}
                        <div className="flex flex-col items-center">
                            {imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt={details.name}
                                    className="rounded-xl shadow-2xl w-full max-w-md border-4 border-slate-800"
                                />
                            ) : (
                                <div className="w-full max-w-md aspect-[2.5/3.5] bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                                    No image available
                                </div>
                            )}
                        </div>

                        {/* Right Column - Details */}
                        <div className="space-y-6">
                            {/* Type and Mana Cost */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Type</h3>
                                <p className="text-lg text-slate-200">{details.type_line}</p>
                            </div>

                            {details.mana_cost && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Mana Cost</h3>
                                    <ManaCost manaCost={details.mana_cost} size={24} />
                                </div>
                            )}

                            {/* Oracle Text */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</h3>
                                <div className="text-slate-300 leading-relaxed whitespace-pre-line">
                                    {getOracleText()}
                                </div>
                            </div>

                            {/* Set Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Set</h3>
                                    <p className="text-slate-300">{details.set_name}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Rarity</h3>
                                    <p className="text-slate-300 capitalize">{details.rarity}</p>
                                </div>
                            </div>

                            {/* Keywords */}
                            {details.keywords && details.keywords.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Keywords</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {details.keywords.map((keyword, idx) => (
                                            <span
                                                key={idx}
                                                className="px-3 py-1 bg-violet-500/20 text-violet-300 rounded-full text-sm border border-violet-500/30"
                                            >
                                                {keyword}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* EDHREC Link */}
                            <div className="pt-4 border-t border-slate-700">
                                <a
                                    href={edhrecUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-6 py-3 rounded-lg font-bold transition-all shadow-lg hover:shadow-orange-500/20 hover:-translate-y-0.5"
                                >
                                    <ExternalLink className="w-5 h-5" />
                                    View on EDHREC
                                    <span className="text-xs opacity-80">(Community Insights)</span>
                                </a>
                                <p className="text-xs text-slate-500 mt-2">
                                    See deck recommendations, synergies, and popularity stats
                                </p>
                            </div>

                            {/* Quantity Badge */}
                            {card.quantity > 1 && (
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                                    <p className="text-sm text-slate-400">
                                        You own <span className="text-violet-400 font-bold text-lg">{card.quantity}</span> {card.quantity === 1 ? 'copy' : 'copies'} of this card
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
