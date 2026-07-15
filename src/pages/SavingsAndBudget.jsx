import { useState, useEffect, useMemo } from 'react'
import Budget from './Budget'
import Savings from './Savings'
import styles from './Page.module.css'
import tStyles from '../components/SharedTabs.module.css'
import { isTransactionPaid } from '../lib/finance'
import { isSameMonth, fmt } from '../lib/utils'

export default function SavingsAndBudget({ user, data, profile = {}, symbol, privacyMode = false, subTab = 'budget', actionRequest = null, onActionHandled = () => {} }) {
  const [activeTab, setActiveTab] = useState(subTab)

  useEffect(() => {
    if (subTab) {
      setActiveTab(subTab)
    }
  }, [subTab])

  const s = symbol || '₱'

  const { totalBudget, totalExpenses, totalSaved, totalTarget } = useMemo(() => {
    const now = new Date()
    const viewMonth = now.getMonth()
    const viewYear = now.getFullYear()
    
    const budgets = data?.budgets || []
    const expenses = data?.expenses || []
    const goals = data?.goals || []

    const budgetSum = budgets.reduce((sum, b) => sum + (b.limit || 0), 0)
    const expenseSum = expenses
      .filter(tx => isTransactionPaid(tx) && isSameMonth(tx.date, viewYear, viewMonth))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0)

    const savedSum = goals.reduce((sum, g) => sum + (Number(g.current) || 0), 0)
    const targetSum = goals.reduce((sum, g) => sum + (Number(g.target) || 0), 0)

    return {
      totalBudget: budgetSum,
      totalExpenses: expenseSum,
      totalSaved: savedSum,
      totalTarget: targetSum
    }
  }, [data?.budgets, data?.expenses, data?.goals])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Budgets & Savings</div>
        <div className={styles.sub}>Set category monthly budget limits and plan your savings target goals.</div>
      </div>

      <div className={tStyles.summaryStrip}>
        <div className={tStyles.summaryCard}>
          <div className={tStyles.summaryLabel}>Month Budget Limit</div>
          <div className={tStyles.summaryValue}>
            {privacyMode ? '••••' : fmt(totalBudget, s)}
          </div>
        </div>
        <div className={tStyles.summaryCard}>
          <div className={tStyles.summaryLabel}>Month Spent</div>
          <div className={`${tStyles.summaryValue} ${totalExpenses > totalBudget && totalBudget > 0 ? tStyles.summaryValueNegative : ''}`}>
            {privacyMode ? '••••' : fmt(totalExpenses, s)}
          </div>
        </div>
        <div className={tStyles.summaryCard}>
          <div className={tStyles.summaryLabel}>Total Goals Saved</div>
          <div className={`${tStyles.summaryValue} ${tStyles.summaryValuePositive}`}>
            {privacyMode ? '••••' : fmt(totalSaved, s)}
          </div>
        </div>
      </div>

      <div className={tStyles.tabsWrap}>
        <div className={tStyles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'budget'}
            className={`${tStyles.tab} ${activeTab === 'budget' ? tStyles.tabActive : ''}`}
            onClick={() => setActiveTab('budget')}
          >
            Monthly Budget
            <span className={tStyles.tabCount}>{(data?.budgets?.length || 0)}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'savings'}
            className={`${tStyles.tab} ${activeTab === 'savings' ? tStyles.tabActive : ''}`}
            onClick={() => setActiveTab('savings')}
          >
            Savings Goals
            <span className={tStyles.tabCount}>{(data?.goals?.length || 0)}</span>
          </button>
        </div>
      </div>

      {activeTab === 'budget' ? (
        <Budget
          user={user}
          data={data}
          profile={profile}
          symbol={symbol}
          privacyMode={privacyMode}
          hideHeader={true}
        />
      ) : (
        <Savings
          user={user}
          data={data}
          profile={profile}
          symbol={symbol}
          privacyMode={privacyMode}
          actionRequest={actionRequest}
          onActionHandled={onActionHandled}
          hideHeader={true}
        />
      )}
    </div>
  )
}
