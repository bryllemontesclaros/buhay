import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import RouteMeta from '../components/RouteMeta'
import { auth } from '../lib/firebase'
import { LEGAL_CONTACT_EMAIL, LEGAL_CONTACT_HREF, LEGAL_OPERATOR_NAME } from '../lib/legal'
import { setStartSpaceIntent } from '../lib/startIntent'
import takdaLandingShot from '../assets/landing/takda-updated.png'
import lakasLandingShot from '../assets/landing/lakas-updated.png'
import talaLandingShot from '../assets/landing/tala-updated.png'
import mockStyles from './LandingPage.module.css'
import styles from './LandingPageClean.module.css'

const HERO_SPACES = [
  {
    label: 'Takda',
    title: 'Money',
    desc: 'Interactive cashflow calendars, snowball/avalanche debt optimizers, savings target charts, and step-by-step Guided Tours keep your money path clear.',
    tone: 'takda',
  },
  {
    label: 'Lakas',
    title: 'Fitness',
    desc: 'Workout logger templates, daily habit sheets, automatic barbell plate weight calculators, and competitive Ghost Racer leaderboards build consistency.',
    tone: 'lakas',
  },
  {
    label: 'Tala',
    title: 'Mind',
    desc: 'Mood distribution wheels, reflection history timelines, daily grounding prompts, and private journaling tags support calm self-focus.',
    tone: 'tala',
  },
]

const SPACE_FEATURES = [
  {
    title: 'Buhay Home',
    desc: 'A fully customizable widget dashboard. Brings together cash balance projections, physical training habits, and mood check-in circles. Add, remove, and arrange widgets freely.',
    tone: 'buhay',
  },
  {
    title: 'Takda (Wealth)',
    desc: 'Track daily cash flow with dynamic balances, track savings targets, simulate snowball or avalanche debt payoff strategies, and follow interactive step-by-step guided onboarding tours.',
    tone: 'takda',
  },
  {
    title: 'Lakas (Health)',
    desc: 'Log set repetitions, check off daily consistency habits, use the built-in barbell plate calculator, and compete against your own historic runs using the Ghost Racer leaderboard.',
    tone: 'lakas',
  },
  {
    title: 'Tala (Mind)',
    desc: 'Log entries with custom mood indicators, view weekly mood distribution wheels, tag reflection topics, and receive gentle grounding prompts during difficult days.',
    tone: 'tala',
  },
]

const FLOW_BEATS = [
  {
    title: 'Customizable Widget Dashboard',
    desc: 'Launch from a fully customizable widget dashboard. Handpick what you want to see—from smart insights to daily fitness progress—all in one step.',
    beat: 'Cockpit',
    tone: 'buhay',
    pills: ['Widgets', 'Unified', 'Home'],
    mock: 'spaces',
  },
  {
    title: 'Drill Down Easily',
    desc: 'Go deeper into money forecasting, training workout sheets, or comprehensive reflection wheels when you need full control.',
    beat: 'Drill',
    tone: 'lakas',
    pills: ['Wealth', 'Health', 'Mind'],
    mock: 'action',
  },
  {
    title: 'See it stay organized',
    desc: 'Buhay structure ensures all transactions, workouts, and reflection tags are logged cleanly and automatically updated.',
    beat: 'Organize',
    tone: 'tala',
    pills: ['Calendar', 'Totals', 'History'],
    mock: 'organized',
  },
  {
    title: 'Complete private control',
    desc: 'Use any combination of tools you like. Local backups, private encryption, and full CSV exports stay in your account.',
    beat: 'Control',
    tone: 'takda',
    pills: ['Free', 'Export', 'Backup'],
    mock: 'account',
  },
]

const FLOW_BEAT_IMAGES = [
  takdaLandingShot,
  lakasLandingShot,
  talaLandingShot,
  takdaLandingShot,
]

const TRUST_POINTS = [
  {
    title: 'Free to use right now',
    desc: 'Create one account and use Takda, Lakas, and Tala without a paid plan in the current release.',
  },
  {
    title: 'Private account controls',
    desc: 'Your money, fitness, and reflection records stay tied to your signed-in account, with privacy settings and deletion tools inside the app.',
  },
  {
    title: 'Export, backup, restore',
    desc: 'Export your records, keep backups, and restore them from settings if you switch devices or want an extra copy.',
  },
  {
    title: 'Honest limits',
    desc: 'Buhay is a tracking tool. It is not a bank, not automatic bank sync, not medical advice, and not mental-health advice.',
  },
]

const SPACE_PROMISES = [
  {
    label: 'Custom Dashboard',
    promise: 'Aggregates your net worth, daily training habits, and reflection prompts onto a single screen.',
    meta: 'Central Cockpit',
    tone: 'buhay',
  },
  {
    label: 'Takda',
    promise: 'Includes savings target trackers, snowball/avalanche debt simulators, and daily cashflow calendars.',
    meta: 'Debt & Savings',
    tone: 'takda',
  },
  {
    label: 'Lakas',
    promise: 'Features cardio run logging, workout library builders, and the Ghost Racer podium.',
    meta: 'Ghost Racer',
    tone: 'lakas',
  },
  {
    label: 'Tala',
    promise: 'Visualizes your weekly mood distribution wheel and unlocks Grounding Prompts.',
    meta: 'Mood Wheels',
    tone: 'tala',
  },
]

// --- CSS Mockup Sub-components & Helpers ---

function TakdaMockup() {
  const [balance, setBalance] = useState(45210.50)
  const [txs, setTxs] = useState([
    { emoji: '🛒', name: 'Groceries', amount: -2350 },
    { emoji: '⚡', name: 'Power Bill', amount: -3100 },
    { emoji: '💰', name: 'Salary', amount: 45000 }
  ])
  const [limitSpent, setLimitSpent] = useState(12500)

  const addCoffee = () => {
    if (balance <= 1000) return
    setBalance(prev => prev - 500)
    setLimitSpent(prev => Math.min(20000, prev + 500))
    setTxs(prev => [
      { emoji: '☕', name: 'Sample Coffee', amount: -500 },
      ...prev
    ])
  }

  const reset = () => {
    setBalance(45210.50)
    setLimitSpent(12500)
    setTxs([
      { emoji: '🛒', name: 'Groceries', amount: -2350 },
      { emoji: '⚡', name: 'Power Bill', amount: -3100 },
      { emoji: '💰', name: 'Salary', amount: 45000 }
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
        <div className={mockStyles.mockupUrl}>buhay.app/takda</div>
      </div>
      <div className={mockStyles.mockupContent}>
        <div className={mockStyles.mockCard} style={{ borderLeft: '3px solid var(--blue)' }}>
          <div className={mockStyles.mockCardHeaderRow}>
            <div className={mockStyles.mockCardLabel}>Financial Pulse · Healthy</div>
            <button type="button" onClick={txs.length > 3 ? reset : addCoffee} className={mockStyles.mockActionBtn}>
              {txs.length > 3 ? 'Reset' : '⚡ Simulate -₱500'}
            </button>
          </div>
          <div className={mockStyles.mockBalance}>₱{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className={mockStyles.mockBudget}>
          <div className={mockStyles.mockBudgetHeader}>
            <span>Limit status</span>
            <span>₱{(limitSpent / 1000).toFixed(1)}k / ₱20k</span>
          </div>
          <div className={mockStyles.mockProgressBar}>
            <div className={mockStyles.mockProgressFill} style={{ width: `${(limitSpent / 20000) * 100}%`, backgroundColor: 'var(--blue)' }}></div>
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

function LakasMockup() {
  const [seconds, setSeconds] = useState(105) // 01:45
  const [isRunning, setIsRunning] = useState(false)
  
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      setSeconds(s => (s > 0 ? s - 1 : 120))
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning])

  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  const timeStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  const percent = (seconds / 120) * 100
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percent / 100) * circumference

  return (
    <div className={mockStyles.mockupFrame}>
      <div className={mockStyles.mockupHeader}>
        <div className={mockStyles.mockupDots}>
          <span className={mockStyles.dotRed}></span>
          <span className={mockStyles.dotYellow}></span>
          <span className={mockStyles.dotGreen}></span>
        </div>
        <div className={mockStyles.mockupUrl}>buhay.app/lakas</div>
      </div>
      <div className={mockStyles.mockupContent}>
        <div className={mockStyles.mockCard} style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className={mockStyles.mockCardHeaderRow}>
            <div className={mockStyles.mockCardLabel}>Ghost Racer Leaderboard</div>
            <button type="button" onClick={() => setIsRunning(!isRunning)} className={mockStyles.mockActionBtn}>
              {isRunning ? '⏸ Pause' : '▶ Start Timer'}
            </button>
          </div>
          <div className={mockStyles.mockWorkoutTitle}>🏆 1st: You (154 pts)</div>
        </div>
        
        <div className={mockStyles.mockTimerGrid}>
          <div className={mockStyles.mockTimerRing}>
            <svg width="56" height="56" viewBox="0 0 56 56" className={mockStyles.mockRingSvg}>
              <circle cx="28" cy="28" r={radius} className={mockStyles.mockRingBg} />
              <circle 
                cx="28" 
                cy="28" 
                r={radius} 
                className={mockStyles.mockRingFill} 
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                stroke="var(--accent)"
              />
            </svg>
            <div className={mockStyles.mockTimerText}>{timeStr}</div>
          </div>
          
          <div className={mockStyles.mockSets}>
            <div className={mockStyles.mockSetItemDone}>🗺️ Outdoor Run: 5.2 km logged</div>
            <div className={mockStyles.mockSetItemActive}>⚡ Consistency: {isRunning ? 'Active Tracker' : 'Paused'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TalaMockup() {
  const [mood, setMood] = useState('⛈️')
  
  const moodPrompts = {
    '☀️': 'Sunny: Wonderful day. Grateful for today\'s clear skies.',
    '🌤️': 'Partly Sunny: Calm focus. Balanced state and light exercises.',
    '🌧️': 'Rainy: Tired state. Remember to take a break and rest.',
    '⛈️': 'Heavy: Heavy state detected. Grounding prompt active...'
  }

  const moodColors = {
    '☀️': 'var(--yellow)',
    '🌤️': 'var(--blue)',
    '🌧️': 'var(--accent)',
    '⛈️': 'var(--purple)'
  }

  return (
    <div className={mockStyles.mockupFrame}>
      <div className={mockStyles.mockupHeader}>
        <div className={mockStyles.mockupDots}>
          <span className={mockStyles.dotRed}></span>
          <span className={mockStyles.dotYellow}></span>
          <span className={mockStyles.dotGreen}></span>
        </div>
        <div className={mockStyles.mockupUrl}>buhay.app/tala</div>
      </div>
      <div className={mockStyles.mockupContent}>
        <div className={mockStyles.mockCard} style={{ borderLeft: `3px solid ${moodColors[mood]}` }}>
          <div className={mockStyles.mockPanicBar}>
            <span className={mockStyles.mockCardLabel}>Grounded Reflection Prompt</span>
            <span className={mockStyles.mockPanicBtn}>🔒 Private default</span>
          </div>
        </div>
        
        <div className={mockStyles.mockTextareaBlur}>
          {moodPrompts[mood]}
        </div>

        <div className={mockStyles.mockCalendarDots}>
          {['☀️', '🌤️', '🌧️', '⛈️'].map(m => (
            <button 
              key={m} 
              type="button" 
              onClick={() => setMood(m)} 
              className={`${mockStyles.mockMoodBtn} ${mood === m ? mockStyles.mockMoodBtnActive : ''}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function BentoMockup() {
  return (
    <div className={mockStyles.mockupFrame}>
      <div className={mockStyles.mockupHeader}>
        <div className={mockStyles.mockupDots}>
          <span className={mockStyles.dotRed}></span>
          <span className={mockStyles.dotYellow}></span>
          <span className={mockStyles.dotGreen}></span>
        </div>
        <div className={mockStyles.mockupUrl}>buhay.app/dashboard</div>
      </div>
      <div className={mockStyles.mockupContent}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
           <div style={{ fontSize: '10px', opacity: 0.6 }}>Good morning, Brylle</div>
           <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '4px', fontSize: '9px', padding: '3px 6px', cursor: 'pointer' }}>Edit Layout</button>
        </div>
        
        <div className={mockStyles.mockBentoGrid} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Smart Insight Banner */}
          <div style={{ padding: '8px', background: 'rgba(var(--blue-rgb), 0.1)', border: '1px solid rgba(var(--blue-rgb), 0.2)', borderRadius: '6px', color: 'var(--blue)' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '2px' }}>💡 Smart Insight</div>
            <div style={{ fontSize: '11px' }}>Your daily cashflow is on track.</div>
          </div>

          {/* Key Stats Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>₱45k</div>
              <div style={{ fontSize: '8px', opacity: 0.6 }}>Net Worth</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>5.2k</div>
              <div style={{ fontSize: '8px', opacity: 0.6 }}>Run (km)</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>14🔥</div>
              <div style={{ fontSize: '8px', opacity: 0.6 }}>Streak</div>
            </div>
          </div>

          {/* Widgets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
             <div style={{ borderLeft: '3px solid var(--blue)', padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
               <div style={{ fontSize: '9px', opacity: 0.7, marginBottom: '2px' }}>Takda Wealth</div>
               <div style={{ fontSize: '11px', fontWeight: '500' }}>Budget: 75%</div>
             </div>
             <div style={{ borderLeft: '3px solid var(--accent)', padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
               <div style={{ fontSize: '9px', opacity: 0.7, marginBottom: '2px' }}>Lakas Health</div>
               <div style={{ fontSize: '11px', fontWeight: '500' }}>🏆 1st Place</div>
             </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}

function renderMockup(tone) {
  if (tone === 'takda') return <TakdaMockup />
  if (tone === 'lakas') return <LakasMockup />
  if (tone === 'tala') return <TalaMockup />
  if (tone === 'buhay') return <BentoMockup />
  return <TakdaMockup />
}

function useScrollVisible(threshold = 0.1) {
  const [ref, setRef] = useState(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!ref) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true)
        observer.unobserve(ref)
      }
    }, { threshold })
    observer.observe(ref)
    return () => observer.disconnect()
  }, [ref, threshold])

  return [setRef, isVisible]
}

function ScrollReveal({ children, className = '' }) {
  const [setRef, isVisible] = useScrollVisible(0.12)
  return (
    <div
      ref={setRef}
      className={`${className} ${mockStyles.fadeUp} ${isVisible ? mockStyles.visible : ''}`}
    >
      {children}
    </div>
  )
}


const FAQ_ITEMS = [
  {
    question: 'What is Buhay?',
    answer: 'Buhay is one account with three spaces: Takda for money, Lakas for fitness, and Tala for reflection.',
  },
  {
    question: 'Is Buhay free to use?',
    answer: 'Yes. Buhay is free to use in its current release.',
  },
  {
    question: 'Do I need to set up everything right away?',
    answer: 'No. You can begin with one space and add the rest only when they become useful.',
  },
  {
    question: 'Can I use only one space first?',
    answer: 'Yes. You can stay in Takda, Lakas, or Tala first without needing to fully set up the others.',
  },
  {
    question: 'Is my data private?',
    answer: 'Your records are tied to your signed-in account, and Buhay includes privacy, backup, restore, and deletion controls inside the app.',
  },
  {
    question: 'Does Takda connect to banks automatically?',
    answer: 'No. Takda is a manual tracking tool today, so you stay in control of what gets recorded.',
  },
  {
    question: 'Is Buhay advice?',
    answer: 'No. Buhay helps you track money, fitness, and reflection more clearly, but it does not replace professional financial, medical, or mental-health advice.',
  },
  {
    question: 'Is there a guide to help me learn how to use the app?',
    answer: 'Yes! Buhay includes premium, interactive step-by-step Guided Onboarding Tours for every space (Takda, Lakas, and Tala) to show you around and help you get started instantly.',
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
    ? (isSignedIn ? 'Open the app' : 'Join Beta')
    : 'Open Buhay'

  const openPrimary = (spaceOverride) => {
    const intended = spaceOverride || 'explore'
    setStartSpaceIntent(intended)
    navigate(isSignedIn ? '/app' : '/login', { state: { startSpace: intended } })
  }

  const goLogin = () => {
    setStartSpaceIntent('explore')
    navigate('/login')
  }

  return (
    <div className={styles.page}>
      <RouteMeta
        title="Buhay — Takda, Lakas, and Tala in one calm account"
        description="Track money, fitness, and reflection in three focused spaces inside one account."
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
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => openPrimary()}>{primaryLabel}</button>
          </div>
        </div>
      </nav>

      <main>
        <section className={styles.hero}>
          <div className={`${styles.heroKicker} ${styles.reveal}`}>Wealth · Health · Mind</div>
          <h1 className={`${styles.heroTitle} ${styles.reveal} ${styles.delay1}`}>The Unified Life System.</h1>
          <p className={`${styles.heroSub} ${styles.reveal} ${styles.delay2}`}>
            Buhay centralizes your cashflow forecasting, fitness rhythms, and mood reflections into a fully customizable home dashboard.
          </p>
          <div className={`${styles.heroActions} ${styles.reveal} ${styles.delay3}`}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => openPrimary()}>{primaryLabel}</button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={goLogin}>Sign in</button>
          </div>
          
          <div className={`${styles.heroVisual} ${styles.reveal} ${styles.delay3}`}>
            <BentoMockup />
          </div>
        </section>

        <section className={styles.features}>
          <h2 className={styles.sectionTitle}>Spaces & Features</h2>
          <p className={styles.sectionSub}>Each space stays focused on one job.</p>
          
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={`${styles.featureLabel} ${styles.labelBuhay}`}>Buhay Home</div>
              <h3 className={styles.featureTitle}>Dashboard</h3>
              <p className={styles.featureDesc}>
                A customizable cockpit dashboard bringing together cash flow projections, daily workout habits, and mood check-in circles on one screen.
              </p>
              <div style={{ marginTop: '24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Central Cockpit</div>
                  <div style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span>💵 Takda Net Cashflow</span>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>+₱45,210</span>
                  </div>
                  <div style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span>🔥 Lakas Fitness Ring</span>
                    <span style={{ color: '#ff4500', fontWeight: 'bold' }}>80% Completed</span>
                  </div>
                  <div style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <span>✨ Tala Daily Mood</span>
                    <span style={{ color: '#c084fc', fontWeight: 'bold' }}>Calm & Focused</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={`${styles.featureLabel} ${styles.labelTakda}`}>Takda</div>
              <h3 className={styles.featureTitle}>Money</h3>
              <p className={styles.featureDesc}>
                Interactive cashflow calendars, snowball/avalanche debt optimizers, and savings target charts keep your money path clear.
              </p>
              <div style={{ marginTop: '24px' }}>
                 <TakdaMockup />
              </div>
            </div>
            
            <div className={styles.featureCard}>
              <div className={`${styles.featureLabel} ${styles.labelLakas}`}>Lakas</div>
              <h3 className={styles.featureTitle}>Fitness</h3>
              <p className={styles.featureDesc}>
                Workout logger templates, daily habit sheets, and competitive Ghost Racer leaderboards build consistency.
              </p>
              <div style={{ marginTop: '24px' }}>
                 <LakasMockup />
              </div>
            </div>
            
            <div className={styles.featureCard}>
              <div className={`${styles.featureLabel} ${styles.labelTala}`}>Tala</div>
              <h3 className={styles.featureTitle}>Mind</h3>
              <p className={styles.featureDesc}>
                Mood distribution wheels, reflection history timelines, and daily grounding prompts support calm self-focus.
              </p>
              <div style={{ marginTop: '24px' }}>
                 <TalaMockup />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.privacy}>
          <div className={styles.privacyInner}>
            <h2 className={styles.privacyTitle}>Free, private, and honest about limits.</h2>
            <p className={styles.privacyDesc}>
              Buhay is free to use right now, and it stays clear about your data, your controls, and what the product does not replace.
            </p>
            
            <div className={styles.privacyGrid}>
              <div className={styles.privacyItem}>
                <h3 className={styles.privacyItemTitle}>Free to use right now</h3>
                <p className={styles.privacyItemDesc}>Create one account and use Takda, Lakas, and Tala without a paid plan in the current release.</p>
              </div>
              <div className={styles.privacyItem}>
                <h3 className={styles.privacyItemTitle}>Private account controls</h3>
                <p className={styles.privacyItemDesc}>Your money, fitness, and reflection records stay tied to your signed-in account, with privacy settings and deletion tools inside the app.</p>
              </div>
              <div className={styles.privacyItem}>
                <h3 className={styles.privacyItemTitle}>Export, backup, restore</h3>
                <p className={styles.privacyItemDesc}>Export your records, keep backups, and restore them from settings if you switch devices or want an extra copy.</p>
              </div>
              <div className={styles.privacyItem}>
                <h3 className={styles.privacyItemTitle}>Honest limits</h3>
                <p className={styles.privacyItemDesc}>Buhay is a manual tracking tool. It is not a bank, not automatic bank sync, and not a replacement for medical advice.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p>© {new Date().getFullYear()} Buhay. Bawat araw, mas malinaw.</p>
        </div>
      </footer>
    </div>
  )
}
