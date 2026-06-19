import styles from './Loading.module.css'

export function Spinner() {
  return (
    <div className={styles.spinnerWrap}>
      <div className={styles.spinner} />
    </div>
  )
}

export function EmptyState({ icon, title, sub, action, onAction }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>{icon || '📭'}</div>
      <div className={styles.emptyTitle}>{title || 'Nothing here yet'}</div>
      {sub && <div className={styles.emptySub}>{sub}</div>}
      {action && onAction && (
        <button className={styles.emptyAction} onClick={onAction}>{action}</button>
      )}
    </div>
  )
}

export function PageLoader({ title = 'Buhay', message = '' }) {
  return (
    <div className={styles.pageLoader}>
      <div className={styles.loaderLogo}>{title}</div>
      <div className={styles.spinner} />
      {message && <div className={styles.loaderMessage}>{message}</div>}
    </div>
  )
}
