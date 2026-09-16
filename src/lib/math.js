export function safeNumber(val) {
  const num = Number(val)
  return Number.isFinite(num) ? num : 0
}

export function sumBy(array, keyFn) {
  if (!Array.isArray(array)) return 0
  return array.reduce((sum, item) => {
    if (!item) return sum
    return sum + safeNumber(keyFn(item))
  }, 0)
}

export function sumAbsBy(array, keyFn) {
  if (!Array.isArray(array)) return 0
  return array.reduce((sum, item) => {
    if (!item) return sum
    return sum + Math.abs(safeNumber(keyFn(item)))
  }, 0)
}

export function sumMax0By(array, keyFn) {
  if (!Array.isArray(array)) return 0
  return array.reduce((sum, item) => {
    if (!item) return sum
    return sum + Math.max(0, safeNumber(keyFn(item)))
  }, 0)
}

export function calculateDelta(amount, isPositive) {
  const normalized = Math.abs(safeNumber(amount))
  if (!normalized) return 0
  return isPositive ? normalized : -normalized
}
