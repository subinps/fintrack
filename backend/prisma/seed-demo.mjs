import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const EMAIL = 'demo@fintrack.app';
const PASSWORD = 'demo1234';

let seed = 20261127;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => Math.round(a + rnd() * (b - a));
const round = (n) => Math.round(n / 100) * 100;

async function main() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "TransactionSplit", "Transaction", "Account", "NetWorthSnapshot", "Session", "User" CASCADE'
  );
  const hash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: { email: EMAIL, password: hash, name: 'Aarav Menon', isVerified: true },
  });
  const uid = user.id;

  const acc = async (name, type, subType, extra = {}) =>
    prisma.account.create({ data: { name, type, subType, userId: uid, ...extra } });

  const bank = await acc('HDFC Savings', 'ASSET', 'Bank');
  const cash = await acc('Cash wallet', 'ASSET', 'Cash');
  const ppfcf = await acc('Parag Parikh Flexi Cap', 'ASSET', 'mutual-fund', {
    symbol: 'PPFCF', units: 512, lastMarketPrice: 846.2, lastMarketUpdate: new Date(),
  });
  const nifty = await acc('Nifty 50 Index', 'ASSET', 'mutual-fund', {
    symbol: 'NIF50', units: 940, lastMarketPrice: 271.35, lastMarketUpdate: new Date(),
  });
  const card = await acc('HDFC Credit Card', 'LIABILITY', 'Credit Card');
  const homeLoan = await acc('Home loan', 'LIABILITY', 'loan', {
    interestRate: 8.6, dueDate: new Date('2026-12-05'),
  });
  const carLoan = await acc('Car loan', 'LIABILITY', 'loan', {
    interestRate: 9.4, dueDate: new Date('2026-12-10'),
  });

  const expenseCats = {};
  for (const [name, sub] of [
    ['Rent', 'Housing'], ['Groceries', 'Food'], ['Dining & Cafes', 'Food'],
    ['Transport', 'Mobility'], ['Utilities', 'Home'], ['Shopping', 'Lifestyle'],
    ['Health', 'Wellbeing'], ['Entertainment', 'Lifestyle'], ['Insurance', 'Protection'],
    ['Travel', 'Lifestyle'], ['Education', 'Growth'],
  ]) {
    expenseCats[name] = await acc(name, 'EXPENSE', sub);
  }
  const salary = await acc('Salary', 'INCOME', 'Primary');
  const freelance = await acc('Freelance', 'INCOME', 'Side');
  const dividends = await acc('Dividends', 'INCOME', 'Passive');

  const tx = async (date, description, splits) => {
    await prisma.transaction.create({
      data: { date, description, userId: uid, status: 'COMPLETED', splits: { create: splits } },
    });
  };
  const spend = async (date, description, category, amount, paidWith = bank) => {
    await tx(date, description, [
      { accountId: category.id, amount: BigInt(amount) },
      { accountId: paidWith.id, amount: BigInt(-amount) },
    ]);
  };

  const now = new Date('2026-11-27T12:00:00Z');
  const start = new Date(now);
  start.setDate(start.getDate() - 430);
  const opening = new Date(start);
  opening.setDate(3);
  await tx(opening, 'Opening balances', [
    { accountId: bank.id, amount: 95000000n },
    { accountId: cash.id, amount: 1200000n },
    { accountId: ppfcf.id, amount: 55000000n },
    { accountId: nifty.id, amount: 30000000n },
    { accountId: homeLoan.id, amount: -220000000n },
    { accountId: carLoan.id, amount: -62000000n },
  ]);

  const monthsBack = 14;
  for (let m = monthsBack; m >= 0; m--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const d = (day) => new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 10, 0, 0);
    const isCurrent = m === 0;
    const lastDay = isCurrent ? now.getDate() : 28;

    await tx(d(1), 'Salary credit - Northwind Labs', [
      { accountId: bank.id, amount: 28500000n },
      { accountId: salary.id, amount: -28500000n },
    ]);
    if (m % 3 === 0) {
      await tx(d(18), 'Freelance invoice - Meridian Studio', [
        { accountId: bank.id, amount: 4200000n },
        { accountId: freelance.id, amount: -4200000n },
      ]);
    }
    if (m % 4 === 1) {
      await tx(d(22), 'Dividend - Nifty 50 Index', [
        { accountId: bank.id, amount: 380000n },
        { accountId: dividends.id, amount: -380000n },
      ]);
    }
    await spend(d(3), 'Rent - Indiranagar flat', expenseCats.Rent, 4200000);
    await tx(d(5), 'Home loan EMI payment', [
      { accountId: homeLoan.id, amount: 2850000n },
      { accountId: bank.id, amount: -2850000n },
    ]);
    await tx(d(9), 'Car loan EMI', [
      { accountId: carLoan.id, amount: 1140000n },
      { accountId: bank.id, amount: -1140000n },
    ]);
    await spend(d(12), 'SIP - Nifty 50 Index', nifty, 4500000);

    const upTo = Math.min(lastDay, 28);
    for (let day = 2; day <= upTo; day++) {
      const r = rnd();
      const useCard = m % 2 === 0 ? card : bank;
      if (r < 0.055) await spend(d(day), pick(['BigBasket', 'Zepto', 'Blinkit groceries']), expenseCats.Groceries, round(between(260000, 720000)));
      if (r < 0.115) await spend(d(day), pick(['Third Wave Coffee', 'Truffles', 'Swiggy order', 'Dyu Art Cafe', 'Zomato dinner']), expenseCats['Dining & Cafes'], round(between(32000, 168000)), useCard);
      if (r < 0.15) await spend(d(day), pick(['Uber', 'Ola', 'Indian Oil fuel', 'Metro card top-up']), expenseCats.Transport, round(between(18000, 240000)), useCard);
      if (r < 0.163) await spend(d(day), pick(['Myntra', 'Amazon order', 'H&M', 'Decathlon']), expenseCats.Shopping, round(between(89000, 690000)), useCard);
      if (r < 0.172) await spend(d(day), pick(['Apollo Pharmacy', 'Practo consult', 'Cult fit']), expenseCats.Health, round(between(45000, 280000)));
      if (r < 0.18) await spend(d(day), pick(['PVR Cinemas', 'Bookshop - Blossom', 'Steam games']), expenseCats.Entertainment, round(between(24000, 98000)), useCard);
      if (r < 0.185) await spend(d(day), pick(['Udemy course', 'Coursera']), expenseCats.Education, round(between(99000, 349000)));
    }
    if (m % 2 === 1 && upTo >= 14) {
      await tx(d(14), 'Credit card bill payment', [
        { accountId: card.id, amount: 1800000n },
        { accountId: bank.id, amount: -1800000n },
      ]);
    }
    if (upTo >= 6) await spend(d(6), 'BESCOM electricity', expenseCats.Utilities, round(between(240000, 460000)) + (m % 4) * 10000);
    if (upTo >= 6) await spend(d(6), 'ACT Fibernet', expenseCats.Utilities, 129900);
    if (upTo >= 2) await spend(d(2), 'Netflix subscription', expenseCats.Entertainment, 64900, card);
    if (upTo >= 8) await spend(d(8), 'Spotify Premium', expenseCats.Entertainment, 11900, card);
    if (upTo >= 15) await spend(d(15), 'HDFC Life term insurance', expenseCats.Insurance, 129000);
    if (upTo >= 20) await spend(d(20), 'Airtel postpaid', expenseCats.Utilities, 79900);
    if (m === 2 && upTo >= 22) await spend(d(22), 'MakeMyTrip - Coorg weekend', expenseCats.Travel, 2460000, card);
    if (m === 5 && upTo >= 11) await spend(d(11), 'IndiGo - Goa flights', expenseCats.Travel, 1280000, card);
  }

  const snapshots = [];
  for (let m = 12; m >= 1; m--) {
    const date = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
    date.setDate(0);
    date.setHours(23, 59, 59);
    const progress = 12 - m;
    const assets = 300000000 + progress * 3300000 + between(-600000, 600000);
    const liabilities = 240000000 + progress * 90000;
    snapshots.push({
      date, userId: uid, netWorth: assets - liabilities, assets, liabilities,
    });
  }
  await prisma.netWorthSnapshot.createMany({ data: snapshots });

  console.log('Seeded', EMAIL, '/', PASSWORD);
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
