import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reload,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
} from 'firebase/auth'
import { deleteField } from 'firebase/firestore'
import { auth, getEmailActionSettings, getVerificationEmailErrorMessage, sendVerificationEmailSafe } from '../lib/firebase'
import { fsAdd, fsDel, fsDeleteAccountData, fsResetFinancialData, fsRestoreBackup, fsSetProfile, fsUpdate } from '../lib/firestore'
import { LEGAL_CONTACT_EMAIL, LEGAL_CONTACT_HREF, LEGAL_OPERATOR_NAME } from '../lib/legal'
import { DEFAULT_NOTIFICATION_PREFS, getNotificationPrefs } from '../lib/notifications'
import { generateMonthlyReport } from '../lib/report'
import { confirmApp, confirmDeleteApp, notifyApp } from '../lib/appFeedback'
import { CURRENCIES, displayValue, fmt, formatDisplayDate, maskMoney, playTick, today } from '../lib/utils'
import styles from './Page.module.css'
import settStyles from './Settings.module.css'

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'

const FEEDBACK_PRESETS = {
  feedback: {
    title: 'Send Feedback',
    prompt: 'Share suggestions or ideas that would make Buhay more helpful for you.',
  },
  bug: {
    title: 'Report a Bug',
    prompt: 'Tell us what broke, what you expected, and which screen you were using.',
  },
  rating: {
    title: 'Rate Your Experience',
    prompt: 'How is Buhay working for you so far?',
  },
  testimonial: {
    title: 'Share a Testimonial',
    prompt: 'Write a short quote we can feature on the Buhay landing page if you consent.',
  },
}

const NOTIFICATION_OPTIONS = [
  {
    key: 'budget',
    title: 'Budget alerts',
    desc: 'Warnings when a category budget is close to or over its limit.',
  },
  {
    key: 'bills',
    title: 'Bill reminders',
    desc: 'Due-soon and overdue bill reminders based on your saved bills.',
  },
  {
    key: 'goals',
    title: 'Goal milestones',
    desc: 'Alerts when savings goals are almost complete or fully reached.',
  },
  {
    key: 'spending',
    title: 'High-spend warnings',
    desc: 'Warnings when one day of spending takes a large share of your total budget.',
  },
]

const BACKUP_COLLECTIONS = [
  { key: 'income', label: 'Income' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'bills', label: 'Bills' },
  { key: 'goals', label: 'Savings goals' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'calendarEvents', label: 'Calendar reminders' },
  { key: 'portfolioHoldings', label: 'Portfolio holdings' },
  { key: 'lakasRoutines', label: 'Lakas routines' },
  { key: 'lakasWorkouts', label: 'Lakas workouts' },
  { key: 'lakasBodyLogs', label: 'Lakas body logs' },
  { key: 'lakasActivities', label: 'Lakas activity logs' },
  { key: 'lakasHabits', label: 'Lakas habit check-ins' },
  { key: 'lakasReminders', label: 'Lakas reminders' },
  { key: 'lakasMeals', label: 'Lakas meals' },
  { key: 'lakasGoals', label: 'Lakas goals' },
  { key: 'talaCheckins', label: 'Tala check-ins' },
  { key: 'talaJournal', label: 'Tala journal entries' },
  { key: 'talaMoods', label: 'Tala mood logs' },
  { key: 'talaTasks', label: 'Tala tasks' },
  { key: 'talaGoals', label: 'Tala goals' },
]

const DONATION_WALLETS = [
  {
    key: 'bitcoin',
    title: 'Bitcoin',
    shortTitle: 'BTC',
    address: 'bc1qe02rw0xqdx7sesypat9ghp923j6hm5hxv6penp',
  },
  {
    key: 'solana',
    title: 'Solana',
    shortTitle: 'SOL',
    address: 'DbVfaDpfTfij2KKfMESbxEk8wwQucuxP36HT4PjvJrXY',
  },
]


function normalizeBackupArray(value) {
  if (value == null) return []
  if (!Array.isArray(value)) throw new Error('Invalid backup file format.')
  return value
}

function sanitizeProfileBackup(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const {
    billingPlan,
    billingStatus,
    billingProvider,
    billingMode,
    billingReferenceNumber,
    billingActivatedAt,
    billingLinkId,
    billingCanceledAt,
    importUsage,
    ...rest
  } = value
  return rest
}

function parseBackupPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid backup file.')
  }

  const hasValidProfile = raw.profile == null || (typeof raw.profile === 'object' && !Array.isArray(raw.profile))
  if (!hasValidProfile) {
    throw new Error('Invalid profile data in backup.')
  }

  return {
    version: raw.version || 1,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    income: normalizeBackupArray(raw.income),
    expenses: normalizeBackupArray(raw.expenses),
    bills: normalizeBackupArray(raw.bills),
    goals: normalizeBackupArray(raw.goals),
    accounts: normalizeBackupArray(raw.accounts),
    budgets: normalizeBackupArray(raw.budgets),
    receipts: normalizeBackupArray(raw.receipts),
    transfers: normalizeBackupArray(raw.transfers),
    calendarEvents: normalizeBackupArray(raw.calendarEvents),
    portfolioHoldings: normalizeBackupArray(raw.portfolioHoldings),
    lakasRoutines: normalizeBackupArray(raw.lakasRoutines),
    lakasWorkouts: normalizeBackupArray(raw.lakasWorkouts),
    lakasBodyLogs: normalizeBackupArray(raw.lakasBodyLogs),
    lakasActivities: normalizeBackupArray(raw.lakasActivities),
    lakasHabits: normalizeBackupArray(raw.lakasHabits),
    lakasReminders: normalizeBackupArray(raw.lakasReminders),
    lakasMeals: normalizeBackupArray(raw.lakasMeals),
    lakasGoals: normalizeBackupArray(raw.lakasGoals),
    talaCheckins: normalizeBackupArray(raw.talaCheckins),
    talaJournal: normalizeBackupArray(raw.talaJournal),
    talaMoods: normalizeBackupArray(raw.talaMoods),
    talaTasks: normalizeBackupArray(raw.talaTasks),
    talaGoals: normalizeBackupArray(raw.talaGoals),
    profile: sanitizeProfileBackup(raw.profile || {}),
  }
}

function buildBackupSummary(backup) {
  return BACKUP_COLLECTIONS.map(item => ({
    ...item,
    count: Array.isArray(backup[item.key]) ? backup[item.key].length : 0,
  }))
}

async function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard unavailable')
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function StatusBanner({ message }) {
  if (!message?.text) return null

  const ok = Boolean(message.ok)
  return (
    <div
      className={`${settStyles.statusBanner} ${ok ? settStyles.statusBannerOk : settStyles.statusBannerError}`}
      role={ok ? 'status' : 'alert'}
      aria-live={ok ? 'polite' : 'assertive'}
    >
      {ok ? '✓ ' : ''}{message.text}
    </div>
  )
}

function ToggleButton({ enabled, onClick, onLabel = 'On', offLabel = 'Off', disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${settStyles.toggleButton} ${enabled ? settStyles.toggleButtonActive : ''}`}
    >
      {enabled ? onLabel : offLabel}
    </button>
  )
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${settStyles.modeButton} ${active ? settStyles.modeButtonActive : ''}`}
    >
      {children}
    </button>
  )
}

function CardHeader({ title, description, eyebrow, badge }) {
  return (
    <div className={settStyles.sectionHeader}>
      <div className={settStyles.sectionHeaderCopy}>
        {eyebrow && <div className={settStyles.sectionEyebrow}>{eyebrow}</div>}
        <div className={settStyles.sectionTitleRow}>
          <div className={settStyles.sectionTitle}>{title}</div>
          {badge ? <span className={settStyles.sectionBadge}>{badge}</span> : null}
        </div>
        {description ? <p className={settStyles.sectionCopy}>{description}</p> : null}
      </div>
    </div>
  )
}

function DisclosureCard({ title, description, eyebrow, badge, className = '', defaultOpen = false, children }) {
  return (
    <details className={`${className} ${settStyles.disclosureCard}`} open={defaultOpen}>
      <summary className={settStyles.disclosureSummary}>
        <div className={settStyles.disclosureCopy}>
          {eyebrow ? <div className={settStyles.sectionEyebrow}>{eyebrow}</div> : null}
          <div className={settStyles.sectionTitleRow}>
            <div className={settStyles.sectionTitle}>{title}</div>
            {badge ? <span className={settStyles.sectionBadge}>{badge}</span> : null}
          </div>
          {description ? <p className={`${settStyles.sectionCopy} ${settStyles.disclosureMeta}`}>{description}</p> : null}
        </div>
        <span className={settStyles.disclosureChevron} aria-hidden="true">⌄</span>
      </summary>
      <div className={settStyles.disclosureBody}>
        {children}
      </div>
    </details>
  )
}

export default function Settings({ user, data, profile, symbol, privacyMode = false }) {
  const s = symbol || '₱'
  const restoreInputRef = useRef(null)
  const [profileForm, setProfileForm] = useState({ currency: 'PHP' })
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_NOTIFICATION_PREFS)
  const [profileSaved, setProfileSaved] = useState(false)
  const [notifMsg, setNotifMsg] = useState({ text: '', ok: false })
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [exportDone, setExportDone] = useState(false)
  const [jsonExportDone, setJsonExportDone] = useState(false)
  const [rates, setRates] = useState(null)
  const [ratesLoading, setRatesLoading] = useState(false)


  const [accountForm, setAccountForm] = useState({ displayName: '', newEmail: '', password: '' })
  const [accountMsg, setAccountMsg] = useState({ text: '', ok: false })
  const [accountSaving, setAccountSaving] = useState(false)
  const [verifySending, setVerifySending] = useState(false)
  const [emailVerified, setEmailVerified] = useState(() => Boolean(auth.currentUser?.emailVerified || user?.emailVerified))
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState({ text: '', ok: false })
  const [pwLoading, setPwLoading] = useState(false)
  const [goalForm, setGoalForm] = useState({ name: '', target: '', current: '', date: '' })
  const [contribs, setContribs] = useState({})
  const [restoreMode, setRestoreMode] = useState('merge')
  const [restorePreview, setRestorePreview] = useState(null)
  const [restoreMsg, setRestoreMsg] = useState({ text: '', ok: false })
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [feedbackModal, setFeedbackModal] = useState(null)
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackSaved, setFeedbackSaved] = useState('')
  const [feedbackForm, setFeedbackForm] = useState({ kind: 'feedback', rating: 0, message: '', allowFeature: false })
  const [deleteAccountForm, setDeleteAccountForm] = useState({ password: '', confirmText: '' })
  const [deleteAccountMsg, setDeleteAccountMsg] = useState({ text: '', ok: false })
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [donationMsg, setDonationMsg] = useState({ text: '', ok: false })
  const [legalMsg, setLegalMsg] = useState({ text: '', ok: false })
  const feedbackOverlayRef = useRef(null)

  useEffect(() => {
    if (feedbackModal) {
      const prevBodyOverflow = document.body.style.overflow
      const prevHtmlOverflow = document.documentElement.style.overflow
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prevBodyOverflow
        document.documentElement.style.overflow = prevHtmlOverflow
      }
    }
  }, [feedbackModal])

  useEffect(() => {
    if (profile && Object.keys(profile).length > 0) {
      setProfileForm({
        currency: profile.currency || 'PHP',
      })
    }
    setNotificationPrefs(getNotificationPrefs(profile))
  }, [profile])

  useEffect(() => {
    setAccountForm(current => ({
      ...current,
      displayName: user?.displayName || auth.currentUser?.displayName || '',
      newEmail: '',
      password: '',
    }))
    setEmailVerified(Boolean(auth.currentUser?.emailVerified || user?.emailVerified))
  }, [user])

  useEffect(() => {
    fetchRates()
  }, [profileForm.currency])

  async function fetchRates() {
    setRatesLoading(true)
    try {
      const baseCurrency = profileForm.currency || 'PHP'
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`)
      const json = await response.json()
      setRates({ data: json.rates, base: baseCurrency })
    } catch {
      setRates(null)
    } finally {
      setRatesLoading(false)
    }
  }

  function setPF(key, value) {
    setProfileForm(current => ({ ...current, [key]: value }))
  }

  function setAccountField(key, value) {
    setAccountForm(current => ({ ...current, [key]: value }))
  }

  async function handleSaveProfile() {
    await fsSetProfile(user.uid, {
      currency: profileForm.currency,
      salary: deleteField(),
      paySchedule: deleteField(),
      lastPayday: deleteField(),
      billingPlan: deleteField(),
      billingStatus: deleteField(),
      billingProvider: deleteField(),
      billingMode: deleteField(),
      billingReferenceNumber: deleteField(),
      billingActivatedAt: deleteField(),
      billingLinkId: deleteField(),
      billingCanceledAt: deleteField(),
      importUsage: deleteField(),
    })
    setProfileSaved(true)
    window.setTimeout(() => setProfileSaved(false), 3000)
  }

  async function handleNotificationToggle(key) {
    const previous = notificationPrefs
    const next = { ...notificationPrefs, [key]: !notificationPrefs[key] }
    setNotificationPrefs(next)
    try {
      await fsSetProfile(user.uid, { notificationPrefs: next })
      setNotifMsg({ text: 'Notification preferences saved.', ok: true })
    } catch {
      setNotificationPrefs(previous)
      setNotifMsg({ text: 'Could not save notification preferences.', ok: false })
    }
  }



  async function handleSaveAccountProfile() {
    const currentUser = auth.currentUser
    if (!currentUser) return

    const displayName = accountForm.displayName.trim()
    if (!displayName) {
      setAccountMsg({ text: 'Display name is required.', ok: false })
      return
    }

    setAccountSaving(true)
    setAccountMsg({ text: '', ok: false })
    try {
      await updateProfile(currentUser, { displayName })
      await fsSetProfile(user.uid, { displayName })
      await reload(currentUser)
      setAccountMsg({ text: 'Account profile updated.', ok: true })
    } catch {
      setAccountMsg({ text: 'Could not update your account profile.', ok: false })
    } finally {
      setAccountSaving(false)
    }
  }

  async function handleSendVerification() {
    const currentUser = auth.currentUser
    if (!currentUser?.email) return
    if (emailVerified) {
      setAccountMsg({ text: 'Your email is already verified.', ok: true })
      return
    }

    setVerifySending(true)
    setAccountMsg({ text: '', ok: false })
    try {
      await sendVerificationEmailSafe(currentUser)
      setAccountMsg({ text: 'Verification email sent.', ok: true })
    } catch (error) {
      setAccountMsg({ text: getVerificationEmailErrorMessage(error), ok: false })
    } finally {
      setVerifySending(false)
    }
  }

  async function handleChangeEmail() {
    const currentUser = auth.currentUser
    if (!currentUser?.email) return

    const nextEmail = accountForm.newEmail.trim()
    if (!nextEmail) return setAccountMsg({ text: 'Enter the new email address first.', ok: false })
    if (nextEmail === currentUser.email) return setAccountMsg({ text: 'That email is already on your account.', ok: false })
    if (!accountForm.password) return setAccountMsg({ text: 'Enter your current password to update your email.', ok: false })

    setAccountSaving(true)
    setAccountMsg({ text: '', ok: false })
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, accountForm.password)
      await reauthenticateWithCredential(currentUser, credential)
      await verifyBeforeUpdateEmail(currentUser, nextEmail, getEmailActionSettings())
      setAccountForm(current => ({ ...current, newEmail: '', password: '' }))
      setAccountMsg({ text: `Verification sent to ${nextEmail}. Confirm it to finish changing your email.`, ok: true })
    } catch (error) {
      const message =
        error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential'
          ? 'Current password is incorrect.'
          : error.code === 'auth/email-already-in-use'
            ? 'That email is already in use.'
            : error.code === 'auth/invalid-email'
              ? 'Enter a valid email address.'
              : 'Could not start the email update. Try again.'
      setAccountMsg({ text: message, ok: false })
    } finally {
      setAccountSaving(false)
    }
  }

  async function handleChangePassword() {
    setPwMsg({ text: '', ok: false })
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) return setPwMsg({ text: 'Enter all three password fields.', ok: false })
    if (pwForm.next.length < 6) return setPwMsg({ text: 'New password must be at least 6 characters.', ok: false })
    if (pwForm.next !== pwForm.confirm) return setPwMsg({ text: 'New passwords do not match.', ok: false })
    setPwLoading(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, pwForm.current)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, pwForm.next)
      setPwMsg({ text: 'Password changed successfully.', ok: true })
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (error) {
      const message = error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential'
        ? 'Current password is incorrect.'
        : 'Failed to change password. Try again.'
      setPwMsg({ text: message, ok: false })
    } finally {
      setPwLoading(false)
    }
  }

  async function handleAddGoal() {
    if (!goalForm.name || !goalForm.target) {
      notifyApp({ title: 'Goal needs details', message: 'Add a goal name and target amount before saving.', tone: 'warning' })
      return
    }
    await fsAdd(user.uid, 'goals', {
      name: goalForm.name,
      target: parseFloat(goalForm.target),
      current: parseFloat(goalForm.current) || 0,
      date: goalForm.date,
    })
    setGoalForm({ name: '', target: '', current: '', date: '' })
  }

  async function handleGoalContrib(goal) {
    const value = parseFloat(contribs[goal._id] || 0)
    if (!value) return
    const newValue = Math.min(goal.target, (goal.current || 0) + value)
    await fsUpdate(user.uid, 'goals', goal._id, { current: newValue })
    setContribs(current => ({ ...current, [goal._id]: '' }))
  }

  async function handleDelGoal(id) {
    if (!(await confirmDeleteApp('this goal'))) return
    await fsDel(user.uid, 'goals', id)
  }

  function exportCSV() {
    const escapeCsvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`
    const classify = tx => [tx.cat, tx.subcat].filter(Boolean).join(' · ')
    const rows = [
      ['Type', 'Description', 'Category / Subcategory', 'Amount', 'Date', 'Recurring'],
      ...data.income.map(tx => ['Income', tx.desc, classify(tx), tx.amount, tx.date, tx.recur || '']),
      ...data.expenses.map(tx => ['Expense', tx.desc, classify(tx), tx.amount, tx.date, tx.recur || '']),
      ...data.bills.map(tx => ['Bill', tx.name, tx.subcat || tx.cat, tx.amount, `Day ${tx.due}`, tx.freq]),
      ...(data.transfers || []).map(tx => ['Transfer', `${tx.fromAccountName || 'From account'} to ${tx.toAccountName || 'To account'}`, '', tx.amount, tx.date, '']),
      ...(data.lakasRoutines || []).map(row => ['Lakas routine', row.name, `${row.exerciseCount || 0} exercises / ${row.setCount || 0} sets`, row.focus || '', row.duration || '', '']),
      ...(data.lakasWorkouts || []).map(row => ['Lakas workout', row.title, `${row.exerciseCount || 0} exercises`, row.duration || '', row.date, '']),
      ...(data.lakasMeals || []).map(row => ['Lakas meal', row.name, row.mealType || '', row.calories || '', row.date, '']),
      ...(data.lakasBodyLogs || []).map(row => ['Lakas body', row.notes || 'Body log', `Weight ${row.weight || 0} kg / Waist ${row.waist || 0} cm / BMI ${row.bmi || 0}`, '', row.date, '']),
      ...(data.lakasActivities || []).map(row => ['Lakas activity', row.type || 'Activity', `${row.steps || 0} steps / ${row.activeMinutes || 0} active min / ${row.cardioMinutes || 0} cardio min`, row.distance || '', row.date, '']),
      ...(data.lakasHabits || []).map(row => ['Lakas habit', row.notes || 'Habit check-in', `${row.score || 0} habits completed`, '', row.date, '']),
      ...(data.lakasReminders || []).map(row => ['Lakas reminder', row.title, row.type || '', row.time || '', row.date, row.frequency || '']),
      ...(data.lakasGoals || []).map(row => ['Lakas goal', row.name, row.type || '', row.target || '', '', row.unit || '']),
    ]
    const csv = rows.map(row => row.map(escapeCsvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `buhay-export-${today()}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    setExportDone(true)
    window.setTimeout(() => setExportDone(false), 3000)
  }

  function exportJSON() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      income: data.income,
      expenses: data.expenses,
      bills: data.bills,
      goals: data.goals,
      accounts: data.accounts,
      budgets: data.budgets,
      receipts: data.receipts,
      transfers: data.transfers || [],
      calendarEvents: data.calendarEvents || [],
      portfolioHoldings: data.portfolioHoldings || [],
      lakasRoutines: data.lakasRoutines || [],
      lakasWorkouts: data.lakasWorkouts || [],
      lakasBodyLogs: data.lakasBodyLogs || [],
      lakasActivities: data.lakasActivities || [],
      lakasHabits: data.lakasHabits || [],
      lakasReminders: data.lakasReminders || [],
      lakasMeals: data.lakasMeals || [],
      lakasGoals: data.lakasGoals || [],
      talaCheckins: data.talaCheckins || [],
      talaJournal: data.talaJournal || [],
      talaMoods: data.talaMoods || [],
      talaTasks: data.talaTasks || [],
      talaGoals: data.talaGoals || [],
      profile: sanitizeProfileBackup(profile),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `buhay-backup-${today()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setJsonExportDone(true)
    window.setTimeout(() => setJsonExportDone(false), 3000)
  }

  async function handleRestoreFile(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setRestoreMsg({ text: '', ok: false })
    try {
      const text = await file.text()
      const parsed = parseBackupPayload(JSON.parse(text))
      setRestorePreview({
        fileName: file.name,
        exportedAt: parsed.exportedAt,
        summary: buildBackupSummary(parsed),
        backup: parsed,
      })
      setRestoreMsg({ text: 'Backup file loaded. Review it before restoring.', ok: true })
    } catch (error) {
      setRestorePreview(null)
      setRestoreMsg({ text: error.message || 'Could not read that backup file.', ok: false })
    } finally {
      event.target.value = ''
    }
  }

  async function handleRestoreBackup() {
    if (!restorePreview?.backup) return

    const confirmed = await confirmApp({
      title: restoreMode === 'replace' ? 'Replace current data?' : 'Merge backup?',
      message: restoreMode === 'replace'
        ? 'This will replace current income, expenses, bills, goals, accounts, budgets, receipts, transfers, calendar reminders, Lakas data, Tala data, and profile data with this backup. Any legacy receipt, meal, and body image files are reference-only and are not recreated from JSON backups.'
        : 'This will merge the backup into your current Buhay data, including Takda, Lakas, Tala, and calendar reminders if present. Matching document ids will be updated. Any legacy receipt, meal, and body image files are reference-only and are not recreated from JSON backups.',
      confirmLabel: restoreMode === 'replace' ? 'Replace data' : 'Merge backup',
      cancelLabel: 'Cancel',
      tone: restoreMode === 'replace' ? 'danger' : 'default',
    })
    if (!confirmed) return

    setRestoreLoading(true)
    setRestoreMsg({ text: '', ok: false })
    try {
      await fsRestoreBackup(user.uid, restorePreview.backup, restoreMode)
      setRestoreMsg({
        text: restoreMode === 'replace'
          ? 'Backup restored. Current app data was replaced.'
          : 'Backup restored. Current app data was merged.',
        ok: true,
      })
    } catch {
      setRestoreMsg({ text: 'Restore failed. Please try again.', ok: false })
    } finally {
      setRestoreLoading(false)
    }
  }

  async function handleReset() {
    const confirmed = await confirmApp({
      title: 'Reset Takda and Lakas records?',
      message: 'This permanently deletes Takda finance records, receipts, calendar events, and Lakas fitness records while keeping Tala entries and your login active. This cannot be undone.',
      confirmLabel: 'Reset data',
      cancelLabel: 'Keep data',
      tone: 'danger',
    })
    if (!confirmed) return
    setResetting(true)
    try {
      await fsResetFinancialData(user.uid)
      setResetDone(true)
      window.setTimeout(() => setResetDone(false), 4000)
    } catch {
      notifyApp({ title: 'Reset failed', message: 'Please try again.', tone: 'error' })
    } finally {
      setResetting(false)
    }
  }

  async function handleDeleteAccount() {
    const currentUser = auth.currentUser
    if (!currentUser?.email) return

    if (deleteAccountForm.confirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteAccountMsg({ text: 'Type DELETE to confirm full account deletion.', ok: false })
      return
    }

    if (!deleteAccountForm.password) {
      setDeleteAccountMsg({ text: 'Enter your current password first.', ok: false })
      return
    }

    const confirmed = await confirmApp({
      title: 'Delete Buhay account?',
      message: 'This removes your Takda, Lakas, and Tala data, saved receipt records, any legacy fitness photos, profile, feedback, and login. This cannot be undone.',
      confirmLabel: 'Delete account',
      cancelLabel: 'Keep account',
      tone: 'danger',
    })
    if (!confirmed) return

    setDeleteAccountLoading(true)
    setDeleteAccountMsg({ text: '', ok: false })

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, deleteAccountForm.password)
      await reauthenticateWithCredential(currentUser, credential)
      await fsDeleteAccountData(user.uid)
      await deleteUser(currentUser)
    } catch (error) {
      const message =
        error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential'
          ? 'Current password is incorrect.'
          : error.code === 'auth/requires-recent-login'
            ? 'Please log in again, then retry deleting your account.'
            : 'Could not delete your account. Please try again.'
      setDeleteAccountMsg({ text: message, ok: false })
    } finally {
      setDeleteAccountLoading(false)
    }
  }

  function openFeedback(kind) {
    setFeedbackSaved('')
    setFeedbackModal(kind)
    setFeedbackForm({
      kind,
      rating: 0,
      message: '',
      allowFeature: kind === 'testimonial',
    })
  }

  async function submitFeedback() {
    if (!feedbackModal) return
    if (!feedbackForm.message.trim() && feedbackModal !== 'rating') {
      notifyApp({ title: 'Message needed', message: 'Please add a message first.', tone: 'warning' })
      return
    }
    if (feedbackModal === 'rating' && !feedbackForm.rating) {
      notifyApp({ title: 'Rating needed', message: 'Please select a rating.', tone: 'warning' })
      return
    }

    setFeedbackSending(true)
    try {
      await fsAdd(user.uid, 'feedback', {
        kind: feedbackForm.kind,
        rating: feedbackForm.rating || null,
        message: feedbackForm.message.trim(),
        allowFeature: feedbackForm.allowFeature,
        email: user.email,
        createdBy: user.displayName || user.email,
      })
      setFeedbackModal(null)
      setFeedbackSaved('Thanks. Your feedback was saved.')
    } catch {
      notifyApp({ title: 'Feedback not saved', message: 'Please check your connection and try again.', tone: 'error' })
    } finally {
      setFeedbackSending(false)
    }
  }

  async function handleCopyWallet(title, address) {
    try {
      await copyToClipboard(address)
      setDonationMsg({ text: `${title} wallet copied.`, ok: true })
    } catch {
      setDonationMsg({ text: `Could not copy the ${title} wallet right now.`, ok: false })
    }
    window.setTimeout(() => setDonationMsg({ text: '', ok: false }), 2800)
  }

  async function handleCopyLegalEmail() {
    try {
      await copyToClipboard(LEGAL_CONTACT_EMAIL)
      setLegalMsg({ text: 'Support email copied.', ok: true })
    } catch {
      setLegalMsg({ text: 'Could not copy the support email right now.', ok: false })
    }
    window.setTimeout(() => setLegalMsg({ text: '', ok: false }), 2800)
  }

  const totalTx = data.income.length + data.expenses.length
  const savingsTotal = data.goals.reduce((sum, goal) => sum + (goal.current || 0), 0)
  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))
  const showPublishConsent = feedbackForm.kind === 'testimonial' || Number(feedbackForm.rating) >= 4
  const currentEmail = auth.currentUser?.email || user?.email || ''
  const currentDisplayName = auth.currentUser?.displayName || user?.displayName || ''
  const restoreExportedAt = restorePreview?.exportedAt && !Number.isNaN(new Date(restorePreview.exportedAt).getTime())
    ? new Date(restorePreview.exportedAt).toLocaleString()
    : restorePreview?.exportedAt
  const enabledNotificationCount = NOTIFICATION_OPTIONS.filter(option => notificationPrefs[option.key]).length
  const trackedRecords = totalTx
    + data.bills.length
    + data.goals.length
    + data.accounts.length
    + data.budgets.length
    + (data.transfers || []).length
  const goalDateSelected = Boolean(goalForm.date)
  const settingsCardClass = `${styles.card} ${settStyles.surfaceCard}`
  const settingsWideCardClass = `${styles.card} ${settStyles.surfaceCard} ${settStyles.fullSpanCard}`
  const settingsDangerCardClass = `${styles.card} ${settStyles.surfaceCard} ${settStyles.dangerCard}`
  return (
    <div className={`${styles.page} ${settStyles.settingsPage}`}>
      <div className={settStyles.heroSection}>
        <div className={settStyles.heroCopy}>
          <div className={settStyles.pageEyebrow}>Settings</div>
          <div className={settStyles.pageTitle}>Everything important, kept simple.</div>
          <div className={settStyles.pageSub}>
            Use this page for account details, privacy, backup, and recovery. Extra tools stay lower down so the basics are easier to scan.
          </div>
        </div>

        <div className={settStyles.heroAside}>
          <div className={settStyles.heroAsideLabel}>Account status</div>
          <div className={settStyles.heroAsideValue}>{emailVerified ? 'Ready to recover' : 'Verify your email'}</div>
          <div className={settStyles.heroAsideTags}>
            <span className={`${settStyles.statusPill} ${emailVerified ? settStyles.statusPillOk : settStyles.statusPillWarn}`}>
              {emailVerified ? 'Verified email' : 'Verify email'}
            </span>
            <span className={settStyles.statusPill}>{profileForm.currency || 'PHP'}</span>
            <span className={settStyles.statusPill}>{trackedRecords} saved records</span>
            <span className={settStyles.statusPill}>{enabledNotificationCount}/{NOTIFICATION_OPTIONS.length} alerts on</span>
          </div>
          <div className={settStyles.heroAsideMeta}>
            {currentDisplayName || 'Buhay account'}
            {' · '}
            {currentEmail || 'Signed in'}
          </div>
        </div>
      </div>

      <div className={settStyles.categoryNavWrap}>
        <div className={settStyles.categoryNav}>
          <button
            type="button"
            className={`${settStyles.navTab} ${activeCategory === 'all' ? settStyles.navTabActive : ''}`}
            onClick={() => { playTick(); setActiveCategory('all'); }}
          >
            ✦ All
          </button>
          <button
            type="button"
            className={`${settStyles.navTab} ${activeCategory === 'account' ? settStyles.navTabActive : ''}`}
            onClick={() => { playTick(); setActiveCategory('account'); }}
          >
            👤 Account & Security
          </button>
          <button
            type="button"
            className={`${settStyles.navTab} ${activeCategory === 'preferences' ? settStyles.navTabActive : ''}`}
            onClick={() => { playTick(); setActiveCategory('preferences'); }}
          >
            ⚙️ Preferences
          </button>
          <button
            type="button"
            className={`${settStyles.navTab} ${activeCategory === 'data' ? settStyles.navTabActive : ''}`}
            onClick={() => { playTick(); setActiveCategory('data'); }}
          >
            💾 Data & Backups
          </button>
          <button
            type="button"
            className={`${settStyles.navTab} ${activeCategory === 'support' ? settStyles.navTabActive : ''}`}
            onClick={() => { playTick(); setActiveCategory('support'); }}
          >
            💬 Support & About
          </button>
          <button
            type="button"
            className={`${settStyles.navTab} ${activeCategory === 'danger' ? settStyles.navTabActive : ''}`}
            onClick={() => { playTick(); setActiveCategory('danger'); }}
          >
            ⚠️ Danger Zone
          </button>
        </div>
      </div>

      <div className={settStyles.settingsGrid}>
      {(activeCategory === 'all' || activeCategory === 'account') && (
      <div className={settingsCardClass}>
        <CardHeader
          eyebrow="Account"
          title="Account & security"
          description="Update your name, confirm your email, and handle sensitive account changes in one place."
        />
        <StatusBanner message={accountMsg} />

        <div className={`${styles.formRow} ${styles.col2}`} style={{ marginBottom: 12 }}>
          <div className={styles.formGroup}>
            <label>Display name</label>
            <input value={accountForm.displayName} onChange={event => setAccountField('displayName', event.target.value)} placeholder="Your name" />
          </div>
          <div className={styles.formGroup}>
            <label>Current email</label>
            <input value={currentEmail} readOnly />
          </div>
        </div>

        <div className={settStyles.preferenceRow} style={{ marginBottom: '1rem' }}>
          <div>
            <div className={settStyles.preferenceTitle}>Email verification</div>
            <div className={settStyles.preferenceMeta}>A verified email makes recovery and account changes safer.</div>
          </div>
          <div className={settStyles.inlineActions}>
            <span className={`${settStyles.statusPill} ${emailVerified ? settStyles.statusPillOk : settStyles.statusPillWarn}`}>
              {emailVerified ? 'Verified' : 'Unverified'}
            </span>
            {!emailVerified && (
              <button className={settStyles.btnExport} onClick={handleSendVerification} disabled={verifySending}>
                {verifySending ? 'Sending...' : 'Send verification link'}
              </button>
            )}
          </div>
        </div>

        <div className={settStyles.actionRow}>
          <button className={`${styles.btnAdd} ${settStyles.inlinePrimary}`} onClick={handleSaveAccountProfile} disabled={accountSaving}>
            {accountSaving ? 'Saving...' : 'Save display name'}
          </button>
        </div>

        <div className={settStyles.subsection}>
          <div className={settStyles.subsectionTitle}>Change email</div>
          <p className={settStyles.subsectionCopy}>
            We will verify the new address before the change goes through.
          </p>
          <div className={`${styles.formRow} ${styles.col2}`} style={{ marginBottom: 12 }}>
            <div className={styles.formGroup}>
              <label>New email</label>
              <input type="email" placeholder="new@email.com" value={accountForm.newEmail} onChange={event => setAccountField('newEmail', event.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label>Current password</label>
              <input type="password" placeholder="Required to confirm this change" value={accountForm.password} onChange={event => setAccountField('password', event.target.value)} />
            </div>
          </div>
          <button className={`${styles.btnAdd} ${settStyles.inlinePrimary}`} onClick={handleChangeEmail} disabled={accountSaving}>
            {accountSaving ? 'Updating...' : 'Update email'}
          </button>
        </div>

        <details className={settStyles.inlineDisclosure}>
          <summary className={settStyles.inlineDisclosureSummary}>
            <span>Change password</span>
            <small>Open this only when you want to change your password.</small>
          </summary>
          <div className={settStyles.inlineDisclosureBody}>
            {pwMsg.text && (
              <div className={`${settStyles.statusBanner} ${pwMsg.ok ? settStyles.statusBannerOk : settStyles.statusBannerError}`} style={{ marginBottom: 12 }}>
                {pwMsg.text}
              </div>
            )}
            <div className={`${styles.formRow} ${styles.col3}`} style={{ marginBottom: 12 }}>
              <div className={styles.formGroup}>
                <label>Current password</label>
                <input type="password" placeholder="••••••••" value={pwForm.current} onChange={event => setPwForm(current => ({ ...current, current: event.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label>New password</label>
                <input type="password" placeholder="Min. 6 characters" value={pwForm.next} onChange={event => setPwForm(current => ({ ...current, next: event.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label>Confirm new password</label>
                <input type="password" placeholder="••••••••" value={pwForm.confirm} onChange={event => setPwForm(current => ({ ...current, confirm: event.target.value }))} />
              </div>
            </div>
            <button className={`${styles.btnAdd} ${settStyles.inlinePrimary}`} onClick={handleChangePassword} disabled={pwLoading}>
              {pwLoading ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </details>
      </div>
      )}

      {(activeCategory === 'all' || activeCategory === 'preferences') && (
      <div className={settingsCardClass}>
        <CardHeader
          eyebrow="Alerts"
          title="Notifications"
          description="Choose which in-app alerts Buhay can show."
        />
        <StatusBanner message={notifMsg} />

        {NOTIFICATION_OPTIONS.map(option => (
          <div
            key={option.key}
            className={settStyles.preferenceRow}
            style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}
          >
            <div>
              <div className={settStyles.preferenceTitle}>{option.title}</div>
              <div className={settStyles.preferenceMeta}>{option.desc}</div>
            </div>
            <ToggleButton enabled={notificationPrefs[option.key]} onClick={() => handleNotificationToggle(option.key)} />
          </div>
        ))}
      </div>

      <div className={settingsCardClass}>
        <CardHeader
          eyebrow="Trust"
          title="Legal & privacy"
          description="Read the policy, review your rights, and get privacy help when you need it."
        />
        <StatusBanner message={legalMsg} />

        <div className={settStyles.preferenceRow}>
          <div>
            <div className={settStyles.preferenceTitle}>Privacy Policy</div>
            <div className={settStyles.preferenceMeta}>How Buhay stores, exports, restores, and deletes your account and app data.</div>
          </div>
          <Link className={settStyles.btnExportLink} to="/privacy">Open policy</Link>
        </div>

        <div className={settStyles.preferenceRow} style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
          <div>
            <div className={settStyles.preferenceTitle}>Terms of Use</div>
            <div className={settStyles.preferenceMeta}>What Buhay provides, what it does not provide, and the responsibilities that come with using it.</div>
          </div>
          <Link className={settStyles.btnExportLink} to="/terms">Open terms</Link>
        </div>

        <div className={settStyles.preferenceRow} style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
          <div>
            <div className={settStyles.preferenceTitle}>Privacy contact</div>
            <div className={settStyles.preferenceMeta}>
              Buhay is operated by {LEGAL_OPERATOR_NAME}. Email <a className={settStyles.inlineLink} href={LEGAL_CONTACT_HREF}>{LEGAL_CONTACT_EMAIL}</a> for privacy requests, account data questions, or support.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className={settStyles.btnExportLink} href={LEGAL_CONTACT_HREF}>Email</a>
            <button className={settStyles.btnExport} onClick={handleCopyLegalEmail}>Copy email</button>
          </div>
        </div>

        <div className={settStyles.legalNote}>
          More account tools are below if you need them: profile changes, exports, restore, reset, and full account deletion.
        </div>
      </div>

      <div className={settingsCardClass}>
        <CardHeader
          eyebrow="Currency"
          title="Currency preference"
          description="Choose the currency Takda uses across your money records. Exchange rates stay optional for quick reference."
        />

        <div className={styles.formGroup} style={{ marginBottom: '1.25rem' }}>
          <label>Currency</label>
          <select value={profileForm.currency} onChange={event => setPF('currency', event.target.value)}>
            {CURRENCIES.map(currency => <option key={currency.code} value={currency.code}>{currency.symbol} — {currency.label}</option>)}
          </select>
        </div>

        <details className={settStyles.inlineDisclosure} style={{ marginBottom: '1.25rem' }}>
          <summary className={settStyles.inlineDisclosureSummary}>
            <span>View exchange rates</span>
            <small>Helpful context, not a required setting.</small>
          </summary>
          <div className={settStyles.inlineDisclosureBody}>
            {ratesLoading ? (
              <div className={settStyles.emptyCopy}>Loading rates...</div>
            ) : !rates ? (
              <div className={settStyles.emptyCopy}>Could not load rates. Check your connection.</div>
            ) : (
              <>
                <div className={settStyles.ratesGrid}>
                  <div className={settStyles.rateBaseCard}>
                    <div className={settStyles.rateBaseLabel}>Your currency — Base</div>
                    <div className={settStyles.rateBaseValue}>{s} {rates.base}</div>
                  </div>
                  {['USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD', 'HKD', 'KRW', 'CNY', 'PHP'].filter(code => code !== rates.base).map(code => {
                    if (!rates.data[code]) return null
                    const unitsPerForeign = (1 / rates.data[code]).toFixed(2)
                    return (
                      <div key={code} className={settStyles.rateCard}>
                        <div className={settStyles.rateLabel}>1 {code} =</div>
                        <div className={settStyles.rateValue}>{s}{unitsPerForeign}</div>
                        <div className={settStyles.rateMeta}>{rates.base}</div>
                      </div>
                    )
                  })}
                </div>
                <div className={settStyles.rateSource}>Indicative rates from exchangerate-api.com</div>
              </>
            )}
          </div>
        </details>

        {profileSaved && (
          <div className={`${settStyles.statusBanner} ${settStyles.statusBannerOk}`}>
            ✓ Profile saved.
          </div>
        )}

        <button className={`${styles.btnAdd} ${settStyles.inlinePrimary}`} onClick={handleSaveProfile}>
          Save profile
        </button>
      </div>
      )}

      {(activeCategory === 'all' || activeCategory === 'data') && (
      <div className={settingsWideCardClass}>
        <CardHeader
          eyebrow="Backup"
          title="Export, backup & restore"
          description="Download a copy of your records or bring one back later when you need it."
        />
        <div className={settStyles.actionCluster}>
          <button className={settStyles.btnExport} onClick={exportCSV}>{exportDone ? '✓ Downloaded' : 'Download transactions CSV'}</button>
          <button className={settStyles.btnExport} onClick={exportJSON}>{jsonExportDone ? '✓ Downloaded' : 'Download JSON backup'}</button>
          <button
            className={settStyles.btnExport}
            onClick={() => {
              const nowDate = new Date()
              generateMonthlyReport(data, profile, nowDate.getFullYear(), nowDate.getMonth(), s)
            }}
          >
            Create monthly PDF
          </button>
        </div>

        <div className={settStyles.subsection}>
          <div className={settStyles.subsectionTitle}>Restore backup</div>
          <p className={settStyles.subsectionCopy}>
            Upload a Buhay JSON backup, review it, then merge it with current data or replace current data.
          </p>
          <StatusBanner message={restoreMsg} />
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleRestoreFile}
            style={{ display: 'none' }}
          />

          <div className={settStyles.preferenceRow}>
            <div>
              <div className={settStyles.preferenceTitle}>Backup file</div>
              <div className={settStyles.preferenceMeta}>Use a JSON backup exported from Buhay.</div>
            </div>
            <button className={settStyles.btnExport} onClick={() => restoreInputRef.current?.click()}>
              Upload JSON backup
            </button>
          </div>

          {restorePreview && (
            <>
              <div className={settStyles.restoreLoadedCard}>
                <div className={settStyles.restoreLoadedLabel}>Loaded backup</div>
                <div className={settStyles.restoreLoadedName}>{restorePreview.fileName}</div>
                {restoreExportedAt && (
                  <div className={settStyles.restoreLoadedMeta}>
                    Exported {restoreExportedAt}
                  </div>
                )}
              </div>

              <div className={settStyles.restoreModeRow}>
                <ModeButton active={restoreMode === 'merge'} onClick={() => setRestoreMode('merge')}>
                  Merge with current data
                </ModeButton>
                <ModeButton active={restoreMode === 'replace'} onClick={() => setRestoreMode('replace')}>
                  Replace current data
                </ModeButton>
              </div>

              <div className={settStyles.summaryGrid} style={{ marginTop: 12 }}>
                {restorePreview.summary.map(item => (
                  <div key={item.key} className={settStyles.summaryItem}>
                    <div className={settStyles.summaryVal}>{item.count}</div>
                    <div className={settStyles.summaryLabel}>{item.label}</div>
                  </div>
                ))}
              </div>

              <div className={settStyles.actionRow} style={{ marginTop: 12 }}>
                <button className={`${styles.btnAdd} ${settStyles.inlinePrimary}`} onClick={handleRestoreBackup} disabled={restoreLoading}>
                  {restoreLoading ? 'Restoring...' : restoreMode === 'replace' ? 'Restore and replace' : 'Restore and merge'}
                </button>
              </div>
            </>
          )}
        </div>
        <details className={settStyles.inlineDisclosure}>
          <summary className={settStyles.inlineDisclosureSummary}>
            <span>View stored data</span>
            <small>See what is currently saved in this account.</small>
          </summary>
          <div className={settStyles.inlineDisclosureBody}>
            <div className={settStyles.summaryGrid}>
              <div className={settStyles.summaryItem}><div className={settStyles.summaryVal}>{data.income.length}</div><div className={settStyles.summaryLabel}>Income entries</div></div>
              <div className={settStyles.summaryItem}><div className={settStyles.summaryVal}>{data.expenses.length}</div><div className={settStyles.summaryLabel}>Expenses</div></div>
              <div className={settStyles.summaryItem}><div className={settStyles.summaryVal}>{data.bills.length}</div><div className={settStyles.summaryLabel}>Bills</div></div>
              <div className={settStyles.summaryItem}><div className={settStyles.summaryVal}>{data.goals.length}</div><div className={settStyles.summaryLabel}>Savings goals</div></div>
              <div className={settStyles.summaryItem}><div className={settStyles.summaryVal}>{data.accounts.length}</div><div className={settStyles.summaryLabel}>Accounts</div></div>
              <div className={settStyles.summaryItem}><div className={settStyles.summaryVal}>{data.budgets.length}</div><div className={settStyles.summaryLabel}>Budgets</div></div>
              <div className={settStyles.summaryItem}><div className={settStyles.summaryVal}>{(data.transfers || []).length}</div><div className={settStyles.summaryLabel}>Transfers</div></div>
              <div className={settStyles.summaryItem}><div className={settStyles.summaryVal} style={{ color: 'var(--accent)' }}>{money(savingsTotal)}</div><div className={settStyles.summaryLabel}>Total saved</div></div>
              <div className={settStyles.summaryItem}><div className={settStyles.summaryVal}>{totalTx}</div><div className={settStyles.summaryLabel}>Total transactions</div></div>
            </div>
          </div>
        </details>
      </div>

      <DisclosureCard
        className={settingsWideCardClass}
        eyebrow="Optional"
        title="Savings goals"
        description="Savings goals still live here if you want them, but they stay secondary to account, privacy, and recovery."
      >
        <div className={settStyles.goalComposer}>
          <div className={`${styles.formRow} ${styles.col2}`} style={{ marginBottom: 8 }}>
            <div className={styles.formGroup}><label>Goal name</label><input placeholder="e.g. Emergency fund" value={goalForm.name} onChange={event => setGoalForm(current => ({ ...current, name: event.target.value }))} /></div>
            <div className={styles.formGroup}><label>Target ({s})</label><input type="number" min="0" placeholder="0.00" value={goalForm.target} onChange={event => setGoalForm(current => ({ ...current, target: event.target.value }))} /></div>
          </div>
          <div className={`${styles.formRow} ${styles.col2}`} style={{ marginBottom: 12 }}>
            <div className={styles.formGroup}><label>Already saved ({s})</label><input type="number" min="0" placeholder="0.00" value={goalForm.current} onChange={event => setGoalForm(current => ({ ...current, current: event.target.value }))} /></div>
            <div className={styles.formGroup}>
              <div className={styles.fieldLabelRow}>
                <label htmlFor="settings-goal-date">Target date</label>
                <span className={styles.fieldLabelNote}>Optional</span>
              </div>
              <div className={styles.dateFieldWrap}>
                <div className={`${styles.dateFieldDisplay} ${!goalDateSelected ? styles.dateFieldPlaceholder : ''}`}>
                  {formatDisplayDate(goalForm.date)}
                </div>
                <input
                  id="settings-goal-date"
                  type="date"
                  className={styles.dateFieldNative}
                  value={goalForm.date}
                  onChange={event => setGoalForm(current => ({ ...current, date: event.target.value }))}
                />
              </div>
            </div>
          </div>
          <div className={settStyles.actionRow}>
            <button className={`${styles.btnAdd} ${settStyles.inlinePrimary}`} style={{ marginBottom: data.goals.length ? '0.25rem' : 0 }} onClick={handleAddGoal}>Add goal</button>
          </div>
        </div>

        {data.goals.map(goal => {
          const pct = Math.min(100, Math.round(((goal.current || 0) / (goal.target || 1)) * 100))
          return (
            <div key={goal._id} className={`${styles.goalCard} ${settStyles.goalItem}`}>
              <div className={settStyles.goalItemHeader}>
                <div>
                  <div className={styles.goalName}>{goal.name}</div>
                  <div className={settStyles.goalItemMeta}>
                    <span>{pct}% complete</span>
                    {goal.date && <span className={styles.goalDateChip}>Target {formatDisplayDate(goal.date)}</span>}
                  </div>
                </div>
                <button className={styles.delBtn} onClick={() => handleDelGoal(goal._id)}>✕</button>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--accent)' : 'var(--blue)' }} />
              </div>
              <div className={styles.goalMeta}>
                <div className={styles.goalMetaPrimary}>
                  <span className={styles.goalSaved}>{money(goal.current || 0)} saved</span>
                  <span>of {money(goal.target)}</span>
                </div>
              </div>
              <div className={settStyles.goalContributionRow}>
                <input
                  type="number"
                  min="0"
                  placeholder={`Add amount (${s})`}
                  value={contribs[goal._id] || ''}
                  onChange={event => setContribs(current => ({ ...current, [goal._id]: event.target.value }))}
                  className={settStyles.goalContributionInput}
                />
                <button className={settStyles.btnExport} onClick={() => handleGoalContrib(goal)}>+ Add</button>
              </div>
            </div>
          )
        })}
        {!data.goals.length && <div className={settStyles.emptyCopy} style={{ marginTop: 8 }}>No savings goals yet. Add one here when you are ready.</div>}
      </DisclosureCard>
      )}

      {(activeCategory === 'all' || activeCategory === 'support') && (
      <DisclosureCard
        className={settingsWideCardClass}
        eyebrow="Support"
        title="Feedback, support, and app details"
        description="These extras stay here without taking over the main settings flow."
      >
        {feedbackSaved && <div className={settStyles.feedbackSaved}>{feedbackSaved}</div>}

        <div className={settStyles.subsection}>
          <div className={settStyles.subsectionTitle}>Feedback</div>
          <p className={settStyles.subsectionCopy}>Share ideas, report issues, rate the app, or leave a testimonial if you want to support the landing page.</p>
          <div className={settStyles.feedbackGrid}>
            <button className={settStyles.feedbackAction} onClick={() => openFeedback('feedback')}>
              <strong>Send Feedback</strong>
              <span>Suggestions and product ideas</span>
            </button>
            <button className={settStyles.feedbackAction} onClick={() => openFeedback('bug')}>
              <strong>Report a Bug</strong>
              <span>Keep support messages organized</span>
            </button>
            <button className={settStyles.feedbackAction} onClick={() => openFeedback('rating')}>
              <strong>Rate Your Experience</strong>
              <span>1-5 stars stored inside Buhay</span>
            </button>
            <button className={settStyles.feedbackAction} onClick={() => openFeedback('testimonial')}>
              <strong>Share a Testimonial</strong>
              <span>Only featured with your consent</span>
            </button>
          </div>
        </div>

        <div className={settStyles.subsection}>
          <div className={settStyles.subsectionTitle}>About Buhay</div>
          <details className={settStyles.inlineDisclosure}>
            <summary className={settStyles.inlineDisclosureSummary}>
              <span>View app details</span>
              <small>Version, brand, and the account you are using.</small>
            </summary>
            <div className={settStyles.inlineDisclosureBody}>
              <div className={settStyles.aboutBlock}>
                <div className={settStyles.aboutLogo}>Buhay</div>
                <div className={settStyles.aboutTagline}>Bawat araw, mas malinaw.</div>
                <div className={settStyles.aboutMeta}>Version {VERSION}</div>
                <div className={settStyles.aboutDesc}>
                  A calm life app built with Filipino clarity and warmth for everyday use anywhere. Keep up with money, fitness, and reflection in one private account.
                </div>
                <div className={settStyles.aboutUser}>Logged in as <strong>{currentDisplayName || user.email}</strong></div>
              </div>
            </div>
          </details>
        </div>

        <div className={settStyles.subsection}>
          <div className={settStyles.subsectionTitle}>Support Buhay</div>
          <details className={settStyles.inlineDisclosure}>
            <summary className={settStyles.inlineDisclosureSummary}>
              <span>View support options</span>
              <small>Wallets stay tucked away unless you want them.</small>
            </summary>
            <div className={settStyles.inlineDisclosureBody}>
              <p className={settStyles.subsectionCopy}>If Buhay helps, you can support the app with a coffee using the wallets below.</p>
              <StatusBanner message={donationMsg} />
              <div className={settStyles.donateGrid}>
                {DONATION_WALLETS.map(wallet => (
                  <div key={wallet.key} className={settStyles.donateCard}>
                    <div className={settStyles.donateTop}>
                      <div>
                        <div className={settStyles.donateTitle}>{wallet.title}</div>
                        <div className={settStyles.donateMeta}>{wallet.shortTitle} wallet</div>
                      </div>
                      <button className={settStyles.btnExport} onClick={() => handleCopyWallet(wallet.title, wallet.address)}>
                        Copy
                      </button>
                    </div>
                    <div className={settStyles.donateAddress}>{wallet.address}</div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      </DisclosureCard>
      )}

      {(activeCategory === 'all' || activeCategory === 'danger') && (
      <>
      <div className={settingsDangerCardClass}>
        <CardHeader
          eyebrow="Danger zone"
          title="Delete Takda and Lakas records"
          description="This removes Takda records, receipts, calendar items, and Lakas logs. Your account and Tala entries stay."
          badge="Irreversible"
        />
        {resetDone && (
          <div className={`${settStyles.statusBanner} ${settStyles.statusBannerOk}`}>
            ✓ Takda and Lakas records have been reset successfully.
          </div>
        )}
        <button className={`${settStyles.btnReset} ${settStyles.btnResetWide}`} onClick={handleReset} disabled={resetting}>
          {resetting ? 'Resetting...' : 'Reset Takda and Lakas data'}
        </button>
      </div>

      <div className={settingsDangerCardClass}>
        <CardHeader
          eyebrow="Danger zone"
          title="Delete account and all data"
          description="This permanently removes your Buhay account, saved profile, app records, and feedback."
          badge="Irreversible"
        />
        <StatusBanner message={deleteAccountMsg} />
        <div className={`${styles.formRow} ${styles.col2}`} style={{ marginBottom: 12 }}>
          <div className={styles.formGroup}>
            <label>Current password</label>
            <input
              type="password"
              placeholder="Required to delete your account"
              value={deleteAccountForm.password}
              onChange={event => setDeleteAccountForm(current => ({ ...current, password: event.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Type DELETE to confirm</label>
            <input
              type="text"
              placeholder="DELETE"
              value={deleteAccountForm.confirmText}
              onChange={event => setDeleteAccountForm(current => ({ ...current, confirmText: event.target.value }))}
            />
          </div>
        </div>
        <button className={`${settStyles.btnReset} ${settStyles.btnResetWide}`} onClick={handleDeleteAccount} disabled={deleteAccountLoading}>
          {deleteAccountLoading ? 'Deleting account...' : 'Delete account and all data'}
        </button>
      </div>
      </>
      )}

      <div className={settingsWideCardClass}>
        <button
          className={settStyles.logoutButton}
          onClick={async () => {
            const { signOut } = await import('firebase/auth')
            const { auth: authRef } = await import('../lib/firebase')
            await signOut(authRef)
          }}
        >
          Log out
        </button>
      </div>
      </div>

      {feedbackModal && typeof document !== 'undefined' && createPortal(
        <div ref={feedbackOverlayRef} className={settStyles.feedbackOverlay} onClick={event => { if (event.target === event.currentTarget) setFeedbackModal(null) }}>
          <div className={settStyles.feedbackModal}>
            <div className={settStyles.feedbackHeader}>
              <div>
                <div className={settStyles.feedbackTitle}>{FEEDBACK_PRESETS[feedbackModal].title}</div>
                <div className={settStyles.feedbackPrompt}>{FEEDBACK_PRESETS[feedbackModal].prompt}</div>
              </div>
              <button className={settStyles.feedbackClose} onClick={() => setFeedbackModal(null)}>✕</button>
            </div>

            {feedbackModal === 'rating' && (
              <div className={settStyles.ratingRow}>
                {[1, 2, 3, 4, 5].map(value => (
                  <button
                    key={value}
                    className={`${settStyles.starBtn} ${feedbackForm.rating >= value ? settStyles.starBtnActive : ''}`}
                    onClick={() => setFeedbackForm(current => ({ ...current, rating: value }))}
                  >
                    ★
                  </button>
                ))}
              </div>
            )}

            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
              <label>{feedbackModal === 'bug' ? 'What happened?' : feedbackModal === 'testimonial' ? 'Your testimonial' : 'Message'}</label>
              <textarea
                className={settStyles.feedbackTextarea}
                rows="5"
                placeholder={feedbackModal === 'bug' ? 'Describe the bug, steps, and expected result.' : 'Write your message here.'}
                value={feedbackForm.message}
                onChange={event => setFeedbackForm(current => ({ ...current, message: event.target.value }))}
              />
            </div>

            {showPublishConsent && (
              <label className={settStyles.consentRow}>
                <input
                  type="checkbox"
                  checked={feedbackForm.allowFeature}
                  onChange={event => setFeedbackForm(current => ({ ...current, allowFeature: event.target.checked }))}
                />
                <span>Can we feature this on the Buhay landing page?</span>
              </label>
            )}

            <div className={settStyles.feedbackActions}>
              <button className={settStyles.feedbackCancel} onClick={() => setFeedbackModal(null)}>Cancel</button>
              <button className={styles.btnAdd} style={{ flex: 1 }} onClick={submitFeedback} disabled={feedbackSending}>
                {feedbackSending ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
