import { useState, useEffect } from 'react'
import Accounts from './Accounts'
import Debts from './Debts'
import CryptoPortfolio from './CryptoPortfolio'
import styles from './Page.module.css'
import tStyles from '../components/SharedTabs.module.css'
import { fmt } from '../lib/utils'
import { getTakdaTotalAssets, getTakdaTotalDebts, getTakdaNetWorth } from '../lib/finance'

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
  const holdings = Array.isArray(data?.portfolioHoldings) ? data.portfolioHoldings : []

  const cashAssets = getTakdaTotalAssets(accounts, [])
  const totalAssets = getTakdaTotalAssets(accounts, holdings)
  const cryptoAssets = Math.max(0, totalAssets - cashAssets)
  const totalDebts = getTakdaTotalDebts(accounts, debts)
  const netWorth = totalAssets - totalDebts

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Accounts & Wealth</div>
        <div className={styles.sub}>Manage liquid cash accounts, track live crypto holdings, and plan debt payoff strategies.</div>
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
            aria-selected={activeTab === 'crypto'}
            className={`${tStyles.tab} ${activeTab === 'crypto' ? tStyles.tabActive : ''}`}
            onClick={() => setActiveTab('crypto')}
          >
            Crypto 🪙
            <span className={tStyles.tabCount}>{holdings.length}</span>
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
        <>
          <div className={tStyles.summaryStrip}>
            <div className={tStyles.summaryCard}>
              <div className={tStyles.summaryLabel}>Total Cash Assets</div>
              <div className={`${tStyles.summaryValue} ${tStyles.summaryValuePositive}`}>
                {privacyMode ? '••••' : fmt(cashAssets, s)}
              </div>
            </div>
            <div className={tStyles.summaryCard}>
              <div className={tStyles.summaryLabel}>Crypto Assets</div>
              <div className={`${tStyles.summaryValue} ${cryptoAssets > 0 ? tStyles.summaryValuePositive : ''}`}>
                {privacyMode ? '••••' : fmt(cryptoAssets, s)}
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
          <Accounts
            user={user}
            data={data}
            profile={profile}
            symbol={symbol}
            privacyMode={privacyMode}
            onTogglePrivacy={onTogglePrivacy}
            hideHeader={true}
          />
        </>
      ) : activeTab === 'crypto' ? (
        <CryptoPortfolio
          user={user}
          data={data}
          profile={profile}
          privacyMode={privacyMode}
          onTogglePrivacy={onTogglePrivacy}
        />
      ) : (
        <>
          <div className={tStyles.summaryStrip}>
            <div className={tStyles.summaryCard}>
              <div className={tStyles.summaryLabel}>Total Debts & Cards</div>
              <div className={`${tStyles.summaryValue} ${tStyles.summaryValueNegative}`}>
                {privacyMode ? '••••' : fmt(totalDebts, s)}
              </div>
            </div>
            <div className={tStyles.summaryCard}>
              <div className={tStyles.summaryLabel}>Total Cash Assets</div>
              <div className={`${tStyles.summaryValue} ${tStyles.summaryValuePositive}`}>
                {privacyMode ? '••••' : fmt(cashAssets, s)}
              </div>
            </div>
            <div className={tStyles.summaryCard}>
              <div className={tStyles.summaryLabel}>Net Worth</div>
              <div className={`${tStyles.summaryValue} ${netWorth >= 0 ? tStyles.summaryValuePositive : tStyles.summaryValueNegative}`}>
                {privacyMode ? '••••' : fmt(netWorth, s)}
              </div>
            </div>
          </div>
          <Debts
            user={user}
            data={data}
            profile={profile}
            symbol={symbol}
            privacyMode={privacyMode}
            hideHeader={true}
          />
        </>
      )}
    </div>
  )
}

