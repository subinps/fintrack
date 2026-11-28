export type LedgerEventType =
    | 'transaction.created'
    | 'transaction.updated'
    | 'transaction.voided'
    | 'transaction.restored'
    | 'transaction.completed'
    | 'account.changed';

export interface LedgerEvent {
    type: LedgerEventType;
    userId: string;
    transactionId?: number;
    accountIds?: number[];
}

type LedgerEventHandler = (event: LedgerEvent) => void | Promise<void>;

const handlers: LedgerEventHandler[] = [];

export function onLedgerEvent(handler: LedgerEventHandler): void {
    handlers.push(handler);
}

export function emitLedgerEvent(event: LedgerEvent): void {
    for (const handler of handlers) {
        Promise.resolve()
            .then(() => handler(event))
            .catch((error) => {
                console.error('[events] handler failed', error);
            });
    }
}
