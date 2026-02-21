'use client';

import { Check } from 'lucide-react';

interface ColorPickerProps {
    selectedColors: string[];
    onChange: (colors: string[]) => void;
}

const COLORS = [
    { id: 'W', name: 'White', bg: 'bg-yellow-100', border: 'border-yellow-200', icon: '☀️' },
    { id: 'U', name: 'Blue', bg: 'bg-blue-100', border: 'border-blue-200', icon: '💧' },
    { id: 'B', name: 'Black', bg: 'bg-slate-800', border: 'border-slate-600', icon: '💀' },
    { id: 'R', name: 'Red', bg: 'bg-red-100', border: 'border-red-200', icon: '🔥' },
    { id: 'G', name: 'Green', bg: 'bg-green-100', border: 'border-green-200', icon: '🌳' },
    { id: 'C', name: 'Colorless', bg: 'bg-slate-200', border: 'border-slate-300', icon: '◇' },
];

export function ColorPicker({ selectedColors, onChange }: ColorPickerProps) {
    const toggleColor = (id: string) => {
        if (selectedColors.includes(id)) {
            onChange(selectedColors.filter(c => c !== id));
        } else {
            onChange([...selectedColors, id]);
        }
    };

    return (
        <div className="flex gap-2">
            {COLORS.map((color) => {
                const isSelected = selectedColors.includes(color.id);
                return (
                    <button
                        key={color.id}
                        onClick={() => toggleColor(color.id)}
                        className={`
              w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all duration-200
              ${color.bg} ${color.border} border-2
              ${isSelected ? 'scale-110 ring-2 ring-violet-500 ring-offset-2 ring-offset-slate-900' : 'opacity-50 hover:opacity-100'}
            `}
                        title={color.name}
                    >
                        {isSelected ? <Check className="w-5 h-5 text-slate-900" /> : color.icon}
                    </button>
                );
            })}
        </div>
    );
}
