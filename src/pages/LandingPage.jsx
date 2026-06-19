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
    desc: 'Balances, bills, savings, budgets, receipts, and date-based money review stay in one clear place.',
    tone: 'takda',
  },
  {
    label: 'Lakas',
    title: 'Fitness',
    desc: 'Workouts, meals, body check-ins, movement, and progress stay practical enough to return to.',
    tone: 'lakas',
  },
  {
    label: 'Tala',
    title: 'Mind',
    desc: 'Journal entries, mood check-ins, small tasks, and reflection stay quieter and more private here.',
    tone: 'tala',
  },
]

const SPACE_FEATURES = [
  {
    title: 'Takda',
    desc: 'Track money day by day with balances, bills, savings goals, budgets, receipts, and calendar-based review.',
    tone: 'takda',
  },
  {
    title: 'Lakas',
    desc: 'Log workouts, meals, body check-ins, and progress without turning fitness into a second full-time job.',
    tone: 'lakas',
  },
  {
    title: 'Tala',
    desc: 'Keep journal entries, moods, and small life tasks in a gentler space that does not compete with everything else.',
    tone: 'tala',
  },
  {
    title: 'Buhay account',
    desc: 'Keep sign-in, privacy, backup, restore, and deletion in one shared account layer while each space keeps its own job.',
    tone: 'buhay',
  },
]

const FLOW_BEATS = [
  {
    title: 'Choose a space',
    desc: 'Pick Takda, Lakas, or Tala based on what helps today. You do not have to set up everything first.',
    beat: 'Choose',
    tone: 'takda',
    pills: ['Takda', 'Lakas', 'Tala'],
    mock: 'spaces',
  },
  {
    title: 'Do the one thing',
    desc: 'Each space keeps one primary action close: add a money entry, start a workout, or write one honest line.',
    beat: 'Do',
    tone: 'lakas',
    pills: ['Add', 'Start', 'Write'],
    mock: 'action',
  },
  {
    title: 'See it stay organized',
    desc: 'Calendar and history keep your records structured so totals and review stay clear without extra work.',
    beat: 'Organize',
    tone: 'tala',
    pills: ['Calendar', 'Totals', 'History'],
    mock: 'organized',
  },
  {
    title: 'Use it your way',
    desc: 'Use one space or all three. Export, backup, restore, and privacy controls stay in your account.',
    beat: 'Use',
    tone: 'buhay',
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
    label: 'Takda',
    promise: 'Money gets a date, an account, and a real balance.',
    meta: 'Calendar first',
    tone: 'takda',
  },
  {
    label: 'Lakas',
    promise: 'Training starts with a session, not another decision maze.',
    meta: 'Workout first',
    tone: 'lakas',
  },
  {
    label: 'Tala',
    promise: 'Reflection starts with one honest line.',
    meta: 'Journal first',
    tone: 'tala',
  },
]


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
]

const START_FOCUS_COPY = {
  'one-update': 'Open one space and finish the one real thing you have been avoiding.',
  'catch-up': 'Use the saved timeline, totals, and history to catch up without guessing.',
  'build-routine': 'Stay with one space long enough for the habit to feel automatic, not dramatic.',
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [authReady, setAuthReady] = useState(() => Boolean(auth.currentUser))
  const [isSignedIn, setIsSignedIn] = useState(() => Boolean(auth.currentUser))
  const [startSpace, setStartSpace] = useState('takda')
  const [startFocus, setStartFocus] = useState('one-update')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, currentUser => {
      setIsSignedIn(Boolean(currentUser))
      setAuthReady(true)
    })
    return () => unsub()
  }, [])

  const primaryLabel = authReady
    ? (isSignedIn ? 'Open the app' : 'Start free')
    : 'Open Buhay'

  /**
   * Navigates the user to the application.
   * If the user is logged in, they are redirected to `/app`, otherwise to `/login`.
   * Passes the selected starting space (intent) via both sessionStorage and React Router location state.
   * @param {string} [spaceOverride] - Explicit space ID (e.g., 'takda', 'lakas', 'tala') to override default selection.
   */
  const openPrimary = (spaceOverride) => {
    const intended = spaceOverride || startSpace || 'explore'
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

  const activeHeroSpace = HERO_SPACES.find(space => space.label.toLowerCase() === startSpace) || HERO_SPACES[0]
  const startFocusCopy = START_FOCUS_COPY[startFocus] || START_FOCUS_COPY['one-update']

  return (
    <div className={`${styles.page} neo`}>
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
              <div className={styles.heroKicker}>Takda for money. Lakas for fitness. Tala for reflection.</div>
              <h1 className={styles.heroTitle}>
                Skip the noise.{' '}
                <span className={styles.heroHighlight}>One calm account.</span>
              </h1>
              <p className={styles.heroSub}>
                Buhay gives money, training, and reflection their own focused spaces while one shared account quietly handles sign-in, privacy, backup, and restore.
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
                  <span key={promise.label} className={`${styles.heroPromise} ${toneClass(promise.tone)}`}>
                    <strong>{promise.label}</strong>
                    <small>{promise.meta}</small>
                    {promise.promise}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.heroShowcase}>
              <div className={styles.heroCard} aria-label="Choose how to start Buhay">
                <div className={styles.heroStartHeader}>
                  <div>
                    <div className={styles.fieldLabel}>Start where the pressure is</div>
                    <h2 className={styles.heroStartTitle}>Choose one space. Do one honest thing.</h2>
                  </div>
                  <p className={styles.heroStartLead}>{startFocusCopy}</p>
                </div>

                <div className={styles.heroCardRow}>
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>Where to start</div>
                    <select className={styles.select} value={startSpace} onChange={event => setStartSpace(event.target.value)}>
                      <option value="takda">Takda (Money)</option>
                      <option value="lakas">Lakas (Fitness)</option>
                      <option value="tala">Tala (Mind)</option>
                      <option value="explore">Explore all</option>
                    </select>
                  </div>

                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>What you want today</div>
                    <select className={styles.select} value={startFocus} onChange={event => setStartFocus(event.target.value)}>
                      <option value="one-update">One real update</option>
                      <option value="catch-up">Catch up on the month</option>
                      <option value="build-routine">Build consistency</option>
                    </select>
                  </div>

                  <button type="button" className={`${styles.btnPrimary} ${styles.heroStartButton}`} onClick={() => openPrimary(startSpace)}>
                    {isSignedIn ? 'Open now' : 'Start free'}
                  </button>
                </div>

                <div className={styles.heroMetaRow}>
                  <span>One account.</span>
                  <span>Three clear jobs.</span>
                  <button type="button" className={styles.metaLink} onClick={goLogin}>Already have an account?</button>
                </div>

                <article className={`${styles.heroSpotlight} ${styles.heroSpaceCard} ${toneClass(activeHeroSpace.tone)}`}>
                  <div className={styles.heroSpotlightTop}>
                    <div>
                      <span className={styles.heroSpaceLabel}>{activeHeroSpace.label}</span>
                      <span className={styles.heroSpaceTitle}>{activeHeroSpace.title}</span>
                    </div>
                    <span className={styles.heroSpotlightBadge}>{startFocus.replace('-', ' ')}</span>
                  </div>
                  <p className={styles.heroSpaceDesc}>{activeHeroSpace.desc}</p>
                  <div className={styles.heroSpaceMeta}>
                    {activeHeroSpace.tone === 'takda' && 'Balances · bills · receipts · forecast'}
                    {activeHeroSpace.tone === 'lakas' && 'Workout · meals · body logs · progress'}
                    {activeHeroSpace.tone === 'tala' && 'Journal · moods · tasks · focus'}
                  </div>
                </article>

                <div className={styles.heroSharedStrip}>
                  <strong>Buhay account layer</strong>
                  <span>Sign-in, privacy, backup, restore, and export stay shared so the spaces can stay focused.</span>
                </div>
              </div>

              <div className={styles.heroDeviceRail} aria-label="Buhay spaces overview">
                {HERO_SPACES.map(space => {
                  const image = space.tone === 'takda' ? takdaLandingShot : space.tone === 'lakas' ? lakasLandingShot : talaLandingShot
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
                        <div className={styles.heroDeviceHeader}>{space.label}</div>
                        <img className={styles.heroDeviceImage} src={image} alt="" loading="lazy" decoding="async" width="900" height="1600" />
                      </div>
                      <p className={styles.heroRailCopy}>{space.desc}</p>
                    </article>
                  )
                })}
              </div>
            </div>
          </div>
        </header>

        <section className={styles.section} id="how-it-works">
          <div className={styles.sectionHead}>
            <div className={styles.kicker}>How it works</div>
            <h2 className={styles.sectionTitle}>Choose a space. Do one real thing.</h2>
            <p className={styles.sectionLead}>The app should feel obvious: pick the space you need, finish the update, then let Buhay keep the record organized.</p>
          </div>

          <div className={`${styles.beatsGrid} ${styles.flowGrid}`}>
            {FLOW_BEATS.map((beat, idx) => {
              const img = FLOW_BEAT_IMAGES[idx] || takdaLandingShot
              return (
                <article key={beat.title} className={`${styles.beatCard} ${toneClass(beat.tone)}`}>
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
                    <div className={styles.deviceTop}>
                      <div className={styles.deviceNotch} />
                    </div>
                    <img className={styles.deviceImg} src={img} alt="" loading="lazy" decoding="async" width="900" height="1600" />
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className={styles.section} id="spaces">
          <div className={styles.sectionHead}>
            <div className={styles.kicker}>Spaces</div>
            <h2 className={styles.sectionTitle}>Each space stays focused on one job.</h2>
            <p className={styles.sectionLead}>The account layer stays in the background. What you see first is the one thing each space is actually for.</p>
          </div>

          <div className={styles.spacesGrid}>
            {SPACE_FEATURES.map(feature => (
              <article
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
                  {feature.tone === 'takda' && 'Forecast · accounts · receipts'}
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
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} id="privacy">
          <div className={styles.sectionHead}>
            <div className={styles.kicker}>Privacy and trust</div>
            <h2 className={styles.sectionTitle}>Free, private, and honest about limits.</h2>
            <p className={styles.sectionLead}>Buhay is free to use right now, and it stays clear about your data, your controls, and what the product does not replace.</p>
          </div>
          <div className={`${styles.beatsGrid} ${styles.trustGrid}`}>
            {TRUST_POINTS.map((point, idx) => (
              <article key={point.title} className={styles.beatCard}>
                <div className={styles.beatNum}>{idx + 1}</div>
                <div className={styles.beatTitle}>{point.title}</div>
                <p className={styles.beatDesc}>{point.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} id="faq">
          <div className={styles.sectionHead}>
            <div className={styles.kicker}>FAQ</div>
            <h2 className={styles.sectionTitle}>Quick answers.</h2>
            <p className={styles.sectionLead}>The practical questions people ask before trusting a new app with real life records.</p>
          </div>
          <div className={`${styles.beatsGrid} ${styles.faqGrid}`}>
            {FAQ_ITEMS.map((item, idx) => (
              <article key={item.question} className={styles.beatCard}>
                <div className={styles.beatNum}>{idx + 1}</div>
                <div className={styles.beatTitle}>{item.question}</div>
                <p className={styles.beatDesc}>{item.answer}</p>
              </article>
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
