import React from 'react'
import { createPortal } from 'react-dom'
import accStyles from '../../pages/Accounts.module.css'
import { ACCOUNT_ICONS } from '../../lib/accountConstants'

export default function TransferModal({
  showTransferModal,
  onClose,
  transferForm,
  setTransferForm,
  transferSaving,
  handleTransferSubmit,
  swapTransferDirection,
  accounts,
  s,
  fmt
}) {
  if (!showTransferModal || typeof document === 'undefined') return null

  return createPortal(
    <div className={accStyles.modalOverlay} onClick={onClose}>
      <div className={accStyles.modalCard} onClick={e => e.stopPropagation()}>
        <div className={accStyles.modalHeader}>
          <div>
            <div className={accStyles.modalEyebrow}>⇄ Inter-Account Transfer</div>
            <div className={accStyles.modalTitle}>Move Money</div>
          </div>
          <button type="button" className={accStyles.modalClose} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleTransferSubmit} className={accStyles.modalBody}>
          <div className={accStyles.transferTopBar}>
            <span className={accStyles.transferTopNotice}>Select source & target accounts:</span>
            <button
              type="button"
              className={accStyles.btnSwapDirection}
              onClick={swapTransferDirection}
              title="Reverse transfer direction"
            >
              ⇄ Swap
            </button>
          </div>

          <div className={accStyles.transferGrid}>
            <div className={accStyles.field}>
              <label className={accStyles.fieldLabel} htmlFor="transfer-from">From Account</label>
              <select
                id="transfer-from"
                className={accStyles.fieldInput}
                value={transferForm.fromAccountId}
                onChange={e => setTransferForm(prev => ({ ...prev, fromAccountId: e.target.value }))}
              >
                {accounts.map(a => (
                  <option key={a._id} value={a._id} disabled={a._id === transferForm.toAccountId}>
                    {ACCOUNT_ICONS[a.type] || '🏷'} {a.name} ({fmt(a.balance, s)})
                  </option>
                ))}
              </select>
            </div>

            <div className={accStyles.transferArrowWrap} onClick={swapTransferDirection} title="Swap direction" role="button" tabIndex={0}>
              ⇄
            </div>

            <div className={accStyles.field}>
              <label className={accStyles.fieldLabel} htmlFor="transfer-to">To Account</label>
              <select
                id="transfer-to"
                className={accStyles.fieldInput}
                value={transferForm.toAccountId}
                onChange={e => setTransferForm(prev => ({ ...prev, toAccountId: e.target.value }))}
              >
                {accounts.map(a => (
                  <option key={a._id} value={a._id} disabled={a._id === transferForm.fromAccountId}>
                    {ACCOUNT_ICONS[a.type] || '🏷'} {a.name} ({fmt(a.balance, s)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={accStyles.field}>
            <label className={accStyles.fieldLabel} htmlFor="transfer-amount">Amount ({s})</label>
            <input
              id="transfer-amount"
              type="number"
              step="any"
              min="0.01"
              className={accStyles.fieldInputBig}
              placeholder="0.00"
              value={transferForm.amount}
              onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
              autoFocus
            />
          </div>

          <div className={accStyles.field}>
            <label className={accStyles.fieldLabel} htmlFor="transfer-date">Date</label>
            <input
              id="transfer-date"
              type="date"
              className={accStyles.fieldInput}
              value={transferForm.date}
              onChange={e => setTransferForm(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>

          <div className={accStyles.field}>
            <label className={accStyles.fieldLabel} htmlFor="transfer-desc">Note (Optional)</label>
            <input
              id="transfer-desc"
              type="text"
              className={accStyles.fieldInput}
              placeholder="e.g. ATM cash withdrawal, wallet reload"
              value={transferForm.desc}
              onChange={e => setTransferForm(prev => ({ ...prev, desc: e.target.value }))}
            />
          </div>

          <div className={accStyles.modalActions}>
            <button type="button" className={accStyles.btnSecondary} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={accStyles.btnPrimary} disabled={transferSaving}>
              {transferSaving ? 'Transferring…' : 'Complete Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
