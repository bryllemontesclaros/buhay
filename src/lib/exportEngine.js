import { today } from './utils'
import {
  getCurrentBalance,
  getTakdaNetWorth,
  getTakdaTotalAssets,
  getTakdaTotalDebts,
  getTakdaTotalSavings,
} from './finance'

/**
 * Escape a cell for CSV formatting adhering to RFC 4180
 */
function escapeCsv(value) {
  if (value === null || value === undefined) return '""'
  const str = String(value)
  return `"${str.replace(/"/g, '""')}"`
}

/**
 * Format currency number for CSV reports
 */
function fmtNum(value) {
  const num = Number(value) || 0
  return num.toFixed(2)
}

/**
 * Generate an Excel & Google Sheets optimized, multi-section CSV export
 * Includes UTF-8 BOM (\uFEFF) so currency symbols and characters render perfectly.
 */
export function generateStructuredCSV(data = {}, profile = {}, symbol = '₱') {
  const s = symbol || '₱'
  const exportDate = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
  const userLabel = profile.name || profile.displayName || profile.email || 'Buhay User'

  const incomeList = Array.isArray(data.income) ? data.income : []
  const expenseList = Array.isArray(data.expenses) ? data.expenses : []
  const transfersList = Array.isArray(data.transfers) ? data.transfers : []
  const accountsList = Array.isArray(data.accounts) ? data.accounts : []
  const billsList = Array.isArray(data.bills) ? data.bills : []
  const budgetsList = Array.isArray(data.budgets) ? data.budgets : []
  const goalsList = Array.isArray(data.goals) ? data.goals : []
  const debtsList = Array.isArray(data.debts) ? data.debts : []
  const holdingsList = Array.isArray(data.portfolioHoldings) ? data.portfolioHoldings : []

  // High level financial metrics using Takda finance engine
  const totalIncome = incomeList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const totalExpenses = expenseList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const netCashflow = totalIncome - totalExpenses
  const liquidCash = getCurrentBalance(accountsList, debtsList)
  const totalDebts = getTakdaTotalDebts(accountsList, debtsList)
  const totalSavings = getTakdaTotalSavings(goalsList)
  const netWorth = getTakdaNetWorth(accountsList, debtsList, goalsList, holdingsList)

  const lines = []

  // 1. EXECUTIVE REPORT BANNER
  lines.push([escapeCsv('BUHAY FINANCIAL STATEMENT & TRANSACTION LEDGER')])
  lines.push([escapeCsv(`Generated: ${exportDate} | Account: ${userLabel} | Currency: ${s}`)])
  lines.push([escapeCsv('----------------------------------------------------------------------------------------------------')])
  lines.push([
    escapeCsv('EXECUTIVE SUMMARY'),
    escapeCsv(`Net Worth: ${s}${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}`),
    escapeCsv(`Liquid Cash: ${s}${liquidCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`),
    escapeCsv(`Total Income: ${s}${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`),
    escapeCsv(`Total Expenses: ${s}${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`),
    escapeCsv(`Net Cashflow: ${s}${netCashflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}`),
    escapeCsv(`Total Debts: ${s}${totalDebts.toLocaleString('en-US', { minimumFractionDigits: 2 })}`),
  ])
  lines.push([])

  // 2. TRANSACTION LEDGER
  lines.push([escapeCsv('=== 1. TRANSACTION LEDGER (INCOME, EXPENSES & TRANSFERS) ===')])
  lines.push([
    escapeCsv('Type'),
    escapeCsv('Date'),
    escapeCsv('Description'),
    escapeCsv('Category'),
    escapeCsv('Subcategory'),
    escapeCsv('Account / Source'),
    escapeCsv(`Amount (${s})`),
    escapeCsv('Status'),
    escapeCsv('Recurrence'),
    escapeCsv('Notes / ID'),
  ])

  // Combine income, expense, and transfers sorted chronologically (newest first)
  const combinedTx = [
    ...incomeList.map(t => ({ ...t, _ledgerType: 'Income', _signedAmount: Number(t.amount) || 0 })),
    ...expenseList.map(t => ({ ...t, _ledgerType: 'Expense', _signedAmount: -(Number(t.amount) || 0) })),
    ...transfersList.map(t => ({
      ...t,
      _ledgerType: 'Transfer',
      desc: t.desc || `Transfer: ${t.fromAccountName || 'Account'} → ${t.toAccountName || 'Account'}`,
      _signedAmount: Number(t.amount) || 0,
    })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  if (combinedTx.length === 0) {
    lines.push([escapeCsv('No transactions recorded yet')])
  } else {
    combinedTx.forEach(tx => {
      lines.push([
        escapeCsv(tx._ledgerType),
        escapeCsv(tx.date || ''),
        escapeCsv(tx.desc || tx.name || ''),
        escapeCsv(tx.cat || ''),
        escapeCsv(tx.subcat || ''),
        escapeCsv(tx.accountName || tx.fromAccountName || tx.account || ''),
        escapeCsv(fmtNum(tx.amount)),
        escapeCsv(tx.unpaid ? 'Pending / Unpaid' : 'Completed / Paid'),
        escapeCsv(tx.recur || tx.frequency || 'One-time'),
        escapeCsv(tx.notes || tx.id || ''),
      ])
    })
  }
  lines.push([])

  // 3. ACCOUNTS & BALANCE SHEET
  lines.push([escapeCsv('=== 2. ACCOUNTS & BALANCE SHEET SNAPSHOT ===')])
  lines.push([
    escapeCsv('Account Name'),
    escapeCsv('Type'),
    escapeCsv('Institution / Platform'),
    escapeCsv(`Current Balance (${s})`),
    escapeCsv('Included in Net Worth'),
  ])
  if (accountsList.length === 0) {
    lines.push([escapeCsv('No accounts registered')])
  } else {
    accountsList.forEach(acc => {
      lines.push([
        escapeCsv(acc.name || ''),
        escapeCsv(acc.type || 'Standard'),
        escapeCsv(acc.institution || acc.type || ''),
        escapeCsv(fmtNum(acc.balance)),
        escapeCsv(acc.excludeFromNetWorth ? 'No' : 'Yes'),
      ])
    })
  }
  lines.push([])

  // 4. RECURRING BILLS & SUBSCRIPTIONS
  lines.push([escapeCsv('=== 3. RECURRING BILLS & SUBSCRIPTIONS ===')])
  lines.push([
    escapeCsv('Bill Name'),
    escapeCsv('Category'),
    escapeCsv('Due Day / Date'),
    escapeCsv('Frequency'),
    escapeCsv(`Amount (${s})`),
    escapeCsv('Auto-Pay'),
  ])
  if (billsList.length === 0) {
    lines.push([escapeCsv('No recurring bills recorded')])
  } else {
    billsList.forEach(b => {
      lines.push([
        escapeCsv(b.name || ''),
        escapeCsv(b.cat || b.subcat || 'Bill'),
        escapeCsv(b.due ? `Day ${b.due}` : (b.dueDate || '')),
        escapeCsv(b.freq || b.frequency || 'Monthly'),
        escapeCsv(fmtNum(b.amount)),
        escapeCsv(b.autoPay ? 'Enabled' : 'Manual'),
      ])
    })
  }
  lines.push([])

  // 5. BUDGET ENVELOPES
  lines.push([escapeCsv('=== 4. MONTHLY BUDGET ENVELOPES ===')])
  lines.push([
    escapeCsv('Category'),
    escapeCsv(`Monthly Limit (${s})`),
    escapeCsv('Notes'),
  ])
  if (budgetsList.length === 0) {
    lines.push([escapeCsv('No budget limits set')])
  } else {
    budgetsList.forEach(b => {
      lines.push([
        escapeCsv(b.cat || b.category || ''),
        escapeCsv(fmtNum(b.limit || b.amount)),
        escapeCsv(b.notes || ''),
      ])
    })
  }
  lines.push([])

  // 6. SAVINGS GOALS
  lines.push([escapeCsv('=== 5. SAVINGS GOALS & SINKING FUNDS ===')])
  lines.push([
    escapeCsv('Goal Name'),
    escapeCsv(`Target Amount (${s})`),
    escapeCsv(`Current Saved (${s})`),
    escapeCsv('Progress %'),
    escapeCsv('Target Date'),
  ])
  if (goalsList.length === 0) {
    lines.push([escapeCsv('No savings goals recorded')])
  } else {
    goalsList.forEach(g => {
      const target = Number(g.target) || 1
      const current = Number(g.current) || 0
      const pct = Math.min(100, Math.round((current / target) * 100))
      lines.push([
        escapeCsv(g.name || ''),
        escapeCsv(fmtNum(g.target)),
        escapeCsv(fmtNum(g.current)),
        escapeCsv(`${pct}%`),
        escapeCsv(g.targetDate || g.deadline || 'No target date'),
      ])
    })
  }
  lines.push([])

  // 7. DEBTS & LIABILITIES
  lines.push([escapeCsv('=== 6. DEBT SNOWBALL & LIABILITIES ===')])
  lines.push([
    escapeCsv('Debt Name / Creditor'),
    escapeCsv(`Current Balance (${s})`),
    escapeCsv('Interest Rate (APR %)'),
    escapeCsv(`Min Monthly Payment (${s})`),
    escapeCsv('Target Payoff Date'),
  ])
  if (debtsList.length === 0) {
    lines.push([escapeCsv('No active debts registered')])
  } else {
    debtsList.forEach(d => {
      lines.push([
        escapeCsv(d.name || ''),
        escapeCsv(fmtNum(d.balance || d.amount)),
        escapeCsv(d.apr ? `${d.apr}%` : '0%'),
        escapeCsv(fmtNum(d.minPayment || 0)),
        escapeCsv(d.targetDate || 'Flexible'),
      ])
    })
  }
  lines.push([])

  // 8. CRYPTO & ASSETS
  lines.push([escapeCsv('=== 7. CRYPTOCURRENCY & DIGITAL ASSETS ===')])
  lines.push([
    escapeCsv('Asset / Token'),
    escapeCsv('Symbol'),
    escapeCsv('Holding Quantity'),
    escapeCsv(`Unit Price (${s})`),
    escapeCsv(`Total Value (${s})`),
  ])
  if (holdingsList.length === 0) {
    lines.push([escapeCsv('No crypto holdings recorded')])
  } else {
    holdingsList.forEach(h => {
      const qty = Number(h.qty) || 0
      const price = Number(h.currentPrice) || 0
      const val = qty * price
      lines.push([
        escapeCsv(h.name || h.symbol || ''),
        escapeCsv(h.symbol || ''),
        escapeCsv(qty.toString()),
        escapeCsv(fmtNum(price)),
        escapeCsv(fmtNum(val)),
      ])
    })
  }

  // Convert array of arrays to CSV text with UTF-8 BOM (\uFEFF)
  const csvContent = '\uFEFF' + lines.map(row => row.join(',')).join('\r\n')
  return csvContent
}

/**
 * Generate a clean, typed Version 3 JSON Backup payload
 */
export function generateCleanJSONBackup(data = {}, profile = {}) {
  return {
    $schema: 'https://buhay.app/schemas/backup-v3.json',
    version: 3,
    exportedAt: new Date().toISOString(),
    app: 'Buhay',
    user: {
      displayName: profile.name || profile.displayName || '',
      email: profile.email || '',
      currency: profile.currency || 'PHP',
    },
    counts: {
      income: (data.income || []).length,
      expenses: (data.expenses || []).length,
      transfers: (data.transfers || []).length,
      accounts: (data.accounts || []).length,
      bills: (data.bills || []).length,
      budgets: (data.budgets || []).length,
      goals: (data.goals || []).length,
      debts: (data.debts || []).length,
      portfolioHoldings: (data.portfolioHoldings || []).length,
    },
    data: {
      accounts: data.accounts || [],
      income: data.income || [],
      expenses: data.expenses || [],
      transfers: data.transfers || [],
      bills: data.bills || [],
      budgets: data.budgets || [],
      goals: data.goals || [],
      debts: data.debts || [],
      portfolioHoldings: data.portfolioHoldings || [],
      receipts: data.receipts || [],
      calendarEvents: data.calendarEvents || [],
    },
  }
}

/**
 * Safely parse and normalize an imported JSON backup (supports v1, v2, v3)
 */
export function parseAndValidateBackup(jsonText) {
  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('Invalid JSON format. Please upload a valid Buhay backup file.')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Unrecognized backup structure.')
  }

  const raw = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed

  const normalizeArray = arr => (Array.isArray(arr) ? arr.filter(Boolean) : [])

  const normalized = {
    accounts: normalizeArray(raw.accounts),
    income: normalizeArray(raw.income),
    expenses: normalizeArray(raw.expenses),
    transfers: normalizeArray(raw.transfers),
    bills: normalizeArray(raw.bills),
    budgets: normalizeArray(raw.budgets),
    goals: normalizeArray(raw.goals),
    debts: normalizeArray(raw.debts),
    portfolioHoldings: normalizeArray(raw.portfolioHoldings),
    receipts: normalizeArray(raw.receipts),
    calendarEvents: normalizeArray(raw.calendarEvents),
  }

  const totalRecords = Object.values(normalized).reduce((sum, arr) => sum + arr.length, 0)

  if (totalRecords === 0) {
    throw new Error('The backup file contains no valid financial records.')
  }

  return {
    version: parsed.version || (parsed.$schema ? 3 : 2),
    exportedAt: parsed.exportedAt || null,
    totalRecords,
    normalized,
  }
}
