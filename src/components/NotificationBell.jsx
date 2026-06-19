import { useState, useEffect, useRef } from 'react'
import { getAlerts, requestPushPermission } from '../lib/notifications'
import nStyles from './NotificationBell.module.css'

const TYPE_COLORS = {
  danger: { bg: 'var(--red-dim)', border: 'rgba(255,83,112,0.3)', icon: 'var(--red)', dot: 'var(--red)' },
  warning: { bg: 'var(--amber-dim)', border: 'rgba(255,179,71,0.3)', icon: 'var(--amber)', dot: 'var(--amber)' },
  success: { bg: 'var(--accent-glow)', border: 'rgba(34,216,122,0.3)', icon: 'var(--accent)', dot: 'var(--accent)' },
  info: { bg: 'var(--blue-dim)', border: 'rgba(110,181,255,0.3)', icon: 'var(--blue)', dot: 'var(--blue)' },
}

// Safe wrappers — mobile Safari throws on undefined Notification or blocked localStorage
const safeNotificationPermission = () => {
  try { return typeof Notification !== 'undefined' ? Notification.permission : 'denied' } catch { return 'denied' }
}
const safeLocalStorageGet = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || fallback) } catch { return JSON.parse(fallback) }
}
const safeLocalStorageSet = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export default function NotificationBell({ data, profile, privacyMode = false, onAction = null }) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(() => safeLocalStorageGet('sentimo_dismissed', '[]'))
  const [pushEnabled, setPushEnabled] = useState(() => safeNotificationPermission() === 'granted')
  const ref = useRef(null)

  const allAlerts = getAlerts(data, profile, privacyMode)
  const alerts = allAlerts.filter(a => !dismissed.includes(a.id))
  const count = alerts.length

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    function handleKeydown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [])

  function dismiss(id) {
    const next = [...dismissed, id]
    setDismissed(next)
    safeLocalStorageSet('sentimo_dismissed', next)
  }

  function dismissAll() {
    const next = alerts.map(a => a.id)
    setDismissed(d => {
      const updated = [...d, ...next]
      safeLocalStorageSet('sentimo_dismissed', updated)
      return updated
    })
  }

  async function enablePush() {
    const granted = await requestPushPermission()
    setPushEnabled(granted)
  }

  function handleAction(alert) {
    onAction?.(alert)
    setOpen(false)
  }

  const showPushBanner = !pushEnabled && typeof Notification !== 'undefined'

  return (
    <div className={nStyles.wrap} ref={ref}>
      <button
        type="button"
        className={nStyles.bell}
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        aria-label={count > 0 ? `Notifications, ${count} unread alerts` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notifications-panel"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {count > 0 && <span className={nStyles.badge}>{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <div
          id="notifications-panel"
          className={nStyles.dropdown}
          role="dialog"
          aria-label="Notifications"
        >
          <div className={nStyles.header}>
            <span className={nStyles.headerTitle}>Notifications</span>
            {count > 0 && <button type="button" className={nStyles.clearAll} onClick={dismissAll} aria-label="Clear all notifications">Clear all</button>}
          </div>

          {showPushBanner && (
            <div className={nStyles.pushBanner}>
              <span>Allow browser notifications?</span>
              <button type="button" className={nStyles.pushBtn} onClick={enablePush}>Enable</button>
            </div>
          )}

          {alerts.length === 0 ? (
            <div className={nStyles.empty}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <div>You’re all caught up.</div>
            </div>
          ) : (
            <div className={nStyles.list}>
              {alerts.map(a => {
                const c = TYPE_COLORS[a.type] || TYPE_COLORS.info
                return (
                  <div key={a.id} className={nStyles.alertItem} style={{ background: c.bg, borderColor: c.border }}>
                    <div className={nStyles.alertLeft}>
                      <span className={nStyles.alertIcon}>{a.icon}</span>
                      <div>
                        <div className={nStyles.alertTitle} style={{ color: c.icon }}>{a.title}</div>
                        <div className={nStyles.alertBody}>{a.body}</div>
                        {a.action?.label && (
                          <button
                            type="button"
                            className={nStyles.alertAction}
                            onClick={() => handleAction(a)}
                          >
                            {a.action.label}
                          </button>
                        )}
                      </div>
                    </div>
                    <button type="button" className={nStyles.dismissBtn} onClick={() => dismiss(a.id)} aria-label={`Dismiss notification: ${a.title}`}>✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
