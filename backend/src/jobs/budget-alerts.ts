import { onLedgerEvent } from '../lib/events';
import { logger } from '../lib/logger';
import { evaluateBudgetAlerts } from '../services/budgets';

const pending = new Map<string, NodeJS.Timeout>();

const DEBOUNCE_MS = Number(process.env.BUDGET_ALERT_DEBOUNCE_MS ?? 1500);

/**
 * Ledger changes arrive in bursts (an import, a recurring run). Coalesce them
 * per user so thresholds are evaluated once against the final numbers.
 */
export function queueBudgetEvaluation(userId: string): void {
    const existing = pending.get(userId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
        pending.delete(userId);
        evaluateBudgetAlerts(userId).catch((error) => {
            logger.error({ err: error, userId }, 'budget alert evaluation failed');
        });
    }, DEBOUNCE_MS);
    timer.unref?.();
    pending.set(userId, timer);
}

export function registerBudgetAlertHandlers(): void {
    onLedgerEvent((event) => {
        if (
            event.type === 'transaction.completed' ||
            event.type === 'transaction.created' ||
            event.type === 'transaction.updated' ||
            event.type === 'transaction.voided' ||
            event.type === 'transaction.restored'
        ) {
            queueBudgetEvaluation(event.userId);
        }
    });
}
