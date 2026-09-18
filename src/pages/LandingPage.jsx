import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import RouteMeta from '../components/RouteMeta'
import BrandLogo from '../components/BrandLogo'
import { auth } from '../lib/firebase'
import styles from './LandingPageClean.module.css'

function LiveAppMockup() {
  const [netWorth, setNetWorth] = useState(482500)
  const [liquidCash, setLiquidCash] = useState(68240)
  const [budgetSpent, setBudgetSpent] = useState(18400)
  const budgetLimit = 25000
  const [txList, setTxList] = useState([
    { id: 1, name: 'Client Retainer Deposit', date: 'Today · 9:30 AM', amount: 45000, icon: '💵', pos: true },
    { id: 2, name: 'S&R Supermarket Haul', date: 'Today · 1:15 PM', amount: -3450, icon: '🛒', pos: false },
    { id: 3, name: 'Meralco Power Bill', date: 'Yesterday', amount: -3100, icon: '⚡', pos: false },
    { id: 4, name: 'Specialty Coffee & Snack', date: 'Yesterday', amount: -420, icon: '☕', pos: false },
  ])

  const handleSalary = () => {
    setNetWorth(prev => prev + 35000)
    setLiquidCash(prev => prev + 35000)
    setTxList(prev => [
      { id: Date.now(), name: 'Salary / Consulting Payout', date: 'Just now', amount: 35000, icon: '💰', pos: true },
      ...prev.slice(0, 4),
    ])
  }

  const handleFreelance = () => {
    setNetWorth(prev => prev + 18500)
    setLiquidCash(prev => prev + 18500)
    setTxList(prev => [
      { id: Date.now(), name: 'Freelance Design Milestone', date: 'Just now', amount: 18500, icon: '🎨', pos: true },
      ...prev.slice(0, 4),
    ])
  }

  const handleGrocery = () => {
    if (liquidCash <= 3000) return
    setNetWorth(prev => prev - 3450)
    setLiquidCash(prev => prev - 3450)
    setBudgetSpent(prev => Math.min(budgetLimit, prev + 3450))
    setTxList(prev => [
      { id: Date.now(), name: 'Supermarket Grocery Run', date: 'Just now', amount: -3450, icon: '🥦', pos: false },
      ...prev.slice(0, 4),
    ])
  }

  const handleCoffee = () => {
    if (liquidCash <= 500) return
    setNetWorth(prev => prev - 420)
    setLiquidCash(prev => prev - 420)
    setBudgetSpent(prev => Math.min(budgetLimit, prev + 420))
    setTxList(prev => [
      { id: Date.now(), name: 'Matcha Latte & Pastry', date: 'Just now', amount: -420, icon: '🍵', pos: false },
      ...prev.slice(0, 4),
    ])
  }

  const handleReset = () => {
    setNetWorth(482500)
    setLiquidCash(68240)
    setBudgetSpent(18400)
    setTxList([
      { id: 1, name: 'Client Retainer Deposit', date: 'Today · 9:30 AM', amount: 45000, icon: '💵', pos: true },
      { id: 2, name: 'S&R Supermarket Haul', date: 'Today · 1:15 PM', amount: -3450, icon: '🛒', pos: false },
      { id: 3, name: 'Meralco Power Bill', date: 'Yesterday', amount: -3100, icon: '⚡', pos: false },
      { id: 4, name: 'Specialty Coffee & Snack', date: 'Yesterday', amount: -420, icon: '☕', pos: false },
    ])
  }

  const budgetPct = Math.min(100, Math.round((budgetSpent / budgetLimit) * 100))

  return (
    <div className={styles.mockupContainer}>
      <div className={styles.mockupHeader}>
        <div className={styles.windowControls}>
          <span className={`${styles.controlDot} ${styles.dotClose}`}></span>
          <span className={`${styles.controlDot} ${styles.dotMin}`}></span>
          <span className={`${styles.controlDot} ${styles.dotMax}`}></span>
        </div>
        <div className={styles.mockupAddressBar}>
          <span>🔒</span> buhay.app/app
        </div>
        <div className={styles.mockupWindowMeta}>
          <span>●</span> Finance Preview
        </div>
      </div>

      <div className={styles.mockupBody}>
        {/* Interactive Simulator Control Bar */}
        <div className={styles.simulatorBar}>
          <div>
            <div className={styles.simulatorTitle}>Finance Command Center</div>
            <div className={styles.simulatorSubtitle}>Try sample entries and watch balances, budgets, and history react:</div>
          </div>
          <div className={styles.simulatorButtons}>
            <button type="button" onClick={handleSalary} className={`${styles.simBtn} ${styles.simBtnPrimary}`}>
              + Salary (+₱35k)
            </button>
            <button type="button" onClick={handleFreelance} className={`${styles.simBtn} ${styles.simBtnPrimary}`}>
              + Project (+₱18.5k)
            </button>
            <button type="button" onClick={handleGrocery} className={styles.simBtn}>
              - Groceries (-₱3.4k)
            </button>
            <button type="button" onClick={handleCoffee} className={styles.simBtn}>
              - Dining (-₱420)
            </button>
            <button type="button" onClick={handleReset} className={styles.simBtn} style={{ opacity: 0.7 }}>
              Reset
            </button>
          </div>
        </div>

        {/* 4 Metrics Strip */}
        <div className={styles.metricsStrip}>
          <div className={styles.metricCard}>
            <div className={styles.metricCardLabel}>Estimated Net Worth</div>
            <div className={styles.metricCardValue}>
              ₱{netWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={styles.metricCardSub}>Cash, Crypto & Assets</div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricCardLabel}>Liquid Cashflow</div>
            <div className={styles.metricCardValue} style={{ color: '#059669' }}>
              ₱{liquidCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={styles.metricCardSub}>Across Banks & E-Wallets</div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricCardLabel}>Upcoming Fixed Bills</div>
            <div className={styles.metricCardValue} style={{ color: '#d97706' }}>
              ₱4,999.00
            </div>
            <div className={styles.metricCardSub} style={{ color: '#d97706' }}>⚡ 2 due in next 7 days</div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricCardLabel}>Safe Daily Spend</div>
            <div className={styles.metricCardValue}>
              ₱920<span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>/day</span>
            </div>
            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${budgetPct}%`, height: '100%', background: budgetPct > 85 ? '#ef4444' : '#10b981', transition: 'width 0.3s ease' }}></div>
            </div>
          </div>
        </div>

        {/* Cockpit Grid */}
        <div className={styles.cockpitGrid}>
          {/* Left: Projected 30-Day Cashflow Curve */}
          <div className={styles.cockpitPanel}>
            <div className={styles.panelTitle}>
              <span>📈 30-Day Cashflow Forecast</span>
              <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>● Positive Runway</span>
            </div>
            <div style={{ height: 130, position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
              <svg viewBox="0 0 400 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="curveGradLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 90 Q 60 110, 100 80 T 200 40 T 300 65 T 400 20 L 400 120 L 0 120 Z"
                  fill="url(#curveGradLight)"
                />
                <path
                  d="M 0 90 Q 60 110, 100 80 T 200 40 T 300 65 T 400 20"
                  fill="none"
                  stroke="#059669"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="200" cy="40" r="4" fill="#059669" />
                <circle cx="400" cy="20" r="5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 8 }}>
              <span>Day 1 (₱52k)</span>
              <span>Day 15 (Salary Spike ₱87k)</span>
              <span>Day 30 (Forecast ₱79k)</span>
            </div>
          </div>

          {/* Right: Real-time Cashflow Timeline */}
          <div className={styles.cockpitPanel}>
            <div className={styles.panelTitle}>
              <span>⚡ Live Activity Stream</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>Latest Entries</span>
            </div>
            <div className={styles.txTimeline}>
              {txList.map(tx => (
                <div key={tx.id} className={styles.txItem}>
                  <div className={styles.txIcon}>{tx.icon}</div>
                  <div className={styles.txDetails}>
                    <div className={styles.txName}>{tx.name}</div>
                    <div className={styles.txMeta}>{tx.date}</div>
                  </div>
                  <div className={tx.pos ? styles.txAmountPos : styles.txAmountNeg}>
                    {tx.pos ? '+' : ''}₱{Math.abs(tx.amount).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CalendarWidget() {
  const [selectedDay, setSelectedDay] = useState(17)
  const dayForecasts = {
    14: { balance: 48500, note: 'Regular spending day (-₱450)' },
    15: { balance: 83500, note: '🎉 Mid-month salary deposit (+₱35,000)' },
    16: { balance: 81200, note: 'Electric utility bill due (-₱2,300)' },
    17: { balance: 80750, note: '🟢 Current active day · Safe cashflow (+₱58.4k projection)' },
    18: { balance: 79250, note: 'Internet subscription recurring (-₱1,500)' },
    19: { balance: 78600, note: 'Scheduled savings transfer to Emergency Fund (-₱650)' },
    20: { balance: 77900, note: 'Planned grocery replenishment' },
  }

  const activeInfo = dayForecasts[selectedDay] || dayForecasts[17]

  return (
    <div className={styles.bentoWidgetArea}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
          📅 {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })} Interactive Calendar
        </div>
        <div style={{ fontSize: 12, color: '#059669', fontWeight: 800 }}>₱{activeInfo.balance.toLocaleString()} balance</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', marginBottom: 12 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>{d}</div>
        ))}
        {[14, 15, 16, 17, 18, 19, 20].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setSelectedDay(d)}
            style={{
              background: d === selectedDay ? '#ecfdf5' : '#ffffff',
              border: d === selectedDay ? '2px solid #059669' : '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '8px 4px',
              color: d === selectedDay ? '#059669' : '#334155',
              fontWeight: d === selectedDay ? 800 : 600,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: d === selectedDay ? '0 2px 8px rgba(16,185,129,0.2)' : 'none',
              transition: 'all 0.18s ease',
            }}
          >
            {d}
            <div style={{ fontSize: 7, color: d === 15 ? '#059669' : d === 16 ? '#ef4444' : d === 17 ? '#10b981' : '#94a3b8', marginTop: 2 }}>●</div>
          </button>
        ))}
      </div>

      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '10px 14px', borderRadius: 10, fontSize: 12, color: '#065f46' }}>
        <strong style={{ color: '#047857' }}>Day {selectedDay} Snapshot:</strong> {activeInfo.note}
      </div>
    </div>
  )
}

function AccountsWidget() {
  const [activeTab, setActiveTab] = useState('all')

  const accounts = [
    { name: '🏦 BDO Savings Account', cat: 'liquid', balance: 48720, type: 'Bank' },
    { name: '📱 GCash Wallet', cat: 'liquid', balance: 12450, type: 'E-Wallet' },
    { name: '⚡ Maya Personal', cat: 'liquid', balance: 7070, type: 'E-Wallet' },
    { name: '🪙 BTC & ETH Holdings', cat: 'invest', balance: 420400, type: 'Crypto' },
    { name: '💳 Platinum Credit Card', cat: 'credit', balance: -8400, type: 'Debt' },
  ]

  const filtered = activeTab === 'all'
    ? accounts
    : accounts.filter(a => activeTab === 'liquid' ? a.cat === 'liquid' : activeTab === 'invest' ? a.cat === 'invest' : a.cat === 'credit')

  return (
    <div className={styles.bentoWidgetArea}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All Accounts' },
          { key: 'liquid', label: 'Liquid Cash' },
          { key: 'invest', label: 'Crypto & Assets' },
          { key: 'credit', label: 'Credit Cards' },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: activeTab === tab.key ? '#ecfdf5' : '#ffffff',
              border: activeTab === tab.key ? '1px solid #10b981' : '1px solid #e2e8f0',
              color: activeTab === tab.key ? '#059669' : '#64748b',
              padding: '4px 12px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((acc, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
            <span style={{ color: '#0f172a', fontWeight: 600 }}>{acc.name}</span>
            <strong style={{ color: acc.balance >= 0 ? '#059669' : '#dc2626' }}>
              {acc.balance >= 0 ? '' : '-'}₱{Math.abs(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function BillsWidget() {
  const [bills, setBills] = useState([
    { id: 1, name: 'Meralco Electricity', amount: 3100, due: 'Due in 2 days', paid: false, urgent: true },
    { id: 2, name: 'Globe Fiber WiFi 200Mbps', amount: 1899, due: 'Due in 6 days', paid: false, urgent: false },
    { id: 3, name: 'Netflix Premium HD', amount: 549, due: 'Auto-debit on 24th', paid: true, urgent: false },
  ])

  const togglePaid = (id) => {
    setBills(prev => prev.map(b => b.id === id ? { ...b, paid: !b.paid } : b))
  }

  return (
    <div className={styles.bentoWidgetArea}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
        Tap checkbox to mark bills as paid in real-time:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bills.map(bill => (
          <div
            key={bill.id}
            onClick={() => togglePaid(bill.id)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: bill.paid ? '#ecfdf5' : bill.urgent ? '#fef2f2' : '#ffffff',
              border: bill.paid ? '1px solid #a7f3d0' : bill.urgent ? '1px solid #fecaca' : '1px solid #e2e8f0',
              padding: '10px 14px',
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                background: bill.paid ? '#10b981' : '#f1f5f9',
                border: bill.paid ? 'none' : '1px solid #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: '#ffffff',
              }}>
                {bill.paid ? '✓' : ''}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: bill.paid ? '#94a3b8' : '#0f172a', textDecoration: bill.paid ? 'line-through' : 'none' }}>
                  {bill.name}
                </div>
                <div style={{ fontSize: 10, color: bill.paid ? '#059669' : bill.urgent ? '#dc2626' : '#64748b' }}>
                  {bill.paid ? 'Marked as Paid' : bill.due}
                </div>
              </div>
            </div>
            <strong style={{ fontSize: 13, color: bill.paid ? '#059669' : bill.urgent ? '#dc2626' : '#0f172a' }}>
              ₱{bill.amount.toLocaleString()}
            </strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function BudgetGoalsWidget() {
  return (
    <div className={styles.bentoWidgetArea}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>🎯 Emergency Fund Target</span>
            <strong style={{ color: '#059669' }}>₱75,000 / ₱100,000 (75%)</strong>
          </div>
          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: '75%', height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)' }}></div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>💳 Credit Debt Snowball</span>
            <strong style={{ color: '#0284c7' }}>Debt Free in 5 Months!</strong>
          </div>
          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: '82%', height: '100%', background: 'linear-gradient(90deg, #0284c7, #2563eb)' }}></div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#ffffff', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: 8, fontSize: 11, color: '#64748b' }}>
          <span>Monthly Safe-to-Spend Envelope</span>
          <strong style={{ color: '#059669' }}>₱920 / day remaining</strong>
        </div>
      </div>
    </div>
  )
}

const COMPARISON_ROWS = [
  { feature: 'Data Ownership', buhay: 'Your finance records stay in your account and can be exported', banks: 'Usually limited to statement downloads', sheets: 'Portable, but easy to duplicate or expose' },
  { feature: 'Bank Login Credentials', buhay: 'No bank passwords, OTPs, or open-banking links required', banks: 'Requires account access to each institution', sheets: 'No credentials, but every update is manual' },
  { feature: 'Visual Cashflow Planning', buhay: 'Calendar-based balances, recurring items, and daily runway', banks: 'Mostly past transactions and statement views', sheets: 'Possible, but formula-heavy' },
  { feature: 'Multi-Account View', buhay: 'Track cash, banks, e-wallets, credit cards, debts, and crypto', banks: 'Usually focused on one institution', sheets: 'Flexible, but maintenance-heavy' },
  { feature: 'Bills & Recurring Money', buhay: 'Schedules, due states, and mark-paid finance records', banks: 'Autopay visibility varies by provider', sheets: 'Needs custom reminders and formulas' },
  { feature: 'Cost / Pricing', buhay: 'Free to use in this project version', banks: 'Account fees depend on provider', sheets: 'Free, but high-maintenance' },
]

const TRUST_POINTS = [
  {
    icon: '🛡️',
    title: 'Zero Bank Credentials Stored',
    desc: 'Buhay is built around intentional manual tracking. It never asks for online banking passwords, OTPs, or bank API credentials.',
  },
  {
    icon: '⚡',
    title: 'Free Project Version',
    desc: 'The current app is free to use and focuses on practical money tracking without subscription prompts in the product flow.',
  },
  {
    icon: '🔒',
    title: 'Privacy Shield & Blur Mode',
    desc: 'Toggle Privacy Mode instantly to blur sensitive balances and transaction values when checking your finances in public.',
  },
  {
    icon: '📥',
    title: 'Universal Data Portability',
    desc: 'Export your transaction ledger to CSV or download a JSON backup snapshot from Settings whenever you need your data.',
  },
]

const FAQ_ITEMS = [
  {
    question: 'What is Buhay?',
    answer: 'Buhay is a personal finance tracker for daily balances, accounts, income, expenses, bills, budgets, savings, debts, and crypto holdings. It is the current home of the Takda finance system.',
  },
  {
    question: 'Why does Buhay not ask for my bank passwords?',
    answer: 'Buhay is designed for manual, intentional tracking instead of bank scraping. You enter and review your own records, so the app never needs online banking credentials, OTPs, or third-party bank connections.',
  },
  {
    question: 'Can I install Buhay on my mobile phone?',
    answer: 'Yes! Buhay is fully responsive and installable as a Progressive Web App (PWA) on iOS and Android. You can add it directly to your home screen for lightning-fast 1-tap tracking.',
  },
  {
    question: 'Is there a limit on how many transactions or accounts I can add?',
    answer: 'There is no product-level limit in the app UI. Practical limits depend on Firebase usage, browser performance, and your project configuration.',
  },
  {
    question: 'How do I backup my financial data?',
    answer: 'Inside the Settings page, you can download a full CSV transaction ledger or export a JSON backup snapshot to restore anytime.',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [authReady, setAuthReady] = useState(() => Boolean(auth.currentUser))
  const [isSignedIn, setIsSignedIn] = useState(() => Boolean(auth.currentUser))

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, currentUser => {
      setIsSignedIn(Boolean(currentUser))
      setAuthReady(true)
    })
    return () => unsub()
  }, [])

  const primaryLabel = authReady
    ? (isSignedIn ? 'Open App' : 'Get Started Free')
    : 'Open App'

  const handleOpenPrimary = () => {
    navigate(isSignedIn ? '/app' : '/login')
  }

  const handleSignIn = () => {
    navigate('/login')
  }

  return (
    <div className={styles.page}>
      <RouteMeta
        title="Buhay — Personal Finance, Bills, Budgets & Cashflow"
        description="Track daily balances, accounts, income, expenses, bills, budgets, savings, debts, and crypto holdings with Buhay."
        path="/"
      />

      {/* Atmospheric Background Lights */}
      <div className={styles.bgGlowTop}></div>
      <div className={styles.bgGridPattern}></div>

      {/* Sticky Glass Navbar */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <BrandLogo to="/" />

          <div className={styles.navLinks}>
            <a href="#forecast" className={styles.navLink}>Forecast</a>
            <a href="#accounts" className={styles.navLink}>Accounts</a>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="#compare" className={styles.navLink}>Comparison</a>
            <a href="#privacy" className={styles.navLink}>Security</a>
            <a href="#faq" className={styles.navLink}>FAQ</a>
          </div>

          <div className={styles.navActions}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={handleSignIn}>
              Sign in
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleOpenPrimary}>
              {primaryLabel} <span>→</span>
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot}></span>
            <span>Buhay · Takda Finance Tracker</span>
          </div>

          <h1 className={styles.heroTitle}>
            Master Your Cashflow. <br />
            <span className={styles.gradientHighlight}>See Every Peso Clearly.</span>
          </h1>

          <p className={styles.heroSub}>
            A calm personal finance app for daily balances, accounts, bills, budgets, savings, debts, and crypto holdings. Track money manually, keep records organized, and stay ahead without sharing bank passwords.
          </p>

          <div className={styles.heroActions}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`} onClick={handleOpenPrimary}>
              {primaryLabel} <span>→</span>
            </button>
            <a href="#forecast" className={`${styles.btn} ${styles.btnGhost} ${styles.btnLg}`}>
              Explore Features ↓
            </a>
          </div>

          <div className={styles.heroTrustBadges}>
            <div className={styles.heroTrustItem}>
              <span>✓</span> Free Project Version
            </div>
            <div className={styles.heroTrustItem}>
              <span>✓</span> Zero Bank Passwords Needed
            </div>
            <div className={styles.heroTrustItem}>
              <span>✓</span> Cashflow Calendar
            </div>
            <div className={styles.heroTrustItem}>
              <span>✓</span> Instant CSV & JSON Export
            </div>
          </div>

          {/* Hyper-realistic Interactive App Cockpit Mockup */}
          <LiveAppMockup />
        </section>

        {/* Bento Grid Feature Suite */}
        <section id="forecast" className={`${styles.features} ${styles.sectionAnchor}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionEyebrow}>Finance Tools</div>
            <h2 className={styles.sectionTitle}>Everything for Your Money in One Place</h2>
            <p className={styles.sectionSub}>
              Replace scattered notes and fragile formulas with one focused finance app for the records you actually use.
            </p>
          </div>

          <div className={styles.bentoGrid}>
            {/* Bento Card 1: Calendar */}
            <div className={styles.bentoCard}>
              <div className={styles.bentoCardTop}>
                <div className={styles.bentoIcon}>📅</div>
                <div>
                  <div className={styles.bentoTag}>Cashflow Forecast</div>
                  <h3 className={styles.bentoCardTitle}>Interactive Cashflow Calendar</h3>
                </div>
              </div>
              <p className={styles.bentoCardDesc}>
                Stop guessing your end-of-month balance. View daily income, expenses, scheduled bills, and projected money movement at a glance.
              </p>
              <CalendarWidget />
            </div>

            {/* Bento Card 2: Multi-Account Hub */}
            <div id="accounts" className={`${styles.bentoCard} ${styles.sectionAnchor}`}>
              <div className={styles.bentoCardTop}>
                <div className={styles.bentoIcon}>💳</div>
                <div>
                  <div className={styles.bentoTag}>Liquidity Radar</div>
                  <h3 className={styles.bentoCardTitle}>Multi-Account & Net Worth Hub</h3>
                </div>
              </div>
              <p className={styles.bentoCardDesc}>
                Track bank accounts, e-wallets, cash, crypto, credit cards, and debts in one liquidity and net worth view with quick balance adjustments.
              </p>
              <AccountsWidget />
            </div>

            {/* Bento Card 3: Smart Bills */}
            <div className={styles.bentoCard}>
              <div className={styles.bentoCardTop}>
                <div className={styles.bentoIcon}>⚡</div>
                <div>
                  <div className={styles.bentoTag}>Fixed Commitments</div>
                  <h3 className={styles.bentoCardTitle}>Smart Bills & Recurring Radar</h3>
                </div>
              </div>
              <p className={styles.bentoCardDesc}>
                Keep recurring bills and subscriptions visible with due states, schedules, and mark-paid records.
              </p>
              <BillsWidget />
            </div>

            {/* Bento Card 4: Budgets & Goals */}
            <div className={styles.bentoCard}>
              <div className={styles.bentoCardTop}>
                <div className={styles.bentoIcon}>🎯</div>
                <div>
                  <div className={styles.bentoTag}>Growth & Envelope</div>
                  <h3 className={styles.bentoCardTitle}>Safe Daily Spend & Debt Freedom</h3>
                </div>
              </div>
              <p className={styles.bentoCardDesc}>
                Pace monthly spending, build emergency savings goals, and plan debt payoff with clear progress views.
              </p>
              <BudgetGoalsWidget />
            </div>
          </div>
        </section>

        {/* 3 Key Pillars Deep-Dive */}
        <section id="features" className={`${styles.highlightsSection} ${styles.sectionAnchor}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionEyebrow}>Daily Money Control</div>
            <h2 className={styles.sectionTitle}>Practical Tools for Intentional Spending</h2>
            <p className={styles.sectionSub}>
              Built around the finance workflows Buhay actually supports today.
            </p>
          </div>

          <div className={styles.highlightsGrid}>
            <div className={styles.highlightCard}>
              <div className={styles.highlightIcon}>💳</div>
              <h3 className={styles.highlightCardTitle}>Credit Card Cycle Intelligence</h3>
              <p className={styles.highlightCardDesc}>
                Track debt balances, payment due dates, minimum payments, and payoff progress alongside your other accounts.
              </p>
            </div>

            <div className={styles.highlightCard}>
              <div className={styles.highlightIcon}>🛡️</div>
              <h3 className={styles.highlightCardTitle}>No Bank Credential Scraping</h3>
              <p className={styles.highlightCardDesc}>
                Buhay never asks for online banking passwords, OTPs, or API credentials. You stay in control of what gets recorded.
              </p>
            </div>

            <div className={styles.highlightCard}>
              <div className={styles.highlightIcon}>📊</div>
              <h3 className={styles.highlightCardTitle}>Universal Data Sovereignty</h3>
              <p className={styles.highlightCardDesc}>
                Download your transaction history to CSV or export a JSON backup snapshot from Settings.
              </p>
            </div>
          </div>
        </section>

        {/* Comparison Section: Buhay vs Alternatives */}
        <section id="compare" className={`${styles.comparisonSection} ${styles.sectionAnchor}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionEyebrow}>Why Buhay?</div>
            <h2 className={styles.sectionTitle}>Built for You, Not Financial Advertisers</h2>
            <p className={styles.sectionSub}>
              See how Buhay compares to institution-specific bank apps and do-it-yourself spreadsheets.
            </p>
          </div>

          <div className={styles.tableResponsiveWrap}>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th>Feature / Capability</th>
                  <th className={styles.highlightCol}>Buhay</th>
                  <th>Bank Apps</th>
                  <th>Spreadsheets</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{row.feature}</strong>
                    </td>
                    <td className={styles.highlightCol}>
                      <div className={styles.checkYes}>
                        <span>✓</span> {row.buhay}
                      </div>
                    </td>
                    <td>
                      <div className={styles.checkNo}>
                        <span>✗</span> {row.banks}
                      </div>
                    </td>
                    <td>
                      <div className={styles.checkNo}>
                        <span>~</span> {row.sheets}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Privacy & Trust Pillars */}
        <section id="privacy" className={`${styles.privacySection} ${styles.sectionAnchor}`}>
          <div className={styles.privacyInner}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionEyebrow}>Security & Ownership</div>
              <h2 className={styles.sectionTitle}>Private by Design, Clear by Default</h2>
              <p className={styles.sectionSub}>
                Buhay is built for personal tracking without bank-password collection or noisy financial ads.
              </p>
            </div>

            <div className={styles.privacyGrid}>
              {TRUST_POINTS.map((pt, idx) => (
                <div key={idx} className={styles.privacyCard}>
                  <div className={styles.privacyIcon}>{pt.icon}</div>
                  <h3 className={styles.privacyCardTitle}>{pt.title}</h3>
                  <p className={styles.privacyCardDesc}>{pt.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className={`${styles.faqSection} ${styles.sectionAnchor}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionEyebrow}>Support & Answers</div>
            <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
            <p className={styles.sectionSub}>
              Clear answers to the most common questions about using Buhay.
            </p>
          </div>

          <div className={styles.faqList}>
            {FAQ_ITEMS.map((item, idx) => (
              <div key={idx} className={styles.faqItem}>
                <h3 className={styles.faqQuestion}>
                  <span>Q.</span> {item.question}
                </h3>
                <p className={styles.faqAnswer}>{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <div style={{ padding: '0 24px' }}>
          <div className={styles.ctaBanner}>
            <h2 className={styles.ctaTitle}>Build Your Everyday Money Clarity</h2>
            <p className={styles.ctaSub}>
              Track balances, bills, budgets, savings, debts, and crypto holdings from one focused finance app.
            </p>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`} onClick={handleOpenPrimary}>
              {primaryLabel} <span>→</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BrandLogo to="/" />
            <span style={{ fontSize: 13, color: '#94a3b8' }}>· Bawat araw, mas malinaw.</span>
          </div>
          <div className={styles.footerLinks}>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/login">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
