import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import RouteMeta from '../components/RouteMeta'
import { auth } from '../lib/firebase'
import mockStyles from './LandingPage.module.css'
import styles from './LandingPageClean.module.css'

function HeroInteractiveMockup() {
  const [balance, setBalance] = useState(45210.50)
  const [txs, setTxs] = useState([
    { emoji: '💰', name: 'Salary Deposit', amount: 45000, date: 'Today' },
    { emoji: '🛒', name: 'Supermarket Groceries', amount: -2350, date: 'Today' },
    { emoji: '⚡', name: 'Monthly Electricity Bill', amount: -3100, date: 'Yesterday' }
  ])
  const [limitSpent, setLimitSpent] = useState(12500)

  const addCoffee = () => {
    if (balance <= 1000) return
    setBalance(prev => prev - 500)
    setLimitSpent(prev => Math.min(20000, prev + 500))
    setTxs(prev => [
      { emoji: '☕', name: 'Coffee & Snacks', amount: -500, date: 'Just now' },
      ...prev
    ])
  }

  const addSalary = () => {
    setBalance(prev => prev + 15000)
    setTxs(prev => [
      { emoji: '💵', name: 'Freelance Payout', amount: 15000, date: 'Just now' },
      ...prev
    ])
  }

  const reset = () => {
    setBalance(45210.50)
    setLimitSpent(12500)
    setTxs([
      { emoji: '💰', name: 'Salary Deposit', amount: 45000, date: 'Today' },
      { emoji: '🛒', name: 'Supermarket Groceries', amount: -2350, date: 'Today' },
      { emoji: '⚡', name: 'Monthly Electricity Bill', amount: -3100, date: 'Yesterday' }
    ])
  }

  return (
    <div className={mockStyles.mockupFrame} style={{ margin: 0, borderRadius: 0 }}>
      <div className={mockStyles.mockupHeader}>
        <div className={mockStyles.mockupDots}>
          <span className={mockStyles.dotRed}></span>
          <span className={mockStyles.dotYellow}></span>
          <span className={mockStyles.dotGreen}></span>
        </div>
        <div className={mockStyles.mockupUrl}>buhay.app/app</div>
      </div>
      
      <div className={mockStyles.mockupContent} style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: 1 }}>Live Money Cockpit</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Real-time net worth & transaction log</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={addCoffee} className={mockStyles.mockActionBtn}>
              + Expense (-₱500)
            </button>
            <button type="button" onClick={addSalary} className={mockStyles.mockActionBtn} style={{ borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
              + Income (+₱15k)
            </button>
            <button type="button" onClick={reset} className={mockStyles.mockActionBtn} style={{ opacity: 0.6 }}>
              Reset
            </button>
          </div>
        </div>

        <div className={mockStyles.mockCard} style={{ borderLeft: '4px solid #10b981', background: 'rgba(16,185,129,0.06)', marginBottom: 16 }}>
          <div className={mockStyles.mockCardHeaderRow}>
            <div className={mockStyles.mockCardLabel}>Total Cash & Liquidity</div>
            <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
              +12.4% this month
            </span>
          </div>
          <div className={mockStyles.mockBalance} style={{ fontSize: 32, fontWeight: 800 }}>
            ₱{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className={mockStyles.mockBudget} style={{ marginBottom: 20 }}>
          <div className={mockStyles.mockBudgetHeader}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Monthly Spending Limit</span>
            <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>₱{(limitSpent / 1000).toFixed(1)}k / ₱20k (62%)</span>
          </div>
          <div className={mockStyles.mockProgressBar} style={{ height: 8 }}>
            <div className={mockStyles.mockProgressFill} style={{ width: `${(limitSpent / 20000) * 100}%`, backgroundColor: '#10b981' }}></div>
          </div>
        </div>

        <div className={mockStyles.mockTransactions}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, textAlign: 'left' }}>Recent Cashflow Timeline</div>
          {txs.slice(0, 3).map((tx, i) => (
            <div key={i} className={mockStyles.mockTxItem} style={{ padding: '10px 12px' }}>
              <span style={{ fontSize: 16 }}>{tx.emoji}</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div className={mockStyles.txName}>{tx.name}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{tx.date}</div>
              </div>
              <span className={tx.amount > 0 ? mockStyles.txAmountPositive : mockStyles.txAmount} style={{ fontSize: 14, fontWeight: 700 }}>
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
    question: 'What is Buhay / Takda?',
    answer: 'Buhay is a calm, private personal finance web app that centralizes daily cashflow forecasting, account balances, recurring bills, and savings targets into one clear system.',
  },
  {
    question: 'Is Buhay free to use?',
    answer: 'Yes! Buhay is 100% free to use with no hidden trial periods or subscription lock-ins.',
  },
  {
    question: 'Does Buhay connect to my bank automatically?',
    answer: 'No. Buhay is an intentional manual tracking app so your bank credentials stay 100% private and you remain in total control of what gets logged.',
  },
  {
    question: 'Is my financial data secure and private?',
    answer: 'Yes. Your records are tied strictly to your signed-in account. You can enable Privacy Mode to mask money numbers, and export or backup data anytime in settings.',
  },
  {
    question: 'Can I export my data or move devices?',
    answer: 'Yes. You can download your transaction records to CSV spreadsheets or export full encrypted JSON backups to restore on any new device.',
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
    ? (isSignedIn ? 'Open Buhay App' : 'Get Started Free')
    : 'Open Buhay App'

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
      
      {/* Sticky Navigation */}
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
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={`${styles.heroKicker} ${styles.reveal}`}>
            <span>✨</span> Personal Finance & Cash Flow
          </div>
          
          <h1 className={`${styles.heroTitle} ${styles.reveal} ${styles.delay1}`}>
            Financial Clarity for Real Life.
          </h1>
          
          <p className={`${styles.heroSub} ${styles.reveal} ${styles.delay2}`}>
            Buhay centralizes account balances, daily cash flow projections, recurring bills, and budget targets into one calm, private dashboard.
          </p>
          
          <div className={`${styles.heroActions} ${styles.reveal} ${styles.delay3}`}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openPrimary}>
              {primaryLabel} <span>→</span>
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={goLogin}>
              Sign in
            </button>
          </div>
          
          {/* Interactive Hero Visual Mockup */}
          <div className={`${styles.heroVisual} ${styles.reveal} ${styles.delay3}`}>
            <HeroInteractiveMockup />
          </div>
        </section>

        {/* 2x2 Feature Bento Grid Section */}
        <section className={styles.features}>
          <h2 className={styles.sectionTitle}>Built for Complete Money Clarity</h2>
          <p className={styles.sectionSub}>Four structured financial tools staying in sync without complexity.</p>
          
          <div className={styles.featureGrid}>
            {/* Feature Card 1: Calendar */}
            <div className={styles.featureCard}>
              <div className={styles.featureCardHeader}>
                <div className={styles.featureIcon}>📅</div>
                <div>
                  <div className={styles.featureLabel}>Takda Calendar</div>
                  <h3 className={styles.featureTitle}>Interactive Cashflow</h3>
                </div>
              </div>
              <p className={styles.featureDesc}>
                View daily income, expenses, and projected balances on a visual timeline. Tap any date to add a record or inspect daily activity.
              </p>
              
              <div className={styles.featureWidgetWrap}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#10b981' }}>
                  <span>August 2026</span>
                  <span>Forecast: ₱58,400</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', fontSize: 10 }}>
                  {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={i} style={{ color: '#64748b', fontWeight: 700 }}>{d}</div>
                  ))}
                  {[14,15,16,17,18,19,20].map((day, idx) => (
                    <div key={idx} style={{
                      background: day === 17 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)',
                      border: day === 17 ? '1px solid #10b981' : '1px solid transparent',
                      borderRadius: 6,
                      padding: '6px 2px',
                      color: day === 17 ? '#10b981' : '#e2e8f0',
                      fontWeight: day === 17 ? 800 : 500
                    }}>
                      {day}
                      <div style={{ fontSize: 7, color: day === 17 ? '#10b981' : '#64748b', marginTop: 2 }}>●</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Feature Card 2: Accounts */}
            <div className={styles.featureCard}>
              <div className={styles.featureCardHeader}>
                <div className={styles.featureIcon}>💳</div>
                <div>
                  <div className={styles.featureLabel}>Accounts & Balances</div>
                  <h3 className={styles.featureTitle}>Multi-Account Hub</h3>
                </div>
              </div>
              <p className={styles.featureDesc}>
                Track cash, bank accounts, e-wallets, and credit cards in one place with automatic net worth and liquidity calculations.
              </p>

              <div className={styles.featureWidgetWrap}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                    <span>💵 Cash Wallet</span>
                    <strong style={{ color: '#10b981' }}>₱12,500.00</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                    <span>🏦 Main Bank Account</span>
                    <strong style={{ color: '#10b981' }}>₱32,710.50</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                    <span>💳 Credit Card</span>
                    <strong style={{ color: '#ef4444' }}>-₱4,200.00</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Card 3: Bills */}
            <div className={styles.featureCard}>
              <div className={styles.featureCardHeader}>
                <div className={styles.featureIcon}>⚡</div>
                <div>
                  <div className={styles.featureLabel}>Bills & Subscriptions</div>
                  <h3 className={styles.featureTitle}>Automated Due Dates</h3>
                </div>
              </div>
              <p className={styles.featureDesc}>
                Stay ahead of upcoming bills, auto-deduction dates, and active recurring subscriptions before deadlines pass.
              </p>

              <div className={styles.featureWidgetWrap}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                    <div>
                      <strong style={{ color: '#ef4444' }}>🔴 Power Utility Bill</strong>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>Due in 2 days</div>
                    </div>
                    <strong style={{ color: '#ef4444' }}>₱3,100.00</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                    <div>
                      <strong style={{ color: '#10b981' }}>✅ Internet Fiber</strong>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>Marked Paid</div>
                    </div>
                    <strong style={{ color: '#10b981' }}>₱1,899.00</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Card 4: Budget & Savings */}
            <div className={styles.featureCard}>
              <div className={styles.featureCardHeader}>
                <div className={styles.featureIcon}>🎯</div>
                <div>
                  <div className={styles.featureLabel}>Budget & Goals</div>
                  <h3 className={styles.featureTitle}>Targets & Debt Payoff</h3>
                </div>
              </div>
              <p className={styles.featureDesc}>
                Set category spending limits, track savings milestones, and simulate payoff timelines for debt freedom.
              </p>

              <div className={styles.featureWidgetWrap}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span>🎯 Emergency Fund Target</span>
                      <strong style={{ color: '#10b981' }}>₱45,000 / ₱60,000 (75%)</strong>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: '75%', height: '100%', background: '#10b981' }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span>📊 Monthly Groceries Budget</span>
                      <strong style={{ color: '#3b82f6' }}>₱7,350 / ₱10,000 (73%)</strong>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: '73%', height: '100%', background: '#3b82f6' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Trust Section */}
        <section className={styles.privacy}>
          <div className={styles.privacyInner}>
            <h2 className={styles.privacyTitle}>Free, Private & Built for Control</h2>
            <p className={styles.privacyDesc}>
              Buhay is free to use with zero hidden fees, zero bank credential lock-ins, and full privacy controls for your data.
            </p>
            
            <div className={styles.privacyGrid}>
              {TRUST_POINTS.map((item, idx) => (
                <div key={idx} className={styles.privacyItem}>
                  <h3 className={styles.privacyItemTitle}>
                    <span>🛡️</span> {item.title}
                  </h3>
                  <p className={styles.privacyItemDesc}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Accordion Section */}
        <section className={styles.faqSection}>
          <h2 className={styles.sectionTitle} style={{ textAlign: 'center' }}>Frequently Asked Questions</h2>
          <p className={styles.sectionSub} style={{ marginBottom: 32 }}>Everything you need to know about Buhay.</p>
          
          <div className={styles.faqGrid}>
            {FAQ_ITEMS.map((faq, idx) => (
              <div key={idx} className={styles.faqItem}>
                <h3 className={styles.faqQuestion}>{faq.question}</h3>
                <p className={styles.faqAnswer}>{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
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
