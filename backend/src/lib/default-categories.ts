/** Canonical category names offered for each account type. Seeded per user so the
 *  manage-categories dialog lists a complete starting set, not just used ones. */
export const DEFAULT_CATEGORIES: Record<string, string[]> = {
    ASSET: [
        'Savings', 'Current', 'Wallet', 'Cash',
        'Stock', 'Mutual Fund', 'Crypto', 'ETF', 'Bond', 'Other Investment',
        'Receivable', 'Property', 'Vehicle', 'Gold', 'Other Asset',
    ],
    LIABILITY: ['Credit Card', 'Loan', 'Mortgage', 'Payable', 'Overdraft', 'Other Liability'],
    INCOME: ['Salary', 'Freelance', 'Business', 'Dividend', 'Interest', 'Rental', 'Refund', 'Gift', 'Bonus', 'Grant', 'Other Income'],
    EXPENSE: [
        'Food', 'Groceries', 'Rent', 'Utilities', 'Transportation', 'Entertainment', 'Health', 'Shopping', 'Travel',
        'Education', 'Insurance', 'Tax', 'Donation', 'Subscriptions', 'Personal Care', 'Home', 'Kids', 'Pets', 'Other Expense',
    ],
    EQUITY: ['Opening Balance', 'Capital', 'Retained Earnings'],
};

export const CATEGORY_TYPES = Object.keys(DEFAULT_CATEGORIES);
