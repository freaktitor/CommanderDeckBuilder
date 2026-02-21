
import React from 'react';
import { CollectionCard } from '@/lib/types';
import { AlertTriangle } from 'lucide-react';

interface SaltMeterProps {
    cards: CollectionCard[];
}

const SALTY_CARDS = [
    "Winter Orb", "Static Orb", "Stasis", "Armageddon", "Ravages of War",
    "Cyclonic Rift", "Rhystic Study", "Smothering Tithe", "Dockside Extortionist",
    "Thassa's Oracle", "Ad Nauseam", "Blood Moon", "Back to Basics",
    "Vorinclex, Voice of Hunger", "Elesh Norn, Grand Cenobite", "Teferi's Protection",
    "Mana Crypt", "Jeweled Lotus", "Drannith Magistrate", "Opposition Agent",
    "Hullbreacher", "Gaddock Teeg", "Grand Arbiter Augustin IV", "Jokulhaups",
    "Obliterate", "Decree of Annihilation", "Sunder", "Humility", "The Tabernacle at Pendrell Vale",
    "Expropriate", "Time Stretch", "Nexus of Fate"
];

export function SaltMeter({ cards }: SaltMeterProps) {
    const saltScore = cards.reduce((score, card) => {
        if (SALTY_CARDS.includes(card.name)) return score + 1;
        // Check for salty keywords in oracle text if available
        const text = card.details?.oracle_text?.toLowerCase() || "";
        if (text.includes("extra turn")) return score + 0.5;
        if (text.includes("destroy all lands")) return score + 1;
        if (text.includes("players can't")) return score + 0.5;
        return score;
    }, 0);

    const getSaltLevel = (score: number) => {
        if (score === 0) return { label: "Low Sodium", color: "text-slate-400", icon: "🧂" };
        if (score < 3) return { label: "Seasoned", color: "text-yellow-400", icon: "🧂" };
        if (score < 6) return { label: "Salty", color: "text-orange-500", icon: "🧂🧂" };
        return { label: "Toxic Waste", color: "text-red-500", icon: "☢️" };
    };

    const level = getSaltLevel(saltScore);

    return (
        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="text-xl">{level.icon}</span>
                <div>
                    <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Salt Level</div>
                    <div className={`font-bold ${level.color}`}>{level.label}</div>
                </div>
            </div>
            {saltScore >= 6 && (
                <div className="text-xs text-red-400 flex items-center gap-1 bg-red-900/20 px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3" />
                    Friends Warning
                </div>
            )}
        </div>
    );
}
