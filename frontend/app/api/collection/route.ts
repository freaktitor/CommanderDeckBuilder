import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        let userEmail = session?.user?.email;

        // Dev unblocking
        if (!userEmail && process.env.NODE_ENV === 'development') {
            userEmail = 'guest@local';
        }

        if (!userEmail) {
            return NextResponse.json({ collection: [] });
        }

        // Fetch collection for this user with joined card metadata
        // Note: Supabase often caps responses at 1000 rows, so we paginate to be safe.
        let allData: any[] = [];
        let from = 0;
        const PAGE_SIZE = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabaseAdmin
                .from('collections')
                .select(`
                    quantity,
                    card_id,
                    card_cache (
                        id,
                        name,
                        type_line,
                        oracle_text,
                        color_identity,
                        image_url,
                        mana_cost,
                        cmc,
                        prices,
                        rarity,
                        set_name,
                        set,
                        keywords
                    )
                `)
                .eq('user_id', userEmail)
                .range(from, from + PAGE_SIZE - 1);

            if (error) throw error;
            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                allData = [...allData, ...data];
                if (data.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    from += PAGE_SIZE;
                }
            }
        }

        const data = allData;

        // Map it back to our CollectionCard format
        const collection = data.map(item => {
            const cache = item.card_cache as any;
            if (!cache) return null;

            return {
                quantity: item.quantity,
                scryfallId: item.card_id,
                name: cache.name,
                details: {
                    id: cache.id,
                    name: cache.name,
                    type_line: cache.type_line,
                    oracle_text: cache.oracle_text,
                    color_identity: cache.color_identity,
                    cmc: cache.cmc,
                    mana_cost: cache.mana_cost,
                    prices: cache.prices,
                    rarity: cache.rarity,
                    set_name: cache.set_name,
                    set: cache.set,
                    keywords: cache.keywords,
                    image_uris: {
                        normal: cache.image_url,
                        small: cache.image_url,
                        large: cache.image_url,
                        png: cache.image_url,
                        art_crop: cache.image_url,
                        border_crop: cache.image_url
                    }
                }
            };
        }).filter(Boolean);

        console.log(`[Collection] Returning ${collection.length} cards for ${userEmail} (Raw: ${data.length})`);
        return NextResponse.json({ collection, total: collection.length, rawTotal: data.length });
    } catch (error) {
        console.error('Error reading collection from Supabase:', error);
        return NextResponse.json({ collection: [] });
    }
}
