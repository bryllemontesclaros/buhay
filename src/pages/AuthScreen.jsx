import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import RouteMeta from '../components/RouteMeta'
import { auth, sendVerificationEmailSafe } from '../lib/firebase'
import { getStartSpaceIntent, setStartSpaceIntent } from '../lib/startIntent'
import styles from './AuthScreen.module.css'

const ERROR_MSGS = {
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Wrong password.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/too-many-requests': 'Too many attempts. Try again in a bit.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/configuration-not-found': 'Firebase Authentication is not fully configured. Enable Email/Password sign-in and add this domain in Firebase.',
  'auth/operation-not-allowed': 'Email/password sign-in is disabled in Firebase. Enable it in Authentication > Sign-in method.',
}

const REMEMBERED_EMAIL_KEY = 'sentimo_remembered_email'
const REMEMBERED_EMAIL_MODE_KEY = 'sentimo_remembered_email_enabled'
const AUTH_FLASH_KEY = 'takda_auth_flash'
const START_SPACE_LABELS = {
  takda: 'Takda',
  lakas: 'Lakas',
  tala: 'Tala',
  explore: 'Buhay',
}

function normalizeStartSpace(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return START_SPACE_LABELS[normalized] ? normalized : ''
}

function safeGet(key, fallback = '') {
  try {
    const value = localStorage.getItem(key)
    return value == null ? fallback : value
  } catch {
    return fallback
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch {}
}

function setAuthFlash(payload) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(AUTH_FLASH_KEY, JSON.stringify(payload))
  } catch {}
}

export default function AuthScreen() {
  const location = useLocation()
  const intendedStart = getStartSpaceIntent() || normalizeStartSpace(location.state?.startSpace)
  const startSpaceLabel = START_SPACE_LABELS[intendedStart] || ''
  const [tab, setTab] = useState(() => intendedStart ? 'register' : 'login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(() => ({
    name: '',
    email: safeGet(REMEMBERED_EMAIL_KEY, ''),
    password: '',
    confirm: '',
  }))
  const [rememberMe, setRememberMe] = useState(() => safeGet(REMEMBERED_EMAIL_MODE_KEY, 'true') !== 'false')
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function handleLogin(e) {
    e.preventDefault()
    if (!form.email || !form.password) return setError('Enter your email and password.')
    setLoading(true); setError(''); setSuccess('')
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
      await signInWithEmailAndPassword(auth, form.email, form.password)
      if (rememberMe) {
        safeSet(REMEMBERED_EMAIL_KEY, form.email.trim())
        safeSet(REMEMBERED_EMAIL_MODE_KEY, 'true')
      } else {
        safeRemove(REMEMBERED_EMAIL_KEY)
        safeSet(REMEMBERED_EMAIL_MODE_KEY, 'false')
      }
      const message = 'Log in complete. Opening your dashboard...'
      setAuthFlash({ title: 'Welcome back', message })
      setSuccess(message)
    } catch (e) {
      setError(ERROR_MSGS[e.code] || e.message)
    } finally { setLoading(false) }
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) return setError('Enter your name, email, and password.')
    if (form.password !== form.confirm) return setError('Passwords do not match.')
    if (form.password.length < 6) return setError('Use at least 6 characters.')
    setLoading(true); setError(''); setSuccess('')
    try {
      if (intendedStart) setStartSpaceIntent(intendedStart)
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await updateProfile(cred.user, { displayName: form.name })
      try {
        await sendVerificationEmailSafe(cred.user)
      } catch {}
      const message = 'Sign up complete. Finish your setup below.'
      setAuthFlash({ title: 'Account created', message })
      setSuccess('Sign up complete. Opening setup...')
    } catch (e) {
      setError(ERROR_MSGS[e.code] || e.message)
    } finally { setLoading(false) }
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!resetEmail) return setError('Enter your email.')
    setResetLoading(true); setError('')
    try {
      await sendPasswordResetEmail(auth, resetEmail)
      setSuccess('Reset link sent. Check your inbox.')
      setShowForgot(false)
      setResetEmail('')
    } catch (e) {
      setError(ERROR_MSGS[e.code] || 'Failed to send reset email.')
    } finally { setResetLoading(false) }
  }

  const authTitle = showForgot
    ? 'Reset your password'
    : tab === 'register'
      ? startSpaceLabel ? `Create your account for ${startSpaceLabel}` : 'Create your Buhay account'
      : 'Welcome back'
  const authSubtitle = showForgot
    ? 'Enter your email and we will send a reset link so you can get back into your Buhay account.'
    : tab === 'register'
      ? startSpaceLabel
        ? `You are starting with ${startSpaceLabel}. We will keep setup light and only ask for what matters now.`
        : 'Create one private account, choose where to start, and add the rest later.'
      : 'Sign in and go straight back to the part of life you were already tracking.'
  return (
    <div className={styles.screen}>
      <RouteMeta
        title="Log in or create your account — Buhay"
        description="Access Buhay to track money, fitness, reflection, tasks, goals, and everyday patterns in one account."
        path="/login"
        robots="noindex, nofollow"
      />
      <div className={styles.shell}>
        <aside className={styles.storyPanel}>
          <div className={styles.storyIntro}>
            <div className={styles.logo}>Buhay</div>
            <div className={styles.storyKicker}>Bawat araw, mas malinaw.</div>
            <h1 className={styles.storyTitle}>One calm app for money, fitness, and reflection.</h1>
            <p className={styles.storyText}>
              Use Takda for money, Lakas for fitness, and Tala for reflection. Start with the part of life that needs support today.
            </p>
            <div className={styles.storyStrip}>
              <span>Private account</span>
              <span>Light setup</span>
              <span>Real records</span>
            </div>
          </div>

          <div className={styles.previewCard} aria-hidden="true">
            <div className={styles.previewTop}>
              <span>{tab === 'login' ? 'Go back in quickly' : 'You do not need full setup first'}</span>
              <strong>{tab === 'login' ? 'Sign in and continue' : 'Start with one space'}</strong>
            </div>
            <div className={styles.previewSpaceList}>
              <div className={`${styles.previewSpace} ${styles.previewSpaceTakda}`}>
                <span>Takda</span>
                <strong>Money that stays clear</strong>
                <em>Balances, bills, receipts</em>
              </div>
              <div className={`${styles.previewSpace} ${styles.previewSpaceLakas}`}>
                <span>Lakas</span>
                <strong>Training you can return to</strong>
                <em>Workouts, meals, progress</em>
              </div>
              <div className={`${styles.previewSpace} ${styles.previewSpaceTala}`}>
                <span>Tala</span>
                <strong>A quieter place to think</strong>
                <em>Journal, mood, tasks</em>
              </div>
            </div>
          </div>
        </aside>

        <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardBrand}>Buhay</div>
          <div className={styles.cardEyebrow}>{showForgot ? 'Account recovery' : tab === 'register' ? 'Start setup' : 'Secure sign in'}</div>
          {!showForgot && startSpaceLabel && tab === 'register' && (
            <div className={styles.startIntentChip}>Starting with {startSpaceLabel}</div>
          )}
          <div className={styles.cardTitle}>{authTitle}</div>
          <div className={styles.cardSubtitle}>{authSubtitle}</div>
          <div className={styles.mobileTrustStrip}>
            <span>Private account</span>
            <span>Light setup</span>
            <span>Real records</span>
          </div>
        </div>

        {!showForgot ? (
          <>
            <div className={styles.tabs}>
              <button className={`${styles.tab} ${tab === 'login' ? styles.active : ''}`} onClick={() => { setTab('login'); setError(''); setSuccess('') }}>Log in</button>
              <button className={`${styles.tab} ${tab === 'register' ? styles.active : ''}`} onClick={() => { setTab('register'); setError(''); setSuccess('') }}>Create account</button>
            </div>

            {error && <div className={styles.error} role="alert">{error}</div>}
            {success && <div className={styles.successMsg} role="status" aria-live="polite">{success}</div>}

            {tab === 'login' ? (
              <form onSubmit={handleLogin}>
                <div className={styles.field}><label>Email</label><input type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} autoComplete="email" /></div>
                <div className={styles.field}>
                  <label>Password</label>
                  <div className={styles.passwordInputWrap}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowPassword(current => !current)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <label className={styles.checkRow}>
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                  <span>Keep me signed in</span>
                </label>
                <button type="button" className={styles.forgotLink} onClick={() => { setShowForgot(true); setResetEmail(form.email); setError('') }}>Forgot password?</button>
                <button className={styles.btnPrimary} type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</button>
                <p className={styles.legalNotice}>
                  By continuing, you agree to Buhay&apos;s <Link className={styles.legalLink} to="/terms">Terms of Use</Link> and acknowledge the <Link className={styles.legalLink} to="/privacy">Privacy Policy</Link>.
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <div className={styles.field}><label>Full name</label><input type="text" placeholder="Juan dela Cruz" value={form.name} onChange={e => set('name', e.target.value)} autoComplete="name" /></div>
                <div className={styles.field}><label>Email</label><input type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} autoComplete="email" /></div>
                <div className={styles.field}>
                  <label>Password</label>
                  <div className={styles.passwordInputWrap}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 6 characters"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowPassword(current => !current)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Confirm password</label>
                  <div className={styles.passwordInputWrap}>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={form.confirm}
                      onChange={e => set('confirm', e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowConfirm(current => !current)}
                      aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                      aria-pressed={showConfirm}
                    >
                      {showConfirm ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <button className={styles.btnPrimary} type="submit" disabled={loading}>{loading ? 'Creating account...' : startSpaceLabel ? `Create account and open ${startSpaceLabel}` : 'Create account'}</button>
                <p className={styles.legalNotice}>
                  By creating an account, you agree to Buhay&apos;s <Link className={styles.legalLink} to="/terms">Terms of Use</Link> and acknowledge the <Link className={styles.legalLink} to="/privacy">Privacy Policy</Link>.
                </p>
              </form>
            )}
          </>
        ) : (
          <>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <form onSubmit={handleReset}>
              <div className={styles.field}><label>Email</label><input type="email" placeholder="you@example.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} autoFocus /></div>
              <button className={styles.btnPrimary} type="submit" disabled={resetLoading}>{resetLoading ? 'Sending...' : 'Send reset link'}</button>
            </form>
            <button type="button" className={styles.backLink} onClick={() => { setShowForgot(false); setError('') }}>← Back to login</button>
          </>
        )}
          <div className={styles.trustStrip}>
            <span>Per-user data</span>
            <span>Privacy controls</span>
            <span>Real logs only</span>
          </div>
        </div>
      </div>
    </div>
  )
}
