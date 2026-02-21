'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { TopBar } from '@/components/TopBar';
import { BookOpen, Trash2, ExternalLink, Calendar, Plus } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

export default function DecksPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [decks, setDecks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDecks = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/decks`);
                if (res.ok) {
                    const data = await res.json();
                    setDecks(data.decks || []);
                }
            } catch (e) {
                console.error('Failed to load decks', e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDecks();
    }, []);

    const deleteDeck = async (id: string) => {
        if (!confirm('Are you sure you want to delete this deck?')) return;

        try {
            const res = await fetch(`${API_BASE_URL}/decks/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setDecks(prev => prev.filter(d => d.id !== id));
            }
        } catch (e) {
            console.error('Failed to delete deck', e);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200">
            <TopBar title="My Decks" subtitle={`${decks.length} decks saved`} />

            <main className="pt-28 p-6 max-w-7xl mx-auto">
                {decks.length === 0 ? (
                    <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-slate-800 border-dashed">
                        <BookOpen className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">No saved decks yet</h2>
                        <p className="text-slate-500 mb-8 max-w-sm mx-auto">
                            Head over to the Deck Builder to create and save your first Commander deck!
                        </p>
                        <button
                            onClick={() => router.push('/builder')}
                            className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-bold transition-all inline-flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Start Building
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {decks.map(deck => (
                            <div
                                key={deck.id}
                                className="group relative bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden hover:border-violet-500/50 transition-all shadow-xl min-h-[200px] flex flex-col"
                            >
                                {/* Background Commander Art */}
                                {deck.commander_image && (
                                    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                                        <div className="absolute inset-0 bg-slate-950/60 z-10" /> {/* Overlay to darken */}
                                        <img
                                            src={deck.commander_image}
                                            alt=""
                                            className="w-full h-full object-cover opacity-30 grayscale-[0.5] group-hover:grayscale-0 group-hover:scale-105 group-hover:opacity-40 transition-all duration-700 blur-[2px] group-hover:blur-0"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-20" />
                                    </div>
                                )}

                                <div className="relative z-10 p-6 flex-1 flex flex-col space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-violet-400 transition-colors">
                                                {deck.name}
                                            </h3>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(deck.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => deleteDeck(deck.id)}
                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                                title="Delete deck"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Color Identity Pills */}
                                    <div className="flex gap-1">
                                        {(deck.colors || []).map((color: string) => (
                                            <div
                                                key={color}
                                                className={`w-3 h-3 rounded-full border border-black/20 ${color === 'W' ? 'bg-orange-50' :
                                                    color === 'U' ? 'bg-blue-500' :
                                                        color === 'B' ? 'bg-slate-800' :
                                                            color === 'R' ? 'bg-red-500' :
                                                                color === 'G' ? 'bg-green-600' : 'bg-slate-400'
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            onClick={() => router.push(`/builder?deckId=${deck.id}`)}
                                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Open in Builder
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
