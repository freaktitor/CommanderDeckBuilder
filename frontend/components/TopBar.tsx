'use client';

import { NavigationPill } from './NavigationPill';

interface TopBarProps {
    title: string;
    subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
    return (
        <div className="fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800 z-50">
            <div className="max-w-full mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    {/* Left: Title */}
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-sm text-slate-400 mt-0.5">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    {/* Center: Navigation Pills */}
                    <div className="absolute left-1/2 -translate-x-1/2">
                        <NavigationPill />
                    </div>

                    {/* Right: Reserved for future use (user profile, etc.) */}
                    <div className="w-48" />
                </div>
            </div>
        </div>
    );
}
