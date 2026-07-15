import { useMemo, useState } from 'react'
import { fsUpdateTransaction } from '../lib/firestore'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import { RECUR_OPTIONS, fmt, playTick, formatDisplayDate } from '../lib/utils'
import styles from './Page.module.css'
import sStyles from './Recurring.module.css'
import { getRecurringOccurrenceKey } from '../lib/recurrence'
import Bills from './Bills'

export default function Recurring({ user, data, symbol, billPaymentTarget }) {
  const s = symbol || '₱'
  
  // Default to bills tab if arriving via a bill payment deep-link, otherwise check localStorage or default to bills
  const initialTab = billPaymentTarget ? 'bills' : (localStorage.getItem('takda_recurring_tab') || 'bills')
  const [activeTab, setActiveTab] = useState(initialTab)

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    localStorage.setItem('takda_recurring_tab', tab)
  }

  // --- Aggregate Recurring Transactions ---
  // Any transaction (expense or income) with a `recur` field set is tracked here
  const { calendarBills, subscriptions, recurringIncome } = useMemo(() => {
    const allTx = [...(data?.income || []), ...(data?.expenses || [])]
    const chains = {}
    
    allTx.forEach(tx => {
      const chainId = tx.recurrenceSourceId || tx._id
      if (!chains[chainId]) chains[chainId] = []
      chains[chainId].push(tx)
    })
    
    const active = []
    Object.values(chains).forEach(chain => {
      // Sort by actual date descending to find the latest
      chain.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      const latest = chain[0]
      // Only include if it has an active recur rule
      if (latest.recur) {
        active.push(latest)
      }
    })
    
    const cBills = []
    const subs = []
    const rIncome = []
    
    active.forEach(tx => {
      if (tx.type === 'income') {
        rIncome.push(tx)
      } else {
        if (tx.cat === 'Bills' && tx.subcat !== 'Subscriptions') {
          cBills.push(tx)
        } else {
          subs.push(tx)
        }
      }
    })
    
    // Sort each group by amount descending
    const sortByAmount = (a, b) => b.amount - a.amount
    cBills.sort(sortByAmount)
    subs.sort(sortByAmount)
    rIncome.sort(sortByAmount)
    
    return { calendarBills: cBills, subscriptions: subs, recurringIncome: rIncome }
  }, [data?.income, data?.expenses])

  async function handleStopRecurrence(tx) {
    playTick()
    const confirmed = await confirmApp({
      title: 'Stop recurring?',
      message: `Stop the recurring rule for ${tx.desc || tx.cat}? This won't delete past records, but the auto-engine will stop generating future cycles.`,
      confirmLabel: 'Stop recurring',
      cancelLabel: 'Keep active',
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      const col = tx.type === 'income' ? 'income' : 'expenses'
      await fsUpdateTransaction(user.uid, col, tx, { recur: '' }, data.accounts)
      notifyApp({
        title: 'Recurrence stopped',
        message: `${tx.desc || tx.cat} will no longer recur.`,
        tone: 'success'
      })
    } catch (err) {
      console.error(err)
      notifyApp({
        title: 'Error',
        message: 'Could not update recurrence right now.',
        tone: 'error'
      })
    }
  }

  const renderSubCard = (tx) => {
    const freqLabel = RECUR_OPTIONS.find(o => o.value === tx.recur)?.label || tx.recur
    const isIncome = tx.type === 'income'
    const occurrenceDate = getRecurringOccurrenceKey(tx) || tx.date
    
    return (
      <div key={tx._id} className={sStyles.subCard}>
        <div className={sStyles.subCardHeader}>
          <div>
            <h4 className={sStyles.subCardTitle}>{tx.desc || tx.cat}</h4>
            <span className={sStyles.subCardSubcat}>{tx.subcat || tx.cat}</span>
          </div>
          <span className={isIncome ? sStyles.badgeIncome : sStyles.badgeExpense}>
            {isIncome ? 'Income' : 'Expense'}
          </span>
        </div>
        
        <div className={sStyles.subCardBody}>
          <div className={sStyles.subCardDetail}>
            <span className={sStyles.detailLabel}>Amount</span>
            <strong className={isIncome ? sStyles.amountIncome : sStyles.amountExpense}>
              {isIncome ? '+' : '-'}{fmt(tx.amount, s)}
            </strong>
          </div>
          <div className={sStyles.subCardDetail}>
            <span className={sStyles.detailLabel}>Frequency</span>
            <span className={sStyles.detailValue}>{freqLabel}</span>
          </div>
          <div className={sStyles.subCardDetail}>
            <span className={sStyles.detailLabel}>Last recorded</span>
            <span className={sStyles.detailValue}>{formatDisplayDate(occurrenceDate)}</span>
          </div>
        </div>
        
        <div className={sStyles.subCardFooter}>
          <button type="button" className={sStyles.stopBtn} onClick={() => handleStopRecurrence(tx)}>
            Stop recurring
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Recurring</div>
        <div className={styles.sub}>
          Manage all your recurring obligations in one place.
        </div>
      </div>

      <div className={sStyles.tabsWrap}>
        <div className={sStyles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bills'}
            className={`${sStyles.tab} ${activeTab === 'bills' ? sStyles.tabActive : ''}`}
            onClick={() => handleTabChange('bills')}
          >
            Bills
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'subscriptions'}
            className={`${sStyles.tab} ${activeTab === 'subscriptions' ? sStyles.tabActive : ''}`}
            onClick={() => handleTabChange('subscriptions')}
          >
            Subscriptions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'income'}
            className={`${sStyles.tab} ${activeTab === 'income' ? sStyles.tabActive : ''}`}
            onClick={() => handleTabChange('income')}
          >
            Income
          </button>
        </div>
      </div>

      {activeTab === 'bills' && (
        <div>
          <Bills user={user} data={data} symbol={symbol} billPaymentTarget={billPaymentTarget} embedded={true} />
          
          {calendarBills.length > 0 && (
            <div style={{ marginTop: '40px' }}>
              <div className={sStyles.sectionTitle}>Auto-generated Bills</div>
              <div className={sStyles.sectionDesc}>
                These recurring expenses were tracked automatically from your calendar. They are not manually paid bills.
              </div>
              <div className={sStyles.subGrid}>
                {calendarBills.map(renderSubCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div>
          <div className={sStyles.sectionTitle}>Subscriptions & Services</div>
          <div className={sStyles.sectionDesc}>
            Auto-charged recurring expenses like Netflix, Spotify, or gym memberships.
          </div>
          
          <div className={sStyles.subGrid}>
            {subscriptions.length > 0 ? (
              subscriptions.map(renderSubCard)
            ) : (
              <div className={sStyles.emptyState}>
                <h4>No active subscriptions</h4>
                <p>Any recurring expense that isn't a bill will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'income' && (
        <div>
          <div className={sStyles.sectionTitle}>Recurring Income</div>
          <div className={sStyles.sectionDesc}>
            Expected income like salary, retainers, or regular allowances.
          </div>
          
          <div className={sStyles.subGrid}>
            {recurringIncome.length > 0 ? (
              recurringIncome.map(renderSubCard)
            ) : (
              <div className={sStyles.emptyState}>
                <h4>No active recurring income</h4>
                <p>Add your salary to the calendar as a recurring income to see it here.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
