import { createPortal } from 'react-dom'
import calStyles from '../../pages/Calendar.module.css'
import styles from '../../pages/Page.module.css'
import Button from '../ui/Button'

export function TransactionComposer({
  showModal,
  formSaving,
  closeTransactionEditor,
  transactionModalRef,
  editTx,
  isIncome,
  selected,
  switchComposerType,
  s,
  amountInputRef,
  form,
  set,
  normalizeAmountInput,
  visibleQuickPresets,
  modalType,
  clearComposerPreset,
  applyComposerPreset,
  showPresetBrowser,
  setShowPresetBrowser,
  presetGroups,
  accountList,
  isCurrentModalCreditCard,
  calendarBillingCycleOptions,
  selectedPreset,
  cats,
  applyComposerCategory,
  subcats,
  applyComposerSubcategory,
  RECUR_OPTIONS,
  formError,
  formImpact,
  handleSave,
  handleDelete
}) {
  if (!showModal || typeof document === 'undefined') return null

  return createPortal(
              <div className={calStyles.modalOverlay} onClick={() => { if (!formSaving) closeTransactionEditor() }}>
            <div
              ref={transactionModalRef}
              tabIndex={-1}
              className={calStyles.modal}
              onClick={event => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="calendar-transaction-modal-title"
            >
            <div className={calStyles.modalHeader}>
              <div className={calStyles.modalTitle} id="calendar-transaction-modal-title">
                {editTx ? 'Edit transaction' : `Add ${isIncome ? 'Income' : 'Expense'}`}
                {selected && !editTx && <span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 8 }}>{selected}</span>}
              </div>
            <button type="button" onClick={closeTransactionEditor} className={calStyles.modalClose} disabled={formSaving} aria-label="Close transaction editor">✕</button>
            </div>

            {!editTx && (
              <div className={calStyles.typeToggle}>
                <button type="button" className={`${calStyles.typeBtn} ${isIncome ? calStyles.typeBtnIncome : ''}`} onClick={() => switchComposerType('income')} disabled={formSaving} aria-pressed={isIncome}>
                  <span className={calStyles.typeBtnSign}>+</span><span>Income</span>
                </button>
                <button type="button" className={`${calStyles.typeBtn} ${!isIncome ? calStyles.typeBtnExpense : ''}`} onClick={() => switchComposerType('expense')} disabled={formSaving} aria-pressed={!isIncome}>
                  <span className={calStyles.typeBtnSign}>−</span><span>Expense</span>
                </button>
              </div>
            )}

            <div className={calStyles.amountField}>
              <span className={calStyles.amountSign} style={{ color: isIncome ? 'var(--income)' : 'var(--red)' }}>
                {isIncome ? '+' : '−'}
              </span>
              <span className={calStyles.amountSymbol}>{s}</span>
              <input
                ref={amountInputRef}
                className={calStyles.amountInput}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                disabled={formSaving}
                onChange={event => set('amount', normalizeAmountInput(event.target.value))}
                style={{ color: isIncome ? 'var(--income)' : 'var(--red)' }}
                aria-label={`${isIncome ? 'Income' : 'Expense'} amount`}
                autoFocus
              />
            </div>

            <div className={calStyles.modalFields}>
              <div className={styles.formGroup}>
                <label>{isIncome ? 'Name' : 'Name'}</label>
                <input placeholder="Name" value={form.desc} onChange={event => set('desc', event.target.value)} disabled={formSaving} required />
              </div>
              <div className={styles.formGroup}>
                <label>Account</label>
                <select value={form.accountId} onChange={event => set('accountId', event.target.value)} disabled={formSaving}>
                  <option value="">No account selected</option>
                  {accountList.map(account => (
                    <option key={account._id} value={account._id}>
                      {account.name} · {account.type}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`${styles.formGroup} ${isCurrentModalCreditCard && calendarBillingCycleOptions.length > 0 ? '' : calStyles.modalFieldFull}`}>
                <label>Counts in balances</label>
                <select value={form.paymentStatus} onChange={event => set('paymentStatus', event.target.value)} disabled={formSaving}>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
              {isCurrentModalCreditCard && calendarBillingCycleOptions.length > 0 && (
                <div className={styles.formGroup}>
                  <label>💳 Billing Statement</label>
                  <select
                    value={form.billingCycle || 'auto'}
                    onChange={event => set('billingCycle', event.target.value)}
                    disabled={formSaving}
                  >
                    {calendarBillingCycleOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <details className={calStyles.advancedBox}>
              <summary className={calStyles.advancedSummary}><span>More options</span><small>Account, payment status, recurrence</small></summary>
              <div className={calStyles.advancedGrid}>
                <div className={`${styles.formGroup} ${calStyles.advancedFull}`}>
                  <label>Recurrence</label>
                  <div className={calStyles.recurGrid}>
                    {RECUR_OPTIONS.map(option => (
                      <button
                        type="button"
                        key={option.value}
                        onClick={() => set('recur', option.value)}
                        className={`${calStyles.recurChip} ${form.recur === option.value ? calStyles.recurChipActive : ''}`}
                        disabled={formSaving}
                        aria-pressed={form.recur === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </details>

            {formError && <div className={calStyles.formError} role="alert">{formError}</div>}

            {formImpact && (
              <div
                className={calStyles.impactPreview}
                role="status"
                style={{
                  background: formImpact.level === 'negative' ? 'var(--red-dim)' : formImpact.level === 'tight' ? 'var(--amber-dim)' : 'var(--accent-glow)',
                  borderColor: formImpact.level === 'negative' ? 'var(--red)' : formImpact.level === 'tight' ? 'var(--amber)' : 'var(--accent)',
                  color: formImpact.level === 'negative' ? 'var(--red)' : formImpact.level === 'tight' ? 'var(--amber)' : 'var(--accent)',
                }}
              >
                {formImpact.msg}
              </div>
            )}

            <div className={calStyles.modalActions}>
              <Button type="button" onClick={closeTransactionEditor} variant="ghost" disabled={formSaving}>Cancel</Button>
              <Button
                type="button"
                onClick={handleSave}
                variant={isIncome ? 'primary' : 'danger'}
                disabled={formSaving || !Number.isFinite(parseFloat(form.amount)) || parseFloat(form.amount) <= 0}
              >
                {formSaving ? 'Saving...' : editTx ? 'Save changes' : isIncome ? '+ Add income' : '− Add expense'}
              </Button>
            </div>
          </div>
        </div>,
    document.body
  )
}
