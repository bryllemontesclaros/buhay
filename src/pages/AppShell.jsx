import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth, getVerificationEmailErrorMessage, sendVerificationEmailSafe } from '../lib/firebase'
import { fsSetProfile, fsSyncDueLinkedTransactions, listenCol, listenProfile } from '../lib/firestore'
import { getInitials, getCurrencySymbol, today, isSameMonth, playTick } from '../lib/utils'
import { getMonthTransactions, isTransactionPaid } from '../lib/finance'
import { getBillPeriodInfo } from '../lib/bills'
import { safeScrollIntoView } from '../lib/ui'
import Calendar from './Calendar'
import Dashboard from './Dashboard'
import Savings from './Savings'
import Accounts from './Accounts'
import Breakdown from './Breakdown'
import Budget from './Budget'
import Bills from './Bills'
import Settings from './Settings'
import History from './History'
import Portfolio from './Portfolio'
import QuickAdd from './QuickAdd'
import Debts from './Debts'
import {
  findPresetByLabel,
  getDefaultTransactionDraft,
  sanitizeTransactionCategory,
  sanitizeTransactionSubcategory,
} from '../lib/transactionOptions'
import { consumeStartSpaceIntent } from '../lib/startIntent'
import { useTheme } from '../lib/theme.jsx'
import NotificationBell from '../components/NotificationBell'
import styles from './AppShell.module.css'

const Lakas = lazy(() => import('./Lakas'))
const Tala = lazy(() => import('./Tala'))

const LAKAS_COLLECTIONS = [
  'lakasRoutines',
  'lakasWorkouts',
  'lakasBodyLogs',
  'lakasActivities',
  'lakasHabits',
  'lakasReminders',
  'lakasMeals',
  'lakasGoals',
]

const TALA_COLLECTIONS = [
  'talaCheckins',
  'talaJournal',
  'talaMoods',
  'talaTasks',
  'talaGoals',
]

class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Buhay page failed to render', error, info)
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
  lakas: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 10-13h-7l0-7Z"/>
    </svg>
  ),
  overview: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h4l2-6 4 12 2-6h4"/>
      <path d="M5 20h14"/>
    </svg>
  ),
  workouts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14V10"/>
      <path d="M8 16V8"/>
      <path d="M16 16V8"/>
      <path d="M20 14V10"/>
      <path d="M8 12h8"/>
      <path d="M2 12h2"/>
      <path d="M20 12h2"/>
    </svg>
  ),
  meals: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v8"/>
      <path d="M5 3v4"/>
      <path d="M9 3v4"/>
      <path d="M7 11v10"/>
      <path d="M15 3v18"/>
      <path d="M15 3c2 1.2 3 3.2 3 6 0 2.4-1 4-3 4"/>
    </svg>
  ),
  activity: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17.5c2.5-5 4.5-7.5 7-7.5 2 0 3 1.5 5 1.5 1.2 0 2-.5 2.5-1"/>
      <circle cx="7" cy="6" r="2"/>
      <path d="M11 22h.01"/>
      <path d="M16 20h.01"/>
      <path d="M20 22h.01"/>
    </svg>
  ),
  habits: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7 9 18l-5-5"/>
      <path d="M4 6h8"/>
      <path d="M4 10h5"/>
    </svg>
  ),
  body: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2.5"/>
      <path d="M6 21c.7-4 2.7-6 6-6s5.3 2 6 6"/>
      <path d="M8 10h8"/>
      <path d="M9 10v5"/>
      <path d="M15 10v5"/>
    </svg>
  ),
  goals: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4"/>
      <path d="M5 5h11l-1.8 3L16 11H5"/>
      <path d="M12 15l2 2 4-5"/>
    </svg>
  ),
  reminders: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9"/>
      <path d="M10 21h4"/>
      <path d="M12 3V2"/>
    </svg>
  ),
  tala: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 4.8L19 9.6l-4.2 3.1.1 5.3L12 15.2 9.1 18l.1-5.3L5 9.6l5.2-1.8L12 3z"/>
      <path d="M4 20h16"/>
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
  journal: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 1 5 17.5z"/>
      <path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H19"/>
      <path d="M9 7h6"/>
      <path d="M9 10h5"/>
    </svg>
  ),
  mood: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M8 10h.01"/>
      <path d="M16 10h.01"/>
      <path d="M8.5 15c1.8 1.4 5.2 1.4 7 0"/>
    </svg>
  ),
  tasks: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13"/>
      <path d="M8 12h13"/>
      <path d="M8 18h13"/>
      <path d="M3 6l1 1 2-2"/>
      <path d="M3 12l1 1 2-2"/>
      <path d="M3 18l1 1 2-2"/>
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
  { id: 'takda', label: 'Takda', meta: 'Finance', iconKey: 'finance', cue: 'Money clarity' },
  { id: 'lakas', label: 'Lakas', meta: 'Fitness', iconKey: 'lakas', cue: 'Training rhythm' },
  { id: 'tala', label: 'Tala', meta: 'Reflection', iconKey: 'tala', cue: 'Calm reflection' },
]

const DEFAULT_SPACE_PAGES = {
  takda: 'calendar',
  lakas: 'workout',
  tala: 'journal',
}

const FINANCE_PAGE_ALIASES = {
  accounts: { page: 'accounts' },
  portfolio: { page: 'portfolio' },
  history: { page: 'history' },
  breakdown: { page: 'breakdown' },
  savings: { page: 'savings' },
  bills: { page: 'bills' },
  budget: { page: 'budget' },
  debts: { page: 'debts' },
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
    meta: 'Due dates and paid status',
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
    label: 'Debts & Cards',
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
    if (!window.matchMedia('(max-width: 768px)').matches) return

    window.requestAnimationFrame(() => {
      safeScrollIntoView(contentRef.current, { behavior: 'smooth', block: 'start' })
    })
  }, [selectedTool.id])

  return (
    <div className={styles.financeGroupPage}>
      <section className={styles.financeGroupHero}>
        <div className={styles.financeGroupSwitch} role="tablist" aria-label={`${title} tools`}>
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
        <div className={styles.financeGroupIntro}>
          <div className={styles.financeGroupEyebrow}>{eyebrow}</div>
          <h2>{title}</h2>
          <p>{description}</p>
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
  const [page, setPage] = useState(DEFAULT_SPACE_PAGES.takda)
  const [lakasPage, setLakasPage] = useState(DEFAULT_SPACE_PAGES.lakas)
  const [talaPage, setTalaPage] = useState(DEFAULT_SPACE_PAGES.tala)
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
    portfolioHoldings: [],
    balanceOverrideLog: [],
    lakasRoutines: [],
    lakasWorkouts: [],
    lakasBodyLogs: [],
    lakasActivities: [],
    lakasHabits: [],
    lakasReminders: [],
    lakasMeals: [],
    lakasGoals: [],
    talaCheckins: [],
    talaJournal: [],
    talaMoods: [],
    talaTasks: [],
    talaGoals: [],
  })
  const [profile, setProfile] = useState({})
  const [quickAddMenuOpen, setQuickAddMenuOpen] = useState(false)
  const [quickAddSheet, setQuickAddSheet] = useState({ open: false, mode: 'manual', type: 'expense', initialEntry: null })
  const [spaceActionRequest, setSpaceActionRequest] = useState(null)
  const [takdaActionRequest, setTakdaActionRequest] = useState(null)
  const [portfolioActionRequest, setPortfolioActionRequest] = useState(null)
  const [mobileNavMenuOpen, setMobileNavMenuOpen] = useState(false)
  const [calendarQuickAddDate, setCalendarQuickAddDate] = useState('')
  const [emailVerified, setEmailVerified] = useState(() => Boolean(auth.currentUser?.emailVerified || user?.emailVerified))
  const [verifyBannerMsg, setVerifyBannerMsg] = useState({ text: '', ok: false })
  const [verifySending, setVerifySending] = useState(false)
  const [syncIssue, setSyncIssue] = useState(null)
  const [billPaymentTarget, setBillPaymentTarget] = useState(null)
  const [chromeMode, setChromeMode] = useState({ compact: false, hidden: false })
  const [exchangeRates, setExchangeRates] = useState(null)
  const syncingDueTransactionsRef = useRef(false)
  const preferredSpaceAppliedRef = useRef(false)
  const mainRef = useRef(null)
  const lastMainScrollRef = useRef(0)
  const previousVisiblePageRef = useRef(null)



  function handleRealtimeError(key, error) {
    console.error(`Buhay sync failed for ${key}`, error)
    if (Object.prototype.hasOwnProperty.call(loadFlagsRef.current, key)) {
      markLoaded(key)
    }
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
      listenCol(uid, 'portfolioHoldings', rows => {
        setData(d => ({ ...d, portfolioHoldings: rows }))
      }, error => handleRealtimeError('portfolioHoldings', error)),
      listenCol(uid, 'balanceOverrideLog', rows => {
        setData(d => ({ ...d, balanceOverrideLog: rows }))
      }, error => handleRealtimeError('balanceOverrideLog', error)),
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
    if (!['takda', 'lakas', 'tala'].includes(profile?.preferredSpace)) return
    preferredSpaceAppliedRef.current = true
    setActiveSpace(profile.preferredSpace)
  }, [profile?.preferredSpace])

  useEffect(() => {
    if (!user) return
    const intendedSpace = consumeStartSpaceIntent()
    if (!['takda', 'lakas', 'tala'].includes(intendedSpace)) return
    setActiveSpace(intendedSpace)
  }, [user])

  useEffect(() => {
    if (!user || activeSpace !== 'lakas') return undefined

    const uid = user.uid
    const unsubs = LAKAS_COLLECTIONS.map(collectionName => (
      listenCol(uid, collectionName, rows => {
        setData(d => ({ ...d, [collectionName]: rows }))
      }, error => handleRealtimeError(collectionName, error))
    ))

    return () => unsubs.forEach(unsub => unsub())
  }, [activeSpace, user])

  useEffect(() => {
    if (!user || activeSpace !== 'tala') return undefined

    const uid = user.uid
    const unsubs = TALA_COLLECTIONS.map(collectionName => (
      listenCol(uid, collectionName, rows => {
        setData(d => ({ ...d, [collectionName]: rows }))
      }, error => handleRealtimeError(collectionName, error))
    ))

    return () => unsubs.forEach(unsub => unsub())
  }, [activeSpace, user])

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

  const symbol = getCurrencySymbol(profile.currency || 'PHP')
  const privacyMode = false

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
      setQuickAddMenuOpen(false)
      setQuickAddSheet(current => current.open ? { ...current, open: false } : current)
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  useEffect(() => {
    setMobileNavMenuOpen(false)
    setQuickAddMenuOpen(false)
    if (activeSpace !== 'takda' || page !== 'calendar') setCalendarQuickAddDate('')
  }, [activeSpace, page, lakasPage, talaPage])

  const resolvedLakasPage = ({
    today: 'workout',
    overview: 'workout',
    train: 'workout',
    workouts: 'workout',
    log: 'workout',
    track: 'body',
    nutrition: 'body',
    meals: 'body',
    activity: 'body',
    habits: 'body',
    goals: 'body',
    measurements: 'body',
    'body-log': 'body',
  }[lakasPage] || lakasPage)

  const visiblePageKey = activeSpace === 'takda'
    ? page
    : activeSpace === 'lakas'
      ? resolvedLakasPage
      : talaPage

  useEffect(() => {
    if (previousVisiblePageRef.current == null) {
      previousVisiblePageRef.current = `${activeSpace}:${visiblePageKey}`
      return
    }

    const nextVisiblePage = `${activeSpace}:${visiblePageKey}`
    if (previousVisiblePageRef.current === nextVisiblePage) return
    previousVisiblePageRef.current = nextVisiblePage

    if (typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 768px)').matches) return

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
        const isMobile = window.matchMedia('(max-width: 768px)').matches

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
    setChromeMode({ compact: false, hidden: false })
    lastMainScrollRef.current = 0
  }, [activeSpace, visiblePageKey])

  useEffect(() => {
    const nextVerified = Boolean(auth.currentUser?.emailVerified || user?.emailVerified)
    setEmailVerified(nextVerified)
    if (nextVerified) setVerifyBannerMsg({ text: '', ok: false })
  }, [user])

  const nav = [
    { id: 'calendar', label: 'Today', iconKey: 'calendar', section: 'Start' },
    { id: 'portfolio', label: 'Portfolio', iconKey: 'portfolio', section: null },
    { id: 'history', label: 'History', iconKey: 'history', section: 'Do' },
    { id: 'bills', label: 'Bills', iconKey: 'bills', section: null },
    { id: 'savings', label: 'Savings', iconKey: 'savings', section: 'Review' },
    { id: 'debts', label: 'Debts & Cards', iconKey: 'debts', section: null },
    { id: 'accounts', label: 'Accounts', iconKey: 'accounts', section: null },
    { id: 'budget', label: 'Budget', iconKey: 'budget', section: null },
    { id: 'breakdown', label: 'Insights', iconKey: 'insights', section: null },
    { id: 'settings', label: 'Settings', iconKey: 'settings', section: 'Manage' },
  ]
  const lakasNav = [
    { id: 'workout', label: 'Workout', iconKey: 'workouts', section: 'Core' },
    { id: 'body', label: 'Body & Nutrition', iconKey: 'meals', section: null },
    { id: 'progress', label: 'Progress', iconKey: 'body', section: 'Review' },
    { id: 'settings', label: 'Settings', iconKey: 'settings', section: 'Manage' },
  ]
  const talaNav = [
    { id: 'journal', label: 'Journal', iconKey: 'journal', section: 'Core' },
    { id: 'track', label: 'Track', iconKey: 'mood', section: null },
    { id: 'focus', label: 'Focus', iconKey: 'goals', section: null },
    { id: 'settings', label: 'Settings', iconKey: 'settings', section: 'Manage' },
  ]
  const takdaMoreNav = [
    { id: 'dashboard', label: 'Overview', iconKey: 'home', section: 'Review' },
    { id: 'savings', label: 'Savings', iconKey: 'savings', section: 'Review' },
    { id: 'debts', label: 'Debts & Cards', iconKey: 'debts', section: 'Review' },
    { id: 'accounts', label: 'Accounts', iconKey: 'accounts', section: 'Review' },
    { id: 'budget', label: 'Budget', iconKey: 'budget', section: 'Review' },
    { id: 'breakdown', label: 'Insights', iconKey: 'insights', section: 'Review' },
    { id: 'settings', label: 'Settings', iconKey: 'settings', section: 'Manage' },
  ]

  const financePages = {
    dashboard: Dashboard,
    calendar: Calendar,
    portfolio: Portfolio,
    money: TakdaMoneyPage,
    plan: TakdaPlanPage,
    settings: Settings,
    history: History,
    savings: Savings,
    debts: Debts,
    accounts: Accounts,
    breakdown: Breakdown,
    budget: Budget,
    bills: Bills,
  }
  const PageComponent = activeSpace === 'lakas' ? Lakas : activeSpace === 'tala' ? Tala : financePages[page] || Dashboard
  const activeSpaceConfig = APP_SPACES.find(space => space.id === activeSpace) || APP_SPACES[0]
  const selectedFinanceTool = page === 'money'
    ? MONEY_TOOLS.find(tool => tool.id === financeToolSelections.money)
    : page === 'plan'
      ? PLAN_TOOLS.find(tool => tool.id === financeToolSelections.plan)
      : null

  const isCalendarPage = activeSpace === 'takda' && page === 'calendar'
  const pageBoundaryKey = activeSpace === 'takda'
    ? `${page}:${selectedFinanceTool?.id || 'main'}`
    : activeSpace === 'lakas'
      ? `lakas:${resolvedLakasPage}`
      : `tala:${talaPage}`
  const currentSidebarNav = activeSpace === 'lakas' ? lakasNav : activeSpace === 'tala' ? talaNav : nav
  const currentNavItem = (
    activeSpace === 'takda'
      ? [...nav, ...takdaMoreNav]
      : activeSpace === 'lakas'
        ? lakasNav
        : talaNav
  ).find(item => item.id === visiblePageKey) || currentSidebarNav[0]
  const activeWorkspaceLabel = activeSpace === 'takda' && selectedFinanceTool
    ? selectedFinanceTool.label
    : currentNavItem?.label || activeSpaceConfig.label
  const financeBottomNav = [
    { id: 'calendar', label: 'Today', iconKey: 'calendar', space: 'takda' },
    { id: 'portfolio', label: 'Portfolio', iconKey: 'portfolio', space: 'takda' },
    { id: 'bills', label: 'Bills', iconKey: 'bills', space: 'takda' },
    { id: 'history', label: 'History', iconKey: 'history', space: 'takda' },
  ]
  const lakasBottomNav = [
    { id: 'workout', label: 'Workout', iconKey: 'workouts', space: 'lakas' },
    { id: 'body', label: 'Body', iconKey: 'meals', space: 'lakas' },
    { id: 'progress', label: 'Progress', iconKey: 'body', space: 'lakas' },
  ]
  const talaBottomNav = [
    { id: 'journal', label: 'Journal', iconKey: 'journal', space: 'tala' },
    { id: 'track', label: 'Track', iconKey: 'mood', space: 'tala' },
    { id: 'focus', label: 'Focus', iconKey: 'goals', space: 'tala' },
  ]
  const bottomNav = activeSpace === 'lakas' ? lakasBottomNav : activeSpace === 'tala' ? talaBottomNav : financeBottomNav
  const financeMoreNav = takdaMoreNav.map(item => ({ ...item, space: 'takda' }))
  const lakasMoreNav = lakasNav
    .filter(item => ['settings'].includes(item.id))
    .map(item => ({ ...item, space: 'lakas' }))
  const talaMoreNav = talaNav
    .filter(item => ['settings'].includes(item.id))
    .map(item => ({ ...item, space: 'tala' }))
  talaMoreNav.unshift({ id: 'insights', label: 'Insights', iconKey: 'insights', section: 'Review', space: 'tala' })
  const mobileMoreNav = activeSpace === 'lakas' ? lakasMoreNav : activeSpace === 'tala' ? talaMoreNav : financeMoreNav
  const mobileMoreTitle = activeSpace === 'lakas' ? 'More Lakas' : activeSpace === 'tala' ? 'More Tala' : 'More'
  const mobileMoreMeta = activeSpace === 'lakas'
    ? 'Open Lakas settings and account controls.'
    : activeSpace === 'tala'
      ? 'Open Tala insights and settings.'
      : 'Open savings, accounts, insights, and Takda settings here.'
  const isMorePage = activeSpace === 'lakas'
    ? lakasMoreNav.some(item => item.id === resolvedLakasPage)
    : activeSpace === 'tala'
      ? talaMoreNav.some(item => item.id === talaPage)
      : financeMoreNav.some(item => item.id === page)
  const shouldHideFabWrap = mobileNavMenuOpen || (activeSpace === 'takda' && quickAddSheet.open)
  const shouldHideBottomNav = quickAddMenuOpen || mobileNavMenuOpen || (activeSpace === 'takda' && quickAddSheet.open)
  const isBottomNavItemActive = item => (
    item.space === 'lakas'
      ? activeSpace === 'lakas' && resolvedLakasPage === item.id
      : item.space === 'tala'
        ? activeSpace === 'tala' && talaPage === item.id
        : activeSpace === 'takda' && page === item.id
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

  // 2. Lakas Weekly Consistency Score
  const lakasScoreValue = useMemo(() => {
    const workouts = data.lakasWorkouts || []
    const habits = data.lakasHabits || []

    const now = new Date()
    const startMs = now.getTime() - 7 * 24 * 60 * 60 * 1000
    const endMs = now.getTime()

    const formatDate = d => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    const startDateStr = formatDate(new Date(startMs))
    const endDateStr = formatDate(new Date(endMs))

    const weekWorkouts = workouts.filter(w => w.date > startDateStr && w.date <= endDateStr)
    const weekHabits = habits.filter(h => h.date > startDateStr && h.date <= endDateStr)

    const workoutsPoints = weekWorkouts.length * 10
    const habitsPoints = weekHabits.reduce((sum, h) => sum + (Number(h.score) || 0), 0) * 2
    const runDist = weekWorkouts.reduce((sum, w) => sum + (Number(w.distance) || 0), 0)
    const runPoints = Math.round(runDist * 3)

    return workoutsPoints + habitsPoints + runPoints
  }, [data])

  // 3. Tala Weather Climate Status
  const talaWeatherValue = useMemo(() => {
    const checkins = data.talaCheckins || []
    const moods = data.talaMoods || []
    const todayStr = today()

    const todayLog = checkins.find(row => row.date === todayStr)
    const sortedMoods = [...moods].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    const lastMood = sortedMoods[0]?.mood || 'Okay'

    const mName = todayLog?.mood || lastMood
    const emojiMap = { Great: '☀️', Good: '🌤️', Okay: '☁️', Low: '🌧️', Heavy: '⛈️' }
    return emojiMap[mName] || '☁️'
  }, [data])

  const { theme, toggle: toggleTheme } = useTheme()
  // Keep the same layout + component styling in both light and dark.
  // The neo palette itself flips via `[data-theme="dark"] .neo` tokens in `index.css`.
  const neoEnabled = false

  function openSpace(nextSpace) {
    setMobileNavMenuOpen(false)
    setQuickAddMenuOpen(false)
    setSpaceActionRequest(null)
    setTakdaActionRequest(null)
    setQuickAddSheet(current => current.open ? { ...current, open: false } : current)
    const normalizedSpace = ['lakas', 'tala'].includes(nextSpace) ? nextSpace : 'takda'
    setActiveSpace(normalizedSpace)
    if (normalizedSpace === 'takda') setPage(DEFAULT_SPACE_PAGES.takda)
    if (normalizedSpace === 'lakas') setLakasPage(DEFAULT_SPACE_PAGES.lakas)
    if (normalizedSpace === 'tala') setTalaPage(DEFAULT_SPACE_PAGES.tala)
  }

  function handleBadgeClick(spaceId) {
    playTick()
    openSpace(spaceId)
    if (spaceId === 'takda') {
      setPage('breakdown')
    } else if (spaceId === 'lakas') {
      setLakasPage('progress')
    } else if (spaceId === 'tala') {
      setTalaPage('insights')
    }
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
    if (item.space === 'lakas') {
      openSpace('lakas')
      setLakasPage(item.id || DEFAULT_SPACE_PAGES.lakas)
      return
    }

    if (item.space === 'tala') {
      openSpace('tala')
      setTalaPage(item.id || DEFAULT_SPACE_PAGES.tala)
      return
    }

    navigateToFinancePage(item.id || DEFAULT_SPACE_PAGES.takda)
  }



  function toggleQuickAddMenu() {
    if (quickAddSheet.open) return
    if (activeSpace === 'takda' && page === 'portfolio') {
      setMobileNavMenuOpen(false)
      setQuickAddMenuOpen(false)
      setPortfolioActionRequest({ type: 'add-holding', token: Date.now() })
      return
    }
    setMobileNavMenuOpen(false)
    setQuickAddMenuOpen(current => !current)
  }

  function toggleMobileNavMenu() {
    setQuickAddMenuOpen(false)
    setMobileNavMenuOpen(current => !current)
  }

  function openQuickAdd(type) {
    setMobileNavMenuOpen(false)
    setQuickAddMenuOpen(false)
    setQuickAddSheet({ open: true, mode: 'manual', type, initialEntry: null })
  }

  function openLakasFabAction(type) {
    const targetPage = type === 'meal-log' ? 'body' : 'workout'
    openSpace('lakas')
    setLakasPage(targetPage)
    setSpaceActionRequest({ space: 'lakas', type, token: Date.now() })
  }

  function openTalaFabAction(type) {
    const targetPage = type === 'mood' ? 'track' : 'journal'
    openSpace('tala')
    setTalaPage(targetPage)
    setSpaceActionRequest({ space: 'tala', type, token: Date.now() })
  }

  function openTakdaAction(type, payload = {}) {
    setMobileNavMenuOpen(false)
    setQuickAddMenuOpen(false)
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

  function handlePortfolioActionHandled(token) {
    if (!token) return
    setPortfolioActionRequest(current => (current?.token === token ? null : current))
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

    // Lakas navigation
    if (activeSpace === 'lakas') {
      if (action.page) {
        openSpace('lakas')
        setLakasPage(action.page)
      }
      return
    }

    // Tala navigation
    if (activeSpace === 'tala') {
      if (action.page) {
        openSpace('tala')
        setTalaPage(action.page)
      }
      return
    }

    // Takda (financial) navigation
    if (action.page === 'lakas') {
      openSpace('lakas')
    } else if (action.page === 'tala') {
      openSpace('tala')
    } else if (action.page) {
      navigateToFinancePage(action.page)
    }
    if (action.type === 'payBill' && action.billId) {
      setBillPaymentTarget({ billId: action.billId, at: Date.now() })
    }
  }

  function handleCommandNavigate(nextPage) {
    if (nextPage === 'lakas') {
      openSpace('lakas')
      setLakasPage(DEFAULT_SPACE_PAGES.lakas)
      return
    }

    if (nextPage === 'tala') {
      openSpace('tala')
      setTalaPage(DEFAULT_SPACE_PAGES.tala)
      return
    }

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

    billPaymentTarget,
    activeTab: activeSpace === 'lakas' ? lakasPage : activeSpace === 'tala' ? talaPage : page,
    financeToolSelections,
    onFinanceToolSelect: handleFinanceToolSelect,
    onTogglePrivacy: () => {},
    onSelectedDateChange: setCalendarQuickAddDate,
    actionRequest: activeSpace === 'takda'
      ? (takdaActionRequest?.space === 'takda' ? takdaActionRequest : null)
      : (spaceActionRequest?.space === activeSpace ? spaceActionRequest : null),
    onActionHandled: activeSpace === 'takda' ? handleTakdaActionHandled : handleSpaceActionHandled,
    onTakdaAction: openTakdaAction,
    onLakasTabChange: setLakasPage,
    portfolioActionRequest: activeSpace === 'takda' && page === 'portfolio' ? portfolioActionRequest : null,
    onPortfolioActionHandled: handlePortfolioActionHandled,
  }

  const quickAddDialogLabel = quickAddSheet.mode === 'import'
    ? 'Import screenshot'
    : quickAddSheet.mode === 'grocery'
      ? 'Grocery mode'
      : quickAddSheet.type === 'income'
        ? 'Log income'
        : 'Track expense'
  const fabMenuLabel = activeSpace === 'lakas'
    ? 'Lakas quick actions'
    : activeSpace === 'tala'
      ? 'Tala quick actions'
      : 'Takda quick actions'
  const fabButtonLabel = activeSpace === 'lakas'
    ? 'Open Lakas quick actions'
    : activeSpace === 'tala'
      ? 'Open Tala quick actions'
      : page === 'portfolio'
        ? 'Add portfolio holding'
        : 'Open Takda quick actions'
  const isContextualFabMenu = activeSpace === 'lakas' || activeSpace === 'tala'
  const fabActions = activeSpace === 'lakas'
    ? [
        { key: 'meal-log', label: 'Meal Log', meta: 'Log calories, protein, carbs, fat, and notes.', icon: 'ML', className: styles.fabActionMeal, onClick: () => openLakasFabAction('meal-log') },
        { key: 'gym-session', label: 'Start Gym Session', meta: 'Open guided workout mode right away.', icon: 'GS', className: styles.fabActionSession, onClick: () => openLakasFabAction('gym-session') },
      ]
    : activeSpace === 'tala'
      ? [
          { key: 'journal', label: 'Add Journal', meta: 'Write a private entry and jump straight into the editor.', icon: 'JR', className: styles.fabActionJournal, onClick: () => openTalaFabAction('journal') },
          { key: 'mood', label: 'What is your mood?', meta: 'Log mood, energy, stress, and triggers.', icon: 'MO', className: styles.fabActionMood, onClick: () => openTalaFabAction('mood') },
        ]
      : [
          { key: 'expense', label: 'Expense', icon: '-', className: styles.fabActionExpense, onClick: () => openQuickAdd('expense') },
          { key: 'income', label: 'Income', icon: '+', className: styles.fabActionIncome, onClick: () => openQuickAdd('income') },
        ]

  return (
    <div className={`${styles.shell} ${neoEnabled ? 'neo' : ''} ${isCalendarPage ? styles.shellCalendar : ''} ${activeSpace === 'lakas' ? styles.shellLakas : ''} ${activeSpace === 'tala' ? styles.shellTala : ''}`}>
      <a href="#app-main" className="skipLink">Skip to main content</a>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.logoWrap}>
            <div className={styles.logo}>Buhay</div>
          </div>
        </div>
        <div className={styles.sidebarSectionLabel}>Spaces</div>
        <div className={styles.spaceSwitcher} role="group" aria-label="Switch app space">
          {APP_SPACES.map(space => (
            <button
              key={space.id}
              type="button"
              className={`${styles.spaceButton} ${activeSpace === space.id ? styles.spaceButtonActive : ''}`}
              onClick={() => openSpace(space.id)}
              aria-pressed={activeSpace === space.id}
              aria-label={`Open ${space.label} ${space.meta} space`}
            >
              <span className={styles.spaceIcon}>{NAV_ICONS[space.iconKey]}</span>
              <span className={styles.spaceCopy}>
                <span className={styles.spaceName}>{space.label}</span>
                <span className={styles.spaceMeta}>{space.meta}</span>
              </span>
            </button>
          ))}
        </div>
        <nav className={styles.sidebarNav} aria-label={activeSpace === 'lakas' ? 'Lakas navigation' : activeSpace === 'tala' ? 'Tala navigation' : 'Finance navigation'}>
          {currentSidebarNav.map(n => (
            <div key={n.id}>
              {n.section && <div className={styles.navSection}>{n.section}</div>}
              <button
                type="button"
                className={`${styles.navItem} ${activeSpace === 'lakas' ? resolvedLakasPage === n.id ? styles.active : '' : activeSpace === 'tala' ? talaPage === n.id ? styles.active : '' : page === n.id ? styles.active : ''}`}
                onClick={() => {
                  if (activeSpace === 'lakas') {
                    setLakasPage(n.id)
                    return
                  }
                  if (activeSpace === 'tala') {
                    setTalaPage(n.id)
                    return
                  }
                  navigateToFinancePage(n.id)
                }}
                aria-current={activeSpace === 'lakas' ? resolvedLakasPage === n.id ? 'page' : undefined : activeSpace === 'tala' ? talaPage === n.id ? 'page' : undefined : page === n.id ? 'page' : undefined}
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
          <button type="button" className={styles.btnLogout} onClick={() => signOut(auth)}>Log out</button>
        </div>
      </aside>
      <div className={`${styles.mainWrap} ${isCalendarPage ? styles.mainWrapCalendar : ''} ${chromeMode.compact ? styles.mainWrapScrolled : ''} ${chromeMode.hidden ? styles.mainWrapChromeHidden : ''}`}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <div className={styles.topBarTitleBlock}>
              <div className={styles.topBarKicker}>{activeSpaceConfig.label}</div>
              <div className={styles.topBarHeadingRow}>
                <div className={styles.topBarLogo}>{activeWorkspaceLabel}</div>
                <div className={styles.topBarContextPill}>{activeSpaceConfig.meta}</div>
              </div>
            </div>
            <div className={styles.mobileSpaceSwitch} role="group" aria-label="Switch app space">
              {APP_SPACES.map(space => (
                <button
                  key={space.id}
                  type="button"
                  className={`${styles.mobileSpaceButton} ${activeSpace === space.id ? styles.mobileSpaceButtonActive : ''}`}
                  onClick={() => openSpace(space.id)}
                  aria-pressed={activeSpace === space.id}
                  aria-label={`Open ${space.label} ${space.meta} space`}
                >
                  {space.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.topBarRight}>

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
      {(quickAddMenuOpen || (activeSpace === 'takda' && quickAddSheet.open)) && (
        <div
          className={styles.fabBackdrop}
          aria-hidden="true"
          onClick={() => {
            setQuickAddMenuOpen(false)
            if (activeSpace === 'takda') closeQuickAdd()
          }}
        />
      )}
      {['takda', 'lakas', 'tala'].includes(activeSpace) && (
        <div className={`${styles.fabWrap} ${shouldHideFabWrap ? styles.fabWrapHidden : ''}`}>
          {quickAddMenuOpen && (
            <div className={`${styles.fabMenu} ${isContextualFabMenu ? styles.fabMenuContextual : ''}`} role="menu" aria-label={fabMenuLabel}>
              {fabActions.map(action => (
                <button key={action.key} type="button" className={`${styles.fabAction} ${action.className} ${action.meta ? styles.fabActionDetailed : ''}`} onClick={action.onClick} role="menuitem">
                  <span className={styles.fabActionIcon}>{action.icon}</span>
                  <span className={styles.fabActionCopy}>
                    <span className={styles.fabActionText}>{action.label}</span>
                    {action.meta && <span className={styles.fabActionMeta}>{action.meta}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            className={`${styles.fabButton} ${quickAddMenuOpen ? styles.fabButtonOpen : ''}`}
            onClick={toggleQuickAddMenu}
            aria-expanded={quickAddMenuOpen}
            aria-label={fabButtonLabel}
            aria-haspopup="menu"
          >
            <span className={styles.fabButtonGlyph} aria-hidden="true">{quickAddMenuOpen ? '×' : '+'}</span>
          </button>
        </div>
      )}
      {activeSpace === 'takda' && quickAddSheet.open && (
        <>
          <div className={styles.quickAddBackdrop} onClick={closeQuickAdd} aria-hidden="true" />
          <div className={styles.quickAddLayer}>
          <div
            className={styles.quickAddSheet}
            role="dialog"
            aria-modal="true"
            aria-label={quickAddDialogLabel}
          >
            <div className={styles.quickAddHeader}>
              <div>
                <div className={styles.quickAddEyebrow}>Quick add</div>
                <div className={styles.quickAddTitle} id="quick-add-title">
                  {quickAddSheet.type === 'income' ? 'Log income' : 'Track expense'}
                </div>
              </div>
              <button type="button" className={styles.quickAddClose} onClick={closeQuickAdd} aria-label="Close quick add">✕</button>
            </div>
            <QuickAdd
              user={user}
              profile={profile}
              accounts={data.accounts}
              symbol={symbol}
              defaultType={quickAddSheet.type}
              defaultDate={quickAddDefaultDate}
              initialEntry={quickAddSheet.initialEntry}
              onTypeChange={handleQuickAddTypeChange}
              onClose={closeQuickAdd}
            />
          </div>
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
                  className={`${styles.mobileNavLink} ${n.space === 'lakas' ? resolvedLakasPage === n.id ? styles.mobileNavLinkActive : '' : n.space === 'tala' ? talaPage === n.id ? styles.mobileNavLinkActive : '' : page === n.id ? styles.mobileNavLinkActive : ''}`}
                  onClick={() => {
                    if (n.space === 'lakas') {
                      openSpace('lakas')
                      setLakasPage(n.id)
                    } else if (n.space === 'tala') {
                      openSpace('tala')
                      setTalaPage(n.id)
                    } else {
                      navigateToFinancePage(n.id)
                    }
                    setMobileNavMenuOpen(false)
                  }}
                  aria-current={n.space === 'lakas' ? resolvedLakasPage === n.id ? 'page' : undefined : n.space === 'tala' ? talaPage === n.id ? 'page' : undefined : page === n.id ? 'page' : undefined}
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
    </div>
  )
}
