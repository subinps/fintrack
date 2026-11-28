import axios from 'axios';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const PRICE_API = 'https://tools.subinps.in/price';
const FRESH_FOR_MS = 15 * 60 * 1000;

export interface PriceRefreshResult {
    symbols: number;
    updated: number;
    skipped: number;
    failed: number;
}

export async function refreshMarketPrices(): Promise<PriceRefreshResult> {
    const accounts = await prisma.account.findMany({
        where: { type: 'ASSET', symbol: { not: null } },
        select: { symbol: true },
    });

    const symbols = [...new Set(accounts.map((account) => account.symbol?.toUpperCase()).filter(Boolean))] as string[];
    const result: PriceRefreshResult = { symbols: symbols.length, updated: 0, skipped: 0, failed: 0 };

    for (const symbol of symbols) {
        try {
            const existing = await prisma.marketPrice.findUnique({ where: { symbol } });
            if (existing && existing.lastUpdated.getTime() > Date.now() - FRESH_FOR_MS) {
                result.skipped += 1;
                continue;
            }

            const response = await axios.get(`${PRICE_API}/${symbol}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FinTrack/1.0)' },
                timeout: 10_000,
            });

            const raw = response.data?.price;
            const price = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;

            if (!Number.isFinite(price) || price <= 0) {
                result.failed += 1;
                logger.warn({ symbol }, 'price API returned no usable price');
                continue;
            }

            await prisma.marketPrice.upsert({
                where: { symbol },
                update: { price, lastUpdated: new Date() },
                create: { symbol, price, lastUpdated: new Date() },
            });
            result.updated += 1;
        } catch (error) {
            result.failed += 1;
            logger.warn({ err: error, symbol }, 'price refresh failed for symbol');
        }
    }

    logger.info(result, 'market prices refreshed');
    return result;
}
