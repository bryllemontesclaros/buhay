import { useState, useEffect, useMemo } from 'react'
import History from './History'
import Breakdown from './Breakdown'
import styles from './Page.module.css'
import tStyles from '../components/SharedTabs.module.css'
import { isTransactionPaid } from '../lib/finance'
import { isSameMonth, fmt } from '../lib/utils'

export default function HistoryAndInsights({ user, data, profile = {}, symbol, privacyMode = false, subTab = 'history' }) {
  const [activeTab, setActiveTab] = useState(subTab)

  useEffect(() => {
    if (subTab) {
      setActiveTab(subTab)
    }
  }, [subTab])

  const s = symbol || '₱'

  const { totalIncome, totalExpenses, net } = useMemo(() => {
    const now = new Date()
    const viewMonth = now.getMonth()
    const viewYear = now.getFullYear()

    const income = data?.income || []
    const expenses = data?.expenses || []

    const incomeSum = income
      .filter(tx => isTransactionPaid(tx) && isSameMonth(tx.date, viewYear, viewMonth))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0)

    const expenseSum = expenses
      .filter(tx => isTransactionPaid(tx) && isSameMonth(tx.date, viewYear, viewMonth))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0)

    return {
      totalIncome: incomeSum,
      totalExpenses: expenseSum,
      net: incomeSum - expenseSum
    }
  }, [data?.income, data?.expenses])

  const ledgerCount = (data?.income?.length || 0) + (data?.expenses?.length || 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Insights & History</div>
        <div className={styles.sub}>Review transaction history ledger records and analyze visual cash flow distributions.</div>
      </div>

      <div className={tStyles.tabsWrap}>
        <div className={tStyles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            className={`${tStyles.tab} ${activeTab === 'history' ? tStyles.tabActive : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Transaction Ledger
            <span className={tStyles.tabCount}>{ledgerCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'insights'}
            className={`${tStyles.tab} ${activeTab === 'insights' ? tStyles.tabActive : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            Analytics Insights
          </button>
        </div>
      </div>

      {activeTab === 'history' && (
        <div className={tStyles.summaryStrip}>
          <div className={tStyles.summaryCard}>
            <div className={tStyles.summaryLabel}>Month Income</div>
            <div className={`${tStyles.summaryValue} ${tStyles.summaryValuePositive}`}>
              {privacyMode ? '••••' : fmt(totalIncome, s)}
            </div>
          </div>
          <div className={tStyles.summaryCard}>
            <div className={tStyles.summaryLabel}>Month Expenses</div>
            <div className={`${tStyles.summaryValue} ${tStyles.summaryValueNegative}`}>
              {privacyMode ? '••••' : fmt(totalExpenses, s)}
            </div>
          </div>
          <div className={tStyles.summaryCard}>
            <div className={tStyles.summaryLabel}>Month Net Flow</div>
            <div className={`${tStyles.summaryValue} ${net >= 0 ? tStyles.summaryValuePositive : tStyles.summaryValueNegative}`}>
              {privacyMode ? '••••' : fmt(net, s)}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' ? (
        <History
          user={user}
          data={data}
          symbol={symbol}
          privacyMode={privacyMode}
          hideHeader={true}
        />
      ) : (
        <Breakdown
          data={data}
          profile={profile}
          symbol={symbol}
          privacyMode={privacyMode}
          hideHeader={true}
        />
      )}
    </div>
  )
}
