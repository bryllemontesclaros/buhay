import { getBalanceAtDateWithOverrides, getBalanceOverrides, getCurrentBalance } from './finance'


export function getTakdaBalanceOverrides(profile = {}) {
  return getBalanceOverrides(profile?.dailyBalanceOverrides || {}, profile?.monthStartBalances || {})
}

export function getTakdaTotalBalanceNow(accounts = [], debts = []) {
  return getCurrentBalance(accounts, debts)
}

export function getTakdaBalanceAsOfDate(data = {}, profile = {}, dateKey) {
  const accounts = Array.isArray(data.accounts) ? data.accounts : []
  const income = Array.isArray(data.income) ? data.income : []
  const expenses = Array.isArray(data.expenses) ? data.expenses : []
  const overrides = getTakdaBalanceOverrides(profile)
  return getBalanceAtDateWithOverrides(accounts, data.debts || [], income, expenses, dateKey, overrides)
}

