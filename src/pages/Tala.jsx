import { useEffect, useMemo, useRef, useState } from 'react'
import { fsAdd, fsDel, fsSetProfile, fsUpdate } from '../lib/firestore'
import { confirmDeleteApp, notifyApp } from '../lib/appFeedback'
import { formatDisplayDate, today } from '../lib/utils'
import { safeScrollIntoView } from '../lib/ui'
import styles from './Page.module.css'
import tStyles from './Tala.module.css'

const MOOD_OPTIONS = ['Great', 'Good', 'Okay', 'Low', 'Heavy']
const ENERGY_OPTIONS = ['1', '2', '3', '4', '5']
const STRESS_OPTIONS = ['1', '2', '3', '4', '5']
const PRIORITIES = ['Low', 'Medium', 'High']
const LIFE_AREAS = ['Self', 'Family', 'Work', 'School', 'Health', 'Money', 'Faith', 'Creative', 'Custom']
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TALA_CALM_BOUNDARIES = ['Tracking, not diagnosis', 'Private by default', 'One small next step']
const JOURNAL_PROMPTS = [
  {
    title: 'What felt heavy?',
    tags: 'stress, reflection',
    body: 'The thing that felt heavy today was...\n\nThe smallest next step I can take is...',
  },
  {
    title: 'What went right?',
    tags: 'gratitude, win',
    body: 'Something that went right today was...\n\nI want to remember this because...',
  },
  {
    title: 'What needs a first step?',
    tags: 'decision, next step',
    body: 'The thing I keep postponing is...\n\nA first step small enough for today is...',
  },
]

const DEFAULT_TALA_SETTINGS = {
  reminderTime: '20:30',
  weeklyReviewDay: 'Sunday',
  promptStyle: 'Gentle',
  privateByDefault: true,
  showMoodInsights: true,
}

const TALA_TAB_COPY = {
  journal: {
    eyebrow: 'Journal',
    title: 'Write one clear entry.',
    sub: 'Save the note, mood, and tags you want to remember.',
    guide: ['Write freely', 'Keep private', 'Review gently'],
  },
  track: {
    eyebrow: 'Track',
    title: 'Keep today visible without overthinking it.',
    sub: 'Daily check-ins, mood patterns, and the Tala calendar stay together so you can notice the day quickly without hopping across separate tabs.',
    guide: ['Pick one check-in', 'Log honestly', 'Review lightly'],
  },
  focus: {
    eyebrow: 'Focus',
    title: 'Keep life admin and longer goals in one calm place.',
    sub: 'Tasks and personal goals stay grouped so Tala can hold both the urgent loop and the bigger direction without making either feel heavy.',
    guide: ['Choose the next step', 'Keep it small', 'Close one loop'],
  },
  insights: {
    eyebrow: 'Insights',
    title: 'Small patterns, calmer decisions.',
    sub: 'Review streaks, mood averages, task completion, tags, and triggers as reflection aids, not mental-health advice.',
    guide: ['Check pattern', 'Stay curious', 'Adjust gently'],
  },
  settings: {
    eyebrow: 'Tala settings',
    title: 'Keep Tala gentle, private, and light.',
    sub: 'The main Tala defaults stay simple, while data controls and logout stay easy to reach without making the page feel too administrative.',
    guide: ['Set reminder', 'Choose privacy', 'Manage calmly'],
  },
}

const TALA_TRACK_VIEWS = [
  { id: 'checkin', label: 'Check-in', meta: 'Daily note' },
  { id: 'mood', label: 'Mood', meta: 'Patterns and triggers' },
  { id: 'calendar', label: 'Calendar', meta: 'Month view' },
]

const TALA_FOCUS_VIEWS = [
  { id: 'tasks', label: 'Tasks', meta: 'Open loops' },
  { id: 'goals', label: 'Goals', meta: 'Longer direction' },
]

function getTalaTrackViewForTab(tab = '') {
  if (tab === 'mood') return 'mood'
  if (tab === 'calendar') return 'calendar'
  return 'checkin'
}

function getTalaFocusViewForTab(tab = '') {
  if (tab === 'goals') return 'goals'
  return 'tasks'
}

function normalizeRows(rows = []) {
  return Array.isArray(rows) ? rows : []
}

function sortNewest(rows = []) {
  return [...rows].sort((a, b) => {
    const dateCompare = String(b.date || b.dueDate || b.targetDate || '').localeCompare(String(a.date || a.dueDate || a.targetDate || ''))
    if (dateCompare) return dateCompare
    return Number(b.createdAt || 0) - Number(a.createdAt || 0)
  })
}

function numberOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatNumber(value, maximumFractionDigits = 0) {
  return numberOrZero(value).toLocaleString('en-PH', { maximumFractionDigits })
}

function moodScore(mood) {
  return {
    Great: 5,
    Good: 4,
    Okay: 3,
    Low: 2,
    Heavy: 1,
  }[mood] || 3
}

function moodTone(mood) {
  return {
    Great: 'great',
    Good: 'good',
    Okay: 'okay',
    Low: 'low',
    Heavy: 'heavy',
  }[mood] || 'okay'
}

function dateDaysAgo(days) {
  const base = new Date(`${today()}T00:00:00`)
  base.setDate(base.getDate() - days)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}

function getLastDateKeys(days = 7) {
  return Array.from({ length: days }, (_, index) => dateDaysAgo(days - 1 - index))
}

function addMonths(monthKey, delta) {
  const [year, month] = String(monthKey || today().slice(0, 7)).split('-').map(Number)
  const base = new Date(year || new Date().getFullYear(), (month || 1) - 1 + delta, 1)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
}

function getMonthDays(monthKey) {
  const [year, month] = String(monthKey || today().slice(0, 7)).split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  const leading = start.getDay()
  const days = []

  for (let index = 0; index < leading; index += 1) {
    days.push({ key: `empty-${index}`, empty: true })
  }

  for (let day = 1; day <= end.getDate(); day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    days.push({ key, day, empty: false })
  }

  return days
}

function createDateMap(rows = [], dateField = 'date') {
  return normalizeRows(rows).reduce((map, row) => {
    const key = row[dateField]
    if (!key) return map
    if (!map[key]) map[key] = []
    map[key].push(row)
    return map
  }, {})
}

function formatMonthLabel(monthKey = '') {
  const [year, month] = String(monthKey || today().slice(0, 7)).split('-').map(Number)
  const date = new Date(year || new Date().getFullYear(), (month || 1) - 1, 1)
  if (Number.isNaN(date.getTime())) return monthKey
  return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
}

function splitTags(value = '') {
  return String(value || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
}

function getTalaCalmPlan(insights = {}, journal = [], moods = []) {
  const todaysJournal = journal.find(row => row.date === today())
  const todaysMood = moods.find(row => row.date === today())

  if (!insights.todaysCheckin) {
    return {
      kicker: 'Start here',
      title: 'Do the 30-second check-in.',
      body: 'Name your mood, choose one priority, and write one honest sentence before adding more tasks.',
      steps: ['Mood', 'One priority', 'One sentence'],
    }
  }

  if (!todaysJournal) {
    return {
      kicker: 'Gentle next step',
      title: 'Put one thought somewhere safe.',
      body: 'A short private journal entry is enough. No need to solve the whole day.',
      steps: ['Pick a prompt', 'Write freely', 'Save private'],
    }
  }

  if (insights.overdue?.length) {
    return {
      kicker: 'Reduce pressure',
      title: 'Clear or shrink one stale task.',
      body: `${insights.overdue[0].title || 'One overdue task'} can become done, delayed, or smaller. Choose the least stressful honest action.`,
      steps: ['Choose one', 'Make it smaller', 'Mark progress'],
    }
  }

  if (!todaysMood) {
    return {
      kicker: 'Pattern',
      title: 'Log one mood trigger.',
      body: 'If you noticed a pattern today, capture the trigger now while it is still fresh.',
      steps: ['Mood', 'Trigger', 'Short note'],
    }
  }

  return {
    kicker: 'Enough for today',
    title: 'You have a complete Tala loop.',
    body: 'Check-in, journal, and mood are covered. Review gently or stop here without forcing more input.',
    steps: ['Notice', 'Breathe', 'Close the loop'],
  }
}

function getTalaSettings(profile = {}) {
  return {
    ...DEFAULT_TALA_SETTINGS,
    ...(profile?.talaSettings || {}),
  }
}

function sanitizeTalaSettings(settings = {}) {
  return {
    reminderTime: settings.reminderTime || DEFAULT_TALA_SETTINGS.reminderTime,
    weeklyReviewDay: WEEK_DAYS.includes(settings.weeklyReviewDay) ? settings.weeklyReviewDay : DEFAULT_TALA_SETTINGS.weeklyReviewDay,
    promptStyle: settings.promptStyle || DEFAULT_TALA_SETTINGS.promptStyle,
    privateByDefault: settings.privateByDefault !== false,
    showMoodInsights: settings.showMoodInsights !== false,
  }
}

function createTodayForm() {
  return {
    date: today(),
    mood: 'Good',
    energy: '3',
    stress: '2',
    sleepQuality: '3',
    priority: '',
    gratitude: '',
    reflection: '',
  }
}

function createJournalForm(settings = DEFAULT_TALA_SETTINGS) {
  return {
    date: today(),
    title: '',
    mood: 'Good',
    tags: '',
    body: '',
    private: settings.privateByDefault !== false,
  }
}

function createMoodForm() {
  return {
    date: today(),
    mood: 'Good',
    energy: '3',
    stress: '2',
    sleepQuality: '3',
    triggers: '',
    notes: '',
  }
}

function createTaskForm() {
  return {
    title: '',
    dueDate: today(),
    priority: 'Medium',
    notes: '',
  }
}

function createGoalForm() {
  return {
    name: '',
    area: 'Self',
    targetDate: '',
    progress: '0',
    notes: '',
  }
}

function MiniTrend({ title, rows, hidden = false }) {
  const maxValue = Math.max(5, ...rows.map(row => numberOrZero(row.value)))
  return (
    <div className={tStyles.chartCard}>
      <div className={tStyles.chartTitle}>{title}</div>
      <div className={tStyles.barChart}>
        {rows.map(row => (
          <div key={row.key} className={tStyles.barSlot}>
            <div className={tStyles.barTrack}>
              <div className={tStyles.barFill} style={{ height: `${Math.max(8, (numberOrZero(row.value) / maxValue) * 100)}%` }} />
            </div>
            <span>{row.label}</span>
          </div>
        ))}
      </div>
      <div className={tStyles.chartMeta}>{hidden ? 'Private' : `${formatNumber(rows.reduce((sum, row) => sum + numberOrZero(row.value), 0) / Math.max(1, rows.length), 1)} avg`}</div>
    </div>
  )
}

export default function Tala({ user, data = {}, profile = {}, privacyMode = false, activeTab = 'journal', actionRequest = null, onActionHandled = () => {} }) {
  const talaSettings = getTalaSettings(profile)
  const [todayForm, setTodayForm] = useState(createTodayForm)
  const [journalForm, setJournalForm] = useState(() => createJournalForm(talaSettings))
  const [moodForm, setMoodForm] = useState(createMoodForm)
  const [taskForm, setTaskForm] = useState(createTaskForm)
  const [goalForm, setGoalForm] = useState(createGoalForm)
  const [goalProgress, setGoalProgress] = useState({})
  const [settingsForm, setSettingsForm] = useState(talaSettings)
  const [savingSettings, setSavingSettings] = useState(false)
  const [deletingTalaData, setDeletingTalaData] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(today().slice(0, 7))
  const [selectedTalaDate, setSelectedTalaDate] = useState(today())
  const [trackView, setTrackView] = useState(() => getTalaTrackViewForTab(activeTab))
  const [focusView, setFocusView] = useState(() => getTalaFocusViewForTab(activeTab))
  const [pendingQuickAction, setPendingQuickAction] = useState(null)
  const settingsKey = JSON.stringify(profile?.talaSettings || {})
  const journalQuickActionRef = useRef(null)
  const journalTitleInputRef = useRef(null)
  const moodQuickActionRef = useRef(null)
  const moodSelectRef = useRef(null)
  const handledActionTokenRef = useRef(null)

  const checkins = sortNewest(normalizeRows(data.talaCheckins))
  const journal = sortNewest(normalizeRows(data.talaJournal))
  const moods = sortNewest(normalizeRows(data.talaMoods))
  const tasks = sortNewest(normalizeRows(data.talaTasks))
  const goals = sortNewest(normalizeRows(data.talaGoals))

  useEffect(() => {
    const nextSettings = getTalaSettings(profile)
    setSettingsForm(nextSettings)
    setJournalForm(current => ({ ...current, private: nextSettings.privateByDefault !== false }))
  }, [settingsKey])

  const insights = useMemo(() => {
    const weekStart = dateDaysAgo(6)
    const lastSevenDays = getLastDateKeys(7)
    const todaysCheckin = checkins.find(row => row.date === today()) || null
    const moodLogsThisWeek = moods.filter(row => row.date >= weekStart)
    const avgMood = moodLogsThisWeek.length
      ? moodLogsThisWeek.reduce((sum, row) => sum + moodScore(row.mood), 0) / moodLogsThisWeek.length
      : 0
    const openTasks = tasks.filter(row => row.done !== true)
    const doneTasks = tasks.filter(row => row.done === true)
    const dueToday = openTasks.filter(row => row.dueDate === today())
    const overdue = openTasks.filter(row => row.dueDate && row.dueDate < today())
    const activeGoals = goals.filter(goal => numberOrZero(goal.progress) < 100)
    const completeGoals = goals.filter(goal => numberOrZero(goal.progress) >= 100)
    const moodTrend = lastSevenDays.map(day => {
      const dayRows = moods.filter(row => row.date === day)
      const value = dayRows.length
        ? dayRows.reduce((sum, row) => sum + moodScore(row.mood), 0) / dayRows.length
        : 0
      return { key: day, label: day.slice(8), value }
    })
    const energyTrend = lastSevenDays.map(day => {
      const dayRows = moods.filter(row => row.date === day)
      const value = dayRows.length
        ? dayRows.reduce((sum, row) => sum + numberOrZero(row.energy), 0) / dayRows.length
        : 0
      return { key: day, label: day.slice(8), value }
    })
    const allTags = journal.flatMap(row => normalizeRows(row.tags))
    const allTriggers = moods.flatMap(row => normalizeRows(row.triggers))
    const journalDates = new Set(journal.map(row => row.date).filter(Boolean))
    let streak = 0
    let cursor = today()
    while (journalDates.has(cursor)) {
      streak += 1
      cursor = dateDaysAgo(streak)
    }

    return {
      todaysCheckin,
      avgMood,
      moodLogsThisWeek,
      openTasks,
      doneTasks,
      dueToday,
      overdue,
      activeGoals,
      completeGoals,
      moodTrend,
      energyTrend,
      journalStreak: streak,
      topTags: [...new Set(allTags)].slice(0, 6),
      topTriggers: [...new Set(allTriggers)].slice(0, 6),
    }
  }, [checkins, goals, journal, moods, tasks])

  const calendarData = useMemo(() => {
    const checkinMap = createDateMap(checkins)
    const journalMap = createDateMap(journal)
    const moodMap = createDateMap(moods)
    const taskMap = createDateMap(tasks, 'dueDate')
    const goalMap = createDateMap(goals, 'targetDate')
    return getMonthDays(calendarMonth).map(day => {
      if (day.empty) return day
      return {
        ...day,
        checkins: checkinMap[day.key] || [],
        journal: journalMap[day.key] || [],
        moods: moodMap[day.key] || [],
        tasks: taskMap[day.key] || [],
        goals: goalMap[day.key] || [],
      }
    })
  }, [calendarMonth, checkins, goals, journal, moods, tasks])
  const selectedDayData = useMemo(() => ({
    checkins: checkins.filter(row => row.date === selectedTalaDate),
    journal: journal.filter(row => row.date === selectedTalaDate),
    moods: moods.filter(row => row.date === selectedTalaDate),
    tasks: tasks.filter(row => row.dueDate === selectedTalaDate),
    goals: goals.filter(row => row.targetDate === selectedTalaDate),
  }), [checkins, goals, journal, moods, selectedTalaDate, tasks])
  const selectedDayTotal = Object.values(selectedDayData).reduce((sum, rows) => sum + rows.length, 0)

  const legacyTabAliases = {
    today: 'track',
    mood: 'track',
    calendar: 'track',
    tasks: 'focus',
    goals: 'focus',
  }
  const normalizedRequestedTab = legacyTabAliases[activeTab] || activeTab
  const currentTab = TALA_TAB_COPY[normalizedRequestedTab] ? normalizedRequestedTab : 'journal'
  const tabCopy = TALA_TAB_COPY[currentTab] || TALA_TAB_COPY.journal
  const showToday = currentTab === 'track' && trackView === 'checkin'
  const showJournal = currentTab === 'journal'
  const showMood = currentTab === 'track' && trackView === 'mood'
  const showTasks = currentTab === 'focus' && focusView === 'tasks'
  const showGoals = currentTab === 'focus' && focusView === 'goals'
  const showCalendar = currentTab === 'track' && trackView === 'calendar'
  const showInsights = currentTab === 'insights'
  const showSettings = currentTab === 'settings'
  const avgMoodLabel = insights.avgMood ? `${formatNumber(insights.avgMood, 1)}/5` : 'No log'
  const calmPlan = useMemo(() => getTalaCalmPlan(insights, journal, moods), [insights, journal, moods])

  useEffect(() => {
    if (!['today', 'mood', 'calendar'].includes(activeTab)) return
    setTrackView(getTalaTrackViewForTab(activeTab))
  }, [activeTab])

  useEffect(() => {
    if (!['tasks', 'goals'].includes(activeTab)) return
    setFocusView(getTalaFocusViewForTab(activeTab))
  }, [activeTab])

  useEffect(() => {
    if (!actionRequest?.token || handledActionTokenRef.current === actionRequest.token) return undefined

    if (actionRequest.type === 'journal') {
      if (!showJournal) return undefined
      handledActionTokenRef.current = actionRequest.token
      setPendingQuickAction({ type: 'journal', token: actionRequest.token })
      return undefined
    }

    if (actionRequest.type === 'mood') {
      if (currentTab !== 'track') return undefined
      handledActionTokenRef.current = actionRequest.token
      setTrackView('mood')
      setPendingQuickAction({ type: 'mood', token: actionRequest.token })
      return undefined
    }

    handledActionTokenRef.current = actionRequest.token
    onActionHandled(actionRequest.token)
    return undefined
  }, [actionRequest, currentTab, onActionHandled, showJournal])

  useEffect(() => {
    if (!pendingQuickAction) return undefined

    if (pendingQuickAction.type === 'journal' && showJournal) {
      const frameId = window.requestAnimationFrame(() => {
        safeScrollIntoView(journalQuickActionRef.current, { behavior: 'smooth', block: 'start' })
        journalTitleInputRef.current?.focus()
        onActionHandled(pendingQuickAction.token)
        setPendingQuickAction(null)
      })
      return () => window.cancelAnimationFrame(frameId)
    }

    if (pendingQuickAction.type === 'mood' && showMood) {
      const frameId = window.requestAnimationFrame(() => {
        safeScrollIntoView(moodQuickActionRef.current, { behavior: 'smooth', block: 'start' })
        moodSelectRef.current?.focus()
        onActionHandled(pendingQuickAction.token)
        setPendingQuickAction(null)
      })
      return () => window.cancelAnimationFrame(frameId)
    }

    return undefined
  }, [pendingQuickAction, showJournal, showMood, onActionHandled])

  const trackHeroCard = {
    checkin: {
      label: 'Today',
      value: privacyMode ? '...' : insights.todaysCheckin?.mood || 'No check-in',
      meta: insights.dueToday.length ? `${insights.dueToday.length} tasks due today` : 'Clear space for one honest note',
    },
    mood: {
      label: '7-day mood',
      value: privacyMode ? '...' : avgMoodLabel,
      meta: `${insights.moodLogsThisWeek.length} mood logs this week`,
    },
    calendar: {
      label: 'This month',
      value: formatMonthLabel(calendarMonth),
      meta: 'Check-ins, mood, journal, task dates, and goals',
    },
  }[trackView]

  const focusHeroCard = {
    tasks: {
      label: 'Open tasks',
      value: privacyMode ? '...' : String(insights.openTasks.length),
      meta: `${insights.dueToday.length} due today · ${insights.overdue.length} overdue`,
    },
    goals: {
      label: 'Active goals',
      value: privacyMode ? '...' : String(insights.activeGoals.length),
      meta: `${insights.completeGoals.length} completed`,
    },
  }[focusView]

  const staticHeroCards = {
    insights: {
      label: 'Pattern view',
      value: privacyMode ? '...' : avgMoodLabel,
      meta: `${insights.topTags.length} tags · ${insights.topTriggers.length} triggers`,
    },
    settings: {
      label: 'Privacy',
      value: talaSettings.privateByDefault ? 'Private' : 'Open',
      meta: `${talaSettings.reminderTime} reminder · ${talaSettings.weeklyReviewDay} review`,
    },
  }
  const tabHeroCard = currentTab === 'track'
    ? trackHeroCard
    : currentTab === 'focus'
      ? focusHeroCard
      : staticHeroCards[currentTab] || {}

  const trackStats = {
    checkin: [
      { label: 'Mood', value: privacyMode ? '...' : insights.todaysCheckin?.mood || 'No check-in', meta: 'Today' },
      { label: 'Energy', value: privacyMode ? '...' : insights.todaysCheckin?.energy || '-', meta: '1 to 5' },
      { label: 'Due', value: privacyMode ? '...' : String(insights.dueToday.length), meta: 'Tasks today' },
      { label: 'Journal', value: privacyMode ? '...' : `${insights.journalStreak}d`, meta: 'Current streak' },
    ],
    mood: [
      { label: 'Average', value: privacyMode ? '...' : avgMoodLabel, meta: 'Last 7 days' },
      { label: 'Logs', value: privacyMode ? '...' : String(moods.length), meta: 'All time' },
      { label: 'Energy', value: privacyMode ? '...' : formatNumber(insights.energyTrend.reduce((sum, row) => sum + numberOrZero(row.value), 0) / Math.max(1, insights.energyTrend.filter(row => row.value).length), 1), meta: '7-day avg' },
      { label: 'Triggers', value: privacyMode ? '...' : String(insights.topTriggers.length), meta: 'Recent' },
    ],
    calendar: [
      { label: 'Entries', value: privacyMode ? '...' : String(journal.length), meta: 'Journal' },
      { label: 'Mood logs', value: privacyMode ? '...' : String(moods.length), meta: 'Mood' },
      { label: 'Tasks', value: privacyMode ? '...' : String(tasks.length), meta: 'Task dates' },
      { label: 'Goals', value: privacyMode ? '...' : String(goals.length), meta: 'Target dates' },
    ],
  }[trackView]

  const focusStats = {
    tasks: [
      { label: 'Open', value: privacyMode ? '...' : String(insights.openTasks.length), meta: 'To do' },
      { label: 'Due', value: privacyMode ? '...' : String(insights.dueToday.length), meta: 'Today' },
      { label: 'Overdue', value: privacyMode ? '...' : String(insights.overdue.length), meta: 'Need attention' },
      { label: 'Done', value: privacyMode ? '...' : String(insights.doneTasks.length), meta: 'Completed' },
    ],
    goals: [
      { label: 'Active', value: privacyMode ? '...' : String(insights.activeGoals.length), meta: 'In progress' },
      { label: 'Done', value: privacyMode ? '...' : String(insights.completeGoals.length), meta: 'Completed' },
      { label: 'Areas', value: privacyMode ? '...' : String(new Set(goals.map(goal => goal.area)).size), meta: 'Life areas' },
      { label: 'Total', value: privacyMode ? '...' : String(goals.length), meta: 'Tracked goals' },
    ],
  }[focusView]

  const staticTabStats = {
    journal: [
      { label: 'Entries', value: privacyMode ? '...' : String(journal.length), meta: 'Saved notes' },
      { label: 'Streak', value: privacyMode ? '...' : `${insights.journalStreak}d`, meta: 'Current' },
      { label: 'Tags', value: privacyMode ? '...' : String(insights.topTags.length), meta: 'Recent themes' },
      { label: 'Private', value: privacyMode ? '...' : String(journal.filter(row => row.private).length), meta: 'Locked entries' },
    ],
    insights: [
      { label: 'Mood avg', value: privacyMode ? '...' : avgMoodLabel, meta: 'Last 7 days' },
      { label: 'Streak', value: privacyMode ? '...' : `${insights.journalStreak}d`, meta: 'Journal' },
      { label: 'Tasks done', value: privacyMode ? '...' : String(insights.doneTasks.length), meta: 'All time' },
      { label: 'Tags', value: privacyMode ? '...' : String(insights.topTags.length), meta: 'Themes' },
    ],
    settings: [
      { label: 'Reminder', value: talaSettings.reminderTime, meta: 'Daily check-in' },
      { label: 'Review', value: talaSettings.weeklyReviewDay, meta: 'Weekly reset' },
      { label: 'Prompt', value: talaSettings.promptStyle, meta: 'Tone' },
      { label: 'Privacy', value: talaSettings.privateByDefault ? 'Private' : 'Open', meta: 'Journal default' },
    ],
  }
  async function handleSaveToday() {
    if (!todayForm.date || (!todayForm.priority.trim() && !todayForm.gratitude.trim() && !todayForm.reflection.trim())) {
      notifyApp({ title: 'Check-in needs a note', message: 'Add a priority, gratitude, or reflection before saving.', tone: 'warning' })
      return
    }

    const existing = checkins.find(row => row.date === todayForm.date)
    const payload = {
      ...todayForm,
      energy: numberOrZero(todayForm.energy),
      stress: numberOrZero(todayForm.stress),
      sleepQuality: numberOrZero(todayForm.sleepQuality),
      priority: todayForm.priority.trim(),
      gratitude: todayForm.gratitude.trim(),
      reflection: todayForm.reflection.trim(),
      source: 'tala',
    }
    if (existing?._id) {
      await fsUpdate(user.uid, 'talaCheckins', existing._id, payload)
    } else {
      await fsAdd(user.uid, 'talaCheckins', payload)
    }
    setTodayForm(createTodayForm())
    notifyApp({ title: 'Tala check-in saved', message: 'Today has a little more shape now.', tone: 'success' })
  }

  async function handleAddJournal() {
    if (!journalForm.title.trim() && !journalForm.body.trim()) {
      notifyApp({ title: 'Journal needs words', message: 'Add a title or write an entry before saving.', tone: 'warning' })
      return
    }

    await fsAdd(user.uid, 'talaJournal', {
      date: journalForm.date,
      title: journalForm.title.trim() || 'Untitled entry',
      mood: journalForm.mood,
      tags: splitTags(journalForm.tags),
      body: journalForm.body.trim(),
      private: Boolean(journalForm.private),
      source: 'tala',
    })
    setJournalForm(createJournalForm(talaSettings))
    notifyApp({ title: 'Journal saved', message: 'Your Tala entry was added.', tone: 'success' })
  }

  async function handleAddMood() {
    if (!moodForm.date) {
      notifyApp({ title: 'Mood needs a date', message: 'Choose a date before saving.', tone: 'warning' })
      return
    }

    await fsAdd(user.uid, 'talaMoods', {
      date: moodForm.date,
      mood: moodForm.mood,
      energy: numberOrZero(moodForm.energy),
      stress: numberOrZero(moodForm.stress),
      sleepQuality: numberOrZero(moodForm.sleepQuality),
      triggers: splitTags(moodForm.triggers),
      notes: moodForm.notes.trim(),
      source: 'tala',
    })
    setMoodForm(createMoodForm())
    notifyApp({ title: 'Mood logged', message: 'Mood pattern updated.', tone: 'success' })
  }

  async function handleAddTask() {
    if (!taskForm.title.trim()) {
      notifyApp({ title: 'Task needs a title', message: 'Add the task you want to remember.', tone: 'warning' })
      return
    }

    await fsAdd(user.uid, 'talaTasks', {
      title: taskForm.title.trim(),
      dueDate: taskForm.dueDate,
      priority: taskForm.priority,
      notes: taskForm.notes.trim(),
      done: false,
      source: 'tala',
    })
    setTaskForm(createTaskForm())
    notifyApp({ title: 'Task added', message: 'Tala task saved.', tone: 'success' })
  }

  async function handleAddGoal() {
    if (!goalForm.name.trim()) {
      notifyApp({ title: 'Goal needs a name', message: 'Name the goal before saving.', tone: 'warning' })
      return
    }

    await fsAdd(user.uid, 'talaGoals', {
      name: goalForm.name.trim(),
      area: goalForm.area,
      targetDate: goalForm.targetDate,
      progress: Math.min(100, numberOrZero(goalForm.progress)),
      notes: goalForm.notes.trim(),
      source: 'tala',
    })
    setGoalForm(createGoalForm())
    notifyApp({ title: 'Tala goal saved', message: 'Your life goal is now visible.', tone: 'success' })
  }

  async function handleGoalProgress(goal) {
    const value = Math.max(0, Math.min(100, numberOrZero(goalProgress[goal._id])))
    await fsUpdate(user.uid, 'talaGoals', goal._id, { progress: value, updatedAt: Date.now() })
    setGoalProgress(current => ({ ...current, [goal._id]: '' }))
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      const nextSettings = sanitizeTalaSettings(settingsForm)
      await fsSetProfile(user.uid, { talaSettings: nextSettings })
      setSettingsForm(nextSettings)
      notifyApp({ title: 'Tala settings saved', message: 'Your mind-space defaults were updated.', tone: 'success' })
    } catch {
      notifyApp({ title: 'Settings not saved', message: 'Check your connection and try again.', tone: 'error' })
    } finally {
      setSavingSettings(false)
    }
  }

  function handleExportTalaData() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: {
        talaSettings: sanitizeTalaSettings(settingsForm),
      },
      talaCheckins: checkins,
      talaJournal: journal,
      talaMoods: moods,
      talaTasks: tasks,
      talaGoals: goals,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `buhay-tala-backup-${today()}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    notifyApp({ title: 'Tala export ready', message: 'Your Tala backup was downloaded.', tone: 'success' })
  }

  async function handleLogout() {
    const [{ signOut }, { auth }] = await Promise.all([
      import('firebase/auth'),
      import('../lib/firebase'),
    ])
    await signOut(auth)
  }

  async function handleDeleteTalaData() {
    const confirmed = await confirmDeleteApp('all Tala data')
    if (!confirmed) return

    setDeletingTalaData(true)
    try {
      const collections = [
        ['talaCheckins', checkins],
        ['talaJournal', journal],
        ['talaMoods', moods],
        ['talaTasks', tasks],
        ['talaGoals', goals],
      ]
      await Promise.all(collections.flatMap(([collectionName, rows]) => (
        normalizeRows(rows)
          .filter(row => row._id)
          .map(row => fsDel(user.uid, collectionName, row._id))
      )))
      notifyApp({ title: 'Tala data cleared', message: 'Tala logs were deleted. Tala settings were kept.', tone: 'success' })
    } catch {
      notifyApp({ title: 'Could not clear Tala', message: 'Some data may still remain. Check your connection and try again.', tone: 'error' })
    } finally {
      setDeletingTalaData(false)
    }
  }

  function updateSettings(field, value) {
    setSettingsForm(current => ({ ...current, [field]: value }))
  }

  function selectCalendarDay(day) {
    if (!day?.key || day.empty) return
    setSelectedTalaDate(day.key)
  }

  function applyJournalPrompt(prompt) {
    setJournalForm(current => ({
      ...current,
      title: current.title || prompt.title,
      tags: current.tags || prompt.tags,
      body: current.body || prompt.body,
      private: true,
    }))
  }

  const trackSwitcher = currentTab === 'track' ? (
    <div className={tStyles.grid}>
      <section className={`${tStyles.viewSwitchCard} ${tStyles.viewSwitchCompact}`} aria-label="Choose what to track in Tala">
        <div className={tStyles.viewSwitchHeader}>
          <div>
            <div className={tStyles.sectionKicker}>Track</div>
            <h3>Choose what you want to update.</h3>
            <p className={tStyles.sectionHint}>Check-in, mood, and calendar stay in one calm area so the page does not keep changing shape.</p>
          </div>
        </div>
        <div className={tStyles.viewSwitch} role="tablist" aria-label="Choose what to track in Tala">
          {TALA_TRACK_VIEWS.map(view => (
            <button
              key={view.id}
              type="button"
              className={`${tStyles.viewSwitchButton} ${trackView === view.id ? tStyles.viewSwitchButtonActive : ''}`}
              onClick={() => setTrackView(view.id)}
              role="tab"
              aria-selected={trackView === view.id}
            >
              <strong>{view.label}</strong>
              <span>{view.meta}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  ) : null

  const focusSwitcher = currentTab === 'focus' ? (
    <div className={tStyles.grid}>
      <section className={`${tStyles.viewSwitchCard} ${tStyles.viewSwitchCompact}`} aria-label="Choose what to focus on in Tala">
        <div className={tStyles.viewSwitchHeader}>
          <div>
            <div className={tStyles.sectionKicker}>Focus</div>
            <h3>Choose what you want to keep in view.</h3>
            <p className={tStyles.sectionHint}>Tasks and goals stay together so Tala feels familiar even when you switch focus.</p>
          </div>
        </div>
        <div className={tStyles.viewSwitch} role="tablist" aria-label="Choose what to focus on in Tala">
          {TALA_FOCUS_VIEWS.map(view => (
            <button
              key={view.id}
              type="button"
              className={`${tStyles.viewSwitchButton} ${focusView === view.id ? tStyles.viewSwitchButtonActive : ''}`}
              onClick={() => setFocusView(view.id)}
              role="tab"
              aria-selected={focusView === view.id}
            >
              <strong>{view.label}</strong>
              <span>{view.meta}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  ) : null

  return (
    <div className={`${styles.page} ${tStyles.page}`}>
      {trackSwitcher}
      {focusSwitcher}

      {showToday && (
      <div className={tStyles.grid}>
        <section className={tStyles.panel}>
          <div className={tStyles.sectionHeader}>
            <div>
              <div className={tStyles.sectionKicker}>Daily check-in</div>
              <h3>Log today&apos;s check-in.</h3>
              <p className={tStyles.sectionHint}>Save one honest snapshot of mood, energy, stress, priority, gratitude, and reflection. Tracking only, not diagnosis.</p>
            </div>
          </div>
          <div className={tStyles.formGrid}>
            <label>
              <span>Date</span>
              <input type="date" value={todayForm.date} onChange={event => setTodayForm(current => ({ ...current, date: event.target.value }))} />
            </label>
            <label>
              <span>Mood</span>
              <select value={todayForm.mood} onChange={event => setTodayForm(current => ({ ...current, mood: event.target.value }))}>
                {MOOD_OPTIONS.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Top priority</span>
              <input value={todayForm.priority} placeholder="One thing that matters today" onChange={event => setTodayForm(current => ({ ...current, priority: event.target.value }))} />
            </label>
            <label className={tStyles.full}>
              <span>Reflection</span>
              <textarea value={todayForm.reflection} placeholder="What should future you remember about today?" onChange={event => setTodayForm(current => ({ ...current, reflection: event.target.value }))} />
            </label>
          </div>
          <details className={tStyles.advancedBox}>
            <summary className={tStyles.advancedSummary}>
              <span>More check-in details</span>
              <small>Energy, stress, sleep, gratitude</small>
            </summary>
            <div className={tStyles.advancedGrid}>
              <label>
                <span>Energy</span>
                <select value={todayForm.energy} onChange={event => setTodayForm(current => ({ ...current, energy: event.target.value }))}>
                  {ENERGY_OPTIONS.map(option => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span>Stress</span>
                <select value={todayForm.stress} onChange={event => setTodayForm(current => ({ ...current, stress: event.target.value }))}>
                  {STRESS_OPTIONS.map(option => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span>Sleep quality</span>
                <select value={todayForm.sleepQuality} onChange={event => setTodayForm(current => ({ ...current, sleepQuality: event.target.value }))}>
                  {ENERGY_OPTIONS.map(option => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span>Gratitude</span>
                <input value={todayForm.gratitude} placeholder="Something small but real" onChange={event => setTodayForm(current => ({ ...current, gratitude: event.target.value }))} />
              </label>
            </div>
          </details>
          <button type="button" className={tStyles.primaryBtn} onClick={handleSaveToday}>Save check-in</button>
        </section>

        <section className={tStyles.panel}>
          <div className={tStyles.sectionHeader}>
            <div>
              <div className={tStyles.sectionKicker}>Today focus</div>
              <h3>See what matters today.</h3>
              <p className={tStyles.sectionHint}>Keep today simple: current check-in, due tasks, and one gentle next step.</p>
            </div>
          </div>
          <div className={tStyles.calmPlanCard}>
            <div className={tStyles.calmPlanTop}>
              <span>{calmPlan.kicker}</span>
              <strong>{calmPlan.title}</strong>
              <p>{calmPlan.body}</p>
            </div>
            <div className={tStyles.calmPlanSteps}>
              {calmPlan.steps.map((step, index) => <span key={step}>{index + 1}. {step}</span>)}
            </div>
            <div className={tStyles.calmBoundaryGrid}>
              {TALA_CALM_BOUNDARIES.map(boundary => <span key={boundary}>{boundary}</span>)}
            </div>
          </div>
          <div className={tStyles.focusCard}>
            <span>Prompt</span>
            <strong>{talaSettings.promptStyle === 'Direct' ? 'What are you avoiding that deserves a small first step?' : 'What would make today feel a little lighter?'}</strong>
          </div>
          <div className={tStyles.routineList}>
            {!insights.dueToday.length ? <div className={tStyles.empty}>No tasks due today.</div> : insights.dueToday.slice(0, 4).map(task => (
              <div key={task._id} className={tStyles.rowCard}>
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.priority} · Due today</span>
                </div>
                <button type="button" onClick={() => fsUpdate(user.uid, 'talaTasks', task._id, { done: true, completedAt: Date.now() })}>Done</button>
              </div>
            ))}
          </div>
        </section>
      </div>
      )}

      {showJournal && (
      <div className={tStyles.grid}>
        <section ref={journalQuickActionRef} className={`${tStyles.panel} ${tStyles.quickEntryPanel}`}>
          <div className={tStyles.sectionHeader}>
            <div>
              <div className={tStyles.sectionKicker}>Journal</div>
              <h3>One honest line is enough.</h3>
              <p className={tStyles.sectionHint}>Start with the entry first. Prompts, mood, tags, and privacy stay one step deeper so Tala does not make you perform.</p>
            </div>
          </div>
          <div className={tStyles.formGrid}>
            <label>
              <span>Date</span>
              <input type="date" value={journalForm.date} onChange={event => setJournalForm(current => ({ ...current, date: event.target.value }))} />
            </label>
            <label className={tStyles.full}>
              <span>Title</span>
              <input ref={journalTitleInputRef} value={journalForm.title} placeholder="What is this entry about?" onChange={event => setJournalForm(current => ({ ...current, title: event.target.value }))} />
            </label>
            <label className={tStyles.full}>
              <span>Entry</span>
              <textarea value={journalForm.body} placeholder="Write without performing. Tala can hold it." onChange={event => setJournalForm(current => ({ ...current, body: event.target.value }))} />
            </label>
          </div>
          <details className={tStyles.advancedBox}>
            <summary className={tStyles.advancedSummary}>
              <span>Need a prompt?</span>
              <small>Optional shortcuts if the blank page feels heavy</small>
            </summary>
            <div className={tStyles.journalPromptRow} aria-label="Journal prompt shortcuts">
              {JOURNAL_PROMPTS.map(prompt => (
                <button key={prompt.title} type="button" className={tStyles.journalPromptChip} onClick={() => applyJournalPrompt(prompt)}>
                  <strong>{prompt.title}</strong>
                  <span>{prompt.tags}</span>
                </button>
              ))}
            </div>
          </details>
          <details className={tStyles.advancedBox}>
            <summary className={tStyles.advancedSummary}>
              <span>More journal details</span>
              <small>Mood, tags, privacy</small>
            </summary>
            <div className={tStyles.advancedGrid}>
              <label>
                <span>Mood</span>
                <select value={journalForm.mood} onChange={event => setJournalForm(current => ({ ...current, mood: event.target.value }))}>
                  {MOOD_OPTIONS.map(option => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span>Privacy</span>
                <select value={journalForm.private ? 'private' : 'open'} onChange={event => setJournalForm(current => ({ ...current, private: event.target.value === 'private' }))}>
                  <option value="private">Private</option>
                  <option value="open">Open</option>
                </select>
              </label>
              <label className={tStyles.full}>
                <span>Tags</span>
                <input value={journalForm.tags} placeholder="family, work, gratitude" onChange={event => setJournalForm(current => ({ ...current, tags: event.target.value }))} />
              </label>
            </div>
          </details>
          <button type="button" className={tStyles.primaryBtn} onClick={handleAddJournal}>Save journal</button>
        </section>

        <section className={tStyles.panel}>
          <div className={tStyles.sectionHeader}>
            <div>
              <div className={tStyles.sectionKicker}>Recent</div>
              <h3>Journal entries</h3>
              <p className={tStyles.sectionHint}>Private entries are masked when privacy mode is on.</p>
            </div>
          </div>
          {!journal.length ? <div className={tStyles.empty}>No journal entries yet.</div> : journal.slice(0, 8).map(entry => (
            <div key={entry._id} className={tStyles.entryCard}>
              <div>
                <span>{formatDisplayDate(entry.date)} · {entry.mood} · {entry.private ? 'Private' : 'Open'}</span>
                <strong>{entry.title}</strong>
                <p>{privacyMode && entry.private ? 'Private entry hidden.' : entry.body || 'No body text.'}</p>
                {!!normalizeRows(entry.tags).length && <small>{normalizeRows(entry.tags).join(' · ')}</small>}
              </div>
              <button type="button" onClick={async () => { if (await confirmDeleteApp(entry.title)) await fsDel(user.uid, 'talaJournal', entry._id) }}>Delete</button>
            </div>
          ))}
        </section>
      </div>
      )}

      {showMood && (
      <div className={tStyles.grid}>
        <section ref={moodQuickActionRef} className={`${tStyles.panel} ${tStyles.quickEntryPanel}`}>
          <div className={tStyles.sectionHeader}>
            <div>
              <div className={tStyles.sectionKicker}>Mood</div>
              <h3>Log mood</h3>
              <p className={tStyles.sectionHint}>Add tags for triggers: commute, family, money, work, sleep, health.</p>
            </div>
          </div>
          <div className={tStyles.formGrid}>
            <label>
              <span>Date</span>
              <input type="date" value={moodForm.date} onChange={event => setMoodForm(current => ({ ...current, date: event.target.value }))} />
            </label>
            <label>
              <span>Mood</span>
              <select ref={moodSelectRef} value={moodForm.mood} onChange={event => setMoodForm(current => ({ ...current, mood: event.target.value }))}>
                {MOOD_OPTIONS.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Energy</span>
              <select value={moodForm.energy} onChange={event => setMoodForm(current => ({ ...current, energy: event.target.value }))}>
                {ENERGY_OPTIONS.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Stress</span>
              <select value={moodForm.stress} onChange={event => setMoodForm(current => ({ ...current, stress: event.target.value }))}>
                {STRESS_OPTIONS.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Sleep quality</span>
              <select value={moodForm.sleepQuality} onChange={event => setMoodForm(current => ({ ...current, sleepQuality: event.target.value }))}>
                {ENERGY_OPTIONS.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Triggers</span>
              <input value={moodForm.triggers} placeholder="work, sleep, money" onChange={event => setMoodForm(current => ({ ...current, triggers: event.target.value }))} />
            </label>
            <label className={tStyles.full}>
              <span>Notes</span>
              <input value={moodForm.notes} placeholder="What affected your mood?" onChange={event => setMoodForm(current => ({ ...current, notes: event.target.value }))} />
            </label>
          </div>
          <button type="button" className={tStyles.primaryBtn} onClick={handleAddMood}>Save mood</button>
        </section>

        <section className={tStyles.panel}>
          <div className={tStyles.sectionHeader}>
            <div>
              <div className={tStyles.sectionKicker}>Trend</div>
              <h3>Mood patterns</h3>
              <p className={tStyles.sectionHint}>Mood and energy use a 1 to 5 scale for the last 7 days.</p>
            </div>
          </div>
          <div className={tStyles.chartGrid}>
            <MiniTrend title="Mood" rows={insights.moodTrend} hidden={privacyMode || !talaSettings.showMoodInsights} />
            <MiniTrend title="Energy" rows={insights.energyTrend} hidden={privacyMode || !talaSettings.showMoodInsights} />
          </div>
          <div className={tStyles.routineList}>
            {!moods.length ? <div className={tStyles.empty}>No mood logs yet.</div> : moods.slice(0, 5).map(row => (
              <div key={row._id} className={tStyles.rowCard}>
                <div>
                  <strong><span className={`${tStyles.moodDot} ${tStyles[moodTone(row.mood)]}`} /> {row.mood}</strong>
                  <span>{formatDisplayDate(row.date)} · Energy {row.energy || '-'} · Stress {row.stress || '-'}</span>
                  {!!normalizeRows(row.triggers).length && <small>{normalizeRows(row.triggers).join(' · ')}</small>}
                </div>
                <button type="button" onClick={async () => { if (await confirmDeleteApp('this mood log')) await fsDel(user.uid, 'talaMoods', row._id) }}>Delete</button>
              </div>
            ))}
          </div>
        </section>
      </div>
      )}

      {showTasks && (
      <div className={tStyles.grid}>
        <section className={tStyles.panel}>
          <div className={tStyles.sectionHeader}>
            <div>
              <div className={tStyles.sectionKicker}>Tasks</div>
              <h3>Add personal task</h3>
              <p className={tStyles.sectionHint}>For errands, reminders, and small commitments.</p>
            </div>
          </div>
          <div className={tStyles.formGrid}>
            <label className={tStyles.full}>
              <span>Task</span>
              <input value={taskForm.title} placeholder="Book appointment, call family, clean desk" onChange={event => setTaskForm(current => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              <span>Due date</span>
              <input type="date" value={taskForm.dueDate} onChange={event => setTaskForm(current => ({ ...current, dueDate: event.target.value }))} />
            </label>
            <label>
              <span>Priority</span>
              <select value={taskForm.priority} onChange={event => setTaskForm(current => ({ ...current, priority: event.target.value }))}>
                {PRIORITIES.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className={tStyles.full}>
              <span>Notes</span>
              <input value={taskForm.notes} placeholder="Optional details" onChange={event => setTaskForm(current => ({ ...current, notes: event.target.value }))} />
            </label>
          </div>
          <button type="button" className={tStyles.primaryBtn} onClick={handleAddTask}>Add task</button>
        </section>

        <section className={tStyles.panel}>
          <div className={tStyles.sectionHeader}>
            <div>
              <div className={tStyles.sectionKicker}>List</div>
              <h3>Tasks</h3>
              <p className={tStyles.sectionHint}>Mark done when complete. Finished tasks stay visible for momentum.</p>
            </div>
          </div>
          {!tasks.length ? <div className={tStyles.empty}>No tasks yet.</div> : tasks.slice(0, 10).map(task => (
            <div key={task._id} className={`${tStyles.rowCard} ${task.done ? tStyles.rowDone : ''}`}>
              <div>
                <strong>{task.title}</strong>
                <span>{task.dueDate ? formatDisplayDate(task.dueDate) : 'No due date'} · {task.priority} · {task.done ? 'Done' : 'Open'}</span>
                {task.notes && <small>{task.notes}</small>}
              </div>
              <div className={tStyles.rowActions}>
                <button type="button" onClick={() => fsUpdate(user.uid, 'talaTasks', task._id, { done: !task.done, completedAt: task.done ? 0 : Date.now() })}>{task.done ? 'Reopen' : 'Done'}</button>
                <button type="button" onClick={async () => { if (await confirmDeleteApp(task.title)) await fsDel(user.uid, 'talaTasks', task._id) }}>Delete</button>
              </div>
            </div>
          ))}
        </section>
      </div>
      )}

      {showGoals && (
      <div className={tStyles.grid}>
        <section className={tStyles.panel}>
          <div className={tStyles.sectionHeader}>
            <div>
              <div className={tStyles.sectionKicker}>Goals</div>
              <h3>Add life goal</h3>
              <p className={tStyles.sectionHint}>Keep it measurable enough to revisit, but gentle enough to keep honest.</p>
            </div>
          </div>
          <div className={tStyles.formGrid}>
            <label className={tStyles.full}>
              <span>Goal</span>
              <input value={goalForm.name} placeholder="Read 12 books, repair sleep, finish portfolio" onChange={event => setGoalForm(current => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Area</span>
              <select value={goalForm.area} onChange={event => setGoalForm(current => ({ ...current, area: event.target.value }))}>
                {LIFE_AREAS.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Target date</span>
              <input type="date" value={goalForm.targetDate} onChange={event => setGoalForm(current => ({ ...current, targetDate: event.target.value }))} />
            </label>
            <label>
              <span>Progress %</span>
              <input type="number" min="0" max="100" inputMode="numeric" value={goalForm.progress} onChange={event => setGoalForm(current => ({ ...current, progress: event.target.value }))} />
            </label>
            <label className={tStyles.full}>
              <span>Notes</span>
              <input value={goalForm.notes} placeholder="Why this matters, first step, milestone" onChange={event => setGoalForm(current => ({ ...current, notes: event.target.value }))} />
            </label>
          </div>
          <button type="button" className={tStyles.primaryBtn} onClick={handleAddGoal}>Save goal</button>
        </section>

        <section className={tStyles.panel}>
          <div className={tStyles.sectionHeader}>
            <div>
              <div className={tStyles.sectionKicker}>Goal board</div>
              <h3>Tracked goals</h3>
              <p className={tStyles.sectionHint}>Update progress directly from the card.</p>
            </div>
          </div>
          {!goals.length ? <div className={tStyles.empty}>No Tala goals yet.</div> : goals.map(goal => (
            <div key={goal._id} className={tStyles.goalCard}>
              <div className={tStyles.goalTop}>
                <div>
                  <strong>{goal.name}</strong>
                  <span>{goal.area} · {goal.targetDate ? formatDisplayDate(goal.targetDate) : 'No target date'} · {formatNumber(goal.progress)}%</span>
                  {goal.notes && <small>{goal.notes}</small>}
                </div>
                <button type="button" onClick={async () => { if (await confirmDeleteApp(goal.name)) await fsDel(user.uid, 'talaGoals', goal._id) }}>Delete</button>
              </div>
              <div className={tStyles.track}><div style={{ width: `${Math.min(100, numberOrZero(goal.progress))}%` }} /></div>
              <div className={tStyles.goalUpdate}>
                <input type="number" min="0" max="100" inputMode="numeric" placeholder="New %" value={goalProgress[goal._id] || ''} onChange={event => setGoalProgress(current => ({ ...current, [goal._id]: event.target.value }))} />
                <button type="button" onClick={() => handleGoalProgress(goal)}>Set</button>
              </div>
            </div>
          ))}
        </section>
      </div>
      )}

      {showCalendar && (
      <div className={tStyles.grid}>
        <section className={tStyles.panel}>
        <div className={tStyles.sectionHeader}>
          <div>
            <div className={tStyles.sectionKicker}>Calendar</div>
            <h3>Tala month view</h3>
            <p className={tStyles.sectionHint}>Dots show check-ins, journal entries, mood logs, task due dates, and goal target dates.</p>
          </div>
          <div className={tStyles.monthControls}>
            <button type="button" aria-label="Previous month" onClick={() => setCalendarMonth(current => addMonths(current, -1))}>‹</button>
            <div className={tStyles.monthLabelWrap}>
              <span className={tStyles.monthLabelEyebrow}>Month view</span>
              <strong>{formatMonthLabel(calendarMonth)}</strong>
            </div>
            <button type="button" aria-label="Next month" onClick={() => setCalendarMonth(current => addMonths(current, 1))}>›</button>
          </div>
        </div>
        <div className={tStyles.calendarGrid}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => <div key={`${label}-${index}`} className={tStyles.calendarHead}>{label}</div>)}
          {calendarData.map(day => (
            <button
              key={day.key}
              type="button"
              className={`${tStyles.calendarDay} ${day.empty ? tStyles.calendarEmpty : ''} ${day.key === today() ? tStyles.calendarToday : ''} ${day.key === selectedTalaDate ? tStyles.calendarSelected : ''}`}
              onClick={() => selectCalendarDay(day)}
              disabled={day.empty}
              aria-pressed={!day.empty && day.key === selectedTalaDate}
              aria-label={day.empty ? 'Empty calendar slot' : `${formatDisplayDate(day.key)}. ${day.checkins.length} check-ins, ${day.journal.length} journal entries, ${day.moods.length} mood logs, ${day.tasks.length} tasks, ${day.goals.length} goals.`}
            >
              {!day.empty && (
                <>
                  <strong>{day.day}</strong>
                  <div className={tStyles.calendarDots}>
                    {!!day.checkins.length && <span title="Check-in" className={tStyles.dotCheckin} />}
                    {!!day.journal.length && <span title="Journal" className={tStyles.dotJournal} />}
                    {!!day.moods.length && <span title="Mood" className={tStyles.dotMood} />}
                    {!!day.tasks.length && <span title="Task" className={tStyles.dotTask} />}
                    {!!day.goals.length && <span title="Goal" className={tStyles.dotGoal} />}
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
        <div className={tStyles.legendRow}>
          <span><i className={tStyles.dotCheckin} /> Check-in</span>
          <span><i className={tStyles.dotJournal} /> Journal</span>
          <span><i className={tStyles.dotMood} /> Mood</span>
          <span><i className={tStyles.dotTask} /> Task</span>
          <span><i className={tStyles.dotGoal} /> Goal</span>
        </div>
        <div className={tStyles.selectedDayPanel}>
          <div className={tStyles.selectedDayHeader}>
            <div>
              <div className={tStyles.sectionKicker}>Selected day</div>
              <h3>{formatDisplayDate(selectedTalaDate)}</h3>
              <p className={tStyles.sectionHint}>
                {selectedDayTotal ? `${selectedDayTotal} Tala entr${selectedDayTotal === 1 ? 'y' : 'ies'} saved for this day.` : 'No Tala entries saved for this day yet.'}
              </p>
            </div>
            <button type="button" className={tStyles.ghostBtn} onClick={() => {
              setSelectedTalaDate(today())
              setCalendarMonth(today().slice(0, 7))
            }}>
              Today
            </button>
          </div>
          <div className={tStyles.selectedDayGrid}>
            <div className={tStyles.selectedDayMetric}><span>Check-ins</span><strong>{selectedDayData.checkins.length}</strong></div>
            <div className={tStyles.selectedDayMetric}><span>Journal</span><strong>{selectedDayData.journal.length}</strong></div>
            <div className={tStyles.selectedDayMetric}><span>Mood</span><strong>{selectedDayData.moods.length}</strong></div>
            <div className={tStyles.selectedDayMetric}><span>Tasks</span><strong>{selectedDayData.tasks.length}</strong></div>
            <div className={tStyles.selectedDayMetric}><span>Goals</span><strong>{selectedDayData.goals.length}</strong></div>
          </div>
          <div className={tStyles.selectedDayList}>
            {selectedDayTotal ? (
              <>
                {selectedDayData.checkins.map(row => (
                  <div key={`checkin-${row._id}`} className={tStyles.selectedDayItem}><span>Check-in</span><strong>{privacyMode ? 'Private' : row.mood}</strong><small>{privacyMode ? 'Details hidden.' : row.priority || row.reflection || 'Saved daily check-in'}</small></div>
                ))}
                {selectedDayData.journal.map(row => (
                  <div key={`journal-${row._id}`} className={tStyles.selectedDayItem}><span>Journal</span><strong>{privacyMode && row.private ? 'Private entry' : row.title}</strong><small>{privacyMode && row.private ? 'Details hidden.' : normalizeRows(row.tags).join(' · ') || 'Journal entry'}</small></div>
                ))}
                {selectedDayData.moods.map(row => (
                  <div key={`mood-${row._id}`} className={tStyles.selectedDayItem}><span>Mood</span><strong>{privacyMode ? 'Private' : row.mood}</strong><small>{privacyMode ? 'Details hidden.' : `Energy ${row.energy || '-'} · Stress ${row.stress || '-'}`}</small></div>
                ))}
                {selectedDayData.tasks.map(row => (
                  <div key={`task-${row._id}`} className={tStyles.selectedDayItem}><span>Task</span><strong>{row.title}</strong><small>{row.done ? 'Done' : `${row.priority} priority`}</small></div>
                ))}
                {selectedDayData.goals.map(row => (
                  <div key={`goal-${row._id}`} className={tStyles.selectedDayItem}><span>Goal</span><strong>{row.name}</strong><small>{row.area} · {formatNumber(row.progress)}%</small></div>
                ))}
              </>
            ) : (
              <div className={tStyles.empty}>Use Today, Journal, Mood, Tasks, or Goals to add something for this date.</div>
            )}
          </div>
        </div>
        </section>
      </div>
      )}

      {showInsights && (
      <div className={tStyles.grid}>
        <section className={tStyles.panel}>
          <div className={tStyles.sectionHeader}>
            <div>
              <div className={tStyles.sectionKicker}>Insights</div>
              <h3>Patterns</h3>
              <p className={tStyles.sectionHint}>Not diagnosis, not advice, and not therapy. Just your logged patterns made easier to see.</p>
            </div>
          </div>
          <div className={tStyles.chartGrid}>
            <MiniTrend title="Mood" rows={insights.moodTrend} hidden={privacyMode || !talaSettings.showMoodInsights} />
            <MiniTrend title="Energy" rows={insights.energyTrend} hidden={privacyMode || !talaSettings.showMoodInsights} />
          </div>
        </section>

        <section className={tStyles.panel}>
          <div className={tStyles.sectionHeader}>
            <div>
              <div className={tStyles.sectionKicker}>Themes</div>
              <h3>Tags and triggers</h3>
              <p className={tStyles.sectionHint}>Useful for noticing what keeps repeating.</p>
            </div>
          </div>
          <div className={tStyles.tagCloud}>
            {!insights.topTags.length ? <span>No journal tags yet</span> : insights.topTags.map(tag => <span key={tag}>{tag}</span>)}
          </div>
          <div className={tStyles.tagCloud}>
            {!insights.topTriggers.length ? <span>No mood triggers yet</span> : insights.topTriggers.map(trigger => <span key={trigger}>{trigger}</span>)}
          </div>
        </section>
      </div>
      )}

      {showSettings && (
      <div className={tStyles.settingsWorkspace}>
        <div className={tStyles.settingsColumn}>
          <section className={tStyles.panel}>
            <div className={tStyles.sectionHeader}>
              <div>
                <div className={tStyles.sectionKicker}>Basics</div>
                <h3>Tala defaults</h3>
                <p className={tStyles.sectionHint}>Set the defaults that make Tala feel gentle, private, and easy to return to.</p>
              </div>
            </div>
            <div className={tStyles.formGrid}>
              <label>
                <span>Reminder time</span>
                <input type="time" value={settingsForm.reminderTime} onChange={event => updateSettings('reminderTime', event.target.value)} />
              </label>
              <label>
                <span>Weekly review</span>
                <select value={settingsForm.weeklyReviewDay} onChange={event => updateSettings('weeklyReviewDay', event.target.value)}>
                  {WEEK_DAYS.map(day => <option key={day}>{day}</option>)}
                </select>
              </label>
              <label>
                <span>Prompt style</span>
                <select value={settingsForm.promptStyle} onChange={event => updateSettings('promptStyle', event.target.value)}>
                  <option>Gentle</option>
                  <option>Direct</option>
                  <option>Reflective</option>
                </select>
              </label>
              <label>
                <span>Journal privacy by default</span>
                <select value={settingsForm.privateByDefault ? 'private' : 'open'} onChange={event => updateSettings('privateByDefault', event.target.value === 'private')}>
                  <option value="private">Private by default</option>
                  <option value="open">Open by default</option>
                </select>
              </label>
              <label className={tStyles.full}>
                <span>Show mood insights</span>
                <select value={settingsForm.showMoodInsights ? 'show' : 'hide'} onChange={event => updateSettings('showMoodInsights', event.target.value === 'show')}>
                  <option value="show">Show mood insights</option>
                  <option value="hide">Hide mood insights</option>
                </select>
              </label>
            </div>
            <div className={tStyles.settingsSaveNotice}>
              <div>
                <strong>Pending changes</strong>
                <span>Update the basics here, then save when you are ready.</span>
              </div>
              <button type="button" className={tStyles.primaryBtn} onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving...' : 'Save Tala settings'}
              </button>
            </div>
          </section>
        </div>

        <div className={tStyles.settingsColumn}>
          <section className={tStyles.panel}>
            <div className={tStyles.sectionHeader}>
              <div>
                <div className={tStyles.sectionKicker}>Account tools</div>
                <h3>Export, clear, and log out</h3>
                <p className={tStyles.sectionHint}>Use these only when needed so Tala stays light and focused the rest of the time.</p>
              </div>
            </div>
            <div className={tStyles.settingsStack}>
              <div className={tStyles.settingsActionBlock}>
                <div className={tStyles.settingsActionCopy}>
                  <strong>Keep a copy</strong>
                  <span>Download your Tala entries before making bigger changes.</span>
                </div>
                <button type="button" className={tStyles.secondaryBtn} onClick={handleExportTalaData}>Export Tala data</button>
              </div>

              <div className={tStyles.settingsActionBlock}>
                <div className={tStyles.settingsActionCopy}>
                  <strong>Clear Tala logs</strong>
                  <span>Remove Tala entries from this account while keeping your Tala defaults.</span>
                </div>
                <button type="button" className={tStyles.ghostBtn} onClick={handleDeleteTalaData} disabled={deletingTalaData}>
                  {deletingTalaData ? 'Deleting...' : 'Delete Tala logs'}
                </button>
                <div className={tStyles.empty}>Your Tala settings stay if you delete Tala logs.</div>
              </div>

              <div className={tStyles.settingsActionBlock}>
                <div className={tStyles.settingsActionCopy}>
                  <strong>Log out</strong>
                  <span>Leave this account safely without changing your Tala settings.</span>
                </div>
                <button type="button" className={tStyles.ghostBtn} onClick={handleLogout}>
                  Log out
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
      )}
    </div>
  )
}
