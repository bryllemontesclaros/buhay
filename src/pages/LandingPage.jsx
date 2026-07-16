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

function BentoMockup() {
  return (
    <div className={styles.mockupFrame}>
      <div className={styles.mockupHeader}>
        <div className={styles.mockupDots}>
          <span className={styles.dotRed}></span>
          <span className={styles.dotYellow}></span>
          <span className={styles.dotGreen}></span>
        </div>
        <div className={styles.mockupUrl}>buhay.app/dashboard</div>
      </div>
      <div className={styles.mockupContent}>
        <div className={styles.mockBentoGrid}>
          <div className={styles.mockBentoItem} style={{ borderLeft: '3px solid var(--blue)', padding: '8px', marginBottom: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <div className={styles.mockCardLabel}>Takda · Wealth</div>
            <div className={styles.mockBalance} style={{ fontSize: '15px', fontWeight: 'bold', margin: '2px 0' }}>₱45,210.50</div>
          </div>
          <div className={styles.mockBentoItem} style={{ borderLeft: '3px solid var(--accent)', padding: '8px', marginBottom: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <div className={styles.mockCardLabel}>Lakas · Fitness</div>
            <div style={{ fontSize: '12px', fontWeight: '500', margin: '2px 0' }}>🏆 Ghost Racer: 1st place</div>
          </div>
          <div className={styles.mockBentoItem} style={{ borderLeft: '3px solid var(--purple)', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <div className={styles.mockCardLabel}>Tala · Mind</div>
            <div style={{ fontSize: '11px', opacity: 0.8, margin: '2px 0' }}>⛈️ Grounded Reflection Active</div>
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
  const [activeTab, setActiveTab] = useState('buhay')
  const [openFaqIdx, setOpenFaqIdx] = useState(null)

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
    <div className={styles.page}>
      <RouteMeta
        title="Buhay — Takda, Lakas, and Tala in one calm account"
        description="Track money, fitness, and reflection in three focused spaces inside one account."
        path="/"
      />
      <div className={styles.backdropWrap} aria-hidden="true">
        <div className={styles.backdrop} />
      </div>
      <a href="#landing-main" className="skipLink">Skip to main content</a>




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
          <div className={styles.heroContentCentered}>
            <div className={styles.heroKicker}>Wealth · Health · Mind</div>
            <h1 className={styles.heroTitleCentered}>
              The Unified Life System.{' '}
              <span className={styles.heroHighlight}>All in one calm bento cockpit.</span>
            </h1>
            <p className={styles.heroSubCentered}>
              Buhay centralizes your cashflow forecasting, fitness rhythms, and mood reflections into a single home dashboard. Control your wealth, health, and mind from one unified space.
            </p>

            <div className={styles.heroActionRowCentered}>
              <button type="button" className={styles.btnPrimary} onClick={() => openPrimary()}>
                {primaryLabel}
              </button>
              <button type="button" className={styles.btnGhost} onClick={goLogin}>
                Sign in
              </button>
            </div>

            <div className={styles.heroSignalRowCentered} aria-label="Buhay quick facts">
              <span className={styles.heroSignal}>Free right now</span>
              <span className={styles.heroSignal}>Manual and honest</span>
              <span className={styles.heroSignal}>Private by account</span>
            </div>
          </div>

          <div className={styles.heroMockupCentered}>
            <BentoMockup />
          </div>
        </header>

        <section className={styles.section} id="spaces">
          <ScrollReveal className={styles.sectionHead}>
            <div className={styles.kicker}>Spaces & Features</div>
            <h2 className={styles.sectionTitle}>Each space stays focused on one job.</h2>
            <p className={styles.sectionLead}>Choose a space below to see how it keeps your daily records organized and clear.</p>
          </ScrollReveal>

          <div className={styles.tabsContainer}>
            <div className={styles.tabList} role="tablist" aria-label="Buhay spaces">
              {SPACE_FEATURES.map(feature => (
                <button
                  key={feature.tone}
                  role="tab"
                  aria-selected={activeTab === feature.tone}
                  className={`${styles.tabBtn} ${activeTab === feature.tone ? `${styles.tabBtnActive} ${toneClass(feature.tone)}` : ''}`}
                  onClick={() => setActiveTab(feature.tone)}
                >
                  {feature.title}
                </button>
              ))}
            </div>

            <div className={styles.tabContentPanel}>
              {(() => {
                const currentFeature = SPACE_FEATURES.find(f => f.tone === activeTab) || SPACE_FEATURES[0]
                return (
                  <ScrollReveal className={styles.showcaseGrid}>
                    <div className={styles.showcaseCopy}>
                      <div className={`${styles.showcaseToneLabel} ${toneClass(currentFeature.tone)}`}>
                        {currentFeature.tone === 'buhay' ? 'Cockpit' : currentFeature.tone.toUpperCase()}
                      </div>
                      <h3 className={styles.showcaseTitle}>{currentFeature.title}</h3>
                      <p className={styles.showcaseDesc}>{currentFeature.desc}</p>
                      
                      <div className={styles.showcasePillRow}>
                        {currentFeature.tone === 'takda' && (
                          <>
                            <span className={styles.pill}>Money</span>
                            <span className={styles.pill}>Calendar</span>
                            <span className={styles.pill}>Savings</span>
                          </>
                        )}
                        {currentFeature.tone === 'lakas' && (
                          <>
                            <span className={styles.pill}>Workout</span>
                            <span className={styles.pill}>Timer</span>
                            <span className={styles.pill}>Ghost Racer</span>
                          </>
                        )}
                        {currentFeature.tone === 'tala' && (
                          <>
                            <span className={styles.pill}>Journal</span>
                            <span className={styles.pill}>Mood</span>
                            <span className={styles.pill}>Grounding</span>
                          </>
                        )}
                        {currentFeature.tone === 'buhay' && (
                          <>
                            <span className={styles.pill}>Bento</span>
                            <span className={styles.pill}>Privacy</span>
                            <span className={styles.pill}>Backup</span>
                          </>
                        )}
                      </div>

                      <div className={styles.showcaseAction}>
                        {currentFeature.tone !== 'buhay' ? (
                          <button type="button" className={styles.btnPrimary} onClick={() => openPrimary(currentFeature.tone)}>
                            {isSignedIn ? `Open ${currentFeature.title}` : `Start with ${currentFeature.title}`}
                          </button>
                        ) : (
                          <button type="button" className={styles.btnPrimary} onClick={() => openPrimary()}>
                            {primaryLabel}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={styles.showcaseMockup}>
                      {renderMockup(currentFeature.tone)}
                    </div>
                  </ScrollReveal>
                )
              })()}
            </div>
          </div>
        </section>

        <section className={styles.section} id="privacy">
          <ScrollReveal className={styles.sectionHead}>
            <div className={styles.kicker}>Privacy and trust</div>
            <h2 className={styles.sectionTitle}>Free, private, and honest about limits.</h2>
            <p className={styles.sectionLead}>Buhay is free to use right now, and it stays clear about your data, your controls, and what the product does not replace.</p>
          </ScrollReveal>
          
          <div className={styles.minimalistTrustGrid}>
            {TRUST_POINTS.map((point, idx) => (
              <ScrollReveal key={point.title} className={styles.trustColumn}>
                <div className={styles.trustNum}>0{idx + 1}</div>
                <h3 className={styles.trustTitle}>{point.title}</h3>
                <p className={styles.trustDesc}>{point.desc}</p>
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
          
          <div className={styles.faqAccordionContainer}>
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIdx === idx
              return (
                <ScrollReveal key={item.question} className={`${styles.accordionItem} ${isOpen ? styles.accordionItemOpen : ''}`}>
                  <button
                    type="button"
                    className={styles.accordionHeader}
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                  >
                    <span className={styles.accordionQuestion}>{item.question}</span>
                    <span className={styles.accordionIcon}>{isOpen ? '−' : '+'}</span>
                  </button>
                  <div className={styles.accordionPanel}>
                    <div className={styles.accordionContent}>
                      <p className={styles.accordionAnswer}>{item.answer}</p>
                    </div>
                  </div>
                </ScrollReveal>
              )
            })}
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
