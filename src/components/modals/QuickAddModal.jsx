import styles from '../../pages/AppShell.module.css'
import QuickAdd from '../../pages/QuickAdd'

export function QuickAddModal({
  quickAddSheet,
  closeQuickAdd,
  quickAddDialogLabel,
  user,
  profile,
  data,
  symbol,
  quickAddDefaultDate,
  handleQuickAddTypeChange
}) {
  if (!quickAddSheet.open) return null

  return (
    <>
      <div className={styles.quickAddBackdrop} onClick={closeQuickAdd} aria-hidden="true" />
      <div className={styles.quickAddLayer}>
        <div
          className={styles.quickAddSheet}
          role="dialog"
          aria-modal="true"
          aria-label={quickAddDialogLabel}
        >
          <div className={styles.quickAddHeader}>
            <div>
              <div className={styles.quickAddEyebrow}>Quick add</div>
              <div className={styles.quickAddTitle} id="quick-add-title">
                {quickAddSheet.type === 'income' ? 'Log income' : 'Track expense'}
              </div>
            </div>
            <button type="button" className={styles.quickAddClose} onClick={closeQuickAdd} aria-label="Close quick add">✕</button>
          </div>
          <QuickAdd
            user={user}
            profile={profile}
            accounts={data.accounts}
            debts={data.debts}
            symbol={symbol}
            defaultType={quickAddSheet.type}
            defaultDate={quickAddDefaultDate}
            initialEntry={quickAddSheet.initialEntry}
            onTypeChange={handleQuickAddTypeChange}
            onClose={closeQuickAdd}
          />
        </div>
      </div>
    </>
  )
}
