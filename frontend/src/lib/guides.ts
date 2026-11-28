import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  CreditCard,
  FileSpreadsheet,
  Layers,
  Rocket,
  Scale,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import type { BadgeTone } from '@/components/system/IconBadge';

/**
 * Help Centre content. Pure data: add a guide here and it appears in the index,
 * the search results and the previous/next links without touching the UI.
 */
export type GuideSection = {
  heading: string;
  steps: string[];
  tip?: string;
};

export type Guide = {
  slug: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  tone: BadgeTone;
  minutes: number;
  keywords: string[];
  sections: GuideSection[];
  related: string[];
};

export const GUIDES: Guide[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    summary: 'From an empty ledger to a net worth you trust, in about ten minutes.',
    icon: Rocket,
    tone: 'primary',
    minutes: 3,
    keywords: ['setup', 'first account', 'opening balance', 'net worth', 'start'],
    sections: [
      {
        heading: 'Set your opening balance',
        steps: [
          'Open Bank & Cash and choose New account.',
          'Pick the account type — bank, cash, wallet or credit card — and give it the name you actually use for it.',
          'Enter the balance the account has today as the opening balance. That figure is your position on day one, so FinTrack posts it to Equity → Opening balance instead of calling it income.',
        ],
        tip: 'Only the difference needs entering. If the ledger already says ₹40,000 and the bank says ₹42,000, log a ₹2,000 transfer with the note "missed entry" rather than editing history.',
      },
      {
        heading: 'Look over your categories',
        steps: [
          'Open Chart of Accounts → Manage categories.',
          'FinTrack seeds 56 defaults across assets, liabilities, income, expenses and equity, so most spending already has a home.',
          'Rename them or add your own — the category\'s type decides the colour it carries into every picker, chart and report.',
        ],
      },
      {
        heading: 'Record one real transaction',
        steps: [
          'Choose New transaction in the top bar.',
          'Pick Income, Expense or Transfer, type the amount, then choose the account, the category and the date.',
          'Save with the button at the bottom of the dialog.',
        ],
        tip: 'Record three or four real ones from this week before importing anything — you will know within a minute whether your accounts and categories fit how you actually spend.',
      },
      {
        heading: 'Read the overview',
        steps: [
          'Net worth is assets minus liabilities, live from every posted entry.',
          'The stat row below it splits assets, liabilities, this month\'s income and expenses, and your savings rate.',
          'The range selector changes the trend window — 1M is the default for month-to-month decisions.',
        ],
      },
    ],
    related: ['double-entry', 'accounts-and-categories'],
  },
  {
    slug: 'double-entry',
    title: 'Double-entry, in plain language',
    summary: 'Why every entry has two sides, and what "balanced" actually means.',
    icon: Scale,
    tone: 'equity',
    minutes: 4,
    keywords: ['debit', 'credit', 'balanced', 'splits', 'ledger', 'accounting'],
    sections: [
      {
        heading: 'One transaction, two movements',
        steps: [
          'Every entry in FinTrack is made of split lines. Each line moves value into or out of exactly one account.',
          'The lines must add to zero, which is what "balanced" means: money never appears or disappears, it only changes where it sits.',
          'Because of that, no account has a balance you type and maintain. Every balance is calculated from the entries posted to it.',
        ],
      },
      {
        heading: 'A worked example',
        steps: [
          'You pay ₹1,200 for groceries from your bank account by UPI.',
          'Line one: ₹1,200 to Groceries (an expense — spending rises).',
          'Line two: −₹1,200 to HDFC Bank (an asset — the balance falls).',
          'Add them and you get zero, so the entry is balanced and both the bank balance and this month\'s expenses are correct at the same moment.',
        ],
        tip: 'The expense is not "money leaving the bank". It is consumption. Paying a credit card bill, by contrast, is a transfer — the expense already happened when you swiped.',
      },
      {
        heading: 'Reading debit and credit',
        steps: [
          'Debit is the left side of an entry, credit is the right side. Neither word means good or bad.',
          'For assets and expenses, a debit increases the balance. For liabilities, equity and income, a credit increases it.',
          'The split view in a transaction shows both sides with signs, so you never have to hold that in your head: green moves value in, rose moves it out.',
        ],
      },
      {
        heading: 'When a form refuses to save',
        steps: [
          'If the editor says the entry is out of balance, the split amounts do not add up to the transaction total.',
          'Check the last line you typed: an amount with the wrong sign is the usual cause.',
          'Use the balance bar at the bottom of the splits panel — it shows the amount still unassigned.',
        ],
      },
    ],
    related: ['transactions-and-splits', 'accounts-and-categories'],
  },
  {
    slug: 'accounts-and-categories',
    title: 'Accounts and categories',
    summary: 'The tree everything hangs from, and the colour that tells you what a number means.',
    icon: Layers,
    tone: 'assets',
    minutes: 4,
    keywords: ['chart of accounts', 'account types', 'categories', 'colour', 'icon', 'archive'],
    sections: [
      {
        heading: 'Five account types, five meanings',
        steps: [
          'Assets (blue) are what you own: bank, cash, wallets, investments, money lent out.',
          'Liabilities (amber) are what you owe: credit cards, loans, money borrowed from people.',
          'Income (green) is money earned, expenses (rose) are money consumed, and equity (violet) is the bridge that keeps the books balanced.',
        ],
        tip: 'The colour is the meaning. If a number is amber, something is owed — the palette is the same on the overview, the charts and the reports.',
      },
      {
        heading: 'Add or edit an account',
        steps: [
          'Bank & Cash → New account, or Chart of Accounts for any other type.',
          'Name it the way you would say it out loud, choose the type and set an opening balance if it is not empty.',
          'Each account takes its colour and icon from its type — blue for assets, amber for liabilities — and they follow it into rows, chips and pickers.',
        ],
      },
      {
        heading: 'Keep the tree shallow',
        steps: [
          'Two levels is plenty for personal books: group by purpose, not by bank.',
          'A category should describe the habit — Groceries, Fuel, Eating out — not the shop.',
          'Archive an account you no longer use instead of deleting it: history stays intact and reports do not change.',
        ],
        tip: 'If one shop is spending what a whole category should be, that is a budgeting question, not a reason for a new category. Keep the category, add a tag for the shop.',
      },
      {
        heading: 'Deleting a category',
        steps: [
          'Manage categories → the trash icon on the row you want to remove.',
          'FinTrack asks first and tells you how many accounts still use it.',
          'Deleting only removes the option from pickers and filters. Entries already posted keep their label, so no historical report moves.',
        ],
      },
    ],
    related: ['getting-started', 'double-entry'],
  },
  {
    slug: 'transactions-and-splits',
    title: 'Recording transactions and splits',
    summary: 'Fast entry for the daily case, splits for the one-payment-many-buckets case.',
    icon: ArrowLeftRight,
    tone: 'income',
    minutes: 5,
    keywords: ['simple', 'advanced', 'tags', 'transfer', 'split', 'edit', 'trash', 'restore'],
    sections: [
      {
        heading: 'Simple entry',
        steps: [
          'Choose Income, Expense or Transfer at the top of the dialog, then type the amount first — it is the biggest field on purpose.',
          'Date chips cover most days: Today, Yesterday, then Pick for anything older.',
          'Choose the account and the category. Both pickers show the account colour and icon so you can see what you are choosing.',
        ],
        tip: 'A transfer is not income or expense. Moving money between your own accounts changes two balances and leaves the profit-and-loss untouched.',
      },
      {
        heading: 'Tags',
        steps: [
          'Under Description there is a tag field. Type a word and press Enter or comma to turn it into a chip.',
          'Tags you already use appear as reuse chips beneath the field — tap one instead of retyping it.',
          'Filter the transaction list by tag from the Filter by tag menu, which shows each tag with its count.',
        ],
        tip: 'Tags are how you answer questions categories are too coarse for: which trips, which client, which card. The tax module also reads tags to find deductible spending, so a steady tag like "client-acme" pays for itself in March.',
      },
      {
        heading: 'Splits',
        steps: [
          'Switch the dialog to Advanced, then use Add line under Splits.',
          'Give each line its own account or category and amount. The balance bar shows what is still unassigned.',
          'When the bar reads zero, the entry is balanced and Save is enabled.',
        ],
        tip: 'A supermarket run with groceries, household and a gift is one entry with three lines — not three entries. The bank sees one debit and so should the ledger.',
      },
      {
        heading: 'Edit, trash and restore',
        steps: [
          'Open any row to edit it; both sides of the entry update together.',
          'Deleting moves the entry to Trash rather than erasing it, so balances and reports recalculate immediately but the data is recoverable.',
          'Trash in the ledger sidebar lists removed entries with a restore action.',
        ],
      },
      {
        heading: 'Finding things again',
        steps: [
          'Press Ctrl or Cmd + K anywhere in the app to open the command palette.',
          'Type a page name, an account or a merchant to jump straight there.',
          'The transaction list has a Filter by tag menu, so a tag is also a saved view of its own history.',
        ],
      },
    ],
    related: ['double-entry', 'importing-from-excel'],
  },
  {
    slug: 'importing-from-excel',
    title: 'Importing from Excel',
    summary: 'Bring a bank statement or a spreadsheet in without creating duplicates.',
    icon: FileSpreadsheet,
    tone: 'info',
    minutes: 4,
    keywords: ['import', 'csv', 'xlsx', 'excel', 'bank statement', 'ofx', 'duplicates', 'rules'],
    sections: [
      {
        heading: 'What FinTrack reads',
        steps: [
          'Reconcile → Import statement accepts CSV, TSV, XLSX, XLS and OFX/QFX files.',
          'The first row must be a header. One row per transaction is the shape it expects.',
          'Unambiguous columns work best: a date, a description, and either one signed amount column or separate debit and credit columns.',
        ],
        tip: 'Any spreadsheet works — no template is required. Rename the columns in Excel first if the preview shows a column in the wrong slot.',
      },
      {
        heading: 'Pick the right mode',
        steps: [
          'Bank statement mode matches rows against lines you have already posted and posts only what is genuinely new.',
          'Ledger export mode posts every row as a new entry — use it for data coming from another app, not for your own bank.',
          'Preview first. Nothing is written until you confirm.',
        ],
      },
      {
        heading: 'Read the preview before committing',
        steps: [
          'Duplicates are flagged in the preview, so a statement you already imported last week shows no new rows.',
          'Each row gets a suggested category, taken from the rules you have saved.',
          'Change a suggestion inline where it is wrong; the correction can be saved as a rule for next time.',
        ],
        tip: 'Import rules are worth ten minutes. A rule like "description contains SWIGGY → Eating out" turns every future import into a one-click confirm.',
      },
      {
        heading: 'Reconcile afterwards',
        steps: [
          'Once imported, the Reconcile tab lists anything in the bank feed that the ledger does not have.',
          'Match a row to an existing entry, or post it as new with a category.',
          'When the difference reads zero, the statement period is closed and you can stop looking at it.',
        ],
      },
    ],
    related: ['transactions-and-splits', 'accounts-and-categories'],
  },
  {
    slug: 'investments',
    title: 'Investments',
    summary: 'Holdings, market value and the return that actually matters.',
    icon: TrendingUp,
    tone: 'investments',
    minutes: 4,
    keywords: ['portfolio', 'holdings', 'mutual fund', 'stocks', 'xirr', 'allocation', 'market value'],
    sections: [
      {
        heading: 'How holdings appear',
        steps: [
          'Record buys and sells against an investment asset account with the quantity and the price you paid.',
          'Each holding keeps its own average cost, first buy date and symbol.',
          'Market value uses the last known price for that symbol; the investments screen exposes a refresh for prices.',
        ],
      },
      {
        heading: 'Read the three numbers in order',
        steps: [
          'Invested is what you put in — the cost basis of everything still held.',
          'Market value is what it is worth at the last known price. Unrealised gain is the difference, and it is amber or green by sign, never both.',
          'XIRR accounts for when money went in, which is why it beats a simple percentage on an SIP.',
        ],
        tip: 'Compare XIRR across holdings, not gain in rupees. A small position with a 22% XIRR is a better decision than a large one at 6%.',
      },
      {
        heading: 'Allocation',
        steps: [
          'The allocation bar groups market value by holding, in the chart palette so it stays readable in both themes.',
          'Hover a segment for the amount and its share of the portfolio.',
          'If one holding is more than a third of the bar, that is concentration, not diversification.',
        ],
      },
      {
        heading: 'Keep fees visible',
        steps: [
          'Post brokerage and platform fees as a separate expense line rather than folding them into the buy price.',
          'The holding cost stays comparable to the market price, and the fee shows up in your expense reports where it belongs.',
        ],
      },
    ],
    related: ['accounts-and-categories', 'debts'],
  },
  {
    slug: 'debts',
    title: 'Debts',
    summary: 'Loans and cards with the interest cost in plain sight.',
    icon: CreditCard,
    tone: 'liabilities',
    minutes: 4,
    keywords: ['loan', 'emi', 'credit card', 'interest', 'payoff', 'due date', 'utilisation'],
    sections: [
      {
        heading: 'Set up a loan',
        steps: [
          'Create a liability account for the loan, then open Debts and edit its terms.',
          'Enter the interest rate, the tenure in months, the EMI and the due day of the month.',
          'FinTrack then shows payoff progress, interest still to come and the amortisation schedule.',
        ],
      },
      {
        heading: 'Set up a credit card',
        steps: [
          'A card is a liability account with a limit and a due day.',
          'Enter the limit, the minimum due and the due day to get utilisation and the next due date on the card.',
          'Spending on the card is an expense at the moment of purchase — not when you pay the bill.',
        ],
        tip: 'Paying the card is a transfer from bank to card. If you record the bill payment as an expense you will double count every rupee you spent.',
      },
      {
        heading: 'Record an EMI correctly',
        steps: [
          'Split the EMI into two lines: the interest part as an expense, the principal part as a transfer that reduces the loan balance.',
          'The loan balance then falls by exactly the principal, and interest appears in your expense reports.',
          'The next due date advances on its own from the due day you set.',
        ],
      },
      {
        heading: 'What debts do to your position',
        steps: [
          'Liability balances subtract from net worth every time the overview loads.',
          'Utilisation above roughly 30% on a card is worth seeing before a lender sees it.',
          'Interest remaining is the honest cost of the loan — the number to compare if you are considering prepaying.',
        ],
      },
    ],
    related: ['investments', 'double-entry'],
  },
  {
    slug: 'security',
    title: 'Security',
    summary: 'Sessions, passwords and the data that lives in your account.',
    icon: ShieldCheck,
    tone: 'neutral',
    minutes: 3,
    keywords: ['sessions', 'devices', 'password', 'sign out', 'revoke', 'export', 'backup', 'api key'],
    sections: [
      {
        heading: 'See where you are signed in',
        steps: [
          'Profile → Active sessions lists every device with the current one marked "Active now".',
          'Sessions are grouped into desktop and mobile, each with how long ago it was last used.',
          'Revoke a single session with the action on its row.',
        ],
      },
      {
        heading: 'Sign out everywhere',
        steps: [
          'Use Revoke all other sessions, which asks for your password before it acts.',
          'That ends every device except the one you are on.',
          'If you ever see a device you do not recognise: change the password first, then revoke the others — a session can outlive a password change on a device that stays open.',
        ],
      },
      {
        heading: 'Change your password',
        steps: [
          'Profile → Change password needs the current password and the new one twice.',
          'A passphrase of four unrelated words beats a short string with symbols.',
          'Nothing else in the ledger changes when the password does; the data is unaffected.',
        ],
      },
      {
        heading: 'Keys and exports',
        steps: [
          'Connect to AI holds the API keys you created for assistants; revoke a key there the moment you stop using the client.',
          'Profile → Export All Data downloads your ledger as JSON, so a backup is never more than a click away.',
          'Keep the export somewhere you control. It contains your full financial history in clear text.',
        ],
        tip: 'Treat an export like a bank statement: useful, portable, and not something to leave in a shared folder.',
      },
    ],
    related: ['getting-started', 'transactions-and-splits'],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((guide) => guide.slug === slug);

export function searchGuides(query: string): Guide[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return GUIDES;
  return GUIDES.filter((guide) => {
    const haystack = [
      guide.title,
      guide.summary,
      ...guide.keywords,
      ...guide.sections.flatMap((section) => [section.heading, section.tip ?? '', ...section.steps]),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}
