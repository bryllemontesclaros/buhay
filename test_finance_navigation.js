import { FINANCE_PAGE_ALIASES, resolveFinancePage } from './src/lib/financeNavigation.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(resolveFinancePage('bills').page === 'recurring', 'Bills must resolve to the recurring hub')
assert(resolveFinancePage('bills').subTab === 'bills', 'Bills must preserve the bills tab')
assert(resolveFinancePage('subscriptions').page === 'recurring', 'Subscriptions must resolve to the recurring hub')
assert(resolveFinancePage('subscriptions').subTab === 'subscriptions', 'Subscriptions must preserve the recurring expenses tab')
assert(resolveFinancePage('recurring').page === 'recurring', 'Recurring must remain the canonical schedule page')
assert(resolveFinancePage('crypto').page === 'accounts', 'Crypto must resolve through the accounts hub')
assert(resolveFinancePage('unknown').page === 'unknown', 'Unknown destinations must remain recoverable')
assert(FINANCE_PAGE_ALIASES.bills !== undefined, 'Legacy bills alias must remain registered')

console.log('Finance navigation checks passed')
