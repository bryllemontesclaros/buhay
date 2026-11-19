const REFERENCE_RATES = Object.freeze({
  PHP: { PHP: 1, USD: 0.017, EUR: 0.016, SGD: 0.023, HKD: 0.13, GBP: 0.013, JPY: 2.7, AUD: 0.026, CAD: 0.023 },
  USD: { USD: 1, PHP: 58.5, EUR: 0.92, SGD: 1.35, HKD: 7.8, GBP: 0.79, JPY: 158.2, AUD: 1.5, CAD: 1.37 },
  EUR: { EUR: 1, USD: 1.09, PHP: 63.6, SGD: 1.47, HKD: 8.5, GBP: 0.86, JPY: 172.0, AUD: 1.63, CAD: 1.49 },
})

export function getReferenceRates(base = 'PHP') {
  const normalizedBase = String(base || 'PHP').toUpperCase()
  return { ...(REFERENCE_RATES[normalizedBase] || REFERENCE_RATES.PHP) }
}
