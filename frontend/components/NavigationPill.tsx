'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Package, Hammer, BookOpen } from 'lucide-react';

export function NavigationPill() {
    const pathname = usePathname();
    const router = useRouter();

    const isCollection = pathname === '/collection';
    const isDecks = pathname === '/decks';
    const isBuilder = pathname === '/builder';

    const getIndicatorPosition = () => {
        if (isCollection) return 'left-1 w-[33.33%]';
        if (isDecks) return 'left-[33.33%] w-[33.33%]';
        if (isBuilder) return 'left-[66.66%] w-[33.33%]';
        return 'hidden';
    };

    return (
        <div className="relative inline-flex bg-slate-900/80 backdrop-blur-lg border border-slate-700/50 rounded-full p-1 shadow-lg">
            {/* Sliding background indicator */}
            <div
                className={`absolute top-1 bottom-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full shadow-lg shadow-violet-500/30 transition-all duration-300 ease-out ${getIndicatorPosition()}`}
            />

            {/* Buttons */}
            <button
                onClick={() => router.push('/collection')}
                className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-colors duration-200 ${isCollection
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">Collection</span>
            </button>

            <button
                onClick={() => router.push('/decks')}
                className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-colors duration-200 ${isDecks
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">My Decks</span>
            </button>

            <button
                onClick={() => router.push('/builder')}
                className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-colors duration-200 ${isBuilder
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                <Hammer className="w-4 h-4" />
                <span className="hidden sm:inline">Builder</span>
            </button>
        </div>
    );
}
