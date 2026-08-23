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
import styles from './AuthScreen.module.css'
import BrandLogo from '../components/BrandLogo'

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

const REMEMBERED_EMAIL_KEY = 'buhay_remembered_email'
const REMEMBERED_EMAIL_MODE_KEY = 'buhay_remembered_email_enabled'
const AUTH_FLASH_KEY = 'buhay_auth_flash'

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
  const [tab, setTab] = useState(() => location.pathname === '/signup' ? 'register' : 'login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(() => ({
    name: '',
    email: safeGet(REMEMBERED_EMAIL_KEY, ''),
    password: '',
    confirm: '',
    inviteCode: '',
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
      const message = 'Log in complete. Opening your financial cockpit...'
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
    if (form.password.length < 6) return setError('Use at least 6 characters for your password.')
    if (!['BUHAY-BETA', 'BUHAY2026', 'TAKDA'].includes((form.inviteCode || '').trim().toUpperCase())) {
      return setError('Invalid access code. Use BUHAY-BETA or BUHAY2026.')
    }
    setLoading(true); setError(''); setSuccess('')
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await updateProfile(cred.user, { displayName: form.name })
      try {
        await sendVerificationEmailSafe(cred.user)
      } catch {}
      const message = 'Account created. Setting up your baseline...'
      setAuthFlash({ title: 'Account created', message })
      setSuccess('Sign up complete. Opening setup...')
    } catch (e) {
      setError(ERROR_MSGS[e.code] || e.message)
    } finally { setLoading(false) }
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!resetEmail) return setError('Enter your email address.')
    setResetLoading(true); setError('')
    try {
      await sendPasswordResetEmail(auth, resetEmail)
      setSuccess('Password reset link sent. Please check your inbox.')
      setShowForgot(false)
      setResetEmail('')
    } catch (e) {
      setError(ERROR_MSGS[e.code] || 'Failed to send reset email.')
    } finally { setResetLoading(false) }
  }

  const authTitle = showForgot
    ? 'Reset your password'
    : tab === 'register'
      ? 'Create your account'
      : 'Welcome back'
  const authSubtitle = showForgot
    ? 'Enter your email address and we will send you a link to reset your password.'
    : tab === 'register'
      ? 'Start with a clean financial slate. Set your baseline in under 60 seconds.'
      : 'Sign in to access your cashflow forecast, accounts, and bill schedules.'

  return (
    <div className={styles.screen}>
      <RouteMeta
        title="Log in or create your account — Buhay"
        description="Access Buhay to track cashflow runway, multi-account liquidity, recurring bills, budgets, and net worth."
        path="/login"
        robots="noindex, nofollow"
      />
      <div className={styles.shell}>
        <aside className={styles.storyPanel}>
          <div className={styles.storyIntro}>
            <div className={styles.logoWrap} style={{ marginBottom: '16px' }}>
              <BrandLogo to="/" />
            </div>
            <div className={styles.storyKicker}>Bawat araw, mas malinaw.</div>
            <h1 className={styles.storyTitle}>Predict your cashflow. Control every peso.</h1>
            <p className={styles.storyText}>
              A calm, private personal finance cockpit that combines 30-day runway projection, multi-account liquidity tracking, envelope budgets, and automated bill scheduling.
            </p>
            <div className={styles.storyStrip}>
              <span>🛡️ Zero bank passwords</span>
              <span>🔒 100% Private</span>
              <span>⚡ 30-Day Runway</span>
            </div>
          </div>

          <div className={styles.previewCard} aria-hidden="true">
            <div className={styles.previewTop}>
              <span>Financial Clarity</span>
              <strong>{tab === 'login' ? 'Continue your runway' : 'Set your baseline'}</strong>
            </div>
            <div className={styles.previewSpaceList}>
              <div className={`${styles.previewSpace} ${styles.previewSpaceTakda}`}>
                <span>30-Day Cashflow</span>
                <strong>Predict Every Balance Dip</strong>
                <em>Know your exact liquidity before bills arrive</em>
              </div>
              <div className={`${styles.previewSpace} ${styles.previewSpaceTakda}`}>
                <span>Multi-Account Radar</span>
                <strong>Unified Liquidity & Net Worth</strong>
                <em>Cash, Bank, GCash, Maya, and Crypto</em>
              </div>
              <div className={`${styles.previewSpace} ${styles.previewSpaceTakda}`}>
                <span>Smart Commitments</span>
                <strong>Fixed Bills & Safe Daily Spend</strong>
                <em>Paced budget limits with zero overdrafts</em>
              </div>
            </div>
          </div>
        </aside>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardBrand}>Buhay</div>
            <div className={styles.cardEyebrow}>{showForgot ? 'Account recovery' : tab === 'register' ? 'Quick setup' : 'Secure sign in'}</div>
            <div className={styles.cardTitle}>{authTitle}</div>
            <div className={styles.cardSubtitle}>{authSubtitle}</div>
            <div className={styles.mobileTrustStrip}>
              <span>🛡️ Zero bank passwords</span>
              <span>🔒 100% Private</span>
              <span>⚡ 30-Day Runway</span>
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
                  <div className={styles.field}><label>Access Code</label><input type="text" placeholder="BUHAY-BETA" value={form.inviteCode} onChange={e => set('inviteCode', e.target.value)} autoComplete="off" /></div>
                  <button className={styles.btnPrimary} type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create account & launch'}</button>
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
            <span>Zero Bank Credentials</span>
            <span>Client-Side Privacy</span>
            <span>1-Click CSV Export</span>
          </div>
        </div>
      </div>
    </div>
  )
}
