import { getBalanceAtDateWithOverrides, getBalanceOverrides, getCurrentBalance } from './finance'


export function getTakdaBalanceOverrides(profile = {}) {
  return getBalanceOverrides(profile?.dailyBalanceOverrides || {}, profile?.monthStartBalances || {})
}

export function getTakdaTotalBalanceNow(accounts = [], debts = []) {
  const accountIds = new Set(accounts.map(a => a._id))
  const unlinkedDebts = (debts || []).filter(d => !d.accountId || !accountIds.has(d.accountId))
  const totalDebt = unlinkedDebts.reduce((sum, d) => sum + (Number(d.balance) || 0), 0)
  return getCurrentBalance(accounts) - totalDebt
}

export function getTakdaBalanceAsOfDate(data = {}, profile = {}, dateKey) {
  const accounts = Array.isArray(data.accounts) ? data.accounts : []
  const income = Array.isArray(data.income) ? data.income : []
  const expenses = Array.isArray(data.expenses) ? data.expenses : []
  const overrides = getTakdaBalanceOverrides(profile)
  return getBalanceAtDateWithOverrides(accounts, income, expenses, dateKey, overrides)
}

