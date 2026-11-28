/**
 * Start of the calendar day in the user's own timezone, expressed as a UTC instant.
 * Snapshots are keyed by this value so "today" means the user's today, not UTC's.
 */
export function zonedDayStart(date: Date, timeZone: string): Date {
    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).formatToParts(date);
    } catch {
        return utcDayStart(date);
    }

    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour') === 24 ? 0 : get('hour');

    const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, get('minute'), get('second'));
    const offset = wallClockAsUtc - date.getTime();
    return new Date(Date.UTC(year, month - 1, day) - offset);
}

export function utcDayStart(date: Date): Date {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    return start;
}
