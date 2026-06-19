import { fsAdd, fsAddTransaction, fsMarkBillPaid, fsTransferAccounts, fsUpdate } from './firestore'
import { getBillPeriodInfo } from './bills'
import { getCurrentBalance } from './finance'
import { getTakdaTotalBalanceNow } from './balanceSystem'
import { getMonthKey, normalizeDate, today } from './utils'

function getContextData(context = {}) {
  const data = context.data || {}
  return {
    income: Array.isArray(data.income) ? data.income : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    bills: Array.isArray(data.bills) ? data.bills : [],
    goals: Array.isArray(data.goals) ? data.goals : [],
    accounts: Array.isArray(data.accounts) ? data.accounts : [],
    portfolioHoldings: Array.isArray(data.portfolioHoldings) ? data.portfolioHoldings : [],
    budgets: Array.isArray(data.budgets) ? data.budgets : [],
    receipts: Array.isArray(data.receipts) ? data.receipts : [],
  }
}

function getUserId(context = {}) {
  return context.user?.uid || context.uid || ''
}

function money(value, context = {}) {
  const symbol = context.symbol || '₱'
  if (context.privacyMode) return `${symbol}••••`
  return `${symbol}${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function getPeriodRange(period = '', reference = today()) {
  const anchor = new Date(`${normalizeDate(reference) || today()}T00:00:00`)
  if (period === 'today') {
    const key = normalizeDate(anchor)
    return { start: key, end: key, label: 'today' }
  }
  if (period === 'yesterday') {
    anchor.setDate(anchor.getDate() - 1)
    const key = normalizeDate(anchor)
    return { start: key, end: key, label: 'yesterday' }
  }
  if (period === 'this_week' || period === 'last_week') {
    const day = anchor.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    anchor.setDate(anchor.getDate() + mondayOffset)
    if (period === 'last_week') anchor.setDate(anchor.getDate() - 7)
    const start = normalizeDate(anchor)
    anchor.setDate(anchor.getDate() + 6)
    return { start, end: normalizeDate(anchor), label: period.replace('_', ' ') }
  }
  if (period === 'last_month') {
    anchor.setMonth(anchor.getMonth() - 1, 1)
    const start = normalizeDate(anchor)
    anchor.setMonth(anchor.getMonth() + 1, 0)
    return { start, end: normalizeDate(anchor), label: 'last month' }
  }
  if (period === 'this_year' || period === 'last_year') {
    const year = period === 'last_year' ? anchor.getFullYear() - 1 : anchor.getFullYear()
    return { start: `${year}-01-01`, end: `${year}-12-31`, label: period.replace('_', ' ') }
  }
  anchor.setDate(1)
  const start = normalizeDate(anchor)
  anchor.setMonth(anchor.getMonth() + 1, 0)
  return { start, end: normalizeDate(anchor), label: 'this month' }
}

function inRange(tx = {}, range = {}) {
  const date = normalizeDate(tx.date)
  if (!date) return false
  return (!range.start || date >= range.start) && (!range.end || date <= range.end)
}

function sumTransactions(rows = [], range = {}) {
  return rows.filter(tx => inRange(tx, range)).reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
}

function getAccountName(accounts = [], id = '') {
  return accounts.find(account => account._id === id)?.name || ''
}

function getQueryAnswer(parsed = {}, context = {}) {
  const { income, expenses, bills, goals, accounts, portfolioHoldings, budgets, receipts } = getContextData(context)
  const data = parsed.data || {}
  const period = data.period || 'this_month'
  const range = getPeriodRange(period)
  const queryType = data.queryType || 'unknown'

  if (queryType === 'balance' || queryType === 'net_worth') {
    const total = getTakdaTotalBalanceNow(accounts, portfolioHoldings)
    const includedPortfolio = total - getCurrentBalance(accounts)
    return `Current balance is ${money(total, context)} across ${accounts.length} account${accounts.length === 1 ? '' : 's'}${includedPortfolio ? ' plus included portfolio holdings' : ''}.`
  }

  if (queryType === 'spending_summary') {
    const filtered = expenses.filter(tx => inRange(tx, range))
    return `${range.label} spending is ${money(sumTransactions(filtered, {}), context)} across ${filtered.length} expense${filtered.length === 1 ? '' : 's'}.`
  }

  if (queryType === 'income_summary') {
    const filtered = income.filter(tx => inRange(tx, range))
    return `${range.label} income is ${money(sumTransactions(filtered, {}), context)} across ${filtered.length} income entr${filtered.length === 1 ? 'y' : 'ies'}.`
  }

  if (queryType === 'cashflow') {
    const incomeTotal = sumTransactions(income, range)
    const expenseTotal = sumTransactions(expenses, range)
    return `${range.label} cashflow is ${money(incomeTotal - expenseTotal, context)}: ${money(incomeTotal, context)} in and ${money(expenseTotal, context)} out.`
  }

  if (queryType === 'budget_status') {
    if (!budgets.length) return 'No budgets set yet.'
    const monthKey = getMonthKey(today())
    const monthExpenses = expenses.filter(tx => getMonthKey(tx.date) === monthKey)
    const spentByCat = monthExpenses.reduce((acc, tx) => {
      acc[tx.cat] = (acc[tx.cat] || 0) + (Number(tx.amount) || 0)
      return acc
    }, {})
    const tightest = budgets
      .map(budget => {
        const spent = spentByCat[budget.cat] || 0
        const limit = Number(budget.limit) || 0
        return { ...budget, spent, remaining: limit - spent, pct: limit > 0 ? spent / limit : 0 }
      })
      .sort((a, b) => b.pct - a.pct)[0]
    return `${tightest.cat} is the tightest budget: ${money(tightest.spent, context)} spent of ${money(tightest.limit, context)}.`
  }

  if (queryType === 'bill_status') {
    const openBills = bills
      .map(bill => ({ ...bill, period: getBillPeriodInfo(bill) }))
      .filter(bill => !bill.period.paid)
    const overdue = openBills.filter(bill => bill.period.status === 'overdue')
    if (overdue.length) return `${overdue.length} bill${overdue.length === 1 ? ' is' : 's are'} overdue. Next: ${overdue[0].name} for ${money(overdue[0].amount, context)}.`
    if (openBills.length) return `${openBills.length} bill${openBills.length === 1 ? ' is' : 's are'} still unpaid this period. Next: ${openBills[0].name}.`
    return 'All bills are marked paid for the current period.'
  }

  if (queryType === 'savings_status') {
    const saved = goals.reduce((sum, goal) => sum + (Number(goal.current) || 0), 0)
    const target = goals.reduce((sum, goal) => sum + (Number(goal.target) || 0), 0)
    return goals.length ? `Savings total is ${money(saved, context)} of ${money(target, context)} across ${goals.length} goal${goals.length === 1 ? '' : 's'}.` : 'No savings goals yet.'
  }

  if (queryType === 'receipt_search') {
    return receipts.length ? `You have ${receipts.length} saved receipt${receipts.length === 1 ? '' : 's'} in the receipt box.` : 'No saved receipts yet.'
  }

  if (queryType === 'transaction_search' || queryType === 'expense_list' || queryType === 'income_list') {
    const rows = [...income.map(tx => ({ ...tx, kind: 'income' })), ...expenses.map(tx => ({ ...tx, kind: 'expense' }))]
      .filter(tx => inRange(tx, range))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    if (!rows.length) return `No transactions found for ${range.label}.`
    const first = rows[0]
    return `${rows.length} transaction${rows.length === 1 ? '' : 's'} found for ${range.label}. Latest: ${first.desc || first.cat} (${money(first.amount, context)}).`
  }

  return `Takda found ${income.length + expenses.length} transaction${income.length + expenses.length === 1 ? '' : 's'}, ${bills.length} bill${bills.length === 1 ? '' : 's'}, and ${accounts.length} account${accounts.length === 1 ? '' : 's'}.`
}

function requireUser(context = {}) {
  const uid = getUserId(context)
  if (!uid) throw new Error('Takda needs a signed-in user before saving.')
  return uid
}

function requireAmount(data = {}) {
  const amount = Number(data.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero.')
  return amount
}

export async function executeTakdaCommand(parsed = {}, context = {}) {
  const { accounts, bills, goals, budgets } = getContextData(context)
  const data = parsed.data || {}
  const action = parsed.action

  if (action === 'query') {
    return { ok: true, message: getQueryAnswer(parsed, context), didWrite: false }
  }

  if (action === 'open_receipt_scanner') {
    return { ok: true, message: 'Opening receipt scanner...', didWrite: false, openReceiptScanner: true }
  }

  if (action === 'clarify') {
    return { ok: false, message: parsed.responseMessage || 'Takda needs one more detail.', didWrite: false }
  }

  const uid = requireUser(context)

  if (action === 'add_expense' || action === 'add_receipt_expense') {
    const amount = requireAmount(data)
    await fsAddTransaction(uid, 'expenses', {
      desc: data.description || data.category || 'expense',
      amount,
      date: normalizeDate(data.date) || today(),
      cat: data.category || 'Other',
      subcat: data.subcategory || 'Miscellaneous',
      presetKey: '',
      recur: data.recurring || '',
      type: 'expense',
      accountId: data.accountId || '',
      accountBalanceLinked: Boolean(data.accountId),
      source: action === 'add_receipt_expense' ? 'ask-takda-receipt' : 'ask-takda',
    }, accounts)
    return { ok: true, message: `Expense saved: ${money(amount, context)} for ${data.category || 'Other'}.`, didWrite: true }
  }

  if (action === 'add_income') {
    const amount = requireAmount(data)
    await fsAddTransaction(uid, 'income', {
      desc: data.description || data.category || 'income',
      amount,
      date: normalizeDate(data.date) || today(),
      cat: data.category || 'Other',
      subcat: data.subcategory || 'Miscellaneous',
      presetKey: '',
      recur: data.recurring || '',
      type: 'income',
      accountId: data.accountId || '',
      accountBalanceLinked: Boolean(data.accountId),
      source: 'ask-takda',
    }, accounts)
    return { ok: true, message: `Income saved: ${money(amount, context)} from ${data.category || 'Other'}.`, didWrite: true }
  }

  if (action === 'add_bill') {
    const amount = requireAmount(data)
    if (!data.dueDay) throw new Error('Bill due day is required.')
    await fsAdd(uid, 'bills', {
      name: data.billName || data.description || 'Bill',
      amount,
      due: Number(data.dueDay),
      cat: 'Bills',
      subcat: data.subcategory || 'Other',
      presetKey: '',
      freq: data.frequency || data.recurring || 'monthly',
      paid: false,
      paidPeriods: {},
      type: 'bill',
      accountId: data.accountId || '',
      source: 'ask-takda',
    })
    return { ok: true, message: `Bill saved: ${data.billName || data.description || 'Bill'} for ${money(amount, context)}.`, didWrite: true }
  }

  if (action === 'mark_bill_paid') {
    const bill = bills.find(row => row._id === data.billId)
    if (!bill) throw new Error('Takda could not find that bill.')
    const period = getBillPeriodInfo(bill)
    if (period.paid) throw new Error(`${bill.name} is already marked paid for this period.`)
    const amount = requireAmount({ amount: data.amount || bill.amount })
    await fsMarkBillPaid(uid, bill, {
      amount,
      date: normalizeDate(data.date) || today(),
      accountId: data.accountId || bill.accountId || '',
      source: 'ask-takda',
    }, accounts)
    return { ok: true, message: `${bill.name} was marked paid and saved as an expense.`, didWrite: true }
  }

  if (action === 'transfer_account') {
    const amount = requireAmount(data)
    if (!data.fromAccountId || !data.toAccountId) throw new Error('Transfer needs both accounts.')
    await fsTransferAccounts(uid, {
      amount,
      date: normalizeDate(data.date) || today(),
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      desc: data.description || 'transfer',
      source: 'ask-takda',
    }, accounts)
    const fromName = getAccountName(accounts, data.fromAccountId) || data.fromAccount || 'source account'
    const toName = getAccountName(accounts, data.toAccountId) || data.toAccount || 'destination account'
    return { ok: true, message: `Transfer saved: ${money(amount, context)} from ${fromName} to ${toName}.`, didWrite: true }
  }

  if (action === 'edit_account_balance') {
    const amount = Number(data.amount)
    if (!Number.isFinite(amount)) throw new Error('Balance must be a valid number.')
    if (!data.accountId) throw new Error('Account is required.')
    await fsUpdate(uid, 'accounts', data.accountId, { balance: amount })
    return { ok: true, message: `${data.account || 'Account'} balance updated to ${money(amount, context)}.`, didWrite: true }
  }

  if (action === 'add_savings_contribution') {
    const amount = requireAmount(data)
    const goal = goals.find(row => row._id === data.goalId)
    if (!goal) throw new Error('Takda could not find that savings goal.')
    const nextCurrent = Math.min(Number(goal.target) || Number.MAX_SAFE_INTEGER, (Number(goal.current) || 0) + amount)
    await fsUpdate(uid, 'goals', goal._id, { current: nextCurrent })
    return { ok: true, message: `${money(amount, context)} added to ${goal.name}.`, didWrite: true }
  }

  if (action === 'set_budget') {
    const amount = requireAmount(data)
    const category = data.budgetCategory || data.category
    if (!category) throw new Error('Budget category is required.')
    const existing = budgets.find(budget => budget.cat === category)
    if (existing) await fsUpdate(uid, 'budgets', existing._id, { limit: amount })
    else await fsAdd(uid, 'budgets', { cat: category, limit: amount, source: 'ask-takda' })
    return { ok: true, message: `${category} budget set to ${money(amount, context)}.`, didWrite: true }
  }

  if (action === 'add_calendar_event') {
    if (!data.date) throw new Error('Calendar reminder needs a date.')
    await fsAdd(uid, 'calendarEvents', {
      title: data.description || 'Reminder',
      date: normalizeDate(data.date),
      notes: data.notes || '',
      source: 'ask-takda',
    })
    return { ok: true, message: `Reminder saved for ${normalizeDate(data.date)}.`, didWrite: true }
  }

  throw new Error('This Ask Takda action is not supported yet.')
}
