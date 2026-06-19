export function notifyApp(input, options = {}) {
  if (typeof window === 'undefined') return

  const detail = typeof input === 'string'
    ? { message: input, ...options }
    : { ...input, ...options }

  if (!window.__takdaFeedbackReady) {
    console.warn(detail.message || detail.title || 'Buhay needs your attention.')
    return
  }

  window.dispatchEvent(new CustomEvent('takda:notify', { detail }))
}

export function confirmApp(input, options = {}) {
  if (typeof window === 'undefined') return Promise.resolve(false)

  const detail = typeof input === 'string'
    ? { message: input, ...options }
    : { ...input, ...options }

  if (!window.__takdaFeedbackReady) {
    console.warn(detail.message || detail.title || 'Confirmation requested before feedback UI was ready.')
    return Promise.resolve(false)
  }

  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent('takda:confirm', {
      detail: {
        ...detail,
        resolve,
      },
    }))
  })
}

export function confirmDeleteApp(name = 'this item') {
  return confirmApp({
    title: 'Delete item?',
    message: `Delete ${name}? This cannot be undone.`,
    confirmLabel: 'Delete',
    cancelLabel: 'Keep it',
    tone: 'danger',
  })
}
