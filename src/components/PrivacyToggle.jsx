import styles from './PrivacyToggle.module.css'

export default function PrivacyToggle({ enabled, onToggle, label = 'Hide balances' }) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${enabled ? styles.active : ''}`}
      onClick={onToggle}
      aria-pressed={enabled}
      title={enabled ? 'Show sensitive values' : 'Hide sensitive values'}
    >
      <span aria-hidden="true">{enabled ? 'Hide' : 'Show'}</span>
      <span className={styles.label}>{enabled ? 'Privacy on' : label}</span>
    </button>
  )
}
