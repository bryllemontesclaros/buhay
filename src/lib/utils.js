export const CURRENCIES = [
  { code: 'PHP', symbol: '₱', label: 'Philippine Peso (PHP)' },
  { code: 'HKD', symbol: 'HK$', label: 'Hong Kong Dollar (HKD)' },
  { code: 'USD', symbol: '$', label: 'US Dollar (USD)' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (GBP)' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen (JPY)' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar (SGD)' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (AUD)' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar (CAD)' },
]

export const PAY_SCHEDULES = [
  { value: 'semi-monthly', label: 'Semi-monthly (1st & 15th)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Every 2 weeks' },
  { value: 'tri-weekly', label: 'Every 3 weeks' },
  { value: 'quad-weekly', label: 'Every 4 weeks' },
]

export const RECUR_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Every 2 weeks' },
  { value: 'tri-weekly', label: 'Every 3 weeks' },
  { value: 'quad-weekly', label: 'Every 4 weeks' },
  { value: 'semi-monthly', label: 'Semi-monthly (1st & 15th)' },
  { value: 'monthly', label: 'Monthly' },
]

export function fmt(n, symbol = '₱') {
  return symbol + Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function displayValue(hidden, visible, masked = '••••') {
  return hidden ? masked : visible
}

export function maskMoney(symbol = '₱') {
  return `${symbol}••••`
}

export function normalizeDate(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (iso) {
      const [, year, month, day] = iso
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDisplayDate(value, locale = 'en-PH') {
  const normalized = normalizeDate(value)
  if (!normalized) return 'Pick a date'

  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return normalized

  return parsed.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function toMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function getMonthKey(value) {
  const normalized = normalizeDate(value)
  return normalized ? normalized.slice(0, 7) : ''
}

export function isSameMonth(value, year, month) {
  return getMonthKey(value) === toMonthKey(year, month)
}

export function today() {
  const date = new Date()
  return normalizeDate(`${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`)
}

export function getInitials(name) {
  return (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function getCurrencySymbol(code) {
  return CURRENCIES.find(c => c.code === code)?.symbol || '₱'
}

export function confirmDelete(name = 'this item') {
  console.warn(`confirmDelete(${name}) is deprecated. Use confirmDeleteApp from appFeedback instead.`)
  return false
}

export function validateAmount(val, fieldName = 'Amount') {
  const n = parseFloat(val)
  if (isNaN(n) || n <= 0) return `${fieldName} must be a positive number.`
  return null
}
