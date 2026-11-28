/**
 * Single currency (INR). Money is BigInt paise in the database and in services;
 * rupees only exist at the edges: HTTP payloads, MCP tool arguments, automation scripts.
 */

export const PAISE_PER_RUPEE = 100;

export class MoneyError extends Error {
    statusCode = 400;
    code = 'INVALID_AMOUNT';
}

/** 1234.56 -> 123456n, rounding half away from zero so 0.005 never becomes 0.00. */
export function rupeesToPaise(value: number | string): bigint {
    const numeric = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;
    if (!Number.isFinite(numeric)) throw new MoneyError(`Not a number: ${value}`);
    const sign = numeric < 0 ? -1 : 1;
    const paise = Math.round(Math.abs(numeric) * PAISE_PER_RUPEE);
    return BigInt(sign * paise);
}

/** 123456n -> 1234.56 */
export function paiseToRupees(paise: bigint): number {
    return Number(paise) / PAISE_PER_RUPEE;
}

/** 123456n -> "1234.56" (stable string for JSON payloads and exports). */
export function formatPaise(paise: bigint): string {
    const sign = paise < 0n ? '-' : '';
    const absolute = paise < 0n ? -paise : paise;
    const whole = absolute / 100n;
    const fraction = (absolute % 100n).toString().padStart(2, '0');
    return `${sign}${whole}.${fraction}`;
}

export function sumPaise(values: bigint[]): bigint {
    return values.reduce((total, value) => total + value, 0n);
}

/** Rounds a rupee number to 2 decimals (automation `round2`). */
export function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
