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
import styles from './LandingPage.module.css'

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
    title: 'Buhay Bento',
    desc: 'Brings together cash balance projections, physical training habits, and mood check-in circles onto a single central screen.',
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
    title: 'Central Bento Dashboard',
    desc: 'Launch from a single cockpit screen. View your net worth, check off daily physical habits, and log today\'s reflection in one step.',
    beat: 'Cockpit',
    tone: 'buhay',
    pills: ['Bento', 'Unified', 'Home'],
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
    label: 'Bento Dashboard',
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
  return (
    <div className={styles.mockupFrame}>
      <div className={styles.mockupHeader}>
        <div className={styles.mockupDots}>
          <span className={styles.dotRed}></span>
          <span className={styles.dotYellow}></span>
          <span className={styles.dotGreen}></span>
        </div>
        <div className={styles.mockupUrl}>buhay.app/takda</div>
      </div>
      <div className={styles.mockupContent}>
        <div className={styles.mockCard} style={{ borderLeft: '3px solid var(--blue)' }}>
          <div className={styles.mockCardLabel}>Financial Pulse · Healthy</div>
          <div className={styles.mockBalance}>₱45,210.50</div>
        </div>
        <div className={styles.mockBudget}>
          <div className={styles.mockBudgetHeader}>
            <span>Limit status</span>
            <span>₱12.5k / ₱20k</span>
          </div>
          <div className={styles.mockProgressBar}>
            <div className={styles.mockProgressFill} style={{ width: '62.5%' }}></div>
          </div>
        </div>
        <div className={styles.mockTransactions}>
          <div className={styles.mockTxItem}>
            <span>🛒</span>
            <span className={styles.txName}>Groceries</span>
            <span className={styles.txAmount}>-₱2,350</span>
          </div>
          <div className={styles.mockTxItem}>
            <span>⚡</span>
            <span className={styles.txName}>Power Bill</span>
            <span className={styles.txAmount}>-₱3,100</span>
          </div>
          <div className={styles.mockTxItem}>
            <span>💰</span>
            <span className={styles.txName}>Salary</span>
            <span className={styles.txAmountPositive}>+₱45k</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LakasMockup() {
  const [seconds, setSeconds] = useState(105) // 01:45
  
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => (s > 0 ? s - 1 : 120))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  const timeStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  const percent = (seconds / 120) * 100
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percent / 100) * circumference

  return (
    <div className={styles.mockupFrame}>
      <div className={styles.mockupHeader}>
        <div className={styles.mockupDots}>
          <span className={styles.dotRed}></span>
          <span className={styles.dotYellow}></span>
          <span className={styles.dotGreen}></span>
        </div>
        <div className={styles.mockupUrl}>buhay.app/lakas</div>
      </div>
      <div className={styles.mockupContent}>
        <div className={styles.mockCard} style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className={styles.mockCardLabel}>Ghost Racer Leaderboard</div>
          <div className={styles.mockWorkoutTitle}>🏆 1st: You (154 pts)</div>
        </div>
        
        <div className={styles.mockTimerGrid}>
          <div className={styles.mockTimerRing}>
            <svg width="56" height="56" viewBox="0 0 56 56" className={styles.mockRingSvg}>
              <circle cx="28" cy="28" r={radius} className={styles.mockRingBg} />
              <circle 
                cx="28" 
                cy="28" 
                r={radius} 
                className={styles.mockRingFill} 
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className={styles.mockTimerText}>{timeStr}</div>
          </div>
          
          <div className={styles.mockSets}>
            <div className={styles.mockSetItemDone}>🗺️ Outdoor Run: 5.2 km logged</div>
            <div className={styles.mockSetItemActive}>⚡ Consistency Score: Active</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TalaMockup() {
  return (
    <div className={styles.mockupFrame}>
      <div className={styles.mockupHeader}>
        <div className={styles.mockupDots}>
          <span className={styles.dotRed}></span>
          <span className={styles.dotYellow}></span>
          <span className={styles.dotGreen}></span>
        </div>
        <div className={styles.mockupUrl}>buhay.app/tala</div>
      </div>
      <div className={styles.mockupContent}>
        <div className={styles.mockCard} style={{ borderLeft: '3px solid var(--purple)' }}>
          <div className={styles.mockPanicBar}>
            <span className={styles.mockCardLabel}>Grounded Reflection Prompt</span>
            <span className={styles.mockPanicBtn}>🔒 Private default</span>
          </div>
        </div>
        
        <div className={styles.mockTextareaBlur}>
          ⛈️ Heavy state detected. Grounding reflection recommendation active...
        </div>

        <div className={styles.mockCalendarDots}>
          <span className={styles.mockCalDay}>☀️ <span className={styles.mockCalDayNum}>1</span></span>
          <span className={styles.mockCalDay}>🌤️ <span className={styles.mockCalDayNum}>2</span></span>
          <span className={styles.mockCalDay}>☁️ <span className={styles.mockCalDayNum}>3</span></span>
          <span className={styles.mockCalDay}>🌧️ <span className={styles.mockCalDayNum}>4</span></span>
          <span className={styles.mockCalDay}>⛈️ <span className={styles.mockCalDayNum}>5</span></span>
        </div>
      </div>
    </div>
  )
}

function renderMockup(tone) {
  if (tone === 'takda') return <TakdaMockup />
  if (tone === 'lakas') return <LakasMockup />
  if (tone === 'tala') return <TalaMockup />
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
      className={`${className} ${styles.fadeUp} ${isVisible ? styles.visible : ''}`}
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

  /**
   * Navigates the user to the application.
   * If the user is logged in, they are redirected to `/app`, otherwise to `/login`.
   * Passes the selected starting space (intent) via both sessionStorage and React Router location state.
   * @param {string} [spaceOverride] - Explicit space ID (e.g., 'takda', 'lakas', 'tala') to override default selection.
   */
  const openPrimary = (spaceOverride) => {
    const intended = spaceOverride || 'explore'
    setStartSpaceIntent(intended)
    navigate(isSignedIn ? '/app' : '/login', { state: { startSpace: intended } })
  }

  /**
   * Direct route helper to send the user to the login screen with a generic start intent.
   */
  const goLogin = () => {
    setStartSpaceIntent('explore')
    navigate('/login')
  }

  /**
   * Dynamically retrieves the corresponding space theme CSS class from the style module.
   * @param {string} tone - Theme key name (e.g., 'takda', 'lakas', 'tala').
   * @returns {string} - The CSS module class name.
   */
  const toneClass = tone => {
    if (!tone) return ''
    const key = `tone${tone.charAt(0).toUpperCase()}${tone.slice(1)}`
    return styles[key] || ''
  }



  return (
    <div className={`${styles.page} force-light-theme`}>
      <RouteMeta
        title="Buhay — Takda, Lakas, and Tala in one calm account"
        description="Track money, fitness, and reflection in three focused spaces inside one account."
        path="/"
      />
      <a href="#landing-main" className="skipLink">Skip to main content</a>

      <div className={styles.ribbon} aria-hidden="true">
        <div className={styles.ribbonTrack}>
          <span className={styles.ribbonItem}>Skip the chaos · choose a space · do one honest thing</span>
          <span className={styles.ribbonItem}>Skip the chaos · choose a space · do one honest thing</span>
          <span className={styles.ribbonItem}>Skip the chaos · choose a space · do one honest thing</span>
          <span className={styles.ribbonItem}>Skip the chaos · choose a space · do one honest thing</span>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Buhay landing">
        <div className={styles.navInner}>
          <Link to="/" className={styles.brand} aria-label="Buhay home">
            <span className={styles.brandMark} aria-hidden="true">↗</span>
            <span className={styles.brandText}>
              <span className={styles.brandName}>Buhay</span>
              <span className={styles.brandTag}>Takda, Lakas, Tala in one account</span>
            </span>
          </Link>

          <div className={styles.navLinks} aria-label="Landing sections">
            <a className={styles.navLink} href="#how-it-works">How it works</a>
            <a className={styles.navLink} href="#spaces">Spaces</a>
            <a className={styles.navLink} href="#faq">FAQ</a>
            <a className={styles.navLink} href="#privacy">Privacy</a>
          </div>

          <div className={styles.navActions}>
            <button type="button" className={styles.btnGhost} onClick={goLogin}>Sign in</button>
            <button type="button" className={styles.btnPrimary} onClick={() => openPrimary()}>{primaryLabel}</button>
          </div>
        </div>
      </nav>

      <main id="landing-main" className={styles.main}>
        <header className={styles.hero}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.heroKicker}>Wealth · Health · Mind</div>
              <h1 className={styles.heroTitle}>
                The Unified Life System.{' '}
                <span className={styles.heroHighlight}>All in one bento cockpit.</span>
              </h1>
              <p className={styles.heroSub}>
                Buhay centralizes your cashflow forecasting, fitness rhythms, and mood reflections into a single home dashboard. Control your wealth, health, and mind from one unified space.
              </p>

              <div className={styles.heroActionRow}>
                <button type="button" className={styles.btnPrimary} onClick={() => openPrimary()}>
                  {primaryLabel}
                </button>
                <button type="button" className={styles.btnGhost} onClick={goLogin}>
                  Sign in
                </button>
              </div>

              <div className={styles.heroSignalRow} aria-label="Buhay quick facts">
                <span className={styles.heroSignal}>Free right now</span>
                <span className={styles.heroSignal}>Manual and honest</span>
                <span className={styles.heroSignal}>Private by account</span>
              </div>

              <div className={styles.heroChecklist} aria-label="What Buhay helps keep clear">
                {SPACE_PROMISES.map(promise => (
                  <div key={promise.label} className={`${styles.heroPromise} ${toneClass(promise.tone)}`}>
                    <strong>{promise.label}</strong>
                    <small>{promise.meta}</small>
                    {promise.promise}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.heroShowcase}>
              <div className={styles.heroCard} aria-label="Choose how to start Buhay">
                <div className={styles.heroStartHeader}>
                  <div>
                    <h2 className={styles.heroStartTitle}>Start your journey.</h2>
                  </div>
                  <p className={styles.heroStartLead}>Track what matters, simply and privately.</p>
                </div>

                <div className={styles.heroCardRow}>
                  <button type="button" className={`${styles.btnPrimary} ${styles.heroStartButton}`} onClick={() => openPrimary()}>
                    {isSignedIn ? 'Open the app' : 'Join Beta now'}
                  </button>
                </div>

                <div className={styles.heroMetaRow}>
                  <span>One account.</span>
                  <span>Three clear jobs.</span>
                  <button type="button" className={styles.metaLink} onClick={goLogin}>Already have an account?</button>
                </div>

                <div className={styles.heroSharedStrip}>
                  <strong>Buhay account layer</strong>
                  <span>Sign-in, privacy, backup, restore, and export stay shared so the spaces can stay focused.</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.heroDeviceRail} aria-label="Buhay spaces overview">
            {HERO_SPACES.map(space => {
              return (
                <article key={space.label} className={`${styles.heroRailCard} ${toneClass(space.tone)}`}>
                  <div className={styles.heroRailMeta}>
                    <div>
                      <span className={styles.heroSpaceLabel}>{space.label}</span>
                      <strong>{space.title}</strong>
                    </div>
                    <small>
                      {space.tone === 'takda' && 'Money'}
                      {space.tone === 'lakas' && 'Fitness'}
                      {space.tone === 'tala' && 'Reflection'}
                    </small>
                  </div>
                  <div className={styles.heroRailDevice}>
                    {renderMockup(space.tone)}
                  </div>
                  <p className={styles.heroRailCopy}>{space.desc}</p>
                </article>
              )
            })}
          </div>
        </header>

        <section className={styles.section} id="how-it-works">
          <ScrollReveal className={styles.sectionHead}>
            <div className={styles.kicker}>How it works</div>
            <h2 className={styles.sectionTitle}>Choose a space. Do one real thing.</h2>
            <p className={styles.sectionLead}>The app should feel obvious: pick the space you need, finish the update, then let Buhay keep the record organized.</p>
          </ScrollReveal>

          <div className={`${styles.beatsGrid} ${styles.flowGrid}`}>
            {FLOW_BEATS.map((beat, idx) => {
              return (
                <ScrollReveal key={beat.title} className={`${styles.beatCard} ${toneClass(beat.tone)}`}>
                  <div className={styles.beatNum}>{idx + 1}</div>
                  <div className={styles.beatSignal}>0{idx + 1} / signal</div>
                  <div className={styles.beatTitle}>{beat.title}</div>
                  <p className={styles.beatDesc}>{beat.desc}</p>
                  <div className={styles.pillRow} aria-label={`${beat.title} cues`}>
                    {beat.pills.map(pill => (
                      <span key={pill} className={styles.pill}>{pill}</span>
                    ))}
                  </div>
                  <div className={styles.device} aria-hidden="true">
                    {renderMockup(beat.tone)}
                  </div>
                </ScrollReveal>
              )
            })}
          </div>
        </section>

        <section className={styles.section} id="spaces">
          <ScrollReveal className={styles.sectionHead}>
            <div className={styles.kicker}>Spaces</div>
            <h2 className={styles.sectionTitle}>Each space stays focused on one job.</h2>
            <p className={styles.sectionLead}>The account layer stays in the background. What you see first is the one thing each space is actually for.</p>
          </ScrollReveal>

          <div className={styles.spacesGrid}>
            {SPACE_FEATURES.map(feature => (
              <ScrollReveal
                key={feature.title}
                className={`${styles.spaceCard} ${styles[`spaceCard${feature.tone.charAt(0).toUpperCase()}${feature.tone.slice(1)}`] || ''} ${toneClass(feature.tone)}`}
              >
                <div className={styles.spaceTop}>
                  <div className={styles.spaceName}>{feature.title}</div>
                  <div className={styles.spacePills}>
                    {feature.tone === 'takda' && (
                      <>
                        <span className={styles.pill}>Money</span>
                        <span className={styles.pill}>Calendar</span>
                      </>
                    )}
                    {feature.tone === 'lakas' && (
                      <>
                        <span className={styles.pill}>Workout</span>
                        <span className={styles.pill}>Progress</span>
                      </>
                    )}
                    {feature.tone === 'tala' && (
                      <>
                        <span className={styles.pill}>Journal</span>
                        <span className={styles.pill}>Mood</span>
                      </>
                    )}
                    {feature.tone === 'buhay' && (
                      <>
                        <span className={styles.pill}>Privacy</span>
                        <span className={styles.pill}>Backup</span>
                      </>
                    )}
                  </div>
                </div>
                <div className={styles.spaceTelemetry}>
                  {feature.tone === 'takda' && 'Forecast · accounts · budgets'}
                  {feature.tone === 'lakas' && 'Sessions · meals · body logs'}
                  {feature.tone === 'tala' && 'Entries · moods · quiet goals'}
                  {feature.tone === 'buhay' && 'Sign-in · export · restore'}
                </div>
                <p className={styles.spaceDesc}>{feature.desc}</p>
                <div className={styles.spaceActionRow}>
                  {feature.tone === 'takda' && (
                    <button type="button" className={styles.btnPrimary} onClick={() => openPrimary('takda')}>
                      {isSignedIn ? 'Open Takda' : 'Start with Takda'}
                    </button>
                  )}
                  {feature.tone === 'lakas' && (
                    <button type="button" className={styles.btnPrimary} onClick={() => openPrimary('lakas')}>
                      {isSignedIn ? 'Open Lakas' : 'Start with Lakas'}
                    </button>
                  )}
                  {feature.tone === 'tala' && (
                    <button type="button" className={styles.btnPrimary} onClick={() => openPrimary('tala')}>
                      {isSignedIn ? 'Open Tala' : 'Start with Tala'}
                    </button>
                  )}
                  {feature.tone === 'buhay' && (
                    <a className={styles.spaceInlineLink} href="#privacy">See the shared account layer</a>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section className={styles.section} id="privacy">
          <ScrollReveal className={styles.sectionHead}>
            <div className={styles.kicker}>Privacy and trust</div>
            <h2 className={styles.sectionTitle}>Free, private, and honest about limits.</h2>
            <p className={styles.sectionLead}>Buhay is free to use right now, and it stays clear about your data, your controls, and what the product does not replace.</p>
          </ScrollReveal>
          <div className={`${styles.beatsGrid} ${styles.trustGrid}`}>
            {TRUST_POINTS.map((point, idx) => (
              <ScrollReveal key={point.title} className={styles.beatCard}>
                <div className={styles.beatNum}>{idx + 1}</div>
                <div className={styles.beatTitle}>{point.title}</div>
                <p className={styles.beatDesc}>{point.desc}</p>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section className={styles.section} id="faq">
          <ScrollReveal className={styles.sectionHead}>
            <div className={styles.kicker}>FAQ</div>
            <h2 className={styles.sectionTitle}>Quick answers.</h2>
            <p className={styles.sectionLead}>The practical questions people ask before trusting a new app with real life records.</p>
          </ScrollReveal>
          <div className={`${styles.beatsGrid} ${styles.faqGrid}`}>
            {FAQ_ITEMS.map((item, idx) => (
              <ScrollReveal key={item.question} className={styles.beatCard}>
                <div className={styles.beatNum}>{idx + 1}</div>
                <div className={styles.beatTitle}>{item.question}</div>
                <p className={styles.beatDesc}>{item.answer}</p>
              </ScrollReveal>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <div className={styles.footerTitle}>Buhay</div>
            <div className={styles.footerMeta}>
              Takda, Lakas, and Tala stay separate by purpose, but share one Buhay account for sign-in, privacy, backup, and restore. Operated by {LEGAL_OPERATOR_NAME}. Support:{' '}
              <a className={styles.footerLink} href={LEGAL_CONTACT_HREF}>{LEGAL_CONTACT_EMAIL}</a>
            </div>
          </div>

          <div className={styles.footerCols}>
            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Product</div>
              <div className={styles.footerLinkStack}>
                <a className={styles.footerLink} href="#how-it-works">How it works</a>
                <a className={styles.footerLink} href="#spaces">Spaces</a>
                <a className={styles.footerLink} href="#faq">FAQ</a>
              </div>
            </div>
            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Legal</div>
              <div className={styles.footerLinkStack}>
                <Link className={styles.footerLink} to="/privacy">Privacy Policy</Link>
                <Link className={styles.footerLink} to="/terms">Terms of Service</Link>
              </div>
            </div>
            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Account</div>
              <div className={styles.footerActionStack}>
                <button type="button" className={styles.btnGhost} onClick={goLogin}>Sign in</button>
                <button type="button" className={styles.btnPrimary} onClick={() => openPrimary()}>{isSignedIn ? 'Open the app' : 'Start free'}</button>
              </div>
            </div>
          </div>

          <div className={styles.footerCopy}>© {new Date().getFullYear()} Buhay. Bawat araw, mas malinaw.</div>
        </div>
      </footer>
    </div>
  )
}
