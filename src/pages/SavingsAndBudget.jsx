import { useState, useEffect } from 'react'
import Budget from './Budget'
import Savings from './Savings'
import styles from './Page.module.css'

export default function SavingsAndBudget({ user, data, profile = {}, symbol, privacyMode = false, subTab = 'budget', actionRequest = null, onActionHandled = () => {} }) {
  const [activeTab, setActiveTab] = useState(subTab)

  useEffect(() => {
    if (subTab) {
      setActiveTab(subTab)
    }
  }, [subTab])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Budgets</div>
        <div className={styles.sub}>Set category monthly budget limits and plan your savings target goals.</div>
      </div>

      <div style={{
        display: 'inline-flex',
        background: 'var(--surface2)',
        border: '1px solid var(--border2)',
        borderRadius: '14px',
        padding: '3px',
        marginBottom: '20px',
        width: 'fit-content'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('budget')}
          style={{
            minHeight: '34px',
            padding: '0 20px',
            fontSize: '13px',
            fontWeight: 800,
            borderRadius: '11px',
            border: 'none',
            background: activeTab === 'budget' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'budget' ? 'var(--text)' : 'var(--text3)',
            cursor: 'pointer',
            boxShadow: activeTab === 'budget' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.16s ease'
          }}
        >
          Monthly Budget
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('savings')}
          style={{
            minHeight: '34px',
            padding: '0 20px',
            fontSize: '13px',
            fontWeight: 800,
            borderRadius: '11px',
            border: 'none',
            background: activeTab === 'savings' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'savings' ? 'var(--text)' : 'var(--text3)',
            cursor: 'pointer',
            boxShadow: activeTab === 'savings' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.16s ease'
          }}
        >
          Savings Goals
        </button>
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
