import assert from 'node:assert/strict'
import { getProjectedLedger } from './src/lib/projectedLedger.js'
import { getBillOccurrencesForMonth, getBillPeriodKey } from './src/lib/bills.js'
import { getRecurringDates } from './src/lib/recurrence.js'

const sourceExpense = {
  _id: 'expense-source',
  desc: 'Groceries',
  amount: 100,
  cat: 'Food',
  date: '2026-11-05',
  recur: 'monthly',
  accountId: 'cash',
}

const scheduledExpense = {
  _id: 'expense-schedule',
  desc: 'Streaming',
  amount: 150,
  date: '2026-11-08',
  recur: 'monthly',
  cat: '',
  subcat: '',
  isBill: false,
  accountId: 'cash',
}

const bill = {
  _id: 'water-bill',
  name: 'Water',
  amount: 200,
  cat: 'Bills',
  due: 10,
  freq: 'monthly',
  accountId: 'cash',
}

const baseData = {
  accounts: [{ _id: 'cash', name: 'Cash', type: 'Cash', balance: 1000 }],
  income: [{ _id: 'income-source', desc: 'Salary', amount: 500, date: '2026-11-01', recur: 'monthly', accountId: 'cash' }],
  expenses: [sourceExpense, scheduledExpense],
  transfers: [],
  bills: [bill],
}

const projected = getProjectedLedger({
  data: baseData,
  startDate: '2026-12-01',
  endDate: '2026-12-31',
  anchorDate: '2026-11-19',
})

assert.equal(projected.summary.projectedCount, 4)
assert.equal(projected.entries.filter(entry => entry.occurrenceIdentity?.startsWith('bill:')).length, 1)
assert.equal(projected.entries.filter(entry => entry.occurrenceIdentity?.startsWith('schedule:expense-schedule')).length, 1)
assert.equal(projected.daily['2026-12-10'].closingBalance, 1050)
assert.equal(projected.daily['2026-12-31'].closingBalance, 1050)

const paidBillData = {
  ...baseData,
  expenses: [
    sourceExpense,
    scheduledExpense,
    {
      _id: 'water-payment',
      desc: 'Water',
      amount: 200,
      cat: 'Bills',
      date: '2026-12-10',
      billId: 'water-bill',
      billPeriodKey: getBillPeriodKey(bill, '2026-12-10'),
      accountId: 'cash',
      paymentStatus: 'paid',
    },
  ],
}

const deduplicated = getProjectedLedger({
  data: paidBillData,
  startDate: '2026-12-01',
  endDate: '2026-12-31',
  anchorDate: '2026-11-19',
})

assert.equal(deduplicated.entries.filter(entry => entry.occurrenceIdentity?.startsWith('bill:')).length, 1)
assert.equal(deduplicated.entries.filter(entry => entry.date === '2026-12-10' && entry.type === 'expense').length, 1)

assert.deepEqual(
  getRecurringDates({ date: '2026-01-15', recur: 'quarterly' }, 2026, 3),
  ['2026-04-15'],
)
assert.deepEqual(
  getRecurringDates({ date: '2025-12-31', recur: 'yearly' }, 2026, 11),
  ['2026-12-31'],
)
assert.deepEqual(
  getRecurringDates({ date: '2026-01-15', recur: 'monthly', endDate: '2026-02-15' }, 2026, 2),
  [],
)
assert.deepEqual(
  getRecurringDates({ date: '2026-01-15', recur: 'monthly', paused: true }, 2026, 1),
  [],
)
assert.deepEqual(
  getBillOccurrencesForMonth({ _id: 'quarterly-bill', amount: 300, due: 10, dueMonth: 0, freq: 'quarterly' }, 2026, 3),
  ['2026-04-10'],
)

console.log('Projected ledger checks passed')
