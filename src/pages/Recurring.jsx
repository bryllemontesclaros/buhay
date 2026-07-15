import { useMemo, useState } from 'react'
import { fsUpdateTransaction } from '../lib/firestore'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import { RECUR_OPTIONS, fmt, playTick, formatDisplayDate } from '../lib/utils'
import styles from './Page.module.css'
import sStyles from './Recurring.module.css'
import { getRecurringOccurrenceKey } from '../lib/recurrence'
import Bills from './Bills'

function getMonthlyEquivalent(amount, freq = 'monthly') {
  const numericAmount = Number(amount) || 0
  if (!numericAmount) return 0
  switch (freq) {
    case 'weekly': return (numericAmount * 52) / 12
    case 'bi-weekly':
    case 'biweekly': return (numericAmount * 26) / 12
    case 'tri-weekly': return (numericAmount * (365 / 21)) / 12
    case 'quad-weekly': return (numericAmount * (365 / 28)) / 12
    case 'semi-monthly': return (numericAmount * 24) / 12
    case 'yearly':
    case 'annually': return numericAmount / 12
    case 'quarterly': return numericAmount / 3
    case 'daily': return numericAmount * 30.4
    case 'monthly':
    default:
      return numericAmount
  }
}

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
  const { calendarBills, subscriptions, recurringIncome, totals } = useMemo(() => {
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
    
    let obligationsMonthly = 0
    let incomeMonthly = 0
    
    active.forEach(tx => {
      const monthlyEquiv = getMonthlyEquivalent(tx.amount, tx.recur)
      if (tx.type === 'income') {
        rIncome.push(tx)
        incomeMonthly += monthlyEquiv
      } else {
        obligationsMonthly += monthlyEquiv
        if (tx.cat === 'Bills' && tx.subcat !== 'Subscriptions') {
          cBills.push(tx)
        } else {
          subs.push(tx)
        }
      }
    })
    
    // Add manual bills to obligations
    if (data?.bills) {
      data.bills.forEach(bill => {
        obligationsMonthly += getMonthlyEquivalent(bill.amount, bill.freq)
      })
    }
    
    // Sort each group by amount descending
    const sortByAmount = (a, b) => b.amount - a.amount
    cBills.sort(sortByAmount)
    subs.sort(sortByAmount)
    rIncome.sort(sortByAmount)
    
    return { 
      calendarBills: cBills, 
      subscriptions: subs, 
      recurringIncome: rIncome,
      totals: {
        obligations: obligationsMonthly,
        income: incomeMonthly,
        net: incomeMonthly - obligationsMonthly
      }
    }
  }, [data?.income, data?.expenses, data?.bills])

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

  const renderRowItem = (tx) => {
    const freqLabel = RECUR_OPTIONS.find(o => o.value === tx.recur)?.label || tx.recur
    const isIncome = tx.type === 'income'
    const occurrenceDate = getRecurringOccurrenceKey(tx) || tx.date
    
    return (
      <div key={tx._id} className={sStyles.rowItem}>
        <div className={sStyles.rowTop}>
          <div className={sStyles.rowLeft}>
            <div className={`${sStyles.iconWrap} ${isIncome ? sStyles.iconIncome : sStyles.iconExpense}`}>
              {isIncome ? '💰' : '🔄'}
            </div>
            <div className={sStyles.rowInfo}>
              <h4 className={sStyles.rowTitle} title={tx.desc || tx.cat}>{tx.desc || tx.cat}</h4>
              <div className={sStyles.rowMeta}>
                <span className={`${sStyles.badge} ${isIncome ? sStyles.badgeIncome : sStyles.badgeExpense}`}>
                  {isIncome ? 'Income' : 'Expense'}
                </span>
                <span className={`${sStyles.badge} ${sStyles.badgeFreq}`}>{freqLabel}</span>
              </div>
            </div>
          </div>
          <div className={`${sStyles.rowAmount} ${isIncome ? sStyles.amountIncome : sStyles.amountExpense}`}>
            {isIncome ? '+' : '-'}{fmt(tx.amount, s)}
          </div>
        </div>
        
        <div className={sStyles.rowBottom}>
          <div className={sStyles.lastRecorded}>
            <span role="img" aria-label="calendar">📅</span> 
            Last: {formatDisplayDate(occurrenceDate)}
          </div>
          <button type="button" className={sStyles.stopBtn} onClick={() => handleStopRecurrence(tx)}>
            Stop
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
          Manage all your recurring obligations and income.
        </div>
      </div>

      <div className={sStyles.summaryStrip}>
        <div className={sStyles.summaryCard}>
          <div className={sStyles.summaryLabel}>
            Monthly Obligations
          </div>
          <div className={sStyles.summaryValue}>
            {fmt(totals.obligations, s)}
          </div>
        </div>
        <div className={sStyles.summaryCard}>
          <div className={sStyles.summaryLabel}>
            Monthly Income
          </div>
          <div className={`${sStyles.summaryValue} ${sStyles.summaryValuePositive}`}>
            {fmt(totals.income, s)}
          </div>
        </div>
        <div className={sStyles.summaryCard}>
          <div className={sStyles.summaryLabel}>
            Net Recurring
          </div>
          <div className={`${sStyles.summaryValue} ${totals.net >= 0 ? sStyles.summaryValuePositive : ''}`}>
            {totals.net >= 0 ? '+' : '-'}{fmt(Math.abs(totals.net), s)}
          </div>
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
            <span className={sStyles.tabCount}>{(data?.bills?.length || 0) + calendarBills.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'subscriptions'}
            className={`${sStyles.tab} ${activeTab === 'subscriptions' ? sStyles.tabActive : ''}`}
            onClick={() => handleTabChange('subscriptions')}
          >
            Subscriptions
            <span className={sStyles.tabCount}>{subscriptions.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'income'}
            className={`${sStyles.tab} ${activeTab === 'income' ? sStyles.tabActive : ''}`}
            onClick={() => handleTabChange('income')}
          >
            Income
            <span className={sStyles.tabCount}>{recurringIncome.length}</span>
          </button>
        </div>
      </div>

      {activeTab === 'bills' && (
        <div className={sStyles.billsWrapper}>
          <Bills user={user} data={data} symbol={symbol} billPaymentTarget={billPaymentTarget} embedded={true} />
          
          {calendarBills.length > 0 && (
            <div>
              <div className={sStyles.billsDivider} />
              <div className={sStyles.groupHeader}>
                <h3 className={sStyles.groupTitle}>Auto-generated Bills</h3>
                <span className={sStyles.groupDesc}>Tracked from your calendar</span>
              </div>
              <div className={sStyles.listLayout}>
                {calendarBills.map(renderRowItem)}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div>
          <div className={sStyles.groupHeader}>
            <h3 className={sStyles.groupTitle}>Subscriptions & Services</h3>
            <span className={sStyles.groupDesc}>Auto-charged recurring expenses</span>
          </div>
          
          <div className={sStyles.listLayout}>
            {subscriptions.length > 0 ? (
              subscriptions.map(renderRowItem)
            ) : (
              <div className={sStyles.emptyState}>
                <div className={sStyles.emptyStateIcon}>🔄</div>
                <h4>No active subscriptions</h4>
                <p>Any recurring expense from your calendar that isn't a bill will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'income' && (
        <div>
          <div className={sStyles.groupHeader}>
            <h3 className={sStyles.groupTitle}>Recurring Income</h3>
            <span className={sStyles.groupDesc}>Expected income like salary or retainers</span>
          </div>
          
          <div className={sStyles.listLayout}>
            {recurringIncome.length > 0 ? (
              recurringIncome.map(renderRowItem)
            ) : (
              <div className={sStyles.emptyState}>
                <div className={sStyles.emptyStateIcon}>💰</div>
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
