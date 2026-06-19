const START_SPACE_INTENT_KEY = 'buhay_start_space'
const VALID_START_SPACES = new Set(['takda', 'lakas', 'tala', 'explore'])

function normalizeStartSpace(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return VALID_START_SPACES.has(normalized) ? normalized : ''
}

export function getStartSpaceIntent() {
  if (typeof window === 'undefined') return ''
  try {
    return normalizeStartSpace(window.sessionStorage.getItem(START_SPACE_INTENT_KEY))
  } catch {
    return ''
  }
}

export function setStartSpaceIntent(space) {
  const normalized = normalizeStartSpace(space)
  if (typeof window === 'undefined' || !normalized) return
  try {
    window.sessionStorage.setItem(START_SPACE_INTENT_KEY, normalized)
  } catch {}
}

export function clearStartSpaceIntent() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(START_SPACE_INTENT_KEY)
  } catch {}
}

export function consumeStartSpaceIntent() {
  const value = getStartSpaceIntent()
  if (value) clearStartSpaceIntent()
  return value
}
