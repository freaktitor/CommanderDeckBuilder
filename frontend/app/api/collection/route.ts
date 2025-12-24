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
                    cmc
                )
            `)
            .eq('user_id', userEmail);

        if (error) throw error;
        if (!data) return NextResponse.json({ collection: [] });

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

        return NextResponse.json({ collection });
    } catch (error) {
        console.error('Error reading collection from Supabase:', error);
        return NextResponse.json({ collection: [] });
    }
}
