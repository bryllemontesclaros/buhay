import { useState, useEffect } from 'react'
import Accounts from './Accounts'
import Debts from './Debts'
import styles from './Page.module.css'
import tStyles from '../components/SharedTabs.module.css'
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

  const totalAssets = assetAccounts.reduce((sum, acc) => sum + Math.max(0, Number(acc.balance) || 0), 0)
  const totalDebts = unlinkedDebts.reduce((sum, d) => sum + Math.abs(Number(d.balance) || 0), 0) +
                     creditCardAccounts.reduce((sum, acc) => sum + Math.abs(Number(acc.balance) || 0), 0)
  const netWorth = totalAssets - totalDebts

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Accounts & Debts</div>
        <div className={styles.sub}>Manage cash flow accounts, track card utilization, and plan debt payoff strategies.</div>
      </div>

      <div className={tStyles.summaryStrip}>
        <div className={tStyles.summaryCard}>
          <div className={tStyles.summaryLabel}>Total Cash Assets</div>
          <div className={`${tStyles.summaryValue} ${tStyles.summaryValuePositive}`}>
            {privacyMode ? '••••' : fmt(totalAssets, s)}
          </div>
        </div>
        <div className={tStyles.summaryCard}>
          <div className={tStyles.summaryLabel}>Total Debts & Cards</div>
          <div className={`${tStyles.summaryValue} ${tStyles.summaryValueNegative}`}>
            {privacyMode ? '••••' : fmt(totalDebts, s)}
          </div>
        </div>
        <div className={tStyles.summaryCard}>
          <div className={tStyles.summaryLabel}>Net Worth</div>
          <div className={`${tStyles.summaryValue} ${netWorth >= 0 ? tStyles.summaryValuePositive : tStyles.summaryValueNegative}`}>
            {privacyMode ? '••••' : fmt(netWorth, s)}
          </div>
        </div>
      </div>

      <div className={tStyles.tabsWrap}>
        <div className={tStyles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'accounts'}
            className={`${tStyles.tab} ${activeTab === 'accounts' ? tStyles.tabActive : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            Asset Accounts
            <span className={tStyles.tabCount}>{accounts.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'debts'}
            className={`${tStyles.tab} ${activeTab === 'debts' ? tStyles.tabActive : ''}`}
            onClick={() => setActiveTab('debts')}
          >
            Debt Payoffs
            <span className={tStyles.tabCount}>{debts.length}</span>
          </button>
        </div>
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
