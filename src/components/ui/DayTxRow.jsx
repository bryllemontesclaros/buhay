import calStyles from '../../pages/Calendar.module.css'
import { getTakdaTransactionLifecycle } from '../../lib/finance'
import { formatFullCellBalance as fmt, today } from '../../lib/utils'

export function DayTxRow({
  t,
  s,
  privacyMode,
  onEdit,
  onDelete,
  onTogglePaymentStatus,
  onSettleProjectedNow,
  onOpenRecurringDateEditor,
  onLogProjected,
  onEditRecurrence,
  recurringActionPending = false,
  locked = false,
  accountLabel = '',
  animationDelay = '0ms',
}) {
  if (!t) return null
  const isIncome = t?.type === 'income'
  const lifecycle = getTakdaTransactionLifecycle(t || {}, today())
  const isPaid = lifecycle.paid
  const isProjected = lifecycle.projected
  const classification = [t.cat, t.subcat].filter(Boolean).join(' · ')
  const metaParts = [
    classification || t.cat,
    accountLabel,
    t.recur ? `every ${t.recur}` : null,
  ].filter(Boolean)
  const metaSubtitle = metaParts.join(' · ')

  return (
    <div
      className={`${calStyles.txRow} ${calStyles.dayTxRowStaggered} ${isPaid ? '' : calStyles.txRowUnpaid} ${isProjected ? calStyles.projectedTxRow : ''}`}
      style={{ animationDelay }}
    >
      <div className={calStyles.txLeft}>
        <div
          className={calStyles.txIcon}
          style={{
            background: isIncome ? 'color-mix(in srgb, #30d158 16%, transparent)' : 'color-mix(in srgb, #ff453a 16%, transparent)',
            color: isIncome ? '#30d158' : '#ff453a',
          }}
        >
          {isIncome ? '+' : '−'}
        </div>
        <div className={calStyles.txInfoBlock}>
          <div className={calStyles.txDesc}>
            {t.desc || t.cat}
            {t._projected && <span className={calStyles.projBadge}>recurring</span>}
          </div>
          <div className={calStyles.txMeta} title={metaSubtitle}>
            {metaSubtitle}
          </div>
        </div>
      </div>
      <div className={`${calStyles.txRight} ${isProjected ? calStyles.projectedTxRight : ''}`}>
        <div className={`${calStyles.txAmount} ${privacyMode ? calStyles.privacyValueInline : ''} ${isProjected ? calStyles.projectedTxAmount : ''}`} style={{ color: privacyMode ? 'var(--text3)' : (isIncome ? '#30d158' : '#ff453a') }}>
          {privacyMode ? 'Hidden' : `${isIncome ? '+' : '−'}${fmt(t.amount, s)}`}
        </div>
        {t._projected ? (
          <div className={calStyles.projectedActionStack}>
            <div className={calStyles.projectedActionRowPrimary}>
              <button
                type="button"
                className={`${calStyles.logBtn} ${calStyles.primaryProjectedBtn}`}
                onClick={() => onSettleProjectedNow?.(t)}
                aria-label={`${isIncome ? 'Record' : 'Pay'} ${t.desc || t.cat} now`}
                disabled={locked || recurringActionPending}
                style={recurringActionPending
                  ? undefined
                  : {
                    background: isIncome ? '#30d158' : '#ff453a',
                    borderColor: isIncome ? '#30d158' : '#ff453a',
                    color: '#ffffff',
                  }}
              >
                {recurringActionPending ? 'Saving...' : isIncome ? 'Record now' : 'Pay now'}
              </button>
            </div>
            <details className={calStyles.txActionDetails}>
              <summary className={calStyles.txActionSummary}>
                <span>More options</span>
                <small>Change date or recurrence</small>
              </summary>
              <div className={calStyles.txActionGrid}>
                <button
                  type="button"
                  className={`${calStyles.logBtn} ${calStyles.secondaryProjectedBtn}`}
                  onClick={() => onOpenRecurringDateEditor?.(t)}
                  aria-label={`Choose another date for ${t.desc || t.cat}`}
                  disabled={locked || recurringActionPending}
                >
                  Choose date
                </button>
                <button
                  type="button"
                  className={`${calStyles.logBtn} ${calStyles.tertiaryProjectedBtn}`}
                  onClick={() => onLogProjected?.(t)}
                  aria-label={`Keep the scheduled date for ${t.desc || t.cat}`}
                  disabled={locked || recurringActionPending}
                >
                  Keep due date
                </button>
                <button
                  type="button"
                  className={calStyles.recurBtn}
                  onClick={() => onEditRecurrence?.(t)}
                  aria-label={`Edit recurrence for ${t.desc || t.cat}`}
                  disabled={locked || recurringActionPending}
                >
                  Edit recurrence
                </button>
              </div>
            </details>
          </div>
        ) : (
          <div className={calStyles.txActions}>
            <button
              type="button"
              className={`${calStyles.statusBtn} ${isPaid ? calStyles.statusBtnPaid : calStyles.statusBtnUnpaid}`}
              onClick={() => onTogglePaymentStatus(t)}
              aria-label={`${isPaid ? 'Mark unpaid' : 'Mark paid'} for ${t.desc || t.cat}`}
              disabled={locked}
            >
              {isPaid ? 'Paid' : 'Unpaid'}
            </button>
            <button
              type="button"
              className={calStyles.editBtn}
              onClick={() => onEdit(t)}
              aria-label={`Edit ${t.desc || t.cat}`}
              title="Edit transaction"
              disabled={locked}
            >
              ✏️
            </button>
            <button
              type="button"
              className={calStyles.delBtnSm}
              onClick={() => onDelete(t)}
              aria-label={`Delete ${t.desc || t.cat}`}
              title="Delete transaction"
              disabled={locked}
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
