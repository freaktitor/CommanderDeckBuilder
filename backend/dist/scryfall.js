"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCardCollection = fetchCardCollection;
const SCRYFALL_API_BASE = 'https://api.scryfall.com';
function fetchCardCollection(identifiers) {
    return __awaiter(this, void 0, void 0, function* () {
        // Scryfall allows max 75 identifiers per request
        const chunks = [];
        for (let i = 0; i < identifiers.length; i += 75) {
            chunks.push(identifiers.slice(i, i + 75));
        }
        let allCards = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            try {
                // Add delay to be polite to Scryfall API (50-100ms recommended)
                if (i > 0) {
                    yield new Promise(resolve => setTimeout(resolve, 100));
                }
                console.log(`[Scryfall] Fetching chunk ${i + 1}/${chunks.length} (${chunk.length} cards)`);
                const response = yield fetch(`${SCRYFALL_API_BASE}/cards/collection`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ identifiers: chunk }),
                });
                if (!response.ok) {
                    console.error('Failed to fetch cards from Scryfall', yield response.text());
                    continue;
                }
                const data = yield response.json();
                if (data.data) {
                    allCards = [...allCards, ...data.data];
                }
                if (data.not_found && data.not_found.length > 0) {
                    console.warn(`[Scryfall] ${data.not_found.length} cards not found in chunk ${i + 1}`);
                }
            }
            catch (error) {
                console.error('Error fetching from Scryfall:', error);
            }
        }
        return allCards;
    });
}
