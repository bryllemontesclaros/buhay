const LEGACY_PREFIX = 'takda_'
const CURRENT_PREFIX = 'buhay_'

const LEGACY_KEYS = [
  'auth_flash',
  'build_ver',
  'last_commit',
  'privacy_mode',
  'recurring_tab',
  'theme',
]

export function migrateLegacyLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return

  LEGACY_KEYS.forEach(key => {
    const legacyKey = `${LEGACY_PREFIX}${key}`
    const currentKey = `${CURRENT_PREFIX}${key}`
    try {
      if (window.localStorage.getItem(currentKey) == null) {
        const legacyValue = window.localStorage.getItem(legacyKey)
        if (legacyValue != null) window.localStorage.setItem(currentKey, legacyValue)
      }
    } catch {
      // Storage can be unavailable in private browsing; the app still works.
    }
  })
}
