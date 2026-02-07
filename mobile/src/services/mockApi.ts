import * as localDb from './localDb';

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to map DB Account to API Account (snake_case -> camelCase)
const mapAccount = (acc: any) => ({
    id: acc.id,
    name: acc.name,
    type: acc.type,
    subType: acc.sub_type,
    balance: acc.balance, // Number in local, string in backend (handled by frontend)
    currency: acc.currency,
    isArchived: !!acc.is_archived,
    interestRate: acc.interest_rate,
    dueDate: acc.due_date,
    symbol: acc.symbol,
    units: acc.units,
    lastMarketPrice: acc.last_market_price,
    lastMarketUpdate: acc.last_market_update
});

// Helper to map DB Transaction to API Transaction
const mapTransaction = (tx: any, splits: any[]) => ({
    id: tx.id,
    date: tx.date,
    description: tx.description,
    notes: tx.notes,
    status: tx.status,
    splits: splits.map(s => ({
        id: s.id,
        accountId: s.account_id,
        amount: s.amount,
        units: s.units,
        account: {
            id: s.account_id,
            name: s.account_name,
            type: s.account_type,
            subType: s.account_sub_type // Joined field
        }
    }))
});

export const mockApi = {
    handleRequest: async (config: any) => {
        await delay(300); // Simulate 300ms latency

        const { url, method, data } = config;
        const body = data ? (typeof data === 'string' ? JSON.parse(data) : data) : {};

        try {
            // =================================================================================
            // AUTH
            // =================================================================================

            if (url === '/auth/login' && method === 'post') {
                return {
                    data: {
                        token: 'mock-jwt-token',
                        user: { id: 'local', name: 'Local User', email: body.email || 'local@device' }
                    },
                    status: 200
                };
            }

            if (url === '/auth/register' && method === 'post') {
                return {
                    data: {
                        message: 'User created. Please check your email.',
                        user: { id: 'local', name: body.name, email: body.email }
                    },
                    status: 201
                };
            }

            if (url === '/auth/me' && method === 'get') {
                const nameSetting = await localDb.getFirst("SELECT value FROM settings WHERE key = 'user_name'") as any;
                const name = nameSetting ? nameSetting.value : 'Local User';
                return { data: { id: 'local', name, email: 'local@device' }, status: 200 };
            }

            if (url === '/auth/me' && method === 'put') {
                const { name } = body;
                await localDb.runRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('user_name', ?)", [name]);
                return { data: { id: 'local', name, email: 'local@device' }, status: 200 };
            }

            if (url === '/auth/logout' && method === 'post') {
                return { data: { message: 'Logged out successfully' }, status: 200 };
            }

            if (url === '/auth/sessions' && method === 'get') {
                return {
                    data: [{
                        id: 'current-session',
                        device: 'Local Device',
                        ip: '127.0.0.1',
                        lastActive: new Date().toISOString(),
                        isCurrent: true
                    }],
                    status: 200
                };
            }

            if (url === '/auth/sessions/others' && method === 'delete') {
                return { data: { message: 'All other sessions revoked' }, status: 200 };
            }

            if (url.match(/\/auth\/sessions\/.+/) && method === 'delete') {
                return { data: { message: 'Session revoked' }, status: 200 };
            }

            if (url === '/auth/delete-account' && method === 'delete') {
                await localDb.runRun('DELETE FROM transactions');
                await localDb.runRun('DELETE FROM transaction_splits');
                await localDb.runRun('DELETE FROM accounts');
                await localDb.runRun('DELETE FROM categories');
                await localDb.runRun('DELETE FROM net_worth_snapshots');
                await localDb.runRun('DELETE FROM market_prices');
                return { data: { message: 'Account deleted successfully' }, status: 200 };
            }

            if (url === '/auth/reset-data' && method === 'post') {
                await localDb.runRun('DELETE FROM transactions');
                await localDb.runRun('DELETE FROM transaction_splits');
                await localDb.runRun('DELETE FROM accounts');
                await localDb.runRun('DELETE FROM categories');
                await localDb.runRun('DELETE FROM net_worth_snapshots');
                await localDb.runRun('DELETE FROM market_prices');
                return { data: { message: 'All data reset successfully' }, status: 200 };
            }

            if (url === '/auth/forgot-password' && method === 'post') {
                return { data: { message: 'If an account exists with this email, you will receive a reset link.' }, status: 200 };
            }

            if (url === '/auth/reset-password' && method === 'post') {
                return { data: { message: 'Password reset successfully' }, status: 200 };
            }

            if (url === '/auth/resend-verification' && method === 'post') {
                return { data: { message: 'Verification email sent' }, status: 200 };
            }

            if (url.startsWith('/auth/verify') && method === 'get') {
                return { data: 'Email Verified!', status: 200 };
            }

            // =================================================================================
            // ACCOUNTS
            // =================================================================================

            // GET /accounts
            if (url === '/accounts' && method === 'get') {
                const accounts = await localDb.runQuery("SELECT * FROM accounts WHERE is_archived = 0 ORDER BY name ASC") as any[];
                const marketPrices = await localDb.runQuery("SELECT * FROM market_prices") as any[];
                const priceMap = new Map(marketPrices.map(mp => [mp.symbol, mp]));

                const accountsWithBalance = await Promise.all(accounts.map(async (acc: any) => {
                    const splits = await localDb.runQuery(`
                        SELECT s.*, t.date, t.description 
                        FROM transaction_splits s
                        JOIN transactions t ON s.transaction_id = t.id
                        WHERE s.account_id = ? AND t.status = 'COMPLETED'
                        ORDER BY t.date ASC
                    `, [acc.id]) as any[];

                    const balance = splits.reduce((sum: number, split: any) => sum + split.amount, 0);

                    let currentUnits = acc.units || 0;
                    let currentCostBasis = 0;
                    const openingTx = splits.find(s => s.description.toLowerCase().includes('opening balance'));

                    if (!openingTx && acc.units) currentUnits = acc.units;

                    for (const split of splits) {
                        let units = split.units || 0;
                        const amount = split.amount;

                        if (openingTx && split.id === openingTx.id && units === 0 && acc.units) {
                            units = acc.units;
                        }

                        if (units > 0) {
                            currentUnits += units;
                            currentCostBasis += amount;
                        } else if (units < 0) {
                            if (currentUnits > 0) {
                                const avgCost = currentCostBasis / currentUnits;
                                currentCostBasis -= (Math.abs(units) * avgCost);
                                currentUnits += units;
                            } else {
                                currentUnits += units;
                            }
                        }
                    }

                    const averageBuyPrice = currentUnits > 0 ? currentCostBasis / currentUnits : 0;
                    let lastMarketPrice = acc.last_market_price;
                    let lastMarketUpdate = acc.last_market_update;

                    if (acc.symbol) {
                        const mp = priceMap.get(acc.symbol.toUpperCase());
                        if (mp) {
                            lastMarketPrice = mp.price;
                            lastMarketUpdate = mp.last_updated;
                        }
                    }

                    // Map DB fields (snake_case) to API fields (camelCase)
                    return {
                        ...mapAccount(acc),
                        balance: balance,
                        units: currentUnits,
                        averageBuyPrice,
                        lastMarketPrice,
                        lastMarketUpdate
                    };
                }));

                return { data: accountsWithBalance, status: 200 };
            }

            // POST /accounts
            if (url === '/accounts' && method === 'post') {
                const { name, type, subType, interestRate, dueDate, symbol, units, openingBalance, lastMarketPrice, currency } = body;

                // Removed Mirroring Logic as requested

                const result = await localDb.runRun(
                    `INSERT INTO accounts (
                        name, type, sub_type, interest_rate, due_date, symbol, units, last_market_price, currency, balance
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [name, type, subType, interestRate, dueDate, symbol, units, lastMarketPrice, currency || 'INR', 0]
                );
                const accountId = result.lastInsertRowId;

                if (openingBalance && parseFloat(openingBalance) !== 0) {
                    const amount = parseFloat(openingBalance);
                    let equityAccount = await localDb.getFirst("SELECT * FROM accounts WHERE name = 'Opening Balance Equity' AND type = 'EQUITY'") as any;
                    if (!equityAccount) {
                        const eqResult = await localDb.runRun("INSERT INTO accounts (name, type, balance) VALUES ('Opening Balance Equity', 'EQUITY', 0)");
                        equityAccount = { id: eqResult.lastInsertRowId };
                    }

                    let split1Amount = 0;
                    let split2Amount = 0;

                    if (type === 'ASSET' || type === 'EXPENSE') {
                        split1Amount = amount;
                        split2Amount = -amount;
                    } else {
                        split1Amount = -amount;
                        split2Amount = amount;
                    }

                    const txResult = await localDb.runRun(
                        "INSERT INTO transactions (description, date, status) VALUES ('Opening Balance', ?, 'COMPLETED')",
                        [new Date().toISOString()]
                    );
                    const txId = txResult.lastInsertRowId;

                    await localDb.runRun("INSERT INTO transaction_splits (transaction_id, account_id, amount, units) VALUES (?, ?, ?, ?)", [txId, accountId, split1Amount, units]);
                    await localDb.runRun("INSERT INTO transaction_splits (transaction_id, account_id, amount) VALUES (?, ?, ?)", [txId, equityAccount.id, split2Amount]);
                    await localDb.runRun("UPDATE accounts SET balance = balance + ? WHERE id = ?", [split1Amount, accountId]);
                    await localDb.runRun("UPDATE accounts SET balance = balance + ? WHERE id = ?", [split2Amount, equityAccount.id]);
                }

                return { data: { ...body, id: accountId }, status: 201 };
            }

            // PUT /accounts/:id
            if (url.match(/\/accounts\/\d+$/) && method === 'put') {
                const id = url.split('/')[2];
                const { name, type, subType, interestRate, dueDate, symbol, units, lastMarketPrice } = body;

                const existing = await localDb.getFirst('SELECT * FROM accounts WHERE id = ?', [id]) as any;
                if (!existing) return { data: { error: 'Account not found' }, status: 404 };

                await localDb.runRun(
                    `UPDATE accounts SET 
                        name = ?, type = ?, sub_type = ?, interest_rate = ?, due_date = ?, symbol = ?, units = ?, last_market_price = ?
                    WHERE id = ?`,
                    [name, type, subType, interestRate, dueDate, symbol, units, lastMarketPrice, id]
                );

                const splits = await localDb.runQuery('SELECT amount FROM transaction_splits WHERE account_id = ?', [id]) as any[];
                const balance = splits.reduce((sum, s) => sum + s.amount, 0);

                return { data: { ...mapAccount(existing), ...body, balance }, status: 200 };
            }

            // DELETE /accounts/:id
            if (url.match(/\/accounts\/\d+$/) && method === 'delete') {
                const id = url.split('/')[2];
                const txs = await localDb.runQuery(`SELECT DISTINCT transaction_id FROM transaction_splits WHERE account_id = ?`, [id]) as any[];

                for (const tx of txs) {
                    const splits = await localDb.runQuery('SELECT * FROM transaction_splits WHERE transaction_id = ?', [tx.transaction_id]) as any[];
                    for (const split of splits) {
                        if (split.account_id !== parseInt(id)) {
                            await localDb.runRun('UPDATE accounts SET balance = balance - ? WHERE id = ?', [split.amount, split.account_id]);
                        }
                    }
                    await localDb.runRun('DELETE FROM transactions WHERE id = ?', [tx.transaction_id]);
                    await localDb.runRun('DELETE FROM transaction_splits WHERE transaction_id = ?', [tx.transaction_id]);
                }

                await localDb.runRun('DELETE FROM accounts WHERE id = ?', [id]);
                return { data: { message: 'Account deleted' }, status: 200 };
            }

            // PATCH /accounts/:id/price
            if (url.match(/\/accounts\/\d+\/price$/) && method === 'patch') {
                const id = url.split('/')[2];
                const { price } = body;
                await localDb.runRun('UPDATE accounts SET last_market_price = ?, last_market_update = ? WHERE id = ?', [price, new Date().toISOString(), id]);
                return { data: { message: 'Price updated' }, status: 200 };
            }

            // GET /accounts/:id/ledger (Complex Logic)
            if (url.match(/\/accounts\/\d+\/ledger/) && method === 'get') {
                const id = url.split('/')[2];
                // Simplified Ledger Logic for Local Mode (Parity with Backend Logic)
                const splits = await localDb.runQuery(`
                    SELECT s.*, t.date, t.description, t.id as transaction_id
                    FROM transaction_splits s
                    JOIN transactions t ON s.transaction_id = t.id
                    WHERE s.account_id = ? AND t.status = 'COMPLETED'
                    ORDER BY t.date ASC
                `, [id]) as any[];

                let runningBalance = 0;
                const rows = [];

                for (const split of splits) {
                    runningBalance += split.amount;

                    // Find opposing splits
                    const allSplits = await localDb.runQuery('SELECT s.*, a.name as account_name FROM transaction_splits s JOIN accounts a ON s.account_id = a.id WHERE s.transaction_id = ?', [split.transaction_id]) as any[];
                    const otherSplits = allSplits.filter(s => s.id !== split.id);

                    let accountInvolved = 'Split / Multiple';
                    if (otherSplits.length === 1) {
                        accountInvolved = otherSplits[0].account_name;
                    } else if (otherSplits.length === 0) {
                        accountInvolved = 'Unknown';
                    }

                    rows.push({
                        id: `${split.transaction_id}-0`,
                        transactionId: split.transaction_id,
                        date: split.date.split('T')[0],
                        description: split.description,
                        accountInvolved,
                        debit: split.amount > 0 ? (split.amount / 100).toFixed(2) : '',
                        credit: split.amount < 0 ? (Math.abs(split.amount) / 100).toFixed(2) : '',
                        balance: (runningBalance / 100).toFixed(2)
                    });
                }
                return { data: rows, status: 200 };
            }

            // GET /accounts/:id/export
            if (url.match(/\/accounts\/\d+\/export/) && method === 'get') {
                return { data: { message: 'Export not supported in local mode' }, status: 200 };
            }

            // =================================================================================
            // CATEGORIES
            // =================================================================================

            if (url.startsWith('/categories') && method === 'get') {
                const categories = await localDb.runQuery('SELECT * FROM categories ORDER BY name ASC');
                return { data: categories, status: 200 };
            }

            if (url === '/categories' && method === 'post') {
                const { name, type } = body;
                const result = await localDb.runRun('INSERT INTO categories (name, type) VALUES (?, ?)', [name, type]);

                // Removed Mirroring Logic as requested

                return { data: { ...body, id: result.lastInsertRowId }, status: 201 };
            }

            if (url.match(/\/categories\/\d+$/) && method === 'delete') {
                const id = url.split('/')[2];
                await localDb.runRun('DELETE FROM categories WHERE id = ?', [id]);
                return { data: { message: 'Category deleted' }, status: 200 };
            }

            // =================================================================================
            // TRANSACTIONS
            // =================================================================================

            // GET /transactions
            if (url.startsWith('/transactions') && method === 'get' && !url.includes('/import') && !url.includes('/template')) {
                // Parse Query Params
                const queryString = url.split('?')[1] || '';
                const params = new URLSearchParams(queryString);
                const status = params.get('status');

                let query = 'SELECT * FROM transactions';
                const queryParams = [];

                if (status) {
                    query += ' WHERE status = ?';
                    queryParams.push(status);
                }

                query += ' ORDER BY date DESC LIMIT 50';

                const transactions = await localDb.runQuery(query, queryParams);

                const enrichedTransactions = await Promise.all(transactions.map(async (t: any) => {
                    const splits = await localDb.runQuery(`
                        SELECT s.*, a.name as account_name, a.type as account_type, a.sub_type as account_sub_type
                        FROM transaction_splits s
                        JOIN accounts a ON s.account_id = a.id
                        WHERE s.transaction_id = ?
                    `, [t.id]) as any[];

                    return mapTransaction(t, splits);
                }));

                return { data: { data: enrichedTransactions, pagination: { total: transactions.length, page: 1, limit: 50, totalPages: 1 } }, status: 200 };
            }

            // GET /transactions/:id
            if (url.match(/\/transactions\/\d+$/) && method === 'get') {
                const id = url.split('/')[2];
                const transaction = await localDb.getFirst('SELECT * FROM transactions WHERE id = ?', [id]) as any;
                if (!transaction) return { data: { error: 'Not found' }, status: 404 };

                const splits = await localDb.runQuery(`
                    SELECT s.*, a.name as account_name, a.type as account_type, a.sub_type as account_sub_type
                    FROM transaction_splits s
                    JOIN accounts a ON s.account_id = a.id
                    WHERE s.transaction_id = ?
                `, [id]) as any[];

                return { data: mapTransaction(transaction, splits), status: 200 };
            }

            // POST /transactions
            if (url === '/transactions' && method === 'post') {
                const { date, description, notes, splits, status } = body;

                const sum = splits.reduce((acc: number, s: any) => acc + s.amount, 0);
                if (Math.abs(sum) > 0.01) return { data: { error: 'Transaction splits must sum to zero' }, status: 400 };

                const txResult = await localDb.runRun(
                    'INSERT INTO transactions (date, description, notes, status) VALUES (?, ?, ?, ?)',
                    [date, description, notes, status || 'COMPLETED']
                );
                const txId = txResult.lastInsertRowId;

                for (const split of splits) {
                    await localDb.runRun(
                        'INSERT INTO transaction_splits (transaction_id, account_id, amount, units) VALUES (?, ?, ?, ?)',
                        [txId, split.accountId, split.amount, split.units]
                    );
                    await localDb.runRun(
                        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
                        [split.amount, split.accountId]
                    );
                }

                return { data: { ...body, id: txId }, status: 201 };
            }

            // PUT /transactions/:id
            if (url.match(/\/transactions\/\d+$/) && method === 'put') {
                const id = url.split('/')[2];
                const { date, description, notes, splits, status } = body;

                const sum = splits.reduce((acc: number, s: any) => acc + s.amount, 0);
                if (Math.abs(sum) > 0.01) return { data: { error: 'Transaction splits must sum to zero' }, status: 400 };

                const oldSplits = await localDb.runQuery('SELECT * FROM transaction_splits WHERE transaction_id = ?', [id]) as any[];
                for (const split of oldSplits) {
                    await localDb.runRun('UPDATE accounts SET balance = balance - ? WHERE id = ?', [split.amount, split.account_id]);
                }
                await localDb.runRun('DELETE FROM transaction_splits WHERE transaction_id = ?', [id]);

                await localDb.runRun(
                    'UPDATE transactions SET date = ?, description = ?, notes = ?, status = ? WHERE id = ?',
                    [date, description, notes, status || 'COMPLETED', id]
                );

                for (const split of splits) {
                    await localDb.runRun(
                        'INSERT INTO transaction_splits (transaction_id, account_id, amount, units) VALUES (?, ?, ?, ?)',
                        [id, split.accountId, split.amount, split.units]
                    );
                    await localDb.runRun(
                        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
                        [split.amount, split.accountId]
                    );
                }

                return { data: { ...body, id }, status: 200 };
            }

            // PUT /transactions/:id/approve
            if (url.match(/\/transactions\/\d+\/approve$/) && method === 'put') {
                const id = url.split('/')[2];
                await localDb.runRun("UPDATE transactions SET status = 'COMPLETED' WHERE id = ?", [id]);
                return { data: { message: 'Approved' }, status: 200 };
            }

            // DELETE /transactions/:id
            if (url.match(/\/transactions\/\d+$/) && method === 'delete') {
                const id = url.split('/')[2];
                const oldSplits = await localDb.runQuery('SELECT * FROM transaction_splits WHERE transaction_id = ?', [id]) as any[];
                for (const split of oldSplits) {
                    await localDb.runRun('UPDATE accounts SET balance = balance - ? WHERE id = ?', [split.amount, split.account_id]);
                }
                await localDb.runRun('DELETE FROM transactions WHERE id = ?', [id]);
                await localDb.runRun('DELETE FROM transaction_splits WHERE transaction_id = ?', [id]);
                return { data: { message: 'Transaction deleted' }, status: 200 };
            }

            // GET /transactions/template/download
            if (url === '/transactions/template/download' && method === 'get') {
                return { data: { message: 'Template download not supported in local mode' }, status: 200 };
            }

            // POST /transactions/import
            if (url === '/transactions/import' && method === 'post') {
                return { data: { message: 'Import not supported in local mode' }, status: 200 };
            }

            // =================================================================================
            // ANALYTICS
            // =================================================================================

            // GET /analytics/net-worth-history
            if (url === '/analytics/net-worth-history' && method === 'get') {
                const accounts = await localDb.runQuery("SELECT * FROM accounts WHERE is_archived = 0") as any[];
                let totalAssets = 0;
                let totalLiabilities = 0;

                for (const acc of accounts) {
                    let value = acc.balance;
                    if (acc.type === 'ASSET' && acc.units && acc.last_market_price) {
                        value = acc.units * acc.last_market_price;
                    }
                    if (acc.type === 'ASSET') totalAssets += value;
                    else if (acc.type === 'LIABILITY') totalLiabilities += Math.abs(value);
                }

                const netWorth = totalAssets - totalLiabilities;
                const today = new Date().toISOString().split('T')[0];

                const existingSnapshot = await localDb.getFirst('SELECT * FROM net_worth_snapshots WHERE date = ?', [today]);
                if (existingSnapshot) {
                    await localDb.runRun(
                        'UPDATE net_worth_snapshots SET net_worth = ?, assets = ?, liabilities = ? WHERE date = ?',
                        [netWorth, totalAssets, totalLiabilities, today]
                    );
                } else {
                    await localDb.runRun(
                        'INSERT INTO net_worth_snapshots (date, net_worth, assets, liabilities) VALUES (?, ?, ?, ?)',
                        [today, netWorth, totalAssets, totalLiabilities]
                    );
                }

                const history = await localDb.runQuery('SELECT * FROM net_worth_snapshots ORDER BY date ASC');
                return { data: history, status: 200 };
            }

            // GET /analytics/balance-history/:accountId
            if (url.match(/\/analytics\/balance-history\/\d+/) && method === 'get') {
                const id = url.split('/')[3];
                const splits = await localDb.runQuery(`
                    SELECT s.amount, t.date 
                    FROM transaction_splits s
                    JOIN transactions t ON s.transaction_id = t.id
                    WHERE s.account_id = ? AND t.status = 'COMPLETED'
                    ORDER BY t.date ASC
                `, [id]) as any[];

                let runningBalance = 0;
                const historyMap = new Map();

                splits.forEach(split => {
                    runningBalance += split.amount;
                    historyMap.set(split.date.split('T')[0], runningBalance);
                });

                const result = Array.from(historyMap).map(([date, balance]) => ({ date, balance }));
                return { data: result, status: 200 };
            }

            // =================================================================================
            // PRICE
            // =================================================================================

            if (url.match(/\/price\/[A-Z0-9]+$/) && method === 'get') {
                const symbol = url.split('/').pop();
                const cached = await localDb.getFirst('SELECT * FROM market_prices WHERE symbol = ?', [symbol]) as any;

                if (cached) {
                    return { data: { symbol: cached.symbol, price: cached.price, lastUpdated: cached.last_updated }, status: 200 };
                }

                const mockPrice = Math.random() * 1000;
                await localDb.runRun(
                    'INSERT INTO market_prices (symbol, price, last_updated) VALUES (?, ?, ?)',
                    [symbol, mockPrice, new Date().toISOString()]
                );
                return { data: { symbol, price: mockPrice, lastUpdated: new Date().toISOString() }, status: 200 };
            }

            // POST /price/batch
            if (url === '/price/batch' && method === 'post') {
                const { symbols } = body;
                const results = [];
                for (const symbol of symbols) {
                    const cached = await localDb.getFirst('SELECT * FROM market_prices WHERE symbol = ?', [symbol]) as any;
                    if (cached) {
                        results.push({ symbol: cached.symbol, price: cached.price, lastUpdated: cached.last_updated });
                    } else {
                        const mockPrice = Math.random() * 1000;
                        await localDb.runRun(
                            'INSERT INTO market_prices (symbol, price, last_updated) VALUES (?, ?, ?)',
                            [symbol, mockPrice, new Date().toISOString()]
                        );
                        results.push({ symbol, price: mockPrice, lastUpdated: new Date().toISOString() });
                    }
                }
                return { data: results, status: 200 };
            }

            console.warn(`[MockAPI] Unhandled request: ${method} ${url}`);
            return { data: {}, status: 404 };

        } catch (error) {
            console.error('[MockAPI] Error:', error);
            return { data: { error: 'Internal Mock Error' }, status: 500 };
        }
    }
};
