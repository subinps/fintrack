/**
 * Per-screen guidance, shown inside the screen it belongs to. Keep each entry short:
 * three to four steps a person can follow with the buttons in front of them.
 */
export type PageHelp = {
  title: string;
  steps: string[];
  tip?: string;
};

export const PAGE_HELP = {
  'chart-of-accounts': {
    title: 'How this page works',
    steps: [
      'Each tab is one account type: assets and liabilities are what you own and owe, income and expense are what flows in and out, equity keeps the books balanced.',
      'Search by name or group to find an account, then use the row pencil to rename it or the arrows to move money.',
      'Manage categories below changes the labels you pick inside transactions — deleting one never changes history.',
    ],
    tip: 'Two levels is plenty: group by purpose (Bank, Cards, Loans), not by bank. Categories describe the habit, tags describe the shop.',
  },
  automations: {
    title: 'How automations work',
    steps: [
      'Start from a template: it fills in the trigger and the action, and you only adjust the amounts.',
      'A trigger answers "when should this happen" — a date, a scheduled repeat, or a new transaction that matches a filter.',
      'Rehearse runs the script against your real data and lists what it would do, without writing anything.',
      'Turn it on when the rehearsal looks right. Every run is listed under History with its result.',
    ],
    tip: 'Pause everything at the top of the page in one tap if a run does something you did not expect.',
  },
  budgets: {
    title: 'How budgets work',
    steps: [
      'A budget is a monthly ceiling per category. Spending counts at the moment it is recorded, not when the card is paid.',
      'The bar shows this month against the ceiling; green is comfortable, amber is close, rose is over.',
      'Use Adjust to change a ceiling without opening the full editor, and copy last month when a new month starts.',
    ],
    tip: 'Budget the categories you actually overspend on. Twenty accurate ones beat sixty guesses.',
  },
  'connect-ai': {
    title: 'Connect an assistant to your ledger',
    steps: [
      'Create a key here, then paste it into your assistant: Claude Desktop, Cursor, or any client that speaks MCP.',
      'Add FinTrack as a server in the client config — the snippet below is ready to copy.',
      'Ask a question in plain language ("what did I spend on food last month?"); the assistant calls FinTrack tools over MCP.',
      'Revoke a key here the moment a client stops using it.',
    ],
    tip: 'The assistant only sees what a tool asks for, and every call appears in the activity list — a key is a door, not a copy of your ledger.',
  },
  profile: {
    title: 'Your account and preferences',
    steps: [
      'Appearance changes the theme and the accent colour for this browser instantly.',
      'Security holds your password and the list of devices that are signed in — revoke anything you do not recognise.',
      'Export All Data downloads the whole ledger as JSON; delete requests remove the account and everything in it.',
    ],
  },
  overview: {
    title: 'How the overview works',
    steps: [
      'Net worth is every asset minus every liability, posted from the double-entry ledger — nothing here is typed twice.',
      'Change the chart range to read a week, a month or a year of movement; hover the line for the balance on that day.',
      'The cards below split the same moment four ways: assets, liabilities, this month\'s income and this month\'s spending.',
    ],
    tip: 'If a number looks wrong, open Transactions and fix the entry — the overview only reports what the ledger recorded.',
  },
  transactions: {
    title: 'How the journal works',
    steps: [
      'Add transaction opens a two-step entry: pick income, expense or transfer, then the account and category it belongs to.',
      'Advanced mode adds the second line yourself when money moves between your own accounts or needs a split.',
      'Filter by text, account, category, tag or date; the filters stay put while you page through results.',
      'Tick a row to select several, then bulk-edit or export. Deleted rows rest in Trash and can be restored.',
    ],
    tip: 'Use tags for who or where ("gift", "diwali", "swiggy") and categories for the habit — the tax screen claims deductions by tag.',
  },
  accounts: {
    title: 'How accounts work',
    steps: [
      'An account is a place money sits: savings, cash, wallet or a credit card. Its balance is the sum of every posting to it.',
      'Add account asks for an opening balance once — after that the ledger keeps the balance up to date.',
      'Use the row menu to view the ledger or edit details; assets and cards are grouped separately so debt never hides inside savings.',
    ],
    tip: 'Open each account once a month and compare with the bank app, then reconcile the difference instead of editing history.',
  },
  investments: {
    title: 'How investments work',
    steps: [
      'Add a holding with units and buy price; the price refresh button updates market value from the price API.',
      'Gain or loss is market value minus cost — teal when up, rose when down, never the other way round.',
      'The allocation panel weights each holding against the portfolio, so one position cannot quietly become the whole plan.',
    ],
    tip: 'Update prices before reading the numbers; a stale price makes a good month look like a bad one.',
  },
  debts: {
    title: 'How debts work',
    steps: [
      'A debt is money you owe, a receivable is money owed to you — both are liabilities on the balance sheet.',
      'Record a payment against a debt to lower the balance; the interest field keeps the cost of borrowing visible.',
      'The progress bar shows how far the balance has fallen from its opening amount, with the next due date beside it.',
    ],
    tip: 'Log the minimum due as a recurring rule so a missed month shows up as a warning instead of a surprise.',
  },
  'income-expense': {
    title: 'How income and expenses work',
    steps: [
      'Switch months to compare what came in against what went out, category by category.',
      'Click a category card to see the transactions behind the total — the same list you can filter in Transactions.',
      'The trend bars read month over month, so a one-off purchase stands out instead of blending in.',
    ],
    tip: 'Savings rate is income minus expense over income. Anything above 20% is comfortable for most households.',
  },
  recurring: {
    title: 'How recurring rules work',
    steps: [
      'A rule says what repeats, how often, and from which account: rent, salary, a subscription or a bill.',
      'Upcoming dates show what will post next, so the cash flow forecast is never a guess.',
      'Pause a rule instead of deleting it when a bill takes a month off; the history stays intact.',
    ],
    tip: 'Set the amount to the usual figure — the entry can always be edited after it posts.',
  },
  reconcile: {
    title: 'How reconciliation works',
    steps: [
      'Import the bank statement, then match each line against what the ledger recorded.',
      'A match links the two; a difference is either a missing entry you add or a bank fee you post as an expense.',
      'Import rules remember the category for a merchant, so the second import needs far less work than the first.',
    ],
    tip: 'Reconcile to the closing balance, not to today — that is the number the bank actually stands behind.',
  },
  reports: {
    title: 'How reports work',
    steps: [
      'Every statement is built from the same ledger: profit and loss for a period, balance sheet for a moment, cash flow for movement.',
      'Pick the period at the top; each report can be exported as CSV for an accountant.',
      'Equity is shown signed, so a debit balance reads negative and the balance sheet still adds up.',
    ],
    tip: 'Run the trial balance first when something does not reconcile — debits and credits must be equal there.',
  },
  tax: {
    title: 'How tax estimates work',
    steps: [
      'Tag the transactions you claim as deductions, then pick the regime to see the estimate update.',
      'The deduction list is grouped by section, with the total the ledger supports — nothing is invented.',
      'Advance tax shows what is due each quarter against what the estimate says you owe.',
    ],
    tip: 'Tags decide deductions here. Adding a tag to an expense is all it takes for the tax screen to count it.',
  },
  shared: {
    title: 'How shared expenses work',
    steps: [
      'Add the people you split money with, then record an expense and choose who paid and who owes what.',
      'Balances stay per person: the screen shows who owes you and whom you owe, not just one net figure.',
      'Settle up records the transfer, so the split closes without editing the original expense.',
    ],
    tip: 'Settle in the currency you actually paid in — the app records what the ledger saw, not today\'s rate.',
  },
  insights: {
    title: 'How insights work',
    steps: [
      'These cards read your posted ledger: savings rate, runway, biggest movers and a monthly digest.',
      'Each card explains the calculation in one line, so a surprising number can be traced back to transactions.',
      'Two months of entries unlock the trend cards — before that there is not enough history to compare.',
    ],
    tip: 'Runway is liquid assets divided by average monthly spending; it answers "how long could I last".',
  },
} satisfies Record<string, PageHelp>;
