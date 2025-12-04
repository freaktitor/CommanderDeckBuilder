'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Package, Hammer } from 'lucide-react';

export function NavigationPill() {
    const pathname = usePathname();
    const router = useRouter();

    const isCollection = pathname === '/collection';
    const isBuilder = pathname === '/builder';

    return (
        <div className="inline-flex bg-slate-900/80 backdrop-blur-lg border border-slate-700/50 rounded-full p-1 shadow-lg">
            <button
                onClick={() => router.push('/collection')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${isCollection
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
            >
                <Package className="w-4 h-4" />
                <span>Collection</span>
            </button>
            <button
                onClick={() => router.push('/builder')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${isBuilder
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
            >
                <Hammer className="w-4 h-4" />
                <span>Build Deck</span>
            </button>
        </div>
    );
}
