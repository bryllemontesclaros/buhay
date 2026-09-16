import React from 'react'
import { createPortal } from 'react-dom'
import accStyles from '../../pages/Accounts.module.css'
import { ACCOUNT_ICONS, ACCOUNT_TYPES, TYPE_COLORS, COLORS } from '../../lib/accountConstants'

export default function AccountEditorModal({
  showModal,
  onClose,
  editAccount,
  form,
  setField,
  handleSaveAccount,
  s
}) {
  if (!showModal || typeof document === 'undefined') return null

  return createPortal(
    <div className={accStyles.modalOverlay} onClick={onClose}>
      <div className={accStyles.modalCard} onClick={e => e.stopPropagation()}>
        <div className={accStyles.modalHeader}>
          <div>
            <div className={accStyles.modalEyebrow}>{editAccount ? 'Editing Account' : 'New Account'}</div>
            <div className={accStyles.modalTitle}>{editAccount ? `Update ${editAccount.name}` : 'Add New Account'}</div>
          </div>
          <button type="button" className={accStyles.modalClose} onClick={onClose}>✕</button>
        </div>

        <div className={accStyles.modalBody}>
          <div className={accStyles.field}>
            <label className={accStyles.fieldLabel} htmlFor="account-name">Account Name</label>
            <input
              id="account-name"
              className={accStyles.fieldInput}
              placeholder="e.g. BDO Savings, GCash"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              autoFocus
            />
          </div>

          <div className={accStyles.field}>
            <label className={accStyles.fieldLabel} htmlFor="account-type">Account Type</label>
            <select
              id="account-type"
              className={accStyles.fieldInput}
              value={form.type}
              onChange={e => {
                const newType = e.target.value
                setField('type', newType)
                if (!editAccount) {
                  setField('color', TYPE_COLORS[newType] || '#3b82f6')
                }
              }}
            >
              {ACCOUNT_TYPES.map(type => (
                <option key={type} value={type}>
                  {ACCOUNT_ICONS[type] || '🏷'} {type}
                </option>
              ))}
            </select>
          </div>

          <div className={accStyles.field}>
            <label className={accStyles.fieldLabel} htmlFor="account-balance">Starting Balance ({s})</label>
            <input
              id="account-balance"
              className={accStyles.fieldInputBig}
              type="number"
              step="any"
              placeholder="0.00"
              value={form.balance}
              onChange={e => setField('balance', e.target.value)}
            />
          </div>

          <div className={accStyles.field}>
            <label className={accStyles.fieldLabel} htmlFor="account-notes">Notes / Purpose</label>
            <input
              id="account-notes"
              className={accStyles.fieldInput}
              placeholder="e.g. Daily spending, Payroll"
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
            />
          </div>

          <div className={accStyles.colorSection}>
            <div className={accStyles.fieldLabel}>Theme Color</div>
            <div className={accStyles.colorGrid}>
              {COLORS.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setField('color', color.value)}
                  className={`${accStyles.colorBtn} ${form.color === color.value ? accStyles.colorBtnActive : ''}`}
                  style={{ '--swatch': color.value }}
                  title={color.name}
                  aria-pressed={form.color === color.value}
                />
              ))}
            </div>
          </div>

          <div className={accStyles.modalActions}>
            <button type="button" className={accStyles.btnSecondary} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={accStyles.btnPrimary} onClick={handleSaveAccount}>
              {editAccount ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
