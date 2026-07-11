import { useState, useEffect } from 'react'
import Accounts from './Accounts'
import Debts from './Debts'
import styles from './Page.module.css'
import { fmt } from '../lib/utils'

export default function AccountsAndDebts({ user, data, profile = {}, symbol, privacyMode = false, onTogglePrivacy = () => {}, subTab = 'accounts' }) {
  const [activeTab, setActiveTab] = useState(subTab)

  useEffect(() => {
    if (subTab) {
      setActiveTab(subTab)
    }
  }, [subTab])

  const s = symbol || '₱'
  
  const accounts = Array.isArray(data?.accounts) ? data.accounts : []
  const debts = Array.isArray(data?.debts) ? data.debts : []

  const assetAccounts = accounts.filter(acc => acc.type !== 'Credit Card')
  const creditCardAccounts = accounts.filter(acc => acc.type === 'Credit Card')

  const accountIds = new Set(accounts.map(a => a._id))
  const unlinkedDebts = debts.filter(d => !d.accountId || !accountIds.has(d.accountId))

  const totalAssets = assetAccounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0)
  const totalDebts = unlinkedDebts.reduce((sum, d) => sum + (Number(d.balance) || 0), 0) +
                     creditCardAccounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0)
  const netWorth = totalAssets - totalDebts

  return (
    <div className={styles.page}>
      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className={styles.title}>Accounts & Debts</div>
          <div className={styles.sub}>Manage cash flow accounts, track card utilization, and plan debt payoff strategies.</div>
        </div>
        
        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border2)',
          borderRadius: '16px',
          padding: '12px 18px',
          minWidth: '220px',
          textAlign: 'right'
        }}>
          <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.5px' }}>Net Worth</span>
          <div style={{ fontSize: '22px', fontWeight: 900, color: netWorth >= 0 ? 'var(--accent)' : 'var(--red)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            {privacyMode ? '••••' : fmt(netWorth, s)}
          </div>
          <small style={{ fontSize: '10px', color: 'var(--text3)' }}>
            Cash {fmt(totalAssets, s)} · Debt {fmt(totalDebts, s)}
          </small>
        </div>
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
          onClick={() => setActiveTab('accounts')}
          style={{
            minHeight: '34px',
            padding: '0 20px',
            fontSize: '13px',
            fontWeight: 800,
            borderRadius: '11px',
            border: 'none',
            background: activeTab === 'accounts' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'accounts' ? 'var(--text)' : 'var(--text3)',
            cursor: 'pointer',
            boxShadow: activeTab === 'accounts' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.16s ease'
          }}
        >
          Asset Accounts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('debts')}
          style={{
            minHeight: '34px',
            padding: '0 20px',
            fontSize: '13px',
            fontWeight: 800,
            borderRadius: '11px',
            border: 'none',
            background: activeTab === 'debts' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'debts' ? 'var(--text)' : 'var(--text3)',
            cursor: 'pointer',
            boxShadow: activeTab === 'debts' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.16s ease'
          }}
        >
          Debt Payoffs
        </button>
      </div>

      {activeTab === 'accounts' ? (
        <Accounts
          user={user}
          data={data}
          profile={profile}
          symbol={symbol}
          privacyMode={privacyMode}
          onTogglePrivacy={onTogglePrivacy}
          hideHeader={true}
        />
      ) : (
        <Debts
          user={user}
          data={data}
          symbol={symbol}
          privacyMode={privacyMode}
          hideHeader={true}
        />
      )}
    </div>
  )
}
