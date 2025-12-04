'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Zap, Sparkles } from 'lucide-react';

interface AdvancedFiltersProps {
    selectedEffects: string[];
    selectedSynergies: string[];
    onEffectsChange: (effects: string[]) => void;
    onSynergiesChange: (synergies: string[]) => void;
}

const EFFECTS = [
    'Deathtouch',
    'Flying',
    'Haste',
    'Vigilance',
    'Trample',
    'Lifelink',
    'First Strike',
    'Double Strike',
    'Menace',
    'Hexproof',
    'Indestructible',
    'Flash',
    'Reach',
    'Defender',
];

const SYNERGIES = [
    'Treasure',
    'Food',
    'Clue',
    'Blood',
    'Token',
    'Artifact',
    'Enchantment',
    'Graveyard',
    'Sacrifice',
    'Draw',
    'Ramp',
    'Removal',
    'Counter',
    'Exile',
    '+1/+1 Counter',
];

export function AdvancedFilters({
    selectedEffects,
    selectedSynergies,
    onEffectsChange,
    onSynergiesChange,
}: AdvancedFiltersProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleEffect = (effect: string) => {
        if (selectedEffects.includes(effect)) {
            onEffectsChange(selectedEffects.filter(e => e !== effect));
        } else {
            onEffectsChange([...selectedEffects, effect]);
        }
    };

    const toggleSynergy = (synergy: string) => {
        if (selectedSynergies.includes(synergy)) {
            onSynergiesChange(selectedSynergies.filter(s => s !== synergy));
        } else {
            onSynergiesChange([...selectedSynergies, synergy]);
        }
    };

    const clearAll = () => {
        onEffectsChange([]);
        onSynergiesChange([]);
    };

    const hasActiveFilters = selectedEffects.length > 0 || selectedSynergies.length > 0;

    return (
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-medium text-slate-200">Advanced Filters</span>
                    {hasActiveFilters && (
                        <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded-full">
                            {selectedEffects.length + selectedSynergies.length}
                        </span>
                    )}
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-4 pt-0 space-y-4 border-t border-slate-700/50">
                    {/* Effects Section */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                                    Effects & Keywords
                                </h3>
                            </div>
                            {selectedEffects.length > 0 && (
                                <button
                                    onClick={() => onEffectsChange([])}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {EFFECTS.map(effect => (
                                <button
                                    key={effect}
                                    onClick={() => toggleEffect(effect)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedEffects.includes(effect)
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                                            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 border border-slate-700/30'
                                        }`}
                                >
                                    {effect}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Synergies Section */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                                    Synergies & Themes
                                </h3>
                            </div>
                            {selectedSynergies.length > 0 && (
                                <button
                                    onClick={() => onSynergiesChange([])}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {SYNERGIES.map(synergy => (
                                <button
                                    key={synergy}
                                    onClick={() => toggleSynergy(synergy)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedSynergies.includes(synergy)
                                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 shadow-sm'
                                            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 border border-slate-700/30'
                                        }`}
                                >
                                    {synergy}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Clear All */}
                    {hasActiveFilters && (
                        <div className="pt-2 border-t border-slate-700/50">
                            <button
                                onClick={clearAll}
                                className="w-full px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 text-sm rounded-lg transition-colors"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
