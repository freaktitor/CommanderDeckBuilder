import { ScryfallCard } from './types';

const SCRYFALL_API_BASE = 'https://api.scryfall.com';

export async function fetchCardCollection(identifiers: any[]): Promise<ScryfallCard[]> {
    // Scryfall allows max 75 identifiers per request
    const chunks = [];
    for (let i = 0; i < identifiers.length; i += 75) {
        chunks.push(identifiers.slice(i, i + 75));
    }

    let allCards: ScryfallCard[] = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
            // Add delay to be polite to Scryfall API (50-100ms recommended)
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`[Scryfall] Fetching chunk ${i + 1}/${chunks.length} (${chunk.length} cards)`);
            const response = await fetch(`${SCRYFALL_API_BASE}/cards/collection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ identifiers: chunk }),
            });

            if (!response.ok) {
                console.error('Failed to fetch cards from Scryfall', await response.text());
                continue;
            }

            const data = await response.json();
            if (data.data) {
                allCards = [...allCards, ...data.data];
            }
            if (data.not_found && data.not_found.length > 0) {
                console.warn(`[Scryfall] ${data.not_found.length} cards not found in chunk ${i + 1}`);
            }
        } catch (error) {
            console.error('Error fetching from Scryfall:', error);
        }
    }

    return allCards;
}
