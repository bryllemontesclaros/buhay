import { shouldAffectCurrentAccountBalance } from './src/lib/finance.js'
import { today } from './src/lib/utils.js'

console.log('Today:', today())
console.log('Test 1 (Today):', shouldAffectCurrentAccountBalance({ date: '2026-07-05', paymentStatus: 'paid', accountBalanceLinked: true, accountId: 'acc1' }))
console.log('Test 2 (Tomorrow):', shouldAffectCurrentAccountBalance({ date: '2026-07-06', paymentStatus: 'paid', accountBalanceLinked: true, accountId: 'acc1' }))
