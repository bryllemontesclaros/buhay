export function safeScrollIntoView(node, options) {
  if (!node || typeof node.scrollIntoView !== 'function') return
  try {
    node.scrollIntoView(options)
  } catch {
    try {
      node.scrollIntoView(true)
    } catch {
      // noop
    }
  }
}

