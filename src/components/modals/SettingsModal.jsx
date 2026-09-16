import styles from '../../pages/AppShell.module.css'
import Settings from '../../pages/Settings'

export function SettingsModal({ isSettingsOpen, setIsSettingsOpen, activeSpaceConfig, pageProps, NAV_ICONS }) {
  if (!isSettingsOpen) return null

  return (
    <div className={styles.settingsModalOverlay} onClick={() => setIsSettingsOpen(false)}>
      <div className={styles.settingsModalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.settingsModalHeader}>
          <div className={styles.settingsModalTitleGroup}>
            <span className={styles.settingsModalIcon}>{NAV_ICONS?.settings}</span>
            <div>
              <h3 className={styles.settingsModalTitle}>Settings</h3>
              <div className={styles.settingsModalSub}>
                Preferences & system defaults for {activeSpaceConfig?.label}
              </div>
            </div>
          </div>
          <button
            type="button"
            className={styles.settingsModalCloseBtn}
            onClick={() => setIsSettingsOpen(false)}
            aria-label="Close Settings"
          >
            ✕
          </button>
        </div>
        <div className={styles.settingsModalBody}>
          <Settings {...pageProps} />
        </div>
      </div>
    </div>
  )
}
