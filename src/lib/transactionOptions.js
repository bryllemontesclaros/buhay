const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Shopping',
  'Health',
  'Entertainment',
  'Personal Care',
  'Education',
  'Bills',
  'Other',
]

const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Business',
  'Investment',
  '13th Month',
  'Bonus',
  'Other',
]

export const TRANSACTION_CATEGORIES = {
  income: INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
}

export const TRANSACTION_SUBCATEGORIES = {
  expense: {
    'Food & Dining': ['Groceries / Palengke', 'Restaurants / Kainan', 'Fast Food', 'Coffee / Milk Tea', 'Snacks', 'Other'],
    Transport: ['Taxi / Grab', 'Motor Taxi', 'Public Transport', 'Fuel', 'Parking', 'Toll', 'Other'],
    Shopping: ['Online Shopping', 'Household', 'Personal', 'Electronics', 'Other'],
    Health: ['Medicine', 'Clinic', 'Hospital', 'Dental', 'Vitamins', 'Other'],
    Entertainment: ['Movies', 'Games', 'Events', 'Hobbies', 'Other'],
    'Personal Care': ['Haircut / Salon', 'Skincare / Toiletries', 'Laundry', 'Other'],
    Education: ['Tuition', 'School Supplies', 'Projects / Contributions', 'Online Course', 'Other'],
    Bills: ['Electricity', 'Water', 'Internet', 'Mobile', 'Rent', 'Association Dues', 'Subscriptions', 'Loan / Installment', 'Government', 'Fees', 'Other'],
    Other: ['Family Support / Padala', 'Transfer to Savings', 'Cash In / Cash Out', 'Miscellaneous'],
  },
  income: {
    Salary: ['Salary', 'Overtime', 'Commission'],
    Freelance: ['Client Project', 'Retainer', 'Side Hustle'],
    Business: ['Sales', 'Online Selling', 'Service Income'],
    Investment: ['Interest', 'Dividends', 'Investment Gain'],
    '13th Month': ['13th Month'],
    Bonus: ['Bonus', 'Performance Bonus', 'Incentive'],
    Other: ['Allowance', 'Padala Received', 'Gift Received', 'Refund', 'Reimbursement', 'Miscellaneous'],
  },
}

const TRANSACTION_PRESET_GROUPS = {
  expense: [
    {
      label: 'Bills',
      items: [
        { key: 'meralco', label: 'Meralco', desc: 'Meralco', cat: 'Bills', subcat: 'Electricity', icon: '⚡' },
        { key: 'manila-water', label: 'Manila Water', desc: 'Manila Water', cat: 'Bills', subcat: 'Water', icon: '💧' },
        { key: 'maynilad', label: 'Maynilad', desc: 'Maynilad', cat: 'Bills', subcat: 'Water', icon: '💧' },
        { key: 'pldt', label: 'PLDT', desc: 'PLDT', cat: 'Bills', subcat: 'Internet', icon: '🌐' },
        { key: 'globe-internet', label: 'Globe Internet', desc: 'Globe Internet', cat: 'Bills', subcat: 'Internet', icon: '🌐' },
        { key: 'converge', label: 'Converge', desc: 'Converge', cat: 'Bills', subcat: 'Internet', icon: '🌐' },
        { key: 'globe-postpaid', label: 'Globe Postpaid', desc: 'Globe Postpaid', cat: 'Bills', subcat: 'Mobile', icon: '📱' },
        { key: 'smart-postpaid', label: 'Smart Postpaid', desc: 'Smart Postpaid', cat: 'Bills', subcat: 'Mobile', icon: '📱' },
        { key: 'dito', label: 'DITO', desc: 'DITO', cat: 'Bills', subcat: 'Mobile', icon: '📱' },
        { key: 'netflix', label: 'Netflix', desc: 'Netflix', cat: 'Bills', subcat: 'Subscriptions', icon: '🎬' },
        { key: 'spotify', label: 'Spotify', desc: 'Spotify', cat: 'Bills', subcat: 'Subscriptions', icon: '🎧' },
        { key: 'youtube-premium', label: 'YouTube Premium', desc: 'YouTube Premium', cat: 'Bills', subcat: 'Subscriptions', icon: '▶️' },
        { key: 'icloud', label: 'iCloud', desc: 'iCloud', cat: 'Bills', subcat: 'Subscriptions', icon: '☁️' },
      ],
    },
    {
      label: 'Transport',
      items: [
        { key: 'grab', label: 'Grab', desc: 'Grab', cat: 'Transport', subcat: 'Taxi / Grab', icon: '🚗' },
        { key: 'angkas', label: 'Angkas', desc: 'Angkas', cat: 'Transport', subcat: 'Motor Taxi', icon: '🏍️' },
        { key: 'joyride', label: 'JoyRide', desc: 'JoyRide', cat: 'Transport', subcat: 'Motor Taxi', icon: '🏍️' },
        { key: 'move-it', label: 'Move It', desc: 'Move It', cat: 'Transport', subcat: 'Motor Taxi', icon: '🏍️' },
        { key: 'public-transport', label: 'Jeep / Bus / MRT', desc: 'Jeep / Bus / MRT', cat: 'Transport', subcat: 'Public Transport', icon: '🚌' },
        { key: 'gas-fuel', label: 'Gas / Fuel', desc: 'Gas / Fuel', cat: 'Transport', subcat: 'Fuel', icon: '⛽' },
        { key: 'parking', label: 'Parking', desc: 'Parking', cat: 'Transport', subcat: 'Parking', icon: '🅿️' },
      ],
    },
    {
      label: 'Food',
      items: [
        { key: 'groceries-palengke', label: 'Groceries / Palengke', desc: 'Groceries / Palengke', cat: 'Food & Dining', subcat: 'Groceries / Palengke', icon: '🛒' },
        { key: 'jollibee', label: 'Jollibee', desc: 'Jollibee', cat: 'Food & Dining', subcat: 'Fast Food', icon: '🍗' },
        { key: 'mcdonalds', label: "McDonald's", desc: "McDonald's", cat: 'Food & Dining', subcat: 'Fast Food', icon: '🍔' },
        { key: 'coffee', label: 'Coffee', desc: 'Coffee', cat: 'Food & Dining', subcat: 'Coffee / Milk Tea', icon: '☕' },
        { key: 'milk-tea', label: 'Milk Tea', desc: 'Milk Tea', cat: 'Food & Dining', subcat: 'Coffee / Milk Tea', icon: '🧋' },
      ],
    },
    {
      label: 'Shopping',
      items: [
        { key: 'shopee', label: 'Shopee', desc: 'Shopee', cat: 'Shopping', subcat: 'Online Shopping', icon: '🛍️' },
        { key: 'lazada', label: 'Lazada', desc: 'Lazada', cat: 'Shopping', subcat: 'Online Shopping', icon: '📦' },
        { key: 'watsons', label: 'Watsons', desc: 'Watsons', cat: 'Shopping', subcat: 'Personal', icon: '🧴' },
        { key: 'mercury-drug', label: 'Mercury Drug', desc: 'Mercury Drug', cat: 'Health', subcat: 'Medicine', icon: '💊' },
      ],
    },
    {
      label: 'Money',
      items: [
        { key: 'gcash-fee', label: 'GCash Fee', desc: 'GCash Fee', cat: 'Other', subcat: 'Cash In / Cash Out', icon: '💸' },
        { key: 'maya-fee', label: 'Maya Fee', desc: 'Maya Fee', cat: 'Other', subcat: 'Cash In / Cash Out', icon: '💸' },
        { key: 'loan-payment', label: 'Loan Payment', desc: 'Loan Payment', cat: 'Bills', subcat: 'Loan / Installment', icon: '🧾' },
        { key: 'credit-card-payment', label: 'Credit Card Payment', desc: 'Credit Card Payment', cat: 'Bills', subcat: 'Fees', icon: '💳' },
      ],
    },
  ],
  income: [
    {
      label: 'Work',
      items: [
        { key: 'salary', label: 'Salary', desc: 'Salary', cat: 'Salary', subcat: 'Salary', icon: '💼' },
        { key: 'overtime', label: 'Overtime', desc: 'Overtime', cat: 'Salary', subcat: 'Overtime', icon: '⏱️' },
        { key: 'bonus', label: 'Bonus', desc: 'Bonus', cat: 'Bonus', subcat: 'Bonus', icon: '🎁' },
        { key: '13th-month', label: '13th Month', desc: '13th Month', cat: '13th Month', subcat: '13th Month', icon: '🎉' },
      ],
    },
    {
      label: 'Freelance',
      items: [
        { key: 'client-payment', label: 'Client Payment', desc: 'Client Payment', cat: 'Freelance', subcat: 'Client Project', icon: '💻' },
        { key: 'retainer', label: 'Retainer', desc: 'Retainer', cat: 'Freelance', subcat: 'Retainer', icon: '🗂️' },
        { key: 'side-hustle', label: 'Side Hustle', desc: 'Side Hustle', cat: 'Freelance', subcat: 'Side Hustle', icon: '🛠️' },
      ],
    },
    {
      label: 'Business',
      items: [
        { key: 'business-sales', label: 'Business Sales', desc: 'Business Sales', cat: 'Business', subcat: 'Sales', icon: '🏪' },
        { key: 'online-selling', label: 'Online Selling', desc: 'Online Selling', cat: 'Business', subcat: 'Online Selling', icon: '📦' },
      ],
    },
    {
      label: 'Support',
      items: [
        { key: 'allowance', label: 'Allowance', desc: 'Allowance', cat: 'Other', subcat: 'Allowance', icon: '🤝' },
        { key: 'padala-received', label: 'Padala Received', desc: 'Padala Received', cat: 'Other', subcat: 'Padala Received', icon: '💌' },
        { key: 'refund', label: 'Refund', desc: 'Refund', cat: 'Other', subcat: 'Refund', icon: '↩️' },
        { key: 'reimbursement', label: 'Reimbursement', desc: 'Reimbursement', cat: 'Other', subcat: 'Reimbursement', icon: '🧾' },
      ],
    },
  ],
}

const QUICK_PRESET_KEYS = {
  expense: ['groceries-palengke', 'meralco', 'manila-water', 'grab', 'jollibee', 'netflix'],
  income: ['salary', 'client-payment', 'allowance', 'padala-received', 'bonus', '13th-month'],
}

const BILL_QUICK_PRESET_KEYS = ['meralco', 'pldt', 'globe-postpaid', 'netflix', 'loan-payment', 'other-custom']

const CUSTOM_PRESET = {
  key: 'other-custom',
  label: 'Other',
  desc: '',
  cat: 'Other',
  subcat: 'Miscellaneous',
  icon: '✍️',
  isCustom: true,
}

export const DEFAULT_CATEGORY_BY_TYPE = {
  income: 'Other',
  expense: 'Other',
}

export const DEFAULT_SUBCATEGORY_BY_TYPE = {
  income: 'Miscellaneous',
  expense: 'Miscellaneous',
}

export const DEFAULT_LABEL_BY_TYPE = {
  income: '',
  expense: '',
}

function resolveType(type) {
  return type === 'income' ? 'income' : 'expense'
}

function normalizeLabel(value = '') {
  return String(value || '').trim().toLowerCase()
}

function getPresetCatalog(type) {
  const resolvedType = resolveType(type)
  return [
    ...TRANSACTION_PRESET_GROUPS[resolvedType].flatMap(group => group.items),
    CUSTOM_PRESET,
  ]
}

function getBillPresetGroupsInternal() {
  const expenseGroups = TRANSACTION_PRESET_GROUPS.expense
  return expenseGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.cat === 'Bills'),
    }))
    .filter(group => group.items.length)
}

function getBillPresetCatalog() {
  return [
    ...getBillPresetGroupsInternal().flatMap(group => group.items),
    CUSTOM_PRESET,
  ]
}

export function getQuickItems(type) {
  const resolvedType = resolveType(type)
  return QUICK_PRESET_KEYS[resolvedType]
    .map(key => getPresetByKey(resolvedType, key))
    .filter(Boolean)
}

export function getPresetGroups(type) {
  return TRANSACTION_PRESET_GROUPS[resolveType(type)]
}

export function getBillPresetGroups() {
  return getBillPresetGroupsInternal()
}

export function getPresetOptions(type) {
  return getPresetCatalog(type)
}

export function getPresetByKey(type, presetKey = '') {
  if (!presetKey) return null
  return getPresetCatalog(type).find(item => item.key === presetKey) || null
}

export function getBillPresetByKey(presetKey = '') {
  if (!presetKey) return null
  return getBillPresetCatalog().find(item => item.key === presetKey) || null
}

export function findPresetByLabel(type, label = '') {
  const normalized = normalizeLabel(label)
  if (!normalized) return null
  return getPresetCatalog(type).find(item => normalizeLabel(item.label) === normalized || normalizeLabel(item.desc) === normalized) || null
}

export function findBillPresetByLabel(label = '') {
  const normalized = normalizeLabel(label)
  if (!normalized) return null
  return getBillPresetCatalog().find(item => normalizeLabel(item.label) === normalized || normalizeLabel(item.desc) === normalized) || null
}

export function getBillQuickItems() {
  return BILL_QUICK_PRESET_KEYS
    .map(key => getBillPresetByKey(key))
    .filter(Boolean)
}

export function getTransactionCategories(type) {
  return TRANSACTION_CATEGORIES[resolveType(type)]
}

export function sanitizeTransactionCategory(type, cat = '') {
  const resolvedType = resolveType(type)
  return TRANSACTION_CATEGORIES[resolvedType].includes(cat)
    ? cat
    : DEFAULT_CATEGORY_BY_TYPE[resolvedType]
}

export function getTransactionSubcategories(type, cat = '') {
  const resolvedType = resolveType(type)
  const resolvedCat = sanitizeTransactionCategory(resolvedType, cat)
  return TRANSACTION_SUBCATEGORIES[resolvedType][resolvedCat] || [DEFAULT_SUBCATEGORY_BY_TYPE[resolvedType]]
}

export function sanitizeTransactionSubcategory(type, cat = '', subcat = '') {
  const options = getTransactionSubcategories(type, cat)
  return options.includes(subcat)
    ? subcat
    : options[0]
}

export function getQuickPick(type, cat, desc = '', subcat = '', presetKey = '') {
  const preset = getPresetByKey(type, presetKey)
  if (preset) return preset.label

  const resolvedCat = sanitizeTransactionCategory(type, cat)
  const resolvedSubcat = sanitizeTransactionSubcategory(type, resolvedCat, subcat)
  const normalizedDesc = normalizeLabel(desc)
  const exact = getPresetCatalog(type).find(item => (
    !item.isCustom
    && item.cat === resolvedCat
    && item.subcat === resolvedSubcat
    && normalizeLabel(item.desc || item.label) === normalizedDesc
  ))
  if (exact) return exact.label

  const byLabel = findPresetByLabel(type, desc)
  if (byLabel && byLabel.cat === resolvedCat) return byLabel.label

  return ''
}

export function getSuggestedDescription(type, cat, subcat = '', presetKey = '') {
  const preset = getPresetByKey(type, presetKey)
  if (preset && !preset.isCustom) return preset.desc || preset.label

  const resolvedCat = sanitizeTransactionCategory(type, cat)
  const resolvedSubcat = sanitizeTransactionSubcategory(type, resolvedCat, subcat)

  if (resolvedSubcat && resolvedSubcat !== 'Miscellaneous' && resolvedSubcat !== 'Other') {
    return resolvedSubcat
  }
  if (resolvedCat === 'Other') return ''
  return resolvedCat
}

export function applyTransactionPreset(type, presetOrKey) {
  const preset = typeof presetOrKey === 'string' ? getPresetByKey(type, presetOrKey) : presetOrKey
  if (!preset || preset.isCustom) {
    const resolvedType = resolveType(type)
    return {
      presetKey: '',
      cat: DEFAULT_CATEGORY_BY_TYPE[resolvedType],
      subcat: DEFAULT_SUBCATEGORY_BY_TYPE[resolvedType],
      desc: '',
    }
  }

  return {
    presetKey: preset.key,
    cat: preset.cat,
    subcat: preset.subcat,
    desc: preset.desc || preset.label,
  }
}

export function getDefaultTransactionDraft(type = 'expense') {
  const resolvedType = resolveType(type)
  const cat = DEFAULT_CATEGORY_BY_TYPE[resolvedType]
  const subcat = sanitizeTransactionSubcategory(resolvedType, cat, DEFAULT_SUBCATEGORY_BY_TYPE[resolvedType])

  return {
    desc: DEFAULT_LABEL_BY_TYPE[resolvedType],
    amount: '',
    type: resolvedType,
    cat,
    subcat,
    presetKey: '',
    recur: '',
  }
}
