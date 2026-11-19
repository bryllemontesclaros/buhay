import { getBalanceAtDateWithOverrides, getBalanceOverrides, getCurrentBalance } from './finance'


export function getBuhayBalanceOverrides(profile = {}) {
  return getBalanceOverrides(profile?.dailyBalanceOverrides || {}, profile?.monthStartBalances || {})
}

export function getBuhayTotalBalanceNow(accounts = [], debts = []) {
  return getCurrentBalance(accounts, debts)
}

export function getBuhayBalanceAsOfDate(data = {}, profile = {}, dateKey) {
  const accounts = Array.isArray(data.accounts) ? data.accounts : []
  const income = Array.isArray(data.income) ? data.income : []
  const expenses = Array.isArray(data.expenses) ? data.expenses : []
  const overrides = getBuhayBalanceOverrides(profile)
  return getBalanceAtDateWithOverrides(accounts, Array.isArray(data.transfers) ? data.transfers : [], income, expenses, dateKey, overrides)
}

