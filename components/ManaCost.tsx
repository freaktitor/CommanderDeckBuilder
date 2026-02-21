'use client';

interface ManaSymbolProps {
    symbol: string;
    size?: number;
}

/**
 * Renders a single MTG mana symbol using Scryfall's CDN
 * Symbol format examples: W, U, B, R, G, C, 1, 2, X, W/U, 2/W, etc.
 */
export function ManaSymbol({ symbol, size = 20 }: ManaSymbolProps) {
    // Scryfall symbology CDN pattern
    // https://svgs.scryfall.io/card-symbols/{SYMBOL}.svg
    // Remove curly braces and convert to uppercase
    // For hybrid symbols like {W/U}, convert to WU (remove the slash)
    const normalizedSymbol = symbol
        .replace(/[{}]/g, '') // Remove curly braces
        .replace(/\//g, '')    // Remove slashes for hybrid symbols
        .toUpperCase();        // Convert to uppercase

    const svgUrl = `https://svgs.scryfall.io/card-symbols/${normalizedSymbol}.svg`;

    return (
        <img
            src={svgUrl}
            alt={symbol}
            className="inline-block"
            style={{ width: size, height: size }}
            title={symbol}
        />
    );
}

interface ManaCostProps {
    manaCost: string;
    size?: number;
}

/**
 * Parses and renders a full mana cost string as MTG mana symbols
 * Example input: "{2}{W}{U}{B}"
 */
export function ManaCost({ manaCost, size = 20 }: ManaCostProps) {
    if (!manaCost) return null;

    // Parse mana cost string into individual symbols
    // Match anything between curly braces: {2}, {W}, {U/B}, etc.
    const symbolMatches = manaCost.match(/\{[^}]+\}/g);

    if (!symbolMatches) return <span className="text-slate-400">{manaCost}</span>;

    return (
        <div className="flex items-center gap-0.5 flex-wrap">
            {symbolMatches.map((symbol, index) => (
                <ManaSymbol key={index} symbol={symbol} size={size} />
            ))}
        </div>
    );
}
