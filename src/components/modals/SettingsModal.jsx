import styles from '../../pages/AppShell.module.css'
import Settings from '../../pages/Settings'
import ModalShell from '../ui/ModalShell'

export function SettingsModal({ isSettingsOpen, setIsSettingsOpen, activeSpaceConfig, pageProps, NAV_ICONS }) {
  return (
    <ModalShell
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      title="Settings"
      overlayClassName={styles.settingsModalOverlay}
      className={styles.settingsModalContent}
    >
      {({ titleId }) => (
        <>
          <div className={styles.settingsModalHeader}>
            <div className={styles.settingsModalTitleGroup}>
              <span className={styles.settingsModalIcon}>{NAV_ICONS?.settings}</span>
              <div>
                <h3 id={titleId} className={styles.settingsModalTitle}>Settings</h3>
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
        </>
      )}
    </ModalShell>
  )
}
