'use client';

import { useSession, signOut } from 'next-auth/react';
import { LogOut, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NavigationPill } from './NavigationPill';

interface TopBarProps {
    title: string;
    subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
    const { data: session } = useSession();
    const router = useRouter();

    return (
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

                    {/* Right: User Profile */}
                    <div className="flex items-center justify-end gap-3 w-48">
                        {session ? (
                            <>
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
    );
}
