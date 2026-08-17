import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import RouteMeta from '../components/RouteMeta'
import { auth } from '../lib/firebase'
import takdaLandingShot from '../assets/landing/takda-updated.png'
import mockStyles from './LandingPage.module.css'
import styles from './LandingPageClean.module.css'

const HERO_SPACES = [
  {
    label: 'Calendar',
    title: 'Daily Cash Flow',
    desc: 'Interactive cashflow calendars, daily income and expense tracking, and dynamic balance forecasts.',
    tone: 'takda',
  },
  {
    label: 'Accounts',
    title: 'Multi-Account Hub',
    desc: 'Track cash, banks, e-wallets, and credit cards with unified net worth calculations.',
    tone: 'takda',
  },
  {
    label: 'Bills',
    title: 'Bills & Subscriptions',
    desc: 'Automated recurring bill due dates, payment status tracking, and active subscription management.',
    tone: 'takda',
  },
]

const SPACE_FEATURES = [
  {
    title: 'Interactive Cashflow Calendar',
    desc: 'View income, expenses, and projected balances day-by-day. Tap any date to log a record instantly.',
    tone: 'takda',
  },
  {
    title: 'Multi-Account & Net Worth',
    desc: 'Keep track of all your accounts in one place with automatic net worth and liquidity calculations.',
    tone: 'takda',
  },
  {
    title: 'Bills & Subscription Manager',
    desc: 'Stay ahead of upcoming bills, auto-deductions, and recurring subscriptions before due dates arrive.',
    tone: 'takda',
  },
  {
    title: 'Savings & Debt Payoff',
    desc: 'Set savings targets, track contribution progress, and simulate credit card payoff timelines.',
    tone: 'takda',
  },
]

const TRUST_POINTS = [
  {
    title: 'Free & Private',
    desc: 'Create one account and use all financial tools without hidden fees or subscription gates.',
  },
  {
    title: 'Complete Data Control',
    desc: 'Your financial records remain private to your signed-in account with privacy mode and export options.',
  },
  {
    title: 'Local Backup & Export',
    desc: 'Export your financial records anytime to CSV or keep encrypted local backups in settings.',
  },
  {
    title: 'Honest Manual Tracking',
    desc: 'Buhay is a manual tracking tool so you stay in total control of what gets recorded.',
  },
]

function TakdaMockup() {
  const [balance, setBalance] = useState(45210.50)
  const [txs, setTxs] = useState([
    { emoji: '🛒', name: 'Groceries', amount: -2350 },
    { emoji: '⚡', name: 'Power Bill', amount: -3100 },
    { emoji: '💰', name: 'Salary Deposit', amount: 45000 }
  ])
  const [limitSpent, setLimitSpent] = useState(12500)

  const addCoffee = () => {
    if (balance <= 1000) return
    setBalance(prev => prev - 500)
    setLimitSpent(prev => Math.min(20000, prev + 500))
    setTxs(prev => [
      { emoji: '☕', name: 'Coffee Shop', amount: -500 },
      ...prev
    ])
  }

  const reset = () => {
    setBalance(45210.50)
    setLimitSpent(12500)
    setTxs([
      { emoji: '🛒', name: 'Groceries', amount: -2350 },
      { emoji: '⚡', name: 'Power Bill', amount: -3100 },
      { emoji: '💰', name: 'Salary Deposit', amount: 45000 }
    ])
  }

  return (
    <div className={mockStyles.mockupFrame}>
      <div className={mockStyles.mockupHeader}>
        <div className={mockStyles.mockupDots}>
          <span className={mockStyles.dotRed}></span>
          <span className={mockStyles.dotYellow}></span>
          <span className={mockStyles.dotGreen}></span>
        </div>
        <div className={mockStyles.mockupUrl}>buhay.app/app</div>
      </div>
      <div className={mockStyles.mockupContent}>
        <div className={mockStyles.mockCard} style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className={mockStyles.mockCardHeaderRow}>
            <div className={mockStyles.mockCardLabel}>Total Net Worth</div>
            <button type="button" onClick={txs.length > 3 ? reset : addCoffee} className={mockStyles.mockActionBtn}>
              {txs.length > 3 ? 'Reset' : '⚡ Add -₱500'}
            </button>
          </div>
          <div className={mockStyles.mockBalance}>₱{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className={mockStyles.mockBudget}>
          <div className={mockStyles.mockBudgetHeader}>
            <span>Monthly Budget</span>
            <span>₱{(limitSpent / 1000).toFixed(1)}k / ₱20k</span>
          </div>
          <div className={mockStyles.mockProgressBar}>
            <div className={mockStyles.mockProgressFill} style={{ width: `${(limitSpent / 20000) * 100}%`, backgroundColor: 'var(--accent)' }}></div>
          </div>
        </div>
        <div className={mockStyles.mockTransactions}>
          {txs.slice(0, 3).map((tx, i) => (
            <div key={i} className={mockStyles.mockTxItem}>
              <span>{tx.emoji}</span>
              <span className={mockStyles.txName}>{tx.name}</span>
              <span className={tx.amount > 0 ? mockStyles.txAmountPositive : mockStyles.txAmount}>
                {tx.amount > 0 ? '+' : ''}₱{Math.abs(tx.amount).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const FAQ_ITEMS = [
  {
    question: 'What is Buhay?',
    answer: 'Buhay (Takda) is a clean, private personal finance system for daily cashflow tracking, multi-account balance management, recurring bills, and budget goals.',
  },
  {
    question: 'Is Buhay free to use?',
    answer: 'Yes! Buhay is completely free to use.',
  },
  {
    question: 'Does Buhay connect to my bank automatically?',
    answer: 'No. Buhay is an intentional manual tracking tool, putting you in total control of your money records and data privacy.',
  },
  {
    question: 'Is my financial data private?',
    answer: 'Yes. Your records are tied strictly to your account, with built-in privacy toggles, export features, and data reset tools.',
  },
  {
    question: 'Can I export my data?',
    answer: 'Yes. You can export your income, expenses, accounts, and bills to CSV files or save local encrypted backups anytime in settings.',
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
    ? (isSignedIn ? 'Open Buhay' : 'Get Started Free')
    : 'Open Buhay'

  const openPrimary = () => {
    navigate(isSignedIn ? '/app' : '/login')
  }

  const goLogin = () => {
    navigate('/login')
  }

  return (
    <div className={styles.page}>
      <RouteMeta
        title="Buhay — Personal Finance & Cash Flow Calendar"
        description="Track accounts, forecast daily cash flow, manage recurring bills, and reach savings goals with complete privacy."
        path="/"
      />
      
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link to="/" className={styles.brand}>
            <span className={styles.brandMark}>↗</span>
            <span className={styles.brandName}>Buhay</span>
          </Link>

          <div className={styles.navActions}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={goLogin}>Sign in</button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openPrimary}>{primaryLabel}</button>
          </div>
        </div>
      </nav>

      <main>
        <section className={styles.hero}>
          <div className={`${styles.heroKicker} ${styles.reveal}`}>Personal Finance & Cash Flow</div>
          <h1 className={`${styles.heroTitle} ${styles.reveal} ${styles.delay1}`}>Financial Clarity for Real Life.</h1>
          <p className={`${styles.heroSub} ${styles.reveal} ${styles.delay2}`}>
            Buhay centralizes your account balances, daily cash flow projections, recurring bills, and budget targets into one calm, private dashboard.
          </p>
          <div className={`${styles.heroActions} ${styles.reveal} ${styles.delay3}`}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openPrimary}>{primaryLabel}</button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={goLogin}>Sign in</button>
          </div>
          
          <div className={`${styles.heroVisual} ${styles.reveal} ${styles.delay3}`}>
            <TakdaMockup />
          </div>
        </section>

        <section className={styles.features}>
          <h2 className={styles.sectionTitle}>Everything for Money Clarity</h2>
          <p className={styles.sectionSub}>Structured tools to keep your financial direction clear.</p>
          
          <div className={styles.featureGrid}>
            {SPACE_FEATURES.map((feat, idx) => (
              <div key={idx} className={styles.featureCard}>
                <div className={`${styles.featureLabel} ${styles.labelTakda}`}>Takda</div>
                <h3 className={styles.featureTitle}>{feat.title}</h3>
                <p className={styles.featureDesc}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.privacy}>
          <div className={styles.privacyInner}>
            <h2 className={styles.privacyTitle}>Free, private, and built for control.</h2>
            <p className={styles.privacyDesc}>
              Buhay is free to use with zero hidden fees and full privacy controls for your data.
            </p>
            
            <div className={styles.privacyGrid}>
              {TRUST_POINTS.map((item, idx) => (
                <div key={idx} className={styles.privacyItem}>
                  <h3 className={styles.privacyItemTitle}>{item.title}</h3>
                  <p className={styles.privacyItemDesc}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '60px 24px', maxWidth: '800px', margin: '0 auto' }}>
          <h2 className={styles.sectionTitle} style={{ textAlign: 'center', marginBottom: '32px' }}>Frequently Asked Questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {FAQ_ITEMS.map((faq, idx) => (
              <div key={idx} style={{ background: 'var(--bg-base, #111)', border: '1px solid var(--border-light, #222)', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: 'var(--text, #fff)' }}>{faq.question}</h3>
                <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-muted, #aaa)', margin: 0 }}>{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>© {new Date().getFullYear()} Buhay. Financial clarity for real life.</p>
          <div className={styles.footerLinks}>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Use</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
