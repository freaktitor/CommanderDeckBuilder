export interface ScryfallCard {
    id: string;
    name: string;
    mana_cost?: string;
    cmc: number;
    type_line: string;
    oracle_text?: string;
    colors?: string[];
    color_identity: string[];
    image_uris?: {
        small: string;
        normal: string;
        large: string;
        png: string;
        art_crop: string;
        border_crop: string;
    };
    prices?: {
        usd: string | null;
        usd_foil: string | null;
        eur: string | null;
        eur_foil: string | null;
        tix: string | null;
    };
    card_faces?: {
        name: string;
        mana_cost: string;
        type_line: string;
        oracle_text: string;
        colors?: string[];
        image_uris?: {
            small: string;
            normal: string;
            large: string;
            png: string;
            art_crop: string;
            border_crop: string;
        };
    }[];
    rarity: string;
    set_name: string;
    set: string;
    collector_number: string;
    keywords?: string[];
}

export interface CollectionCard {
    quantity: number;
    scryfallId: string;
    name: string;
    set?: string;
    collectorNumber?: string;
    // Enriched data
    details?: ScryfallCard;
}

export interface CardAvailability {
    total: number;
    used: number;
    available: number;
}

export interface Deck {
    id?: string;
    name?: string;
    commander?: ScryfallCard;
    commanders?: ScryfallCard[];
    cards: CollectionCard[];
    colors: string[];
    missingCards?: ScryfallCard[]; // Cards not in collection
    // Database fields returned by API
    card_ids?: CollectionCard[];
    commander_ids?: string[];
}
