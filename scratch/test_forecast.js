import { getMonthForecast } from '../src/lib/finance.js';

// Mock data
const accounts = [
  { _id: 'acc1', balance: 20091, type: 'cash' }
];

const income = [
  { _id: 'inc1', date: '2026-07-01', amount: 0, paymentStatus: 'paid' }
];

const expenses = [
  { _id: 'exp1', date: '2026-07-10', amount: 10000, paymentStatus: 'paid' }
];

const projectedIncome = [];
const projectedExpenses = [];

const year = 2026;
const month = 6; // July
const balanceOverrides = {};

const forecastMap = getMonthForecast(
  accounts,
  income,
  expenses,
  projectedIncome,
  projectedExpenses,
  year,
  month,
  balanceOverrides
);

console.log('forecastMap:');
Object.entries(forecastMap).forEach(([date, day]) => {
  console.log(`${date}: income=${day.income}, expense=${day.expense}, net=${day.net}, runningBalance=${day.runningBalance}, status=${day.status}`);
});
