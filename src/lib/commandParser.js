import { normalizeDate, today } from './utils'

const EMPTY_DATA = {
  amount: null,
  currency: 'PHP',
  category: null,
  subcategory: null,
  date: null,
  startDate: null,
  endDate: null,
  period: null,
  description: null,
  account: null,
  accountId: null,
  fromAccount: null,
  fromAccountId: null,
  toAccount: null,
  toAccountId: null,
  billName: null,
  billId: null,
  billPeriodKey: null,
  goalName: null,
  goalId: null,
  budgetCategory: null,
  transactionId: null,
  dueDay: null,
  frequency: null,
  recurring: null,
  queryType: null,
  notes: null,
}

const FREQUENCIES = [
  'daily',
  'weekly',
  'bi-weekly',
  'tri-weekly',
  'quad-weekly',
  'semi-monthly',
  'monthly',
  'yearly',
]

const EXPENSE_HINTS = [
  { terms: ['grocery', 'groceries', 'palengke', 'supermarket', 'market'], category: 'Food & Dining', subcategory: 'Groceries / Palengke', description: 'groceries' },
  { terms: ['coffee', 'milk tea', 'milktea'], category: 'Food & Dining', subcategory: 'Coffee / Milk Tea', description: 'coffee' },
  { terms: ['food', 'lunch', 'dinner', 'breakfast', 'restaurant', 'kainan'], category: 'Food & Dining', subcategory: 'Restaurants / Kainan', description: 'food' },
  { terms: ['jollibee', 'mcdonald', 'fast food'], category: 'Food & Dining', subcategory: 'Fast Food', description: 'fast food' },
  { terms: ['jeep', 'bus', 'mrt', 'lrt', 'commute'], category: 'Transport', subcategory: 'Public Transport', description: 'transport' },
  { terms: ['grab', 'taxi'], category: 'Transport', subcategory: 'Taxi / Grab', description: 'Grab' },
  { terms: ['angkas', 'joyride', 'move it', 'motor taxi'], category: 'Transport', subcategory: 'Motor Taxi', description: 'motor taxi' },
  { terms: ['fuel', 'gas'], category: 'Transport', subcategory: 'Fuel', description: 'fuel' },
  { terms: ['parking'], category: 'Transport', subcategory: 'Parking', description: 'parking' },
  { terms: ['shopee', 'lazada', 'shopping'], category: 'Shopping', subcategory: 'Online Shopping', description: 'shopping' },
  { terms: ['medicine', 'mercury drug', 'clinic', 'hospital'], category: 'Health', subcategory: 'Medicine', description: 'health' },
  { terms: ['netflix', 'spotify', 'icloud', 'youtube premium', 'subscription'], category: 'Bills', subcategory: 'Subscriptions', description: 'subscription' },
  { terms: ['meralco', 'electricity', 'electric'], category: 'Bills', subcategory: 'Electricity', description: 'electricity' },
  { terms: ['maynilad', 'manila water', 'water bill'], category: 'Bills', subcategory: 'Water', description: 'water' },
  { terms: ['pldt', 'converge', 'internet', 'broadband', 'globe internet'], category: 'Bills', subcategory: 'Internet', description: 'internet' },
  { terms: ['postpaid', 'mobile bill', 'smart', 'globe', 'dito', 'load'], category: 'Bills', subcategory: 'Mobile', description: 'mobile' },
  { terms: ['rent', 'condo', 'apartment'], category: 'Bills', subcategory: 'Rent', description: 'rent' },
  { terms: ['loan', 'installment'], category: 'Bills', subcategory: 'Loan / Installment', description: 'loan payment' },
  { terms: ['fee', 'charge'], category: 'Bills', subcategory: 'Fees', description: 'fee' },
]

const INCOME_HINTS = [
  { terms: ['salary', 'payroll', 'pay day', 'payday'], category: 'Salary', subcategory: 'Salary', description: 'salary' },
  { terms: ['overtime'], category: 'Salary', subcategory: 'Overtime', description: 'overtime' },
  { terms: ['freelance', 'client payment', 'client'], category: 'Freelance', subcategory: 'Client Project', description: 'freelance' },
  { terms: ['retainer'], category: 'Freelance', subcategory: 'Retainer', description: 'retainer' },
  { terms: ['business', 'sales', 'shop income'], category: 'Business', subcategory: 'Sales', description: 'business income' },
  { terms: ['bonus'], category: 'Bonus', subcategory: 'Bonus', description: 'bonus' },
  { terms: ['13th month', 'thirteenth month'], category: '13th Month', subcategory: '13th Month', description: '13th Month' },
  { terms: ['allowance'], category: 'Other', subcategory: 'Allowance', description: 'allowance' },
  { terms: ['padala'], category: 'Other', subcategory: 'Padala Received', description: 'padala received' },
  { terms: ['refund', 'cashback'], category: 'Other', subcategory: 'Refund', description: 'refund' },
  { terms: ['reimbursement'], category: 'Other', subcategory: 'Reimbursement', description: 'reimbursement' },
]

const QUERY_HINTS = [
  { terms: ['balance', 'balances', 'net worth'], queryType: 'balance' },
  { terms: ['cashflow', 'cash flow'], queryType: 'cashflow' },
  { terms: ['spent', 'spending', 'expenses', 'expense'], queryType: 'spending_summary' },
  { terms: ['income', 'earned', 'received'], queryType: 'income_summary' },
  { terms: ['budget', 'budgets', 'budget left'], queryType: 'budget_status' },
  { terms: ['bill', 'bills', 'due', 'overdue'], queryType: 'bill_status' },
  { terms: ['saving', 'savings', 'goal', 'goals'], queryType: 'savings_status' },
  { terms: ['receipt', 'receipts'], queryType: 'receipt_search' },
  { terms: ['transactions', 'history', 'list'], queryType: 'transaction_search' },
]

function blankData(context = {}) {
  return {
    ...EMPTY_DATA,
    currency: context.currency || context.profile?.currency || 'PHP',
  }
}

function makeResult(action, options = {}, context = {}) {
  return {
    action,
    confidence: Number(options.confidence ?? 0.6),
    requiresConfirmation: Boolean(options.requiresConfirmation),
    riskLevel: options.riskLevel || 'low',
    data: {
      ...blankData(context),
      ...(options.data || {}),
      currency: options.data?.currency || context.currency || context.profile?.currency || 'PHP',
    },
    missing: Array.isArray(options.missing) ? options.missing : [],
    responseMessage: options.responseMessage || '',
  }
}

function clarify(message, missing = [], confidence = 0.35, context = {}) {
  return makeResult('clarify', {
    confidence,
    requiresConfirmation: false,
    riskLevel: 'low',
    missing,
    responseMessage: message,
  }, context)
}

function normalizeText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/₱|php|peso|pesos|hk\$|hkd|jpy|yen|usd|eur|gbp|sgd|aud|cad|\$/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function paddedText(value = '') {
  const normalized = normalizeText(value)
  return normalized ? ` ${normalized} ` : ' '
}

function includesAny(text, terms = []) {
  const hay = paddedText(text)
  return terms.some(term => {
    const needle = normalizeText(term)
    return needle && hay.includes(` ${needle} `)
  })
}

function titleCase(value = '') {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map(part => part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : '')
    .join(' ')
}

function addDays(dateKey, days) {
  const normalized = normalizeDate(dateKey) || today()
  const date = new Date(`${normalized}T00:00:00`)
  date.setDate(date.getDate() + days)
  return normalizeDate(date)
}

function getToday(context = {}) {
  return normalizeDate(context.today) || today()
}

function getPeriod(input = '') {
  const text = normalizeText(input)
  if (/\btoday\b/.test(text)) return 'today'
  if (/\byesterday\b/.test(text)) return 'yesterday'
  if (/\bthis week\b/.test(text)) return 'this_week'
  if (/\blast week\b/.test(text)) return 'last_week'
  if (/\bthis month\b/.test(text)) return 'this_month'
  if (/\blast month\b/.test(text)) return 'last_month'
  if (/\bthis year\b/.test(text)) return 'this_year'
  if (/\blast year\b/.test(text)) return 'last_year'
  return null
}

function parseDate(input = '', context = {}) {
  const raw = String(input || '')
  const lower = raw.toLowerCase()
  const todayKey = getToday(context)

  if (/\btoday\b/.test(lower)) return todayKey
  if (/\btomorrow\b/.test(lower)) return addDays(todayKey, 1)
  if (/\byesterday\b/.test(lower)) return addDays(todayKey, -1)
  if (/\bnext week\b/.test(lower)) return addDays(todayKey, 7)

  const iso = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (iso) return normalizeDate(iso[0])

  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  ]
  const monthPattern = monthNames.join('|')
  const monthDay = lower.match(new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`))
  const dayMonth = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\b`))
  const parsedToday = new Date(`${todayKey}T00:00:00`)

  function monthIndex(name) {
    const normalized = name.slice(0, 3)
    return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(normalized)
  }

  if (monthDay || dayMonth) {
    const monthName = monthDay ? monthDay[1] : dayMonth[2]
    const day = Number(monthDay ? monthDay[2] : dayMonth[1])
    const month = monthIndex(monthName)
    if (month >= 0 && day >= 1 && day <= 31) {
      return normalizeDate(`${parsedToday.getFullYear()}-${month + 1}-${day}`)
    }
  }

  const ordinal = lower.match(/\b(?:on\s+|due\s+|every\s+)?(\d{1,2})(?:st|nd|rd|th)\b/)
  if (ordinal) {
    const day = Number(ordinal[1])
    if (day >= 1 && day <= 31) {
      const candidate = normalizeDate(`${parsedToday.getFullYear()}-${parsedToday.getMonth() + 1}-${day}`)
      const futureIntent = /\b(due|next|upcoming|pay|paid|settled|bill)\b/.test(lower)
      if (futureIntent && candidate < todayKey) {
        return normalizeDate(`${parsedToday.getFullYear()}-${parsedToday.getMonth() + 2}-${day}`)
      }
      return candidate
    }
  }

  return ''
}

function parseDueDay(input = '') {
  const lower = String(input || '').toLowerCase()
  const due = lower.match(/\b(?:due|every|on)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/)
    || lower.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/)
  const day = Number(due?.[1])
  if (Number.isInteger(day) && day >= 1 && day <= 31) return day
  return null
}

function parseAmount(input = '') {
  const raw = String(input || '')
  const matches = [...raw.matchAll(/(?:₱|php|peso|pesos|hk\$|hkd|jpy|yen|usd|eur|gbp|sgd|aud|cad|\$)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s*[km])?(?!\s*(?:st|nd|rd|th)\b)/gi)]
  for (const match of matches) {
    const value = Number(String(match[1]).replace(/,/g, ''))
    if (!Number.isFinite(value) || value <= 0) continue
    const suffix = String(match[2] || '').trim().toLowerCase()
    if (suffix === 'k') return value * 1000
    if (suffix === 'm') return value * 1000000
    return value
  }
  return null
}

function parseFrequency(input = '') {
  const text = normalizeText(input)
  if (/\bevery day\b|\bdaily\b/.test(text)) return 'daily'
  if (/\bevery week\b|\bweekly\b/.test(text)) return 'weekly'
  if (/\bevery 2 weeks\b|\bevery two weeks\b|\bbi weekly\b|\bbiweekly\b/.test(text)) return 'bi-weekly'
  if (/\bevery 3 weeks\b|\bevery three weeks\b/.test(text)) return 'tri-weekly'
  if (/\bevery 4 weeks\b|\bevery four weeks\b/.test(text)) return 'quad-weekly'
  if (/\bsemi monthly\b|\bsemimonthly\b/.test(text)) return 'semi-monthly'
  if (/\bevery month\b|\bmonthly\b|\bsubscription\b|\bpostpaid\b|\brent\b|\brecurring\b/.test(text)) return 'monthly'
  if (/\bevery year\b|\byearly\b|\bannual\b|\bannually\b/.test(text)) return 'yearly'
  return null
}

function cleanDescription(input = '') {
  return String(input || '')
    .replace(/(?:₱|php|peso|pesos|hk\$|hkd|jpy|yen|usd|eur|gbp|sgd|aud|cad|\$)?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*[km]?/gi, ' ')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)\b/gi, ' ')
    .replace(/\b(add|create|new|setup|set up|expense|spent|spend|paid|pay|income|received|salary|from|using|via|today|tomorrow|yesterday|this month|last month|this week|last week|set|budget|save|saved|for|to|move|transfer|bill|monthly|every|due|on|the)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getAccountAliases(account = {}) {
  const aliases = [account.name, account.type]
  const name = normalizeText(account.name)
  if (name.includes('gcash')) aliases.push('gcash')
  if (name.includes('maya')) aliases.push('maya')
  if (name.includes('bpi')) aliases.push('bpi')
  if (name.includes('bdo')) aliases.push('bdo')
  if (name.includes('cash')) aliases.push('cash')
  if (normalizeText(account.type) === 'cash') aliases.push('cash')
  if (normalizeText(account.type) === 'bank') aliases.push('bank')
  if (normalizeText(account.type).includes('wallet')) aliases.push('wallet', 'e wallet', 'ewallet')
  if (normalizeText(account.type).includes('credit')) aliases.push('credit card', 'card')
  return [...new Set(aliases.map(normalizeText).filter(Boolean))]
}

function getBestMatches(text = '', items = [], getAliases = item => [item.name], options = {}) {
  const hay = paddedText(text)
  const matches = []
  items.forEach(item => {
    let score = 0
    getAliases(item).forEach(alias => {
      const normalized = normalizeText(alias)
      if (!normalized) return
      if (hay === ` ${normalized} `) score = Math.max(score, 120 + normalized.length)
      else if (hay.includes(` ${normalized} `)) score = Math.max(score, 60 + normalized.length)
      else if (options.allowPartial && normalized.length >= 4 && normalized.includes(normalizeText(text))) score = Math.max(score, 30 + normalized.length)
    })
    if (score > 0) matches.push({ item, score })
  })
  const byId = new Map()
  matches.forEach(match => {
    const key = match.item?._id || match.item?.id || match.item?.name
    const existing = byId.get(key)
    if (!existing || match.score > existing.score) byId.set(key, match)
  })
  return [...byId.values()].sort((a, b) => b.score - a.score)
}

function resolveMatch(text = '', items = [], getAliases, options = {}) {
  const matches = getBestMatches(text, items, getAliases, options)
  if (!matches.length) return { item: null, ambiguous: false, matches: [] }
  const topScore = matches[0].score
  const top = matches.filter(match => match.score === topScore)
  return {
    item: top.length === 1 ? top[0].item : null,
    ambiguous: top.length > 1,
    matches: top.map(match => match.item),
  }
}

function resolveAccount(input = '', accounts = [], context = {}, allowDefault = false) {
  const result = resolveMatch(input, accounts, getAccountAliases)
  if (result.item || result.ambiguous) return result

  if (!allowDefault) return result

  const defaultAccountName = context.defaultAccountName || context.profile?.defaultAccountName || ''
  const defaultAccountId = context.defaultAccountId || context.profile?.defaultAccountId || ''
  const defaultAccount = accounts.find(account => account._id === defaultAccountId)
    || accounts.find(account => normalizeText(account.name) === normalizeText(defaultAccountName))
    || accounts[0]

  return { item: defaultAccount || null, ambiguous: false, matches: defaultAccount ? [defaultAccount] : [] }
}

function resolveBill(input = '', bills = []) {
  return resolveMatch(input, bills, bill => [bill.name, bill.subcat, bill.cat].filter(Boolean))
}

function resolveGoal(input = '', goals = []) {
  return resolveMatch(input, goals, goal => [goal.name].filter(Boolean), { allowPartial: true })
}

function extractSegment(input = '', startWords = [], endWords = []) {
  const raw = String(input || '')
  const lower = raw.toLowerCase()
  let start = -1
  let tokenLength = 0
  startWords.forEach(word => {
    const index = lower.search(new RegExp(`\\b${word}\\b`))
    if (index >= 0 && (start === -1 || index < start)) {
      start = index
      tokenLength = word.length
    }
  })
  if (start < 0) return ''
  let segment = raw.slice(start + tokenLength)
  endWords.forEach(word => {
    const match = segment.toLowerCase().search(new RegExp(`\\b${word}\\b`))
    if (match >= 0) segment = segment.slice(0, match)
  })
  return segment.trim()
}

function inferExpense(input = '') {
  const match = EXPENSE_HINTS.find(hint => includesAny(input, hint.terms))
  if (match) return match
  return {
    category: 'Other',
    subcategory: 'Miscellaneous',
    description: cleanDescription(input) || 'expense',
  }
}

function inferIncome(input = '') {
  const match = INCOME_HINTS.find(hint => includesAny(input, hint.terms))
  if (match) return match
  return {
    category: 'Other',
    subcategory: 'Miscellaneous',
    description: cleanDescription(input) || 'income',
  }
}

function inferQuery(input = '') {
  const match = QUERY_HINTS.find(hint => includesAny(input, hint.terms))
  return match?.queryType || 'unknown'
}

function actionHasIntent(input = '', terms = []) {
  return includesAny(input, terms)
}

function hasQuestionIntent(input = '') {
  const text = normalizeText(input)
  return /^(how|what|show|list|find|where|when|did|do|am|is|are|can)\b/.test(text)
    || /\?$/.test(String(input).trim())
}

function money(amount, symbol = '') {
  if (amount == null) return ''
  return `${symbol}${Number(amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
}

function dateLabel(dateKey, context = {}) {
  const todayKey = getToday(context)
  if (!dateKey) return ''
  if (dateKey === todayKey) return 'today'
  if (dateKey === addDays(todayKey, 1)) return 'tomorrow'
  if (dateKey === addDays(todayKey, -1)) return 'yesterday'
  return dateKey
}

function accountData(account) {
  return account ? { account: account.name || null, accountId: account._id || null } : {}
}

function billData(bill) {
  return bill ? { billName: bill.name || null, billId: bill._id || null } : {}
}

function goalData(goal) {
  return goal ? { goalName: goal.name || null, goalId: goal._id || null } : {}
}

function buildActionContext(context = {}) {
  return {
    accounts: Array.isArray(context.accounts) ? context.accounts : Array.isArray(context.data?.accounts) ? context.data.accounts : [],
    bills: Array.isArray(context.bills) ? context.bills : Array.isArray(context.data?.bills) ? context.data.bills : [],
    goals: Array.isArray(context.goals) ? context.goals : Array.isArray(context.data?.goals) ? context.data.goals : [],
    budgets: Array.isArray(context.budgets) ? context.budgets : Array.isArray(context.data?.budgets) ? context.data.budgets : [],
  }
}

export function parseTakdaCommand(input, context = {}) {
  const text = String(input || '').trim()
  const symbol = context.symbol || '₱'
  const todayKey = getToday(context)
  const { accounts, bills, goals, budgets } = buildActionContext(context)
  const lower = normalizeText(text)

  if (!text) {
    return clarify('What would you like Takda to do?', ['command'], 0.2, context)
  }

  if (actionHasIntent(text, ['scan receipt', 'upload receipt', 'take receipt photo', 'receipt scanner', 'photograph receipt'])) {
    return makeResult('open_receipt_scanner', {
      confidence: 0.98,
      requiresConfirmation: false,
      riskLevel: 'low',
      responseMessage: 'Open the receipt scanner?',
    }, context)
  }

  if (hasQuestionIntent(text) || actionHasIntent(text, ['show', 'list', 'summary', 'summarize', 'how much', 'what is', 'what are', 'bills due', 'budget left'])) {
    const period = getPeriod(text)
    const queryType = inferQuery(text)
    return makeResult('query', {
      confidence: queryType === 'unknown' ? 0.7 : 0.94,
      requiresConfirmation: false,
      riskLevel: 'low',
      data: { period, queryType },
      responseMessage: `Show ${queryType.replace(/_/g, ' ')}${period ? ` for ${period.replace(/_/g, ' ')}` : ''}?`,
    }, context)
  }

  const amount = parseAmount(text)
  const date = parseDate(text, context) || todayKey
  const frequency = parseFrequency(text)

  if (actionHasIntent(text, ['move', 'transfer', 'withdraw', 'send']) && /\b(from|to|into)\b/.test(lower)) {
    if (!amount) return clarify('How much should Takda transfer?', ['amount'], 0.5, context)
    const fromSegment = extractSegment(text, ['from'], ['to', 'into', 'today', 'tomorrow', 'yesterday', 'on'])
    const toSegment = extractSegment(text, ['to', 'into'], ['from', 'today', 'tomorrow', 'yesterday', 'on'])
    const from = resolveAccount(fromSegment || text, accounts, context, false)
    const to = resolveAccount(toSegment || text, accounts, context, false)
    if (from.ambiguous) return clarify('Which account should the transfer come from?', ['fromAccount'], 0.55, context)
    if (to.ambiguous) return clarify('Which account should receive the transfer?', ['toAccount'], 0.55, context)
    if (!from.item) return clarify('Which account should the transfer come from?', ['fromAccount'], 0.55, context)
    if (!to.item) return clarify('Which account should receive the transfer?', ['toAccount'], 0.55, context)
    if (from.item._id && from.item._id === to.item._id) {
      return clarify('Choose two different accounts for the transfer.', ['toAccount'], 0.55, context)
    }
    return makeResult('transfer_account', {
      confidence: 0.96,
      requiresConfirmation: true,
      riskLevel: 'high',
      data: {
        amount,
        date,
        description: 'transfer',
        fromAccount: from.item.name,
        fromAccountId: from.item._id || null,
        toAccount: to.item.name,
        toAccountId: to.item._id || null,
      },
      responseMessage: `Transfer ${money(amount, symbol)} from ${from.item.name} to ${to.item.name}?`,
    }, context)
  }

  if (actionHasIntent(text, ['set balance', 'set account', 'correct balance', 'reset balance', 'update balance', 'adjust balance'])) {
    if (!amount && amount !== 0) return clarify('What balance should Takda set?', ['amount'], 0.5, context)
    const account = resolveAccount(text, accounts, context, false)
    if (account.ambiguous) return clarify('Which account balance should Takda update?', ['account'], 0.55, context)
    if (!account.item) return clarify('Which account balance should Takda update?', ['account'], 0.5, context)
    return makeResult('edit_account_balance', {
      confidence: 0.9,
      requiresConfirmation: true,
      riskLevel: 'high',
      data: {
        amount,
        date,
        description: 'balance adjustment',
        ...accountData(account.item),
      },
      responseMessage: `Set ${account.item.name} balance to ${money(amount, symbol)}?`,
    }, context)
  }

  if (actionHasIntent(text, ['paid', 'settled', 'cleared', 'mark paid', 'done']) || /^pay\b/.test(lower)) {
    const bill = resolveBill(text, bills)
    if (bill.ambiguous) return clarify('Which bill should Takda mark paid?', ['bill'], 0.55, context)
    if (bill.item) {
      const paymentAmount = amount || Number(bill.item.amount) || null
      if (!paymentAmount) return clarify(`How much was the ${bill.item.name} payment?`, ['amount'], 0.6, context)
      const explicitAccount = resolveAccount(text, accounts, context, false)
      if (explicitAccount.ambiguous) return clarify('Which account paid this bill?', ['account'], 0.55, context)
      const billAccount = explicitAccount.item || accounts.find(account => account._id === bill.item.accountId) || null
      return makeResult('mark_bill_paid', {
        confidence: amount ? 0.93 : 0.86,
        requiresConfirmation: true,
        riskLevel: 'medium',
        data: {
          amount: paymentAmount,
          category: 'Bills',
          subcategory: bill.item.subcat || 'Other',
          date,
          description: `${bill.item.name} payment`,
          ...accountData(billAccount),
          ...billData(bill.item),
        },
        responseMessage: `Mark ${bill.item.name} paid${billAccount ? ` from ${billAccount.name}` : ''} ${dateLabel(date, context)}?`,
      }, context)
    }
  }

  if (actionHasIntent(text, ['bill', 'monthly', 'every month', 'recurring', 'due']) && actionHasIntent(text, ['add', 'create', 'new', 'setup', 'set up'])) {
    const dueDay = parseDueDay(text)
    const inferred = inferExpense(text)
    const billName = cleanDescription(text) || inferred.description || 'Bill'
    if (!amount) return clarify('How much is this bill?', ['amount'], 0.55, context)
    if (!dueDay) return clarify('What day of the month is this bill due?', ['dueDay'], 0.55, context)
    const account = resolveAccount(text, accounts, context, false)
    if (account.ambiguous) return clarify('Which account should be the default pay-from account?', ['account'], 0.55, context)
    const resolvedBillName = inferred.description && inferred.description !== 'expense' ? inferred.description : billName
    const recurring = frequency || 'monthly'
    return makeResult('add_bill', {
      confidence: 0.93,
      requiresConfirmation: true,
      riskLevel: 'medium',
      data: {
        amount,
        category: 'Bills',
        subcategory: inferred.subcategory || 'Other',
        description: resolvedBillName,
        ...accountData(account.item),
        billName: resolvedBillName,
        dueDay,
        frequency: recurring,
        recurring,
      },
      responseMessage: `Create ${recurring} ${resolvedBillName} bill for ${money(amount, symbol)} due every ${dueDay}?`,
    }, context)
  }

  if (actionHasIntent(text, ['budget', 'limit', 'cap'])) {
    if (!amount) return clarify('What budget limit should Takda set?', ['amount'], 0.55, context)
    const inferred = inferExpense(text)
    const budgetCategory = inferred.category || titleCase(cleanDescription(text)) || null
    return makeResult('set_budget', {
      confidence: budgetCategory ? 0.88 : 0.65,
      requiresConfirmation: true,
      riskLevel: 'medium',
      data: {
        amount,
        category: budgetCategory,
        budgetCategory,
        period: getPeriod(text) || 'monthly',
        description: `${budgetCategory} budget`,
      },
      responseMessage: `Set ${budgetCategory} budget to ${money(amount, symbol)} monthly?`,
    }, context)
  }

  if (actionHasIntent(text, ['save', 'saved', 'saving', 'put']) && actionHasIntent(text, ['for', 'toward', 'to', 'in'])) {
    if (!amount) return clarify('How much should Takda add to savings?', ['amount'], 0.55, context)
    const goalSegment = extractSegment(text, ['for', 'toward', 'to', 'in'], ['today', 'tomorrow', 'yesterday', 'on'])
    const goal = resolveGoal(goalSegment || text, goals)
    if (goal.ambiguous) return clarify('Which savings goal should receive this contribution?', ['goal'], 0.55, context)
    if (!goal.item) return clarify('Which savings goal should receive this contribution?', ['goal'], 0.55, context)
    return makeResult('add_savings_contribution', {
      confidence: 0.92,
      requiresConfirmation: true,
      riskLevel: 'medium',
      data: {
        amount,
        date,
        description: `${goal.item.name} contribution`,
        ...goalData(goal.item),
      },
      responseMessage: `Add ${money(amount, symbol)} to ${goal.item.name}?`,
    }, context)
  }

  const isIncome = actionHasIntent(text, ['income', 'received', 'receive', 'earned', 'salary', 'payroll', 'allowance', 'freelance', 'bonus', 'refund', 'reimbursement', 'cash gift'])
  const isExplicitExpense = actionHasIntent(text, ['expense', 'spent', 'spend', 'bought', 'buy', 'purchase', 'paid', 'pay'])
  const isReceiptExpense = actionHasIntent(text, ['receipt']) && amount

  if (isIncome || isExplicitExpense || isReceiptExpense || amount) {
    if (!amount) return clarify('How much should Takda record?', ['amount'], 0.45, context)
    const type = isIncome && !isExplicitExpense ? 'income' : 'expense'
    const inferred = type === 'income' ? inferIncome(text) : inferExpense(text)
    const account = resolveAccount(text, accounts, context, true)
    if (account.ambiguous) return clarify('Which account should Takda use?', ['account'], 0.55, context)
    const cleaned = cleanDescription(text)
    const description = inferred.description || cleaned || (type === 'income' ? 'income' : 'expense')
    const action = isReceiptExpense ? 'add_receipt_expense' : type === 'income' ? 'add_income' : 'add_expense'
    return makeResult(action, {
      confidence: account.item ? 0.9 : 0.78,
      requiresConfirmation: true,
      riskLevel: 'medium',
      data: {
        amount,
        category: inferred.category,
        subcategory: inferred.subcategory,
        date,
        description,
        ...accountData(account.item),
        recurring: frequency,
        frequency,
      },
      responseMessage: `Add ${money(amount, symbol)} ${inferred.category} ${type} ${account.item ? `from ${account.item.name} ` : ''}${dateLabel(date, context)}?`,
    }, context)
  }

  if (actionHasIntent(text, ['remind', 'reminder', 'calendar', 'event'])) {
    const reminderDate = parseDate(text, context)
    if (!reminderDate) return clarify('What date should Takda use for the reminder?', ['date'], 0.5, context)
    const description = cleanDescription(text) || 'Reminder'
    return makeResult('add_calendar_event', {
      confidence: 0.82,
      requiresConfirmation: true,
      riskLevel: 'medium',
      data: {
        date: reminderDate,
        description,
      },
      responseMessage: `Add calendar reminder "${description}" on ${reminderDate}?`,
    }, context)
  }

  if (actionHasIntent(text, ['delete', 'remove'])) {
    return clarify('Which recent transaction should Takda delete?', ['transaction'], 0.45, context)
  }

  if (actionHasIntent(text, ['edit', 'change', 'update'])) {
    return clarify('Which transaction should Takda update?', ['transaction'], 0.45, context)
  }

  if (!budgets.length && actionHasIntent(text, ['budget'])) {
    return clarify('What category and monthly limit should Takda use?', ['category', 'amount'], 0.4, context)
  }

  return clarify('I need a little more detail. What should Takda add, update, or show?', ['command'], 0.25, context)
}

export const TAKDA_COMMAND_EXAMPLES = [
  'add 250 food today cash',
  'spent 1200 groceries from GCash',
  'salary 15000 bank',
  'paid Meralco from GCash',
  'move 5000 from cash to bank',
  'save 1000 for emergency fund',
  'set food budget 5000',
  'scan receipt',
  'how much did I spend this month',
]

export const TAKDA_COMMAND_FREQUENCIES = FREQUENCIES
