export function formatCurrency(value: number | string, symbol = '₹') {
  const amount = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(amount)) return `${symbol}0.00`;
  return `${symbol}${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function transactionTotal(tx: { splits: { amount: string }[] }) {
  return tx.splits.reduce((sum, split) => {
    const amount = parseFloat(split.amount) || 0;
    return amount > 0 ? sum + amount : sum;
  }, 0);
}
