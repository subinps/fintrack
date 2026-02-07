import express from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.get('/:symbol', authenticateToken, async (req, res) => {
    try {
        const { symbol } = req.params;
        const upperSymbol = symbol.toUpperCase();

        // 1. Check Cache
        const cachedPrice = await prisma.marketPrice.findUnique({
            where: { symbol: upperSymbol },
        });

        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        if (cachedPrice && cachedPrice.lastUpdated > fifteenMinutesAgo) {
            // Return cached price if fresh
            return res.json({
                symbol: cachedPrice.symbol,
                price: Number(cachedPrice.price),
                lastUpdated: cachedPrice.lastUpdated,
                source: 'cache'
            });
        }

        // 2. Fetch from External API (if not found or stale)
        const response = await axios.get(`https://tools.subinps.in/price/${upperSymbol}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; FinTrack/1.0)',
            },
        });

        const data = response.data;
        let price = null;

        if (data && typeof data.price === 'number') {
            price = data.price;
        } else if (data && typeof data.price === 'string') {
            price = parseFloat(data.price);
        }

        if (price !== null && !isNaN(price) && price > 0) {
            // 3. Update Cache
            await prisma.marketPrice.upsert({
                where: { symbol: upperSymbol },
                update: {
                    price: price,
                    lastUpdated: new Date(),
                },
                create: {
                    symbol: upperSymbol,
                    price: price,
                    lastUpdated: new Date(),
                },
            });

            res.json({
                symbol: upperSymbol,
                price: price,
                lastUpdated: new Date(),
                source: 'api'
            });
        } else {
            // If API fails but we have stale cache, maybe return stale cache?
            // For now, let's throw error as per original behavior, or return stale if available?
            // User said "else use from db" for autorefresh.
            // Let's return stale cache if available, otherwise error.
            if (cachedPrice) {
                return res.json({
                    symbol: cachedPrice.symbol,
                    price: Number(cachedPrice.price),
                    lastUpdated: cachedPrice.lastUpdated,
                    source: 'cache-stale'
                });
            }
            throw new Error('Invalid price data from API');
        }

    } catch (error) {
        console.error('Error fetching price:', error);
        // Fallback to stale cache if API error
        try {
            const { symbol } = req.params;
            const cachedPrice = await prisma.marketPrice.findUnique({
                where: { symbol: symbol.toUpperCase() },
            });
            if (cachedPrice) {
                return res.json({
                    symbol: cachedPrice.symbol,
                    price: Number(cachedPrice.price),
                    lastUpdated: cachedPrice.lastUpdated,
                    source: 'cache-error-fallback'
                });
            }
        } catch (dbError) {
            console.error('Error fetching from cache fallback:', dbError);
        }

        res.status(500).json({ error: 'Failed to fetch price' });
    }
});

router.post('/batch', authenticateToken, async (req, res) => {
    try {
        const { symbols } = req.body;
        if (!Array.isArray(symbols) || symbols.length === 0) {
            return res.status(400).json({ error: 'Invalid symbols array' });
        }

        const uniqueSymbols = [...new Set(symbols.map((s: string) => s.toUpperCase()))];
        const results: any[] = [];
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        // 1. Fetch existing from DB
        const cachedPrices = await prisma.marketPrice.findMany({
            where: { symbol: { in: uniqueSymbols } }
        });
        const cacheMap = new Map(cachedPrices.map(p => [p.symbol, p]));

        // 2. Identify stale/missing
        const toFetch: string[] = [];
        uniqueSymbols.forEach(sym => {
            const cached = cacheMap.get(sym);
            if (!cached || cached.lastUpdated < fifteenMinutesAgo) {
                toFetch.push(sym);
            } else {
                results.push({
                    symbol: cached.symbol,
                    price: Number(cached.price),
                    lastUpdated: cached.lastUpdated,
                    source: 'cache'
                });
            }
        });

        // 3. Fetch from API (sequentially or parallel? Parallel is better but maybe rate limited?)
        // Let's do sequential for safety against rate limits, or small batches.
        // Given the user had "flooding" issues, let's be careful.
        // But since this is a batch request from the client, the client is waiting.
        // Let's try parallel with Promise.all but maybe limited concurrency if needed.
        // For now, simple Promise.all.

        const apiPromises = toFetch.map(async (sym) => {
            try {
                const response = await axios.get(`https://tools.subinps.in/price/${sym}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FinTrack/1.0)' }
                });
                const data = response.data;
                let price = null;
                if (data && typeof data.price === 'number') price = data.price;
                else if (data && typeof data.price === 'string') price = parseFloat(data.price);

                if (price !== null && !isNaN(price) && price > 0) {
                    // Update DB
                    const updated = await prisma.marketPrice.upsert({
                        where: { symbol: sym },
                        update: { price, lastUpdated: new Date() },
                        create: { symbol: sym, price, lastUpdated: new Date() }
                    });
                    return {
                        symbol: sym,
                        price: Number(updated.price),
                        lastUpdated: updated.lastUpdated,
                        source: 'api'
                    };
                }
            } catch (error) {
                console.error(`Failed to fetch ${sym}:`, error);
            }
            // Fallback to stale cache if available
            const cached = cacheMap.get(sym);
            if (cached) {
                return {
                    symbol: cached.symbol,
                    price: Number(cached.price),
                    lastUpdated: cached.lastUpdated,
                    source: 'cache-stale'
                };
            }
            return { symbol: sym, error: 'Failed to fetch' };
        });

        const apiResults = await Promise.all(apiPromises);
        results.push(...apiResults);

        res.json(results);

    } catch (error) {
        console.error('Batch price error:', error);
        res.status(500).json({ error: 'Failed to process batch prices' });
    }
});

export default router;
