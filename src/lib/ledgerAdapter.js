/**
 * Normalize the current Firestore-shaped data object for the shared ledger.
 * This is deliberately an in-memory adapter: it does not migrate or rewrite
 * existing records and keeps legacy collections available to current screens.
 */
export function adaptLegacyFinanceData(data = {}) {
  return {
    accounts: Array.isArray(data.accounts) ? data.accounts : [],
    income: Array.isArray(data.income) ? data.income : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    transfers: Array.isArray(data.transfers) ? data.transfers : [],
    bills: Array.isArray(data.bills) ? data.bills : [],
    debts: Array.isArray(data.debts) ? data.debts : [],
    budgets: Array.isArray(data.budgets) ? data.budgets : [],
    goals: Array.isArray(data.goals) ? data.goals : [],
    portfolioHoldings: Array.isArray(data.portfolioHoldings) ? data.portfolioHoldings : [],
    schedules: Array.isArray(data.schedules) ? data.schedules : [],
  }
}
