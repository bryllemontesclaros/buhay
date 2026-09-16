import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import BrandLogo from '../components/BrandLogo'
import { signOut } from 'firebase/auth'
import { auth, getVerificationEmailErrorMessage, sendVerificationEmailSafe } from '../lib/firebase'
import { fsSetProfile, fsSyncDueLinkedTransactions, listenCol, listenProfile } from '../lib/firestore'
import { getInitials, getCurrencySymbol, today, isSameMonth, playTick } from '../lib/utils'
import { runAutoRecurrenceEngine } from '../lib/autoRecurEngine'
import { getMonthTransactions, isTransactionPaid } from '../lib/finance'
import { getBillPeriodInfo } from '../lib/bills'
import { safeScrollIntoView } from '../lib/ui'
import Calendar from './Calendar'
import Bills from './Bills'
import Settings from './Settings'
import { QuickAddModal } from '../components/modals/QuickAddModal'
import History from './History'
import { SettingsModal } from '../components/modals/SettingsModal'
import ErrorBoundary from '../components/ErrorBoundary'
import AccountsAndDebts from './AccountsAndDebts'
import SavingsAndBudget from './SavingsAndBudget'
import HistoryAndInsights from './HistoryAndInsights'
import Accounts from './Accounts'
import Debts from './Debts'
import { ChangelogModal } from '../components/modals/ChangelogModal'
import Budget from './Budget'
import Savings from './Savings'
import Breakdown from './Breakdown'
import Subscriptions from './Subscriptions'
import Recurring from './Recurring'
import { Button } from '../components/ui/Button'
import {
  findPresetByLabel,
  getDefaultTransactionDraft,
  sanitizeTransactionCategory,
  sanitizeTransactionSubcategory,
} from '../lib/transactionOptions'
import { consumeStartSpaceIntent } from '../lib/startIntent'
import { useTheme } from '../lib/theme.jsx'
import NotificationBell from '../components/NotificationBell'
import GuidedTour from '../components/GuidedTour'
import { triggerHaptic, playHapticTick } from '../lib/gestures'
import styles from './AppShell.module.css'

function safeLazy(importFn) {
  return lazy(() => {
    return importFn().catch(error => {
      console.warn('Failed to load dynamic chunk, reloading...', error)
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
      return { default: () => null }
    })
  })
}


class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('Buhay page failed to render', error, info)
    this.setState({ error, info })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        role="alert"
        style={{
          border: '1px solid color-mix(in srgb, var(--glass-border) 70%, var(--border))',
          borderRadius: 28,
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--glass-2) 78%, var(--surface) 22%), color-mix(in srgb, var(--surface) 92%, transparent 8%))',
          boxShadow: 'var(--glass-shadow-soft)',
          color: 'var(--text)',
          padding: 24,
        }}
      >
        <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, letterSpacing: 0.9, textTransform: 'uppercase' }}>Page recovered</div>
        <h2 style={{ margin: '8px 0 8px', fontFamily: 'var(--font-display)', fontSize: 34, letterSpacing: '-0.05em', lineHeight: 1 }}>This page hit a display issue.</h2>
        <p style={{ margin: 0, color: 'var(--text2)', maxWidth: 560, lineHeight: 1.55 }}>
          Buhay is still running. Go back Home, then try opening the page again.
        </p>
        {this.state.error && (
          <pre style={{ marginTop: 14, padding: 12, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: 12, fontSize: 12, color: '#ff453a', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {String(this.state.error)}
            {'\n'}
            {this.state.error.stack}
          </pre>
        )}
        <button
          type="button"
          onClick={this.props.onRecover}
          style={{
            marginTop: 18,
            minHeight: 44,
            border: '1px solid color-mix(in srgb, var(--accent) 38%, var(--glass-border))',
            borderRadius: 16,
            background: 'color-mix(in srgb, var(--accent) 18%, var(--glass-1))',
            color: 'var(--text)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontWeight: 800,
            padding: '10px 16px',
          }}
        >
          Back to Home
        </button>
      </div>
    )
  }
}

function PageLoading() {
  return (
    <div
      role="status"
      style={{
        border: '1px solid color-mix(in srgb, var(--glass-border) 70%, var(--border))',
        borderRadius: 28,
        background: 'color-mix(in srgb, var(--glass-1) 76%, var(--surface) 24%)',
        color: 'var(--text2)',
        padding: 24,
      }}
    >
      Opening page...
    </div>
  )
}

const NAV_ICONS = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  finance: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="3"/>
      <path d="M16 10h2.5a1.5 1.5 0 0 1 0 3H16a1.5 1.5 0 0 1 0-3Z"/>
      <path d="M6 9h5"/>
    </svg>
  ),
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5 12 4l8 7.5"/>
      <path d="M6.5 10.5V20h11v-9.5"/>
      <path d="M9.5 20v-5h5v5"/>
    </svg>
  ),
  calendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  breakdown: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 1 1-9 9h9z"/>
      <path d="M12 3a9 9 0 0 1 9 9h-9z"/>
    </svg>
  ),
  budget: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="3"/>
      <line x1="12" y1="3" x2="12" y2="5"/>
      <line x1="21" y1="12" x2="19" y2="12"/>
      <line x1="12" y1="21" x2="12" y2="19"/>
      <line x1="3" y1="12" x2="5" y2="12"/>
    </svg>
  ),
  bills: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h10a2 2 0 0 1 2 2V21l-3-1.8-3 1.8-3-1.8L7 21V5.5a2 2 0 0 1 2-2Z"/>
      <path d="M10 8h6"/>
      <path d="M10 12h6"/>
      <path d="M10 16h3"/>
    </svg>
  ),
  savings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l2.8 5.7 6.2.9-4.5 4.3 1 6.1L12 17l-5.5 3 1-6.1L3 9.6l6.2-.9L12 3z"/>
    </svg>
  ),
  debts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 17 13.5 8.5 8.5 13.5 2 7"/>
      <polyline points="16 17 22 17 22 11"/>
    </svg>
  ),
  portfolio: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5"/>
      <path d="M4 19h16"/>
      <path d="m7 15 3-4 3 2 5-7"/>
      <path d="M16 6h2.5V8.5"/>
    </svg>
  ),
  accounts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="3"/><line x1="2.5" y1="10" x2="21.5" y2="10"/><line x1="16" y1="15" x2="18.5" y2="15"/>
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  receipts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5h10.5A2.5 2.5 0 0 1 19 6v14l-2.5-1.5L14 20l-2.5-1.5L9 20l-2.5-1.5L4 20V6a2.5 2.5 0 0 1 2-2.45z"/>
      <path d="M8 8h7"/>
      <path d="M8 12h8"/>
      <path d="M8 16h5"/>
    </svg>
  ),
  more: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
    </svg>
  ),
  history: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4v5h5"/>
      <path d="M3.5 13a8.5 8.5 0 1 0 2.5-6l-3 2"/>
      <path d="M12 8v4l2.5 2.5"/>
    </svg>
  ),

  overview: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h4l2-6 4 12 2-6h4"/>
      <path d="M5 20h14"/>
    </svg>
  ),








  today: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2"/>
      <path d="M12 20v2"/>
      <path d="m4.93 4.93 1.41 1.41"/>
      <path d="m17.66 17.66 1.41 1.41"/>
      <path d="M2 12h2"/>
      <path d="M20 12h2"/>
      <path d="m6.34 17.66-1.41 1.41"/>
      <path d="m19.07 4.93-1.41 1.41"/>
    </svg>
  ),



  insights: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5"/>
      <path d="M4 19h16"/>
      <path d="m7 15 3-4 3 2 5-7"/>
      <path d="M18 6h2v2"/>
    </svg>
  ),
}

const STREAK_MILESTONES = [3, 7, 14]

const APP_SPACES = [
  { id: 'takda', label: 'Buhay', meta: 'Finance', iconKey: 'finance', cue: 'Money clarity' },
]

const DEFAULT_SPACE_PAGES = {
  takda: 'calendar',
}

const FINANCE_PAGE_ALIASES = {
  accounts: { page: 'accounts' },
  crypto: { page: 'accounts', subTab: 'crypto' },
  portfolio: { page: 'accounts', subTab: 'crypto' },
  history: { page: 'history' },
  breakdown: { page: 'breakdown' },
  savings: { page: 'savings' },
  bills: { page: 'bills' },
  budget: { page: 'budget' },
  debts: { page: 'debts' },
  subscriptions: { page: 'bills' },
}

const MONEY_TOOLS = [
  {
    id: 'accounts',
    label: 'Accounts',
    meta: 'Balances and account setup',
    Component: Accounts,
  },
  {
    id: 'history',
    label: 'History',
    meta: 'Income, expenses, and edits',
    Component: History,
  },
  {
    id: 'breakdown',
    label: 'Insights',
    meta: 'Spending and category trends',
    Component: Breakdown,
  },
]

const PLAN_TOOLS = [
  {
    id: 'savings',
    label: 'Savings',
    meta: 'Targets and contributions',
    Component: Savings,
  },
  {
    id: 'bills',
    label: 'Bills',
    meta: 'Due dates and recurring services',
    Component: Bills,
  },
  {
    id: 'budget',
    label: 'Budget',
    meta: 'Monthly limits',
    Component: Budget,
  },
  {
    id: 'debts',
    label: 'Debts',
    meta: 'CC & loan payoff tracking',
    Component: Debts,
  },
]

function FinanceToolGroup({
  tools,
  activeTool,
  onActiveToolChange,
  eyebrow,
  title,
  description,
  ...pageProps
}) {
  const selectedTool = tools.find(tool => tool.id === activeTool) || tools[0]
  const ActiveComponent = selectedTool.Component
  const contentRef = useRef(null)
  const tabRefs = useRef({})
  const previousToolRef = useRef(selectedTool.id)

  useEffect(() => {
    const activeTab = tabRefs.current[selectedTool.id]
    safeScrollIntoView(activeTab, { inline: 'center', block: 'nearest', behavior: 'smooth' })

    if (previousToolRef.current === selectedTool.id) return
    previousToolRef.current = selectedTool.id

    if (typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 1024px)').matches) return

    window.requestAnimationFrame(() => {
      safeScrollIntoView(contentRef.current, { behavior: 'smooth', block: 'start' })
    })
  }, [selectedTool.id])

  return (
    <div className={styles.financeGroupPage}>
      <section className={styles.financeGroupHero}>
        <div className={styles.financeGroupSwitch} role="tablist" aria-label="Finance tools">
          {tools.map(tool => (
            <button
              key={tool.id}
              ref={node => {
                if (node) tabRefs.current[tool.id] = node
              }}
              type="button"
              className={`${styles.financeGroupTab} ${selectedTool.id === tool.id ? styles.financeGroupTabActive : ''}`}
              onClick={() => onActiveToolChange?.(tool.id)}
              role="tab"
              aria-selected={selectedTool.id === tool.id}
            >
              <strong>{tool.label}</strong>
              <span>{tool.meta}</span>
            </button>
          ))}
        </div>
      </section>
      <div ref={contentRef} className={styles.financeGroupContent}>
        <ActiveComponent {...pageProps} />
      </div>
    </div>
  )
}

function TakdaMoneyPage({ financeToolSelections = {}, onFinanceToolSelect, ...pageProps }) {
  return (
    <FinanceToolGroup
      tools={MONEY_TOOLS}
      activeTool={financeToolSelections.money}
      onActiveToolChange={tool => onFinanceToolSelect?.('money', tool)}
      eyebrow="Money"
      title="Open the money view you need right now."
      description="Balances, history, and insights stay on one surface so you can jump straight to the task instead of navigating deeper."
      {...pageProps}
    />
  )
}

function TakdaPlanPage({ financeToolSelections = {}, onFinanceToolSelect, ...pageProps }) {
  return (
    <FinanceToolGroup
      tools={PLAN_TOOLS}
      activeTool={financeToolSelections.plan}
      onActiveToolChange={tool => onFinanceToolSelect?.('plan', tool)}
      eyebrow="Plan"
      title="Open the planning view that needs attention."
      description="Savings, bills, and budget stay together here so month planning feels like one surface instead of three separate detours."
      {...pageProps}
    />
  )
}



export default function AppShell({ user }) {
  const [activeSpace, setActiveSpace] = useState('takda')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [page, setPage] = useState(DEFAULT_SPACE_PAGES.takda)

  const [financeToolSelections, setFinanceToolSelections] = useState({ money: 'accounts', plan: 'savings' })
  const [data, setData] = useState({
    income: [],
    expenses: [],
    bills: [],
    goals: [],
    accounts: [],
    budgets: [],
    debts: [],
    receipts: [],
    transfers: [],
    calendarEvents: [],
    balanceOverrideLog: [],
  })

  const [profile, setProfile] = useState({})
  const [quickAddSheet, setQuickAddSheet] = useState({ open: false, mode: 'manual', type: 'expense', initialEntry: null })
  const [spaceActionRequest, setSpaceActionRequest] = useState(null)
  const [takdaActionRequest, setTakdaActionRequest] = useState(null)

  const [mobileNavMenuOpen, setMobileNavMenuOpen] = useState(false)
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false)
  const [calendarQuickAddDate, setCalendarQuickAddDate] = useState('')
  const [emailVerified, setEmailVerified] = useState(() => Boolean(auth.currentUser?.emailVerified || user?.emailVerified))
  const [verifyBannerMsg, setVerifyBannerMsg] = useState({ text: '', ok: false })
  const [verifySending, setVerifySending] = useState(false)
  const quickAddFocusProxyRef = useRef(null)
  const [syncIssue, setSyncIssue] = useState(null)
  const [billPaymentTarget, setBillPaymentTarget] = useState(null)
  const [debtPaymentTarget, setDebtPaymentTarget] = useState(null)
  const [chromeMode, setChromeMode] = useState({ compact: false, hidden: false })
  const [exchangeRates, setExchangeRates] = useState(null)
  const syncingDueTransactionsRef = useRef(false)
  const preferredSpaceAppliedRef = useRef(false)
  const mainRef = useRef(null)
  const lastMainScrollRef = useRef(0)
  const previousVisiblePageRef = useRef(null)
  const [changelogData, setChangelogData] = useState(null)
  const [activeTour, setActiveTour] = useState(null)
  const autoTriggeredRef = useRef({ takda: false })


  // Auto-trigger tour if user enters a space for the first time after registering
  useEffect(() => {
    if (!profile || Object.keys(profile).length === 0) return
    
    // Only auto-trigger if they recently finished registration onboarding in this session
    const justRegistered = sessionStorage.getItem('just_registered') === 'true'
    if (!justRegistered) return

    const completedFlag = profile.hasCompletedTakdaTour


    if ((completedFlag === undefined || completedFlag === false) && !autoTriggeredRef.current[activeSpace]) {
      autoTriggeredRef.current[activeSpace] = true
      setActiveTour(activeSpace)
    }
  }, [activeSpace, profile])

  const handleFinishTour = async () => {
    const field = 'hasCompletedTakdaTour'

    
    try {
      await fsSetProfile(user.uid, { [field]: true })
    } catch (err) {
      console.error('Failed to save tour status', err)
    }
    setActiveTour(null)
  }

  const handleTourTabChange = (tabName) => {
    navigateToFinancePage(tabName)
  }

  const getActiveTourTab = () => {
    return page
  }


  useEffect(() => {
    try {
      if (typeof __COMMIT_HASH__ !== 'undefined' && __COMMIT_HASH__) {
        const lastSeen = localStorage.getItem('takda_last_commit')
        if (lastSeen !== __COMMIT_HASH__) {
          setChangelogData({ hash: __COMMIT_HASH__, message: __COMMIT_MESSAGE__ })
        }
      }
    } catch (e) {}
  }, [])

  function dismissChangelog() {
    if (changelogData) {
      localStorage.setItem('takda_last_commit', changelogData.hash)
      setChangelogData(null)
    }
  }



  function handleRealtimeError(key, error) {
    console.error(`Buhay sync failed for ${key}`, error)
    setSyncIssue({
      title: 'Sync needs a refresh',
      message: 'Some of your data could not update in real time. Check your connection, then refresh Buhay.',
    })
  }

  useEffect(() => {
    if (!user) return
    preferredSpaceAppliedRef.current = false
    setProfile({})
    setSyncIssue(null)
    const uid = user.uid
    const unsubs = [
      listenCol(uid, 'income', rows => {
        setData(d => ({ ...d, income: rows }))
      }, error => handleRealtimeError('income', error)),
      listenCol(uid, 'expenses', rows => {
        setData(d => ({ ...d, expenses: rows }))
      }, error => handleRealtimeError('expenses', error)),
      listenCol(uid, 'bills', rows => {
        setData(d => ({ ...d, bills: rows }))
      }, error => handleRealtimeError('bills', error)),
      listenCol(uid, 'goals', rows => {
        setData(d => ({ ...d, goals: rows }))
      }, error => handleRealtimeError('goals', error)),
      listenCol(uid, 'debts', rows => {
        setData(d => ({ ...d, debts: rows }))
      }, error => handleRealtimeError('debts', error)),
      listenCol(uid, 'accounts', rows => {
        setData(d => ({ ...d, accounts: rows }))
      }, error => handleRealtimeError('accounts', error)),
      listenCol(uid, 'budgets', rows => {
        setData(d => ({ ...d, budgets: rows }))
      }, error => handleRealtimeError('budgets', error)),
      listenCol(uid, 'transfers', rows => {
        setData(d => ({ ...d, transfers: rows }))
      }, error => handleRealtimeError('transfers', error)),
      listenCol(uid, 'calendarEvents', rows => {
        setData(d => ({ ...d, calendarEvents: rows }))
      }, error => handleRealtimeError('calendarEvents', error)),
      listenCol(uid, 'balanceOverrideLog', rows => {
        setData(d => ({ ...d, balanceOverrideLog: rows }))
      }, error => handleRealtimeError('balanceOverrideLog', error)),
      listenCol(uid, 'portfolioHoldings', rows => {
        setData(d => ({ ...d, portfolioHoldings: rows }))
      }, error => handleRealtimeError('portfolioHoldings', error)),
      listenProfile(uid, p => {
        setProfile(p)
      }, error => handleRealtimeError('profile', error)),
    ]
    return () => unsubs.forEach(u => u())
  }, [user])

  useEffect(() => {
    if (!profile?.currency) return
    const base = String(profile.currency).toUpperCase()
    let active = true

    const DEFAULT_RATES = {
      PHP: { PHP: 1, USD: 0.017, EUR: 0.016, SGD: 0.023, HKD: 0.13, GBP: 0.013, JPY: 2.7, AUD: 0.026, CAD: 0.023 },
      USD: { USD: 1, PHP: 58.5, EUR: 0.92, SGD: 1.35, HKD: 7.8, GBP: 0.79, JPY: 158.2, AUD: 1.5, CAD: 1.37 },
      EUR: { EUR: 1, USD: 1.09, PHP: 63.6, SGD: 1.47, HKD: 8.5, GBP: 0.86, JPY: 172.0, AUD: 1.63, CAD: 1.49 },
    }

    try {
      const cached = localStorage.getItem(`buhay_exchange_rates_${base}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (active && parsed?.rates) {
          setExchangeRates(parsed.rates)
        }
      } else {
        const defaults = DEFAULT_RATES[base] || DEFAULT_RATES.PHP
        if (active) {
          setExchangeRates(defaults)
        }
      }
    } catch (e) {
      console.warn('Failed to load cached exchange rates', e)
    }

    fetch(`https://api.exchangerate-api.com/v4/latest/${base}`)
      .then(res => res.json())
      .then(json => {
        if (active && json?.rates) {
          setExchangeRates(json.rates)
          try {
            localStorage.setItem(`buhay_exchange_rates_${base}`, JSON.stringify({
              rates: json.rates,
              timestamp: Date.now(),
            }))
          } catch (e) {}
        }
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [profile?.currency])

  useEffect(() => {
    if (preferredSpaceAppliedRef.current) return
    preferredSpaceAppliedRef.current = true
    setActiveSpace('takda')
  }, [profile?.preferredSpace])

  useEffect(() => {
    if (!user) return
    setActiveSpace('takda')
  }, [user])




  useEffect(() => {
    function getPendingLinkedTransactions() {
      if (!user?.uid || !data.accounts.length) return []
      return [
        ...data.income.map(tx => ({ ...tx, type: 'income' })),
        ...data.expenses.map(tx => ({ ...tx, type: 'expense' })),
      ].filter(tx => tx.accountBalanceLinked && tx.accountId && !tx.accountBalanceApplied)
    }

    function attemptSync(reason = 'auto') {
      const pending = getPendingLinkedTransactions()
      if (!pending.length || syncingDueTransactionsRef.current) return

      syncingDueTransactionsRef.current = true
      fsSyncDueLinkedTransactions(user.uid, pending, data.accounts)
        .catch(error => {
          console.error('Buhay could not sync due linked transactions', error)
          setSyncIssue({
            title: 'Balance sync paused',
            message: 'Buhay could not apply some due linked transactions. Refresh, then check your account balances.',
          })
        })
        .finally(() => {
          syncingDueTransactionsRef.current = false
        })
    }

    // Primary path: any time transactions/accounts change, reconcile due linked entries.
    attemptSync('data-change')

    // Extra resilience: also reconcile when the app comes back into focus or connectivity returns.
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      attemptSync('visibility')
    }
    function handleFocus() {
      attemptSync('focus')
    }
    function handleOnline() {
      attemptSync('online')
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus)
      window.addEventListener('online', handleOnline)
      document.addEventListener('visibilitychange', handleVisibility)
    }

    // Periodic check running every 60 seconds to auto-apply transactions on date boundary rollover
    const interval = setInterval(() => {
      attemptSync('timer')
    }, 60000)

    return () => {
      clearInterval(interval)
      if (typeof window === 'undefined') return
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user, data.accounts, data.expenses, data.income])

  const autoRecurRunRef = useRef(false)

  useEffect(() => {
    if (!user || autoRecurRunRef.current) return
    if (!data.income || !data.expenses || !data.accounts) return
    
    // Prevent running immediately on empty arrays if we just haven't fetched yet,
    // though listenCol generally fires with the cached snapshot quickly.
    autoRecurRunRef.current = true
    
    runAutoRecurrenceEngine(user.uid, data.income, data.expenses, data.accounts, data.bills)
      .then(addedCount => {
        if (addedCount > 0) {
          playTick()
          console.log(`Buhay AutoRecurEngine: ${addedCount} transactions automatically logged.`)
        }
      })
      .catch(err => {
        console.error('Buhay AutoRecurEngine Error:', err)
      })
  }, [user, data.income, data.expenses, data.accounts, data.bills])

  const symbol = getCurrencySymbol(profile.currency || 'PHP')
  const [privacyMode, setPrivacyMode] = useState(() => {
    try {
      return localStorage.getItem('takda_privacy_mode') === 'true'
    } catch {
      return false
    }
  })

  function togglePrivacy() {
    setPrivacyMode(prev => {
      const next = !prev
      try {
        localStorage.setItem('takda_privacy_mode', String(next))
      } catch {}
      return next
    })
  }

  const topBarTapRef = useRef(0)
  function handleTopBarTap(e) {
    if (e.target.closest('button, a, input, select')) return
    const now = Date.now()
    if (now - topBarTapRef.current < 300 && now - topBarTapRef.current > 40) {
      topBarTapRef.current = 0
      triggerHaptic('medium')
      playHapticTick(1050, 0.04)
      togglePrivacy()
    } else {
      topBarTapRef.current = now
    }
  }

  const netPosition = useMemo(() => {
    const accounts = Array.isArray(data?.accounts) ? data.accounts : []
    return accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0)
  }, [data?.accounts])

  const monthNet = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const income = getMonthTransactions(data.income || [], y, m)
    const expenses = getMonthTransactions(data.expenses || [], y, m)
    const incSum = income.filter(isTransactionPaid).reduce((sum, tx) => sum + (tx.amount || 0), 0)
    const expSum = expenses.filter(isTransactionPaid).reduce((sum, tx) => sum + (tx.amount || 0), 0)
    return incSum - expSum
  }, [data.income, data.expenses])

  const billWatchCount = useMemo(() => {
    if (!data?.bills || !Array.isArray(data.bills)) return 0
    let count = 0
    const now = new Date()
    data.bills.forEach(bill => {
      const period = getBillPeriodInfo(bill, now)
      if (period && !period.paid && (period.status === 'overdue' || period.status === 'due' || period.status === 'soon')) {
        count++
      }
    })
    return count
  }, [data?.bills])

  const budgetStatus = useMemo(() => {
    const budgets = data?.budgets || []
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    
    const spending = {}
    if (Array.isArray(data?.expenses)) {
      data.expenses
        .filter(tx => isTransactionPaid(tx) && isSameMonth(tx.date, y, m))
        .forEach(tx => {
          spending[tx.cat] = (spending[tx.cat] || 0) + (tx.amount || 0)
        })
    }
    
    let overCount = 0
    let warningCount = 0
    budgets.forEach(budget => {
      const spent = spending[budget.cat] || 0
      const pct = budget.limit > 0 ? (spent / budget.limit) * 100 : 0
      if (pct >= 100) {
        overCount++
      } else if (pct >= 80) {
        warningCount++
      }
    })
    
    return { overCount, warningCount, totalBudgets: budgets.length }
  }, [data?.budgets, data?.expenses])

  const savingsProgress = useMemo(() => {
    const goals = data?.goals || []
    const totalSaved = goals.reduce((sum, goal) => sum + (Number(goal.current) || 0), 0)
    const totalTarget = goals.reduce((sum, goal) => sum + (Number(goal.target) || 0), 0)
    const pct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0
    return { totalSaved, totalTarget, pct, totalGoals: goals.length }
  }, [data?.goals])



  useEffect(() => {
    function handleKeydown(event) {
      if (event.key !== 'Escape') return
      setMobileNavMenuOpen(false)
      setQuickAddSheet(current => current.open ? { ...current, open: false } : current)
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  useEffect(() => {
    setMobileNavMenuOpen(false)
    if (page !== 'calendar') setCalendarQuickAddDate('')
  }, [page])



  const visiblePageKey = page


  useEffect(() => {
    if (previousVisiblePageRef.current == null) {
      previousVisiblePageRef.current = `${activeSpace}:${visiblePageKey}`
      return
    }

    const nextVisiblePage = `${activeSpace}:${visiblePageKey}`
    if (previousVisiblePageRef.current === nextVisiblePage) return
    previousVisiblePageRef.current = nextVisiblePage

    if (typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 1024px)').matches) return

    window.requestAnimationFrame(() => {
      safeScrollIntoView(mainRef.current, { behavior: 'smooth', block: 'start' })
    })
  }, [activeSpace, visiblePageKey])

  useEffect(() => {
    const node = mainRef.current
    if (!node || typeof window === 'undefined') return undefined

    let frameId = 0
    const handleScroll = () => {
      if (frameId) return
      frameId = window.requestAnimationFrame(() => {
        frameId = 0
        const nextTop = node.scrollTop || 0
        const delta = nextTop - lastMainScrollRef.current
        lastMainScrollRef.current = nextTop
        const isMobile = window.matchMedia('(max-width: 1024px)').matches

        setChromeMode(current => {
          const compact = nextTop > 28
          const hidden = isMobile
            ? false
            : nextTop < 96
              ? false
              : delta > 8
                ? true
                : delta < -8
                  ? false
                  : current.hidden

          if (current.compact === compact && current.hidden === hidden) return current
          return { compact, hidden }
        })
      })
    }

    node.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      node.removeEventListener('scroll', handleScroll)
      if (frameId) window.cancelAnimationFrame(frameId)
    }
  }, [activeSpace, visiblePageKey])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior
    const prevBodyOverscroll = document.body.style.overscrollBehavior
    const prevHtmlPosition = document.documentElement.style.position
    const prevBodyPosition = document.body.style.position

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overscrollBehavior = 'none'
    document.body.style.overscrollBehavior = 'none'
    document.documentElement.style.position = 'fixed'
    document.body.style.position = 'fixed'
    document.documentElement.style.inset = '0'
    document.body.style.inset = '0'
    document.documentElement.style.width = '100%'
    document.body.style.width = '100%'
    document.documentElement.style.height = '100%'
    document.body.style.height = '100%'

    const resetViewport = () => {
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
        if (document.documentElement) document.documentElement.scrollTop = 0
        if (document.body) document.body.scrollTop = 0
      }
    }

    resetViewport()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        resetViewport()
        window.requestAnimationFrame(resetViewport)
        setTimeout(resetViewport, 60)
        setTimeout(resetViewport, 180)
      }
    }

    const handleScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0)
      }
    }

    window.addEventListener('pageshow', resetViewport)
    window.addEventListener('focus', resetViewport)
    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('visibilitychange', handleVisibility)

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resetViewport)
    }

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll
      document.body.style.overscrollBehavior = prevBodyOverscroll
      document.documentElement.style.position = prevHtmlPosition
      document.body.style.position = prevBodyPosition
      document.documentElement.style.inset = ''
      document.body.style.inset = ''
      document.documentElement.style.width = ''
      document.body.style.width = ''
      document.documentElement.style.height = ''
      document.body.style.height = ''

      window.removeEventListener('pageshow', resetViewport)
      window.removeEventListener('focus', resetViewport)
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', resetViewport)
      }
    }
  }, [])

  useEffect(() => {
    setChromeMode({ compact: false, hidden: false })
    lastMainScrollRef.current = 0
    if (mainRef.current) {
      mainRef.current.scrollTop = 0
    }
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
  }, [activeSpace, visiblePageKey])

  useEffect(() => {
    const nextVerified = Boolean(auth.currentUser?.emailVerified || user?.emailVerified)
    setEmailVerified(nextVerified)
    if (nextVerified) setVerifyBannerMsg({ text: '', ok: false })
  }, [user])

  const nav = [
    { id: 'calendar', label: 'Calendar', iconKey: 'calendar', section: 'Finance' },
    { id: 'accounts', label: 'Accounts', iconKey: 'accounts', section: null },
    { id: 'recurring', label: 'Recurring', iconKey: 'bills', section: null },
    { id: 'budget', label: 'Budgets', iconKey: 'budget', section: 'Review' },
    { id: 'history', label: 'Insights', iconKey: 'history', section: null },
  ]
  const takdaMoreNav = [

    { id: 'crypto', label: 'Crypto 🪙', iconKey: 'portfolio', section: 'Finance' },
    { id: 'accounts', label: 'Accounts', iconKey: 'accounts', section: 'Review' },
    { id: 'recurring', label: 'Recurring', iconKey: 'bills', section: 'Review' },
    { id: 'budget', label: 'Budgets', iconKey: 'budget', section: 'Review' },
    { id: 'history', label: 'Insights', iconKey: 'history', section: 'Review' },
  ]

  const financePages = {
    calendar: Calendar,
    money: TakdaMoneyPage,
    plan: TakdaPlanPage,
    settings: Settings,
    history: HistoryAndInsights,
    savings: SavingsAndBudget,
    debts: AccountsAndDebts,
    accounts: AccountsAndDebts,
    breakdown: HistoryAndInsights,
    budget: SavingsAndBudget,
    recurring: Recurring,
    bills: Bills,
    subscriptions: Subscriptions,
  }
  const PageComponent = page === 'settings'
    ? Settings
    : financePages[page] || Calendar

  const activeSpaceConfig = APP_SPACES.find(space => space.id === activeSpace) || APP_SPACES[0]
  const selectedFinanceTool = page === 'money'
    ? MONEY_TOOLS.find(tool => tool.id === financeToolSelections.money)
    : page === 'plan'
      ? PLAN_TOOLS.find(tool => tool.id === financeToolSelections.plan)
      : null

  const isCalendarPage = page === 'calendar'
  const pageBoundaryKey = `${page}:${selectedFinanceTool?.id || 'main'}`

  const currentSidebarNav = nav
  const currentNavItem = [...nav, ...takdaMoreNav].find(item => item.id === visiblePageKey) || nav[0]
  const activeWorkspaceLabel = activeSpaceConfig.label
  const financeBottomNav = [
    { id: 'calendar', label: 'Calendar', iconKey: 'calendar', space: 'takda' },
    { id: 'accounts', label: 'Accounts', iconKey: 'accounts', space: 'takda' },
    { id: 'recurring', label: 'Recurring', iconKey: 'bills', space: 'takda' },
    { id: 'history', label: 'Insights', iconKey: 'history', space: 'takda' },
  ]
  const bottomNav = financeBottomNav
  const financeMoreNav = takdaMoreNav.map(item => ({ ...item, space: 'takda' }))
  const mobileMoreNav = [
    ...financeMoreNav,
    { id: 'settings', label: 'Settings', iconKey: 'settings', section: 'System', space: 'system' }
  ]
  const mobileMoreTitle = 'More'
  const mobileMoreMeta = 'Open savings, accounts, insights, and settings here.'
  const isMorePage = financeMoreNav.some(item => item.id === page)
  const shouldHideBottomNav = mobileNavMenuOpen || quickAddSheet.open
  const isBottomNavItemActive = item => (
    activeSpace === 'takda' && page === item.id

  )

  // 1. Takda Financial Pulse Status
  const takdaPulse = useMemo(() => {
    const transactions = data.transactions || []
    const expenses = data.expenses || []
    const bills = data.bills || []
    const accounts = data.accounts || []
    const budgets = data.budgets || []

    const isSameMonth = (dStr, yr, mo) => {
      if (!dStr) return false
      const [y, m] = dStr.split('-')
      return y === yr && m === mo
    }
    const isTransactionPaid = tx => tx.status !== 'unpaid'
    const todayStr = today()
    const viewYear = todayStr.slice(0, 4)
    const viewMonth = todayStr.slice(5, 7)

    const monthExpenses = expenses.filter(tx => isTransactionPaid(tx) && isSameMonth(tx.date, viewYear, viewMonth))
    const monthIncomes = (data.incomes || []).filter(tx => isTransactionPaid(tx) && isSameMonth(tx.date, viewYear, viewMonth))
    const incomeTotal = monthIncomes.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
    const expenseTotal = monthExpenses.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
    const monthNet = incomeTotal - expenseTotal

    const savingsRate = incomeTotal <= 0 ? (expenseTotal > 0 ? -1 : 0) : monthNet / incomeTotal

    const spendingMap = {}
    monthExpenses.forEach(tx => {
      spendingMap[tx.cat] = (spendingMap[tx.cat] || 0) + (tx.amount || 0)
    })
    let exceededBudgetsCount = 0
    let warningBudgetsCount = 0
    budgets.forEach(b => {
      const spent = spendingMap[b.cat] || 0
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0
      if (pct > 100) exceededBudgetsCount++
      else if (pct >= 80) warningBudgetsCount++
    })

    const getBillPeriodInfo = (bill) => {
      const scheds = Array.isArray(bill.schedules) ? bill.schedules : []
      const dueSoonDate = (() => {
        const d = new Date()
        d.setDate(d.getDate() + 14)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
      })()
      const list = scheds.map(s => {
        const isPaid = (bill.payments || []).some(p => p.date === s.date)
        const isOverdue = s.date < todayStr && !isPaid
        const isDue = s.date === todayStr && !isPaid
        const isSoon = s.date > todayStr && s.date <= dueSoonDate && !isPaid
        let status = 'future'
        if (isOverdue) status = 'overdue'
        else if (isDue) status = 'due'
        else if (isSoon) status = 'soon'
        else if (isPaid) status = 'paid'
        return { date: s.date, status, paid: isPaid }
      })
      const activePeriod = list.find(p => !p.paid && ['overdue', 'due', 'soon'].includes(p.status))
      return activePeriod || list[0] || null
    }

    const unpaidBillsTotal = bills.map(bill => ({
      ...bill,
      period: getBillPeriodInfo(bill),
    }))
    .filter(bill => bill.period && !bill.period.paid && ['overdue', 'due', 'soon'].includes(bill.period.status))
    .reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0)

    const liquidTotal = accounts
      .filter(account => ['Cash', 'Bank', 'E-wallet'].includes(account.type))
      .reduce((sum, account) => sum + (Number(account.balance) || 0), 0)

    let status = 'healthy'
    let color = '#00e676'
    let label = 'Healthy'

    if (savingsRate < 0.05 || (unpaidBillsTotal > 0 && liquidTotal < unpaidBillsTotal) || exceededBudgetsCount >= 3) {
      status = 'strained'
      color = '#ff3d00'
      label = 'Strained'
    } else if (savingsRate < 0.2 || exceededBudgetsCount > 0 || warningBudgetsCount > 0 || unpaidBillsTotal > 0) {
      status = 'caution'
      color = '#ffc107'
      label = 'Caution'
    }

    return { status, color, label }
  }, [data])


  const { theme, toggle: toggleTheme } = useTheme()
  // Keep the same layout + component styling in both light and dark.
  // The neo palette itself flips via `[data-theme="dark"] .neo` tokens in `index.css`.
  const neoEnabled = false

  function openSettings() {
    playTick()
    setIsSettingsOpen(true)
    setMobileNavMenuOpen(false)
    setWorkspaceDropdownOpen(false)
  }

  function openSpace(nextSpace) {
    setMobileNavMenuOpen(false)
    setWorkspaceDropdownOpen(false)
    setSpaceActionRequest(null)
    setTakdaActionRequest(null)
    setQuickAddSheet(current => current.open ? { ...current, open: false } : current)
    setActiveSpace('takda')
    setPage(DEFAULT_SPACE_PAGES.takda)
  }


  function handleDashboardNavigate(space, subPage) {
    playTick()
    setActiveSpace('takda')
    setPage(subPage || 'calendar')
  }


  function handleBadgeClick(spaceId) {
    playTick()
    openSpace('takda')
    setPage('breakdown')
  }


  function navigateToFinancePage(nextPage = DEFAULT_SPACE_PAGES.takda) {
    const alias = FINANCE_PAGE_ALIASES[nextPage]
    setActiveSpace('takda')
    if (alias?.page) {
      setPage(alias.page)
      return
    }
    if (nextPage === 'money') {
      setPage(financeToolSelections.money || 'accounts')
      return
    }
    if (nextPage === 'plan') {
      setPage(financeToolSelections.plan || 'savings')
      return
    }
    setPage(nextPage || DEFAULT_SPACE_PAGES.takda)
  }

  function handleFinanceToolSelect(group, tool) {
    setFinanceToolSelections(current => ({ ...current, [group]: tool }))
  }

  function handleBottomNavSelect(item) {
    if (item.space === 'dashboard') {
      openSpace('dashboard')
      return
    }

    navigateToFinancePage(item.id || DEFAULT_SPACE_PAGES.takda)
  }




  function toggleMobileNavMenu() {
    setMobileNavMenuOpen(current => !current)
  }

  function openQuickAdd(type) {
    setMobileNavMenuOpen(false)
    quickAddFocusProxyRef.current?.focus()
    flushSync(() => {
      setQuickAddSheet({ open: true, mode: 'manual', type, initialEntry: null })
    })
  }

  function openTakdaAction(type, payload = {}) {
    setMobileNavMenuOpen(false)
    setSpaceActionRequest(null)
    setTakdaActionRequest(null)
    if (type === 'pay-bill' && payload.billId) {
      navigateToFinancePage('bills')
      setBillPaymentTarget({ billId: payload.billId, at: Date.now() })
      return
    }
    if (type === 'goal-contribution' && payload.goalId) {
      navigateToFinancePage('savings')
      setTakdaActionRequest({ space: 'takda', type, goalId: payload.goalId, token: Date.now() })
      return
    }
  }

  function handleSpaceActionHandled(token) {
    if (!token) return
    setSpaceActionRequest(current => (current?.token === token ? null : current))
  }

  function handleTakdaActionHandled(token) {
    if (!token) return
    setTakdaActionRequest(current => (current?.token === token ? null : current))
  }



  function closeQuickAdd() {
    setQuickAddSheet(current => ({ ...current, open: false, initialEntry: null }))
  }

  function handleQuickAddTypeChange(nextType) {
    setQuickAddSheet(current => (
      current.mode !== 'manual' || !current.open || current.type === nextType
        ? current
        : { ...current, type: nextType }
    ))
  }



  async function handleResendVerification() {
    const currentUser = auth.currentUser
    if (!currentUser?.email) return
    if (emailVerified) {
      setVerifyBannerMsg({ text: 'Your email is already verified.', ok: true })
      return
    }

    setVerifySending(true)
    try {
      await sendVerificationEmailSafe(currentUser)
      setVerifyBannerMsg({ text: `Verification email sent to ${currentUser.email}.`, ok: true })
    } catch (error) {
      setVerifyBannerMsg({ text: getVerificationEmailErrorMessage(error), ok: false })
    } finally {
      setVerifySending(false)
    }
  }

  function handleNotificationAction(alert) {
    const action = alert?.action || {}

    // Takda (financial) navigation
    if (action.page) {
      navigateToFinancePage(action.page)
    }
    if (action.type === 'payBill' && action.billId) {
      setBillPaymentTarget({ billId: action.billId, at: Date.now() })
    }
    if (action.type === 'payDebt' && action.debtId) {
      setDebtPaymentTarget({ debtId: action.debtId, at: Date.now() })
    }
  }

  function handleCommandNavigate(nextPage) {
    navigateToFinancePage(nextPage)
  }


  const quickAddDefaultDate = isCalendarPage ? (calendarQuickAddDate || today()) : undefined

  const pageProps = {
    user,
    data,
    profile,
    symbol,
    privacyMode,
    exchangeRates,
    subTab: page === 'breakdown' ? 'insights' : page,

    billPaymentTarget,
    debtPaymentTarget,
    activeTab: page,
    financeToolSelections,
    onFinanceToolSelect: handleFinanceToolSelect,
    onTogglePrivacy: togglePrivacy,
    onSelectedDateChange: setCalendarQuickAddDate,
    onPayBill: (billId) => handleNotificationAction({ action: { type: 'payBill', page: 'bills', billId } }),
    onPayDebt: (debtId) => handleNotificationAction({ action: { type: 'payDebt', page: 'debts', debtId } }),
    actionRequest: takdaActionRequest?.space === 'takda' ? takdaActionRequest : null,
    onActionHandled: handleTakdaActionHandled,
    onTakdaAction: openTakdaAction,
    onNavigate: handleDashboardNavigate,
  }

  const quickAddDialogLabel = quickAddSheet.mode === 'import'
    ? 'Import screenshot'
    : quickAddSheet.mode === 'grocery'
      ? 'Grocery mode'
      : quickAddSheet.type === 'income'
        ? 'Log income'
        : 'Track expense'

  return (
    <div className={`${styles.shell} ${neoEnabled ? 'neo' : ''} ${isCalendarPage ? styles.shellCalendar : ''} ${activeSpace === 'dashboard' ? styles.shellDashboard : ''} ${styles.shellTakda}`}>
      <input ref={quickAddFocusProxyRef} type="text" inputMode="decimal" style={{ opacity: 0, position: 'absolute', top: -9999, pointerEvents: 'none' }} aria-hidden="true" tabIndex={-1} />
      <a href="#app-main" className="skipLink">Skip to main content</a>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.logoWrap}>
            <BrandLogo to="/" />
          </div>
        </div>
        {APP_SPACES.length > 1 && (
          <div className={styles.sidebarSpaceRail}>
            {APP_SPACES.map(space => (
              <button
                key={space.id}
                type="button"
                className={`${styles.spaceRailBtn} ${activeSpace === space.id ? styles.spaceRailBtnActive : ''}`}
                onClick={() => openSpace(space.id)}
                title={space.label}
                aria-label={`Switch to ${space.label}`}
                aria-pressed={activeSpace === space.id}
              >
                {NAV_ICONS[space.iconKey]}
              </button>
            ))}
          </div>
        )}
        <nav className={styles.sidebarNav} aria-label="Finance navigation">
          {currentSidebarNav.map(n => (
            <div key={n.id}>
              {n.section && <div className={styles.navSection}>{n.section}</div>}
              <button
                type="button"
                id={`${activeSpace}-nav-${n.id}`}
                className={`${styles.navItem} ${page === n.id ? styles.active : ''}`}
                onClick={() => {
                  navigateToFinancePage(n.id)
                }}
                aria-current={page === n.id ? 'page' : undefined}
                aria-label={`Open ${n.label}`}
              >
                <span className={styles.icon} aria-hidden="true">{NAV_ICONS[n.iconKey]}</span> {n.label}
              </button>
            </div>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.sidebarBottomLabel}>Signed in</div>
          <div className={styles.userCard}>
            <div className={styles.userInfo}>
              <div className={styles.avatar}>{getInitials(user.displayName || user.email)}</div>
              <div className={styles.userCopy}>
                <div className={styles.userName}>{user.displayName || 'User'}</div>
                <div className={styles.userEmail}>{user.email}</div>
              </div>
            </div>
          </div>
          <div className={styles.sidebarActions}>
            <button
              type="button"
              className={styles.btnSettings}
              onClick={openSettings}
              title="Settings"
            >
              <span className={styles.icon} aria-hidden="true">{NAV_ICONS.settings}</span>
              Settings
            </button>
            <button type="button" className={styles.btnLogout} onClick={() => signOut(auth)}>Log out</button>
          </div>
        </div>
      </aside>
      <div className={`${styles.mainWrap} ${isCalendarPage ? styles.mainWrapCalendar : ''} ${chromeMode.compact ? styles.mainWrapScrolled : ''} ${chromeMode.hidden ? styles.mainWrapChromeHidden : ''}`}>
        <header className={styles.topBar} onClick={handleTopBarTap}>
          <div className={styles.topBarLeft}>
            <div className={styles.mobileLogoOnly}>
              <BrandLogo to="/app" />
            </div>
            <div className={styles.desktopTitleOnly}>
              <span className={styles.desktopTitleText}>{currentNavItem?.label || 'Buhay'}</span>
            </div>
          </div>
          <div className={styles.topBarRight}>


            <button
              type="button"
              className={styles.themeBtn}
              onClick={togglePrivacy}
              title={privacyMode ? 'Show sensitive balances' : 'Hide sensitive balances'}
              aria-label={privacyMode ? 'Show sensitive balances' : 'Hide sensitive balances'}
            >
              {privacyMode ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
            <button
              type="button"
              className={styles.themeBtn}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
              <NotificationBell data={data} profile={profile} privacyMode={privacyMode} onAction={handleNotificationAction} space={activeSpace} />
          </div>
        </header>
        {syncIssue && (
          <div className={styles.syncBannerWrap}>
            <div className={styles.syncBanner} role="alert">
              <div className={styles.syncBannerIcon} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4"/>
                  <path d="M12 17h.01"/>
                  <path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z"/>
                </svg>
              </div>
              <div className={styles.syncBannerCopy}>
                <div className={styles.syncBannerTitle}>{syncIssue.title}</div>
                <div className={styles.syncBannerMeta}>{syncIssue.message}</div>
              </div>
              <button type="button" className={styles.syncBannerAction} onClick={() => window.location.reload()}>
                Refresh
              </button>
              <button type="button" className={styles.syncBannerDismiss} onClick={() => setSyncIssue(null)} aria-label="Dismiss sync warning">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {!!user?.email && !emailVerified && (
          <div className={styles.verifyBannerWrap}>
            <div className={styles.verifyBanner}>
              <div>
                <div className={styles.verifyBannerEyebrow}>Verify your email</div>
                <div className={styles.verifyBannerTitle}>Finish setting up your account</div>
                <div className={styles.verifyBannerMeta}>
                  You can keep using Buhay, but verified accounts are easier to recover and change securely.
                </div>
                {verifyBannerMsg.text && (
                  <div className={`${styles.verifyBannerStatus} ${verifyBannerMsg.ok ? styles.verifyBannerStatusOk : styles.verifyBannerStatusWarn}`}>
                    {verifyBannerMsg.text}
                  </div>
                )}
              </div>
              <div className={styles.verifyBannerActions}>
                <button className={styles.verifyBannerPrimary} onClick={handleResendVerification} disabled={verifySending}>
                  {verifySending ? 'Sending...' : 'Resend email'}
                </button>
              </div>
            </div>
          </div>
        )}
        <main ref={mainRef} id="app-main" className={`${styles.main} ${isCalendarPage ? styles.mainCalendar : ''}`}>
          <PageErrorBoundary key={pageBoundaryKey} onRecover={() => navigateToFinancePage(DEFAULT_SPACE_PAGES.takda)}>
            <Suspense fallback={<PageLoading />}>
              <PageComponent {...pageProps} />
            </Suspense>
          </PageErrorBoundary>
        </main>
      </div>
      <QuickAddModal
        quickAddSheet={quickAddSheet}
        closeQuickAdd={closeQuickAdd}
        quickAddDialogLabel={quickAddDialogLabel}
        user={user}
        profile={profile}
        data={data}
        symbol={symbol}
        quickAddDefaultDate={quickAddDefaultDate}
        handleQuickAddTypeChange={handleQuickAddTypeChange}
      />
      {workspaceDropdownOpen && (
        <>
          <div className={styles.workspaceDropdownBackdrop} onClick={() => setWorkspaceDropdownOpen(false)} aria-hidden="true" />
          <div className={styles.workspaceDropdown}>
            <div className={styles.workspaceDropdownHeader}>Switch Space</div>
            {APP_SPACES.map(space => (
              <button
                key={space.id}
                type="button"
                className={`${styles.workspaceDropdownItem} ${activeSpace === space.id ? styles.workspaceDropdownItemActive : ''}`}
                onClick={() => openSpace(space.id)}
              >
                <span className={styles.workspaceDropdownIcon}>{NAV_ICONS[space.iconKey]}</span>
                <span className={styles.workspaceDropdownCopy}>
                  <span className={styles.workspaceDropdownName}>{space.label}</span>
                  <span className={styles.workspaceDropdownMeta}>{space.meta}</span>
                </span>
                {activeSpace === space.id && <span className={styles.workspaceDropdownCheck}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
      {mobileNavMenuOpen && (
        <>
          <button
            type="button"
            className={styles.mobileNavBackdrop}
            onClick={() => setMobileNavMenuOpen(false)}
            aria-label="Close more pages"
          />
          <div className={styles.mobileNavSheet} role="dialog" aria-modal="true" aria-labelledby="mobile-more-title" aria-describedby="mobile-more-description">
            <div className="srOnly" id="mobile-more-description">Extra app pages and tools.</div>
            <div className={styles.mobileNavSheetHandle} aria-hidden="true" />
            <div className={styles.mobileNavSheetHeader}>
              <div>
                <div className={styles.mobileNavSheetTitle} id="mobile-more-title">{mobileMoreTitle}</div>
                <div className={styles.mobileNavSheetMeta}>{mobileMoreMeta}</div>
              </div>
              <button
                type="button"
                className={styles.mobileNavSheetClose}
                onClick={() => setMobileNavMenuOpen(false)}
                aria-label="Close more pages"
              >
                ✕
              </button>
            </div>
            <div className={styles.mobileNavList}>
              {mobileMoreNav.map(n => (
                <button
                  key={n.id}
                  type="button"
                  className={`${styles.mobileNavLink} ${page === n.id ? styles.mobileNavLinkActive : ''}`}
                  onClick={() => {
                    if (n.id === 'settings') {
                      openSettings()
                    } else {
                      navigateToFinancePage(n.id)
                    }
                    setMobileNavMenuOpen(false)
                  }}
                  aria-current={page === n.id ? 'page' : undefined}
                  aria-label={`Open ${n.label}`}
                >
                  <span className={styles.mobileNavLinkIcon}>{NAV_ICONS[n.iconKey]}</span>
                  <span className={styles.mobileNavLinkCopy}>
                    <span className={styles.mobileNavLinkLabel}>{n.label}</span>
                    <span className={styles.mobileNavLinkMeta}>{n.section || 'More'}</span>
                  </span>
                  <span className={styles.mobileNavLinkChevron}>›</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <nav className={`${styles.bottomNav} ${shouldHideBottomNav ? styles.bottomNavHidden : ''}`} aria-label="Primary navigation">
        {bottomNav.map(n => (
          <button
            key={`${n.space}-${n.id}`}
            type="button"
            id={`${n.space}-nav-${n.id}`}
            className={`${styles.bottomNavItem} ${isBottomNavItemActive(n) ? styles.active : ''}`}
            onClick={() => handleBottomNavSelect(n)}
            aria-current={isBottomNavItemActive(n) ? 'page' : undefined}
            aria-label={`Open ${n.label}`}
          >
            <span className={styles.bottomNavIcon}>{NAV_ICONS[n.iconKey]}</span>
            <span className={styles.bottomNavLabel}>{n.label}</span>
          </button>
        ))}
        {!!mobileMoreNav.length && (
          <button
          type="button"
          className={`${styles.bottomNavItem} ${(isMorePage || mobileNavMenuOpen) ? styles.active : ''}`}
          onClick={toggleMobileNavMenu}
          aria-expanded={mobileNavMenuOpen}
          aria-label="More pages"
          aria-haspopup="dialog"
        >
          <span className={styles.bottomNavIcon}>{NAV_ICONS.more}</span>
          <span className={styles.bottomNavLabel}>More</span>
        </button>
        )}
      </nav>

      <ChangelogModal changelogData={changelogData} dismissChangelog={dismissChangelog} />
      <SettingsModal 
        isSettingsOpen={isSettingsOpen} 
        setIsSettingsOpen={setIsSettingsOpen} 
        activeSpaceConfig={activeSpaceConfig} 
        pageProps={pageProps} 
        NAV_ICONS={NAV_ICONS} 
      />
      {activeTour && (
        <GuidedTour
          space={activeTour}
          activeTab={getActiveTourTab()}
          onTabChange={handleTourTabChange}
          onFinish={handleFinishTour}
        />
      )}
    </div>
  )
}
