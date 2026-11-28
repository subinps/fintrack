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

type SerialisableAccount = {
    loanPrincipalPaise?: bigint | null;
    emiPaise?: bigint | null;
    creditLimitPaise?: bigint | null;
} & Record<string, unknown>;

const paise = (value?: bigint | null) => (value === undefined ? undefined : value === null ? null : value.toString());

/** Account rows carry paise amounts as BigInt; widen them to strings so JSON can carry them. */
export function serializeAccount<T extends SerialisableAccount>(account: T) {
    return {
        ...account,
        loanPrincipalPaise: paise(account.loanPrincipalPaise),
        emiPaise: paise(account.emiPaise),
        creditLimitPaise: paise(account.creditLimitPaise),
    };
}
