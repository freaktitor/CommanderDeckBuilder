'use client';

import { useState } from 'react';

import { useSession, signOut } from 'next-auth/react';
import { LogOut, Home, Settings, RefreshCw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NavigationPill } from './NavigationPill';
import { FileUpload } from './FileUpload';
import { API_BASE_URL } from '@/lib/api';

interface TopBarProps {
    title: string;
    subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleReimport = async (file: File) => {
        setIsUploading(true);
        setError(null);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                setIsImportOpen(false);
                router.refresh(); // Refresh data
                window.location.reload(); // Hard reload to ensure all caches are busted
            } else {
                setError('Failed to import. Please check your file format.');
            }
        } catch (e) {
            setError('An error occurred during upload.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <div className="fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800 z-50">
                <div className="max-w-full mx-auto px-6 py-3">
                    <div className="flex items-center justify-between">
                        {/* Left: Title */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 bg-slate-800/50 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                                title="Home"
                            >
                                <Home className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400 leading-tight">
                                    {title}
                                </h1>
                                {subtitle && (
                                    <p className="text-xs text-slate-500 font-medium">
                                        {subtitle}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Center: Navigation Pills */}
                        <div className="absolute left-1/2 -translate-x-1/2">
                            <NavigationPill />
                        </div>

                        {/* Right: User Profile & Actions */}
                        <div className="flex items-center">
                            {session ? (
                                <>
                                    {/* Reimport Button - Positioned further left */}
                                    <button
                                        onClick={() => setIsImportOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-full border border-violet-500/20 transition-all group hover:scale-105 active:scale-95 mr-8 lg:mr-32"
                                        title="Update your card collection"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-700" />
                                        <span className="text-[11px] font-bold uppercase tracking-widest hidden md:inline">Reimport</span>
                                    </button>

                                    <div className="flex items-center gap-3 lg:gap-4">
                                        <div className="flex flex-col items-end hidden sm:flex">
                                            <span className="text-xs font-bold text-slate-200 truncate max-w-[100px]">
                                                {session.user?.name?.split(' ')[0]}
                                            </span>
                                            <span className="text-[10px] text-violet-400 font-medium tracking-tight">Pro Plan</span>
                                        </div>

                                        <button
                                            onClick={() => signOut({ callbackUrl: '/' })}
                                            className="p-2.5 bg-slate-800/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg border border-slate-700/50 transition-all group"
                                            title="Sign Out"
                                        >
                                            <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Guest Mode</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Import Modal - Moved outside to be absolute-fixed relative to viewport */}
            {isImportOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-950 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-8 relative overflow-hidden ring-1 ring-white/10">
                        {/* Background glow */}
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-violet-600/20 rounded-full blur-[100px]" />

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                        <div className="p-2 bg-violet-500/20 rounded-xl">
                                            <RefreshCw className="w-6 h-6 text-violet-400" />
                                        </div>
                                        Update Collection
                                    </h2>
                                    <p className="text-slate-400 text-sm mt-2">
                                        Sync your Manabox file. This will refresh pricing and card details.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsImportOpen(false)}
                                    className="p-2 hover:bg-slate-900 rounded-xl text-slate-500 hover:text-white transition-all hover:rotate-90 duration-300"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <FileUpload
                                    onUpload={handleReimport}
                                    isLoading={isUploading}
                                />

                                {error && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm text-center font-medium animate-shake">
                                        {error}
                                    </div>
                                )}

                                <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-800/50">
                                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
                                        Important Information
                                    </h4>
                                    <ul className="text-xs text-slate-400 space-y-2.5 leading-relaxed">
                                        <li className="flex gap-3">
                                            <span className="text-violet-500 font-bold">1.</span>
                                            <span>Your existing collection will be <strong className="text-slate-200">replaced</strong> with the new file content.</span>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="text-violet-500 font-bold">2.</span>
                                            <span>We will automatically fetch updated <strong className="text-slate-200">market prices</strong> for all cards.</span>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="text-violet-500 font-bold">3.</span>
                                            <span>Saved decks won't be deleted, even if cards are removed from collection.</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
