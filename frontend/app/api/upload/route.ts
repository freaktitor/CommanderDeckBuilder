import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Papa from 'papaparse';
import { fetchCardCollection } from '@/lib/scryfall';
import { CollectionCard, ScryfallCard } from '@/lib/types';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        let userEmail = session?.user?.email;

        // Dev unblocking
        if (!userEmail && process.env.NODE_ENV === 'development') {
            userEmail = 'guest@local';
            console.log('No session found, using guest@local for development');
        }

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

        const text = await file.text();
        let rows: any[] = [];

        // 1. Parsing
        if (file.name.endsWith('.csv')) {
            const parseResult = Papa.parse(text, { header: true, skipEmptyLines: true });
            if (parseResult.errors.length > 0) return NextResponse.json({ error: 'CSV parsing error' }, { status: 400 });
            rows = parseResult.data as any[];
        } else if (file.name.endsWith('.txt')) {
            const lines = text.split('\n');
            rows = lines.map(line => {
                const match = line.trim().match(/^(\d+)\s+(.+)\s+\(([A-Z0-9]+)\)\s+([A-Z0-9-]+)(?:\s+\*([A-Z]+)\*)?$/);
                if (match) return {
                    'Quantity': match[1],
                    'Name': match[2],
                    'Set Code': match[3].toLowerCase(),
                    'Collector Number': match[4]
                };
                return null;
            }).filter(Boolean);
        }

        // 2. Identify and Deduplicate incoming cards
        const rawCollection = rows.map((row) => ({
            quantity: parseInt(row['Quantity'] || '1', 10),
            scryfallId: row['Scryfall ID'] || '',
            name: row['Name'],
            set: (row['Set Code'] || '').toLowerCase(),
            collectorNumber: String(row['Collector Number'] || '')
        })).filter(c => c.scryfallId || (c.set && c.collectorNumber));

        // 3. Find which cards we already have in our cache
        const allIdentifiers = rawCollection.map(c => {
            if (c.scryfallId) return { id: c.scryfallId };
            return { set: c.set, collector_number: c.collectorNumber };
        });

        // Fetch ALL candidate metadata from our DB cache first
        // We do this by searching by ID or by Set+Number
        const inputScryIds = rawCollection.map(c => c.scryfallId).filter(Boolean);

        let cachedCards: any[] = [];
        if (inputScryIds.length > 0) {
            const { data } = await supabaseAdmin.from('card_cache').select('*').in('id', inputScryIds);
            if (data) cachedCards = data;
        }

        // Also check by name/set/number for those without IDs (harder to do with one query, but let's just use what we have or fetch)
        // For simplicity: cards we don't have an ID for, we will fetch from Scryfall to be sure.

        const rowsToFetch = rawCollection.filter(c => {
            if (!c.scryfallId) return true; // Need to resolve set/number
            return !cachedCards.some(cached => cached.id === c.scryfallId); // Not in cache
        });

        if (rowsToFetch.length > 0) {
            const fetchIdentifiers = Array.from(new Map(rowsToFetch.map(c => {
                const key = c.scryfallId || `${c.set}-${c.collectorNumber}`;
                const val = c.scryfallId ? { id: c.scryfallId } : { set: c.set, collector_number: c.collectorNumber };
                return [key, val];
            })).values());

            console.log(`[Upload] Fetching ${fetchIdentifiers.length} unique items from Scryfall...`);
            const fetched = await fetchCardCollection(fetchIdentifiers);

            // Upsert into cache
            if (fetched.length > 0) {
                const cacheEntries = fetched.map(card => ({
                    id: card.id,
                    name: card.name,
                    type_line: card.type_line,
                    oracle_text: card.oracle_text || (card.card_faces ? card.card_faces.map(f => f.oracle_text).join('\n') : ''),
                    color_identity: card.color_identity,
                    image_url: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || '',
                    mana_cost: card.mana_cost || card.card_faces?.[0]?.mana_cost || '',
                    cmc: card.cmc,
                    last_updated: new Date().toISOString()
                }));
                // Dedup cache entries
                const uniqueCache = Array.from(new Map(cacheEntries.map(e => [e.id, e])).values());
                await supabaseAdmin.from('card_cache').upsert(uniqueCache);

                // Add to our working cached list
                cachedCards.push(...fetched);
            }
        }

        // 4. Final Mapping: Every card must have an ID now
        const finalMap = new Map<string, number>();

        rawCollection.forEach(item => {
            let found = cachedCards.find(c => {
                if (item.scryfallId) return c.id === item.scryfallId;
                // If we don't have ID, check set/number
                // Note: Scryfall uses lower case for set, and string for number
                return c.set?.toLowerCase() === item.set && String(c.collector_number) === item.collectorNumber;
            });

            // If still not found by set/number, try name matching as a fallback (scryfall usually returns it)
            if (!found && !item.scryfallId) {
                found = cachedCards.find(c => c.name === item.name);
            }

            if (found) {
                const id = found.id;
                finalMap.set(id, (finalMap.get(id) || 0) + item.quantity);
            }
        });

        // 5. Save to User Collection
        console.log(`[Upload] Saving ${finalMap.size} unique cards for ${userEmail}`);
        await supabaseAdmin.from('collections').delete().eq('user_id', userEmail);

        const entries = Array.from(finalMap.entries()).map(([card_id, quantity]) => ({
            user_id: userEmail,
            card_id,
            quantity
        }));

        if (entries.length > 0) {
            for (let i = 0; i < entries.length; i += 1000) {
                await supabaseAdmin.from('collections').insert(entries.slice(i, i + 1000));
            }
        }

        return NextResponse.json({ success: true, count: entries.length });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
