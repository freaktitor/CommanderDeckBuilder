import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        let userEmail = session?.user?.email;

        if (!userEmail && process.env.NODE_ENV === 'development') {
            userEmail = 'guest@local';
        }

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const deckId = params.id;

        const { error } = await supabaseAdmin
            .from('decks')
            .delete()
            .eq('id', deckId)
            .eq('user_id', userEmail); // Security check

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting deck:', error);
        return NextResponse.json({ error: 'Failed to delete deck' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        let userEmail = session?.user?.email;

        if (!userEmail && process.env.NODE_ENV === 'development') {
            userEmail = 'guest@local';
        }

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const deckId = params.id;
        const { name, commanders, cards, colors } = await req.json();

        // Commanders are stored as an array of IDs
        const commander_ids = (commanders || []).map((c: any) => c.id).filter(Boolean);

        const { data, error } = await supabaseAdmin
            .from('decks')
            .update({
                name,
                commander_ids,
                card_ids: cards,
                colors,
                updated_at: new Date().toISOString()
            })
            .eq('id', deckId)
            .eq('user_id', userEmail)
            .select();

        if (error) throw error;

        return NextResponse.json({ success: true, deck: data[0] });
    } catch (error) {
        console.error('Error updating deck:', error);
        return NextResponse.json({ error: 'Failed to update deck' }, { status: 500 });
    }
}
