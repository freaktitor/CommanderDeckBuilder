'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Package, Hammer } from 'lucide-react';

export function NavigationPill() {
    const pathname = usePathname();
    const router = useRouter();

    const isCollection = pathname === '/collection';
    const isBuilder = pathname === '/builder';

    return (
        <div className="relative inline-flex bg-slate-900/80 backdrop-blur-lg border border-slate-700/50 rounded-full p-1 shadow-lg">
            {/* Sliding background indicator */}
            <div
                className={`absolute top-1 bottom-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full shadow-lg shadow-violet-500/30 transition-all duration-300 ease-out ${isCollection
                        ? 'left-1 right-[50%]'
                        : 'left-[50%] right-1'
                    }`}
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
                <span>Collection</span>
            </button>
            <button
                onClick={() => router.push('/builder')}
                className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-colors duration-200 ${isBuilder
                        ? 'text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                <Hammer className="w-4 h-4" />
                <span>Build Deck</span>
            </button>
        </div>
    );
}
