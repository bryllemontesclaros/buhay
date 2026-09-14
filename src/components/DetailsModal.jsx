import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { isTransactionPaid } from '../lib/finance'
import { displayValue, fmt, formatDisplayDate, maskMoney } from '../lib/utils'
import styles from './DetailsModal.module.css'

const CAT_EMOJIS = {
  'Food & Dining': '🍔',
  'Transport': '🚗',
  'Shopping': '🛍️',
  'Health': '💊',
  'Entertainment': '🍿',
  'Personal Care': '✨',
  'Education': '📚',
  'Bills': '💡',
  'Salary': '💰',
  'Freelance': '💻',
  'Business': '🏢',
  'Investment': '📈',
  '13th Month': '🎁',
  'Bonus': '🎉',
  'Transfer': '⇄',
  'Debt Payment': '💳',
  'Other': '🏷️',
}

function getCategoryEmoji(cat, type) {
  if (type === 'transfer') return '⇄'
  return CAT_EMOJIS[cat] || (type === 'income' ? '💰' : '💳')
}

export default function DetailsModal({
  open,
  title,
  subtitle,
  onClose,
  sections,
  symbol = '₱',
  privacyMode = false,
  accountLookup = {},
  children,
}) {
  const panelRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return

    // Always start at the top so "blank sheet until scroll" never happens.
    panel.scrollTop = 0

    // Minimal focus management so mobile Safari doesn’t keep focus on the trigger button.
    try {
      panel.focus({ preventScroll: true })
    } catch {
      panel.focus()
    }
  }, [open])

  if (!open) return null

  const modal = (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={event => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <section
        ref={panelRef}
        tabIndex={-1}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Details'}
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape') onClose?.()
        }}
      >
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <div id={titleId} className={styles.title}>{title}</div>
            {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close details">
            Done
          </button>
        </div>

        <div className={styles.body}>
          {sections && sections.length > 0 ? (
            <div className={styles.sectionsWrap}>
              {sections.map(section => {
                const totalCount = (section.list || []).reduce((sum, [, items]) => sum + (items?.length || 0), 0)
                return (
                  <div key={section.label} className={styles.section}>
                    {sections.length > 1 && (
                      <div className={styles.sectionHeader}>
                        <span className={styles.sectionTitle}>{section.label}</span>
                        <span className={styles.sectionBadge}>{totalCount}</span>
                      </div>
                    )}
                    {!section.list || !section.list.length ? (
                      <div className={styles.emptyState}>No transactions recorded.</div>
                    ) : (
                      <div className={styles.dateList}>
                        {section.list.map(([day, items]) => {
                          const paidItems = (items || []).filter(isTransactionPaid)
                          const dayIncome = paidItems.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0)
                          const dayExpense = paidItems.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0)
                          const dayNet = dayIncome - dayExpense

                          return (
                            <div key={day} className={styles.dayGroup}>
                              <div className={styles.dayHeader}>
                                <div className={styles.dayHeaderLeft}>
                                  <span className={styles.dayLabel}>{formatDisplayDate(day)}</span>
                                  <span className={styles.dayBadge}>{(items || []).length}</span>
                                </div>
                                {dayIncome > 0 || dayExpense > 0 ? (
                                  <span
                                    className={styles.dayNet}
                                    style={{
                                      color: dayNet > 0 ? 'var(--income, #10b981)' : dayNet < 0 ? 'var(--expense, #ef4444)' : 'var(--text3)'
                                    }}
                                  >
                                    {displayValue(
                                      privacyMode,
                                      `${dayNet < 0 ? '−' : dayNet > 0 ? '+' : ''}${fmt(Math.abs(dayNet), symbol)}`,
                                      maskMoney(symbol)
                                    )}
                                  </span>
                                ) : null}
                              </div>
                              <div className={styles.itemsList}>
                                {(items || []).map((tx, idx) => {
                                  const isIncome = tx.type === 'income'
                                  const isTransfer = tx.type === 'transfer'
                                  const isPaid = isTransactionPaid(tx)
                                  const emoji = getCategoryEmoji(tx.cat, tx.type)
                                  const acc = tx.accountId && accountLookup ? accountLookup[tx.accountId] : null

                                  return (
                                    <div key={(tx._id || tx.id || 'tx') + idx} className={styles.txRow}>
                                      <div className={styles.txIcon}>{emoji}</div>
                                      <div className={styles.txMain}>
                                        <div className={styles.txDesc}>{tx.desc || tx.cat || (isTransfer ? 'Transfer' : 'Transaction')}</div>
                                        <div className={styles.txMeta}>
                                          {acc && <span className={styles.txAccount}>{acc.name}</span>}
                                          <span>{tx.cat}{tx.subcat ? ` · ${tx.subcat}` : ''}</span>
                                          {tx.type !== 'transfer' && (
                                            <span className={`${styles.txStatus} ${isPaid ? styles.txPaid : styles.txUnpaid}`}>
                                              {isPaid ? 'Paid ✓' : 'Unpaid'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className={`${styles.txAmount} ${isIncome ? styles.valIncome : isTransfer ? styles.valTransfer : styles.valExpense}`}>
                                        {displayValue(
                                          privacyMode,
                                          `${isIncome ? '+' : isTransfer ? '' : '−'}${fmt(tx.amount || 0, symbol)}`,
                                          maskMoney(symbol)
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            children
          )}
        </div>
      </section>
    </div>
  )

  // Portaling to <body> avoids mobile Safari/transform stacking bugs where `position: fixed`
  // elements act like they’re positioned inside the scrolling container.
  if (typeof document !== 'undefined') {
    return createPortal(modal, document.body)
  }

  return modal
}
