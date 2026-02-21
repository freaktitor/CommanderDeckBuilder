import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET: List all decks for the user
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        let userEmail = session?.user?.email;

        if (!userEmail && process.env.NODE_ENV === 'development') {
            userEmail = 'guest@local';
        }

        if (!userEmail) {
            return NextResponse.json({ decks: [] });
        }

        const { data: decks, error } = await supabaseAdmin
            .from('decks')
            .select('*')
            .eq('user_id', userEmail)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enrich decks with commander images
        const enrichedDecks = await Promise.all((decks || []).map(async (deck) => {
            if (deck.commander_ids && deck.commander_ids.length > 0) {
                const { data: card } = await supabaseAdmin
                    .from('card_cache')
                    .select('image_url')
                    .eq('id', deck.commander_ids[0])
                    .single();
                return { ...deck, commander_image: card?.image_url };
            }
            return deck;
        }));

        return NextResponse.json({ decks: enrichedDecks });
    } catch (error) {
        console.error('Error fetching decks:', error);
        return NextResponse.json({ error: 'Failed to fetch decks' }, { status: 500 });
    }
}

// POST: Save a new deck
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        let userEmail = session?.user?.email;

        if (!userEmail && process.env.NODE_ENV === 'development') {
            userEmail = 'guest@local';
        }

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, commanders, cards, colors } = await req.json();

        if (!name) {
            return NextResponse.json({ error: 'Deck name is required' }, { status: 400 });
        }

        // Commanders are stored as an array of IDs
        const commander_ids = (commanders || []).map((c: any) => c.id).filter(Boolean);

        const { data, error } = await supabaseAdmin
            .from('decks')
            .insert([{
                user_id: userEmail,
                name,
                commander_ids,
                card_ids: cards, // The full cards list (names/quantities/ids)
                colors,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        return NextResponse.json({ success: true, deck: data[0] });
    } catch (error) {
        console.error('Error saving deck:', error);
        return NextResponse.json({ error: 'Failed to save deck' }, { status: 500 });
    }
}
