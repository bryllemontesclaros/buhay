import React from 'react'
import { createPortal } from 'react-dom'
import accStyles from '../../pages/Accounts.module.css'

export default function QuickAdjustModal({
  adjustTarget,
  onClose,
  adjustNewBalance,
  setAdjustNewBalance,
  adjustLogToHistory,
  setAdjustLogToHistory,
  adjustSaving,
  handleAdjustSubmit,
  s,
  fmt,
  money
}) {
  if (!adjustTarget || typeof document === 'undefined') return null

  return createPortal(
    <div className={accStyles.modalOverlay} onClick={onClose}>
      <div className={accStyles.modalCard} onClick={e => e.stopPropagation()}>
        <div className={accStyles.modalHeader}>
          <div>
            <div className={accStyles.modalEyebrow}>⚡ Quick Reconcile</div>
            <div className={accStyles.modalTitle}>Adjust {adjustTarget.name}</div>
          </div>
          <button type="button" className={accStyles.modalClose} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleAdjustSubmit} className={accStyles.modalBody}>
          <div className={accStyles.adjustCurrentStrip}>
            <span className={accStyles.adjustCurrentLabel}>Current recorded balance:</span>
            <strong className={accStyles.adjustCurrentVal}>{money(adjustTarget.balance)}</strong>
          </div>

          <div className={accStyles.field}>
            <label className={accStyles.fieldLabel} htmlFor="adjust-bal-input">
              Actual current balance in real life ({s})
            </label>
            <input
              id="adjust-bal-input"
              type="number"
              step="any"
              className={accStyles.fieldInputBig}
              placeholder="0.00"
              value={adjustNewBalance}
              onChange={e => setAdjustNewBalance(e.target.value)}
              autoFocus
            />
          </div>

          {adjustNewBalance !== '' && !isNaN(parseFloat(adjustNewBalance)) && (
            <div className={accStyles.adjustDiffStrip}>
              <span>Difference:</span>
              <strong className={parseFloat(adjustNewBalance) - Number(adjustTarget.balance) >= 0 ? accStyles.diffPositive : accStyles.diffNegative}>
                {parseFloat(adjustNewBalance) - Number(adjustTarget.balance) >= 0 ? '+' : ''}
                {fmt(parseFloat(adjustNewBalance) - Number(adjustTarget.balance), s)}
              </strong>
            </div>
          )}

          {adjustNewBalance !== '' && !isNaN(parseFloat(adjustNewBalance)) && (parseFloat(adjustNewBalance) - Number(adjustTarget.balance) !== 0) && (
            <label className={accStyles.reconcileLedgerCheck}>
              <input
                type="checkbox"
                className={accStyles.reconcileCheckbox}
                checked={adjustLogToHistory}
                onChange={e => setAdjustLogToHistory(e.target.checked)}
              />
              <div className={accStyles.reconcileCheckCopy}>
                <span className={accStyles.reconcileCheckTitle}>Log difference in Transaction History</span>
                <span className={accStyles.reconcileCheckSub}>
                  Automatically logs an adjustment entry so cashflow reports stay balanced
                </span>
              </div>
            </label>
          )}

          <div className={accStyles.modalActions}>
            <button type="button" className={accStyles.btnSecondary} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={accStyles.btnPrimary} disabled={adjustSaving}>
              {adjustSaving ? 'Updating…' : 'Save Balance'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
