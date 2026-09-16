import { createPortal } from 'react'
import calStyles from '../../pages/Calendar.module.css'
import styles from '../../pages/AppShell.module.css'
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

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '16px' }}>
              {[100, 500, 1000, 5000].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('amount', String(Number(form.amount || 0) + v))}
                  style={{
                    flex: '1 1 0',
                    padding: '6px 0',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '999px',
                    border: '1px solid color-mix(in srgb, var(--text) 15%, transparent)',
                    background: 'color-mix(in srgb, var(--text) 6%, transparent)',
                    color: 'var(--text2)',
                    cursor: 'pointer',
                  }}
                >
                  +{v.toLocaleString()}
                </button>
              ))}
              <button
                type="button"
                onClick={() => set('amount', '')}
                style={{
                  flex: '1 1 0',
                  padding: '6px 0',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '999px',
                  border: '1px solid color-mix(in srgb, var(--red, #ff453a) 30%, transparent)',
                  background: 'color-mix(in srgb, var(--red, #ff453a) 8%, transparent)',
                  color: 'var(--red, #ff453a)',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>

            <div className={calStyles.modalSectionLabel}>{isIncome ? 'What did you receive?' : 'What did you pay for?'}</div>
            <div className={calStyles.quickCats}>
              {visibleQuickPresets.map(item => (
                <button
                  key={item.key}
                  className={`${calStyles.quickCat} ${form.presetKey === item.key ? calStyles.quickCatActive : ''}`}
                  style={form.presetKey === item.key ? {
                    borderColor: isIncome ? 'var(--income)' : 'var(--red)',
                    background: isIncome ? 'var(--income-dim)' : 'var(--red-dim)',
                    color: isIncome ? 'var(--income)' : 'var(--red)',
                  } : {}}
                  disabled={formSaving}
                  onClick={() => {
                    if (item.isCustom) clearComposerPreset(modalType, 'Other', 'Miscellaneous')
                    else applyComposerPreset(item.key)
                  }}
                  aria-pressed={form.presetKey === item.key}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className={calStyles.presetActions}>
              <button
                type="button"
                className={`${calStyles.presetToggle} ${showPresetBrowser ? calStyles.presetToggleActive : ''}`}
                onClick={() => setShowPresetBrowser(current => !current)}
                disabled={formSaving}
                aria-expanded={showPresetBrowser}
              >
                {showPresetBrowser ? 'Hide presets' : 'More presets'}
              </button>
            </div>

            <div className={calStyles.modalFields}>
              {showPresetBrowser && (
                <div className={`${styles.formGroup} ${calStyles.modalFieldFull}`}>
                  <label>Browse presets</label>
                  <select
                    value={form.presetKey || 'other-custom'}
                    onChange={event => {
                      if (event.target.value === 'other-custom') clearComposerPreset(modalType, 'Other', 'Miscellaneous')
                      else applyComposerPreset(event.target.value)
                    }}
                    disabled={formSaving}
                  >
                    {presetGroups.map(group => (
                      <optgroup key={group.label} label={group.label}>
                        {group.items.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                      </optgroup>
                    ))}
                    <option value="other-custom">Other / custom</option>
                  </select>
                </div>
              )}
              <div className={styles.formGroup}>
                <label>{selectedPreset ? 'Description' : (isIncome ? 'Payer or note' : 'Merchant, biller, or note')}</label>
                <input placeholder="Merchant, payer, or note (optional)" value={form.desc} onChange={event => set('desc', event.target.value)} disabled={formSaving} />
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
              <div className={styles.formGroup}>
                <label>Counts in balances</label>
                <select value={form.paymentStatus} onChange={event => set('paymentStatus', event.target.value)} disabled={formSaving}>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
              {isCurrentModalCreditCard && calendarBillingCycleOptions.length > 0 && (
                <div className={`${styles.formGroup} ${calStyles.modalFieldFull}`}>
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

            <div className={calStyles.presetHint}>
              {selectedPreset
                ? `${selectedPreset.label} auto-fills ${selectedPreset.cat} → ${selectedPreset.subcat}.`
                : isIncome
                  ? 'No preset selected. Choose a familiar income source, or keep this as a custom entry.'
                  : 'No preset selected. Choose a familiar biller or merchant, or keep this as a custom entry.'}
            </div>

            <details className={calStyles.advancedBox}>
              <summary className={calStyles.advancedSummary}>
                <span>More options</span>
                <small>Payment status, category, subcategory, recurrence</small>
              </summary>
              <div className={calStyles.advancedGrid}>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select value={form.cat} onChange={event => applyComposerCategory(event.target.value)} disabled={formSaving}>
                    {cats.map(option => <option key={option}>{option}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Subcategory</label>
                  <select value={form.subcat} onChange={event => applyComposerSubcategory(event.target.value)} disabled={formSaving}>
                    {subcats.map(option => <option key={option}>{option}</option>)}
                  </select>
                </div>
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
        </div>
  )
}
