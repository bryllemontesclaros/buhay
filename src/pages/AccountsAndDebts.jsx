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

  const [cryptoPriceMap, setCryptoPriceMap] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('buhay_crypto_prices_v7') || localStorage.getItem('buhay_crypto_prices_v6')
        if (raw) return JSON.parse(raw)?.data || {}
      } catch {}
    }
    return {}
  })

  // Keep cryptoPriceMap in sync with localStorage updates
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('buhay_crypto_prices_v7') || localStorage.getItem('buhay_crypto_prices_v6')
        if (raw) {
          const parsed = JSON.parse(raw)?.data
          if (parsed) setCryptoPriceMap(parsed)
        }
      } catch {}
    }
  }, [holdings])

  const cashAssets = getTakdaTotalAssets(accounts, [])
  const totalAssets = getTakdaTotalAssets(accounts, holdings, cryptoPriceMap)
  const cryptoAssets = Math.max(0, totalAssets - cashAssets)
  const totalDebts = getTakdaTotalDebts(accounts, debts)
  const netWorth = totalAssets - totalDebts

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Accounts & Wealth</div>
        <div className={styles.sub}>Manage liquid cash accounts, track live crypto holdings, and plan debt payoff strategies.</div>
      </div>

      {/* UNIFIED WEALTH & NET WORTH HERO CARD */}
      <div className={tStyles.wealthHeroCard}>
        <div className={tStyles.wealthHeroTop}>
          <span className={tStyles.wealthHeroLabel}>Total Estimated Net Worth</span>
          <span className={tStyles.wealthHeroBadge}>
            {activeTab === 'accounts' ? 'Asset Accounts' : activeTab === 'crypto' ? 'Crypto Portfolio' : 'Debt Payoffs'}
          </span>
        </div>
        <div className={tStyles.wealthHeroVal}>
          {privacyMode ? '••••' : fmt(netWorth, s)}
        </div>

        <div className={tStyles.wealthBreakdownStrip}>
          <div className={tStyles.wealthMiniStat}>
            <span className={tStyles.wealthMiniLabel}>💵 Cash Assets</span>
            <span className={tStyles.wealthMiniVal}>{privacyMode ? '••••' : fmt(cashAssets, s)}</span>
          </div>
          <div className={tStyles.wealthMiniDivider} />
          <div className={tStyles.wealthMiniStat}>
            <span className={tStyles.wealthMiniLabel}>🪙 Crypto Assets</span>
            <span className={tStyles.wealthMiniVal}>{privacyMode ? '••••' : fmt(cryptoAssets, s)}</span>
          </div>
          <div className={tStyles.wealthMiniDivider} />
          <div className={tStyles.wealthMiniStat}>
            <span className={tStyles.wealthMiniLabel}>💳 Total Debts</span>
            <span className={`${tStyles.wealthMiniVal} ${totalDebts > 0 ? tStyles.wealthMiniValDebt : ''}`}>
              {privacyMode ? '••••' : fmt(totalDebts, s)}
            </span>
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
        <Accounts
          user={user}
          data={data}
          profile={profile}
          symbol={symbol}
          privacyMode={privacyMode}
          onTogglePrivacy={onTogglePrivacy}
          hideHeader={true}
        />
      ) : activeTab === 'crypto' ? (
        <CryptoPortfolio
          user={user}
          data={data}
          profile={profile}
          privacyMode={privacyMode}
          onTogglePrivacy={onTogglePrivacy}
          hideHeader={true}
        />
      ) : (
        <Debts
          user={user}
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

