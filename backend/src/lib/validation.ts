import type { Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

export const readLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 900,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' },
});

export const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many changes at once. Please slow down.', code: 'RATE_LIMITED' },
});

export const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests for this action. Try again in a few minutes.', code: 'RATE_LIMITED' },
});

/**
 * Validates at the boundary and returns the app's structured error shape:
 * { error, code, details }. Handlers never see unknown fields.
 */
export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): { ok: true; data: z.infer<T> } | { ok: false; error: { error: string; code: string; details?: unknown } } {
    const result = schema.safeParse(body ?? {});
    if (result.success) return { ok: true, data: result.data };
    const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
    }));
    return {
        ok: false,
        error: {
            error: details[0]?.message ? `${details[0].path ? `${details[0].path}: ` : ''}${details[0].message}` : 'Invalid request',
            code: 'VALIDATION_ERROR',
            details,
        },
    };
}

export function badRequest(res: Response, message: string, code = 'VALIDATION_ERROR', details?: unknown) {
    return res.status(400).json({ error: message, code, ...(details ? { details } : {}) });
}

/** Paise are integers everywhere; accept a string or number, reject anything fractional. */
export const paiseSchema = z
    .union([z.string(), z.number()])
    .refine((value) => /^-?\d+$/.test(String(value)), { message: 'Amounts must be integer paise' })
    .transform((value) => String(value));

export const isoDateSchema = z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Expected an ISO date' });

/**
 * Tags are free text but stay short, lowercase-ish and deduplicated so the
 * filter list and saved views stay readable. Unknown shapes are dropped.
 */
export function sanitizeTags(input: unknown, max = 12): string[] {
    const raw = Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : [];
    const seen = new Set<string>();
    for (const value of raw) {
        if (typeof value !== 'string') continue;
        const tag = value.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24);
        if (!tag) continue;
        seen.add(tag);
        if (seen.size >= max) break;
    }
    return [...seen];
}
