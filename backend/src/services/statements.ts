import XLSX from 'xlsx';
import { prisma } from '../lib/prisma';
import { formatPaise, rupeesToPaise } from '../lib/money';

/**
 * Statement and ledger-file parsing (Phase 5).
 * Everything here works on strings; money is converted to paise at the edge and
 * posted by the ledger service so the single write path is preserved.
 */

export type FileSource = 'CSV' | 'OFX' | 'XLSX';
export type ImportMode = 'ledger' | 'statement';

export interface ColumnMapping {
    date: string;
    description: string;
    amount?: string;
    debit?: string;
    credit?: string;
    balance?: string;
    externalId?: string;
}

export interface ParsedRow {
    index: number;
    date: string;
    description: string;
    amount: string;
    balance?: string | null;
    externalId?: string | null;
    error?: string;
}

export interface PreviewRow extends ParsedRow {
    duplicate: { transactionId: number; description: string } | null;
    match: { splitId: number; transactionId: number; description: string; score: number } | null;
    rule: { ruleId: string; name: string; accountId: number; accountName: string } | null;
}

export interface Reading {
    source: FileSource;
    headers: string[];
    rows: string[][];
}

const HEADER_SYNONYMS: Record<keyof ColumnMapping, string[]> = {
    date: ['date', 'transaction date', 'posting date', 'posted', 'value date', 'txn date', 'trans date', 'book date'],
    description: ['description', 'narration', 'details', 'particulars', 'memo', 'payee', 'name', 'transaction details', 'remarks', 'reference'],
    amount: ['amount', 'transaction amount', 'value', 'amt', 'net amount'],
    debit: ['debit', 'withdrawal', 'withdrawals', 'debit amount', 'paid out', 'outflow', 'dr'],
    credit: ['credit', 'deposit', 'deposits', 'credit amount', 'paid in', 'inflow', 'cr'],
    balance: ['balance', 'closing balance', 'running balance', 'bal'],
    externalId: ['id', 'transaction id', 'reference number', 'ref no', 'cheque no', 'fitid', 'utr'],
};

const normaliseHeader = (value: string): string =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/** Best-effort mapping from a file's header row to the columns we need. */
export function suggestMapping(headers: string[]): ColumnMapping {
    const normalised = headers.map(normaliseHeader);
    const pick = (keys: string[]): string | undefined => {
        for (const key of keys) {
            const exact = normalised.findIndex((header) => header === key);
            if (exact >= 0) return headers[exact];
        }
        for (const key of keys) {
            const partial = normalised.findIndex((header) => header.includes(key));
            if (partial >= 0) return headers[partial];
        }
        return undefined;
    };

    const mapping: ColumnMapping = {
        date: pick(HEADER_SYNONYMS.date) ?? headers[0] ?? '',
        description: pick(HEADER_SYNONYMS.description) ?? headers[1] ?? '',
        amount: pick(HEADER_SYNONYMS.amount),
        debit: pick(HEADER_SYNONYMS.debit),
        credit: pick(HEADER_SYNONYMS.credit),
        balance: pick(HEADER_SYNONYMS.balance),
        externalId: pick(HEADER_SYNONYMS.externalId),
    };
    if (!mapping.amount && !mapping.debit && !mapping.credit) {
        mapping.amount = headers[2] ?? '';
    }
    return mapping;
}

function detectDelimiter(sample: string): string {
    const candidates = [',', ';', '\t', '|'];
    const scored = candidates.map((delimiter) => ({
        delimiter,
        count: (sample.split(delimiter).length ?? 0) - 1,
    }));
    scored.sort((a, b) => b.count - a.count);
    return scored[0].count > 0 ? scored[0].delimiter : ',';
}

/** RFC 4180 CSV reader: quoted fields, embedded commas/newlines, CRLF. */
export function parseCsv(text: string): string[][] {
    const clean = text.replace(/^\uFEFF/, '');
    const delimiter = detectDelimiter(clean.split(/\r?\n/)[0] ?? '');
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < clean.length; i += 1) {
        const char = clean[i];
        if (quoted) {
            if (char === '"') {
                if (clean[i + 1] === '"') {
                    field += '"';
                    i += 1;
                } else {
                    quoted = false;
                }
            } else {
                field += char;
            }
            continue;
        }
        if (char === '"') {
            quoted = true;
        } else if (char === delimiter) {
            row.push(field);
            field = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && clean[i + 1] === '\n') i += 1;
            row.push(field);
            field = '';
            if (row.some((cell) => cell.trim() !== '')) rows.push(row);
            row = [];
        } else {
            field += char;
        }
    }
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
    return rows;
}

const OFX_TAG = (block: string, tag: string): string | null => {
    const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
    return match ? match[1].trim() : null;
};

export function parseOfx(text: string): string[][] {
    const rows: string[][] = [['Date', 'Description', 'Amount', 'FitId']];
    const blocks = text.split(/<STMTTRN>/i).slice(1);
    for (const block of blocks) {
        const rawDate = OFX_TAG(block, 'DTPOSTED') ?? '';
        const amount = OFX_TAG(block, 'TRNAMT') ?? '';
        const description = OFX_TAG(block, 'NAME') ?? OFX_TAG(block, 'MEMO') ?? '';
        const fitId = OFX_TAG(block, 'FITID') ?? '';
        const iso = rawDate && rawDate.length >= 8
            ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
            : rawDate;
        rows.push([iso, description.replace(/&amp;/g, '&'), amount, fitId]);
    }
    return rows;
}

/** Reads CSV, XLSX or OFX/QFX into a header row plus raw rows. */
export function readFile(file: { buffer: Buffer; originalname: string }): Reading {
    const name = (file.originalname || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' }) as unknown as string[][];
        const nonEmpty = raw.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
        if (nonEmpty.length === 0) throw new Error('The spreadsheet is empty.');
        const [headers, ...rows] = nonEmpty;
        return { source: 'XLSX', headers: headers.map((cell) => String(cell ?? '').trim()), rows: rows.map((row) => row.map((cell) => String(cell ?? '').trim())) };
    }
    const text = file.buffer.toString('utf8');
    if (name.endsWith('.ofx') || name.endsWith('.qfx') || /<OFX>/i.test(text.slice(0, 400))) {
        const rows = parseOfx(text);
        return { source: 'OFX', headers: rows[0], rows: rows.slice(1) };
    }
    const rows = parseCsv(text);
    if (rows.length === 0) throw new Error('The file is empty.');
    return { source: 'CSV', headers: rows[0].map((cell) => cell.trim()), rows: rows.slice(1) };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (value: number) => String(value).padStart(2, '0');

/** Accepts 2026-04-01, 01/04/2026, 04-01-2026, 1 Apr 2026, ISO timestamps and Excel serials. */
export function parseStatementDate(value: string): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

    const iso = /^\d{4}-\d{2}-\d{2}T/.test(raw) ? new Date(raw) : null;
    if (iso && !Number.isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);

    const numeric = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (numeric) {
        let [, first, second, third] = numeric;
        let year = Number(third.length === 2 ? `20${third}` : third);
        let day = Number(first);
        let month = Number(second);
        if (day > 12 && month <= 12) {
            // already day-first
        } else if (month > 12 && day <= 12) {
            [day, month] = [month, day];
        }
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${year}-${pad(month)}-${pad(day)}`;
        }
        return null;
    }

    const named = raw.match(/^(\d{1,2})[\s-]([A-Za-z]{3,})[\s-](\d{2,4})$/);
    if (named) {
        const month = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
        const year = Number(named[3].length === 2 ? `20${named[3]}` : named[3]);
        if (month > 0) return `${year}-${pad(month)}-${pad(Number(named[1]))}`;
    }

    const serial = Number(raw);
    if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
        const millis = Math.round((serial - 25569) * 86400 * 1000);
        return new Date(millis).toISOString().slice(0, 10);
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return null;
}

/** "₹1,234.50" -> "1234.50"; "(200)" -> "-200"; "-" or "" -> null. */
export function parseStatementAmount(value: string | undefined | null): string | null {
    if (value === undefined || value === null) return null;
    let raw = String(value).replace(/[₹$€£,\s]/g, '').replace(/[^\d.\-()]/g, '');
    if (!raw || raw === '-' || raw === '.') return null;
    let negative = false;
    if (/^\(.*\)$/.test(raw)) {
        negative = true;
        raw = raw.slice(1, -1);
    }
    if (raw.startsWith('-')) {
        negative = true;
        raw = raw.slice(1);
    }
    if (!/^\d*\.?\d*$/.test(raw) || raw === '') return null;
    const paise = rupeesToPaise(raw);
    return formatPaise(negative ? -paise : paise);
}

const cell = (row: string[], headers: string[], column?: string): string => {
    if (!column) return '';
    const index = headers.indexOf(column);
    return index >= 0 ? String(row[index] ?? '').trim() : '';
};

/** Turns raw rows into dated, signed amounts using the chosen mapping. */
export function normaliseRows(reading: Reading, mapping: ColumnMapping): ParsedRow[] {
    return reading.rows.map((row, index) => {
        const date = parseStatementDate(cell(row, reading.headers, mapping.date));
        const description = cell(row, reading.headers, mapping.description) || '(no description)';
        const debit = parseStatementAmount(cell(row, reading.headers, mapping.debit));
        const credit = parseStatementAmount(cell(row, reading.headers, mapping.credit));
        let amount: string | null = null;
        if (debit || credit) {
            const debitPaise = debit ? rupeesToPaise(debit) : 0n;
            const creditPaise = credit ? rupeesToPaise(credit) : 0n;
            const net = creditPaise - debitPaise;
            amount = net === 0n ? null : formatPaise(net);
        } else {
            amount = parseStatementAmount(cell(row, reading.headers, mapping.amount));
        }
        const balance = parseStatementAmount(cell(row, reading.headers, mapping.balance));
        const externalId = cell(row, reading.headers, mapping.externalId) || null;

        const result: ParsedRow = {
            index,
            date: date ?? '',
            description,
            amount: amount ?? '',
            balance,
            externalId,
        };
        if (!date) result.error = 'Date could not be read';
        else if (!amount) result.error = 'Amount could not be read';
        return result;
    });
}

const normaliseText = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const similarity = (left: string, right: string): number => {
    const a = new Set(normaliseText(left).split(' ').filter(Boolean));
    const b = new Set(normaliseText(right).split(' ').filter(Boolean));
    if (a.size === 0 || b.size === 0) return 0;
    let shared = 0;
    a.forEach((word) => {
        if (b.has(word)) shared += 1;
    });
    return shared / Math.max(a.size, b.size);
};

const daysApart = (left: string, right: string): number => {
    const a = Date.parse(`${left}T00:00:00Z`);
    const b = Date.parse(`${right}T00:00:00Z`);
    if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
    return Math.abs(a - b) / 86_400_000;
};

/** First active rule (lowest priority number wins) whose pattern matches the description. */
export async function matchRules(
    userId: string,
    description: string
): Promise<{ ruleId: string; name: string; accountId: number; accountName: string } | null> {
    const rules = await prisma.importRule.findMany({
        where: { userId, active: true },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        include: { account: { select: { id: true, name: true } } },
    });
    const haystack = description.toLowerCase();
    for (const rule of rules) {
        let hit = false;
        if (rule.matchType === 'EQUALS') hit = haystack.trim() === rule.pattern.toLowerCase().trim();
        else if (rule.matchType === 'REGEX') {
            try {
                hit = new RegExp(rule.pattern, 'i').test(description);
            } catch {
                hit = false;
            }
        } else hit = haystack.includes(rule.pattern.toLowerCase());
        if (hit) {
            return { ruleId: rule.id, name: rule.name, accountId: rule.accountId, accountName: rule.account.name };
        }
    }
    return null;
}

/**
 * Annotates parsed rows with the existing transaction they duplicate, the
 * unreconciled ledger line they match (statement mode), and the category the
 * import rules would pick.
 */
export async function annotateRows(
    userId: string,
    accountId: number,
    rows: ParsedRow[],
    mode: ImportMode
): Promise<PreviewRow[]> {
    const valid = rows.filter((row) => !row.error);
    if (valid.length === 0) return rows.map((row) => ({ ...row, duplicate: null, match: null, rule: null }));

    const dates = valid.map((row) => row.date).filter(Boolean).sort();
    const from = new Date(`${dates[0]}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 7);
    const to = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
    to.setUTCDate(to.getUTCDate() + 7);

    const [existing, rules] = await Promise.all([
        prisma.transactionSplit.findMany({
            where: {
                accountId,
                transaction: { userId, date: { gte: from, lte: to } },
            },
            include: { transaction: { select: { id: true, date: true, description: true, status: true } } },
        }),
        prisma.importRule.findMany({
            where: { userId, active: true },
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
            include: { account: { select: { id: true, name: true } } },
        }),
    ]);

    const annotated: PreviewRow[] = [];
    for (const row of rows) {
        if (row.error) {
            annotated.push({ ...row, duplicate: null, match: null, rule: null });
            continue;
        }
        const rowPaise = rupeesToPaise(row.amount);
        const sameAmount = existing.filter((split) => split.amount === rowPaise && split.transaction.status !== 'VOIDED');

        let duplicate: PreviewRow['duplicate'] = null;
        let match: PreviewRow['match'] = null;
        for (const split of sameAmount) {
            const iso = split.transaction.date.toISOString().slice(0, 10);
            const gap = daysApart(iso, row.date);
            const score = Math.round(100 - gap * 8 + similarity(split.transaction.description, row.description) * 20);
            if (gap <= 1 && similarity(split.transaction.description, row.description) >= 0.34) {
                duplicate = { transactionId: split.transaction.id, description: split.transaction.description };
                break;
            }
            if (mode === 'statement' && !split.reconciledAt && gap <= 5) {
                const candidate = { splitId: split.id, transactionId: split.transaction.id, description: split.transaction.description, score: Math.max(0, Math.min(100, score)) };
                if (!match || candidate.score > match.score) match = candidate;
            }
        }

        let rule: PreviewRow['rule'] = null;
        const haystack = row.description.toLowerCase();
        for (const candidate of rules) {
            const hit = candidate.matchType === 'EQUALS'
                ? haystack.trim() === candidate.pattern.toLowerCase().trim()
                : candidate.matchType === 'REGEX'
                    ? (() => { try { return new RegExp(candidate.pattern, 'i').test(row.description); } catch { return false; } })()
                    : haystack.includes(candidate.pattern.toLowerCase());
            if (hit) {
                rule = { ruleId: candidate.id, name: candidate.name, accountId: candidate.account.id, accountName: candidate.account.name };
                break;
            }
        }

        annotated.push({ ...row, duplicate, match, rule });
    }
    return annotated;
}

/** Deterministic key so re-importing the same file posts nothing twice. */
export function importKey(accountId: number, row: { date: string; amount: string; description: string; externalId?: string | null }): string {
    const base = row.externalId
        ? `ext:${row.externalId}`
        : `row:${row.date}:${row.amount}:${normaliseText(row.description)}`;
    return `import:${accountId}:${base}`.slice(0, 220);
}
