type SerialisableSplit = { amount: bigint } & Record<string, unknown>;
type SerialisableTransaction = { splits: SerialisableSplit[] } & Record<string, unknown>;

const serializeSplit = (split: SerialisableSplit) => ({
    ...split,
    amount: split.amount.toString(),
});

export function serializeTransaction<T extends SerialisableTransaction>(transaction: T) {
    return {
        ...transaction,
        splits: transaction.splits.map(serializeSplit),
    };
}

export function serializeTransactions<T extends SerialisableTransaction>(transactions: T[]) {
    return transactions.map(serializeTransaction);
}
