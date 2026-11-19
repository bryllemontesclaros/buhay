// Keep legacy finance destinations pointed at the current canonical screens.
export const FINANCE_PAGE_ALIASES = Object.freeze({
  accounts: { page: 'accounts' },
  crypto: { page: 'accounts', subTab: 'crypto' },
  portfolio: { page: 'accounts', subTab: 'crypto' },
  history: { page: 'history' },
  breakdown: { page: 'breakdown' },
  savings: { page: 'savings' },
  bills: { page: 'recurring', subTab: 'bills' },
  recurring: { page: 'recurring' },
  budget: { page: 'budget' },
  debts: { page: 'debts' },
  subscriptions: { page: 'recurring', subTab: 'subscriptions' },
})

export function resolveFinancePage(nextPage, fallback = 'calendar') {
  const requestedPage = nextPage || fallback
  return FINANCE_PAGE_ALIASES[requestedPage] || { page: requestedPage, subTab: '' }
}
