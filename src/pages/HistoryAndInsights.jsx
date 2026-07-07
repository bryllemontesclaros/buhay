import { useState, useEffect } from 'react'
import History from './History'
import Breakdown from './Breakdown'
import styles from './Page.module.css'

export default function HistoryAndInsights({ user, data, profile = {}, symbol, privacyMode = false, subTab = 'history' }) {
  const [activeTab, setActiveTab] = useState(subTab)

  useEffect(() => {
    if (subTab) {
      setActiveTab(subTab)
    }
  }, [subTab])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>History & Insights</div>
        <div className={styles.sub}>Review transaction history ledger records and analyze visual cash flow distributions.</div>
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
          onClick={() => setActiveTab('history')}
          style={{
            minHeight: '34px',
            padding: '0 20px',
            fontSize: '13px',
            fontWeight: 800,
            borderRadius: '11px',
            border: 'none',
            background: activeTab === 'history' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'history' ? 'var(--text)' : 'var(--text3)',
            cursor: 'pointer',
            boxShadow: activeTab === 'history' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.16s ease'
          }}
        >
          Transaction Ledger
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('insights')}
          style={{
            minHeight: '34px',
            padding: '0 20px',
            fontSize: '13px',
            fontWeight: 800,
            borderRadius: '11px',
            border: 'none',
            background: activeTab === 'insights' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'insights' ? 'var(--text)' : 'var(--text3)',
            cursor: 'pointer',
            boxShadow: activeTab === 'insights' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.16s ease'
          }}
        >
          Analytics Insights
        </button>
      </div>

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
