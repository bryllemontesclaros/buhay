import { useEffect, useMemo, useRef, useState, Fragment } from 'react'
import {
  getBalanceAtDate,
  getBalanceAtDateWithOverrides,
  getBalanceOverrides,
  getMonthForecast,
  getMonthTransactions,
  getTakdaTransactionLifecycle,
  getTakdaTotalAssets,
  getTakdaTotalDebts,
  getTakdaTotalSavings,
  hasDailyBalanceOverride,
  isTransactionPaid,
  TAKDA_BALANCE_IMPACT,
  TAKDA_TRANSACTION_STATUS,
} from '../lib/finance'
import { fsAddTransaction, fsClearDailyBalanceOverrideAudited, fsClearMonthStartBalance, fsDeleteTransaction, fsDeleteTransfer, fsSetDailyBalanceOverrideAudited, fsSetTransactionPaymentStatus, fsUpdate, fsUpdateTransaction, fsTransferAccounts } from '../lib/firestore'
import { getTransactionImpact } from '../lib/forecast'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import {
  formatRecurringDateLabel,
  getProjectedTransactions,
  getRecurringActionKey,
  getRecurringOccurrenceKey,
  isRecurringCycleSettled,
} from '../lib/recurrence'
import {
  findPresetByLabel,
  getDefaultTransactionDraft,
  getPresetByKey,
  getPresetGroups,
  getQuickItems,
  getSuggestedDescription,
  getTransactionCategories,
  getTransactionSubcategories,
  sanitizeTransactionCategory,
  sanitizeTransactionSubcategory,
} from '../lib/transactionOptions'
import { fmt, formatDisplayDate, normalizeDate, RECUR_OPTIONS, today, playTick } from '../lib/utils'
import { getBillOccurrencesForMonth, getBillPeriodInfo, isBillPaidForPeriod } from '../lib/bills'
import { getCreditCardCycleDetails, parseDayOfMonth } from '../lib/billingCycles'
import { createPortal, flushSync } from 'react-dom'
import styles from './Page.module.css'
import calStyles from './Calendar.module.css'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { triggerHaptic, playHapticTick } from '../lib/gestures'

function normalizeAmountInput(value) {
  const cleaned = value.replace(/[^\d.]/g, '')
  if (!cleaned) return ''

  const parts = cleaned.split('.')
  const integerPart = (parts[0] || '0').replace(/^0+(?=\d)/, '') || '0'
  const decimalPart = parts.slice(1).join('').slice(0, 2)

  if (parts.length > 1 || cleaned.endsWith('.')) return `${integerPart}.${decimalPart}`
  return integerPart
}

function formatRoundedBalance(value, symbol = '') {
  const numericValue = Number(value) || 0
  const rounded = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(numericValue))

  return `${numericValue < 0 ? '−' : ''}${symbol}${rounded}`
}

function formatFullCellBalance(value, symbol = '₱') {
  const numericValue = Number(value) || 0
  const absoluteValue = Math.abs(numericValue)
  const sign = numericValue < 0 ? '−' : ''
  const formatted = Math.round(absoluteValue).toLocaleString('en-US')
  return `${sign}${symbol}${formatted}`
}

function formatCompactCellBalance(value) {
  const numericValue = Number(value) || 0
  const absoluteValue = Math.abs(numericValue)
  const sign = numericValue < 0 ? '−' : ''

  if (absoluteValue >= 1_000_000) {
    return `${sign}${(absoluteValue / 1_000_000).toFixed(absoluteValue >= 10_000_000 ? 1 : 2)}M`
  }

  if (absoluteValue >= 1_000) {
    return `${sign}${(absoluteValue / 1_000).toFixed(1)}k`
  }

  return `${sign}${Math.round(absoluteValue)}`
}

function getEmptyForm(type = 'income', defaultAccountId = '') {
  return { ...getDefaultTransactionDraft(type), accountId: defaultAccountId, paymentStatus: 'paid' }
}

function getLegacyMonthStartKeyForDate(dateKey, monthStartBalances = {}) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return ''
  const nextDay = new Date(`${dateKey}T00:00:00`)
  nextDay.setDate(nextDay.getDate() + 1)
  if (nextDay.getDate() !== 1) return ''
  const candidate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}`
  return Object.prototype.hasOwnProperty.call(monthStartBalances, candidate) ? candidate : ''
}

function buildDayAriaLabel({ ds, day, displayValue, hasIncome, hasExpense, hasManualBalance, isToday, isSelected, privacyMode, s }) {
  const parts = [
    `${day}, ${new Date(`${ds}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`,
  ]
  if (privacyMode) parts.push('Balance hidden')
  else parts.push(`Closing balance ${formatRoundedBalance(displayValue || 0, s)}`)
  if (hasIncome) parts.push('has income')
  if (hasExpense) parts.push('has expenses')
  if (hasManualBalance) parts.push('has manual balance override')
  if (isToday) parts.push('today')
  if (isSelected) parts.push('selected')
  return parts.join(', ')
}

function hasLoggedRecurringCycle(entries = [], tx = {}) {
  return isRecurringCycleSettled(entries, tx)
}

export default function Calendar({ user, data, profile = {}, symbol, privacyMode = false, onTogglePrivacy = () => {}, onSelectedDateChange, onPayBill }) {
  const s = symbol || '₱'
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentDay = now.getDate()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState(null)
  const defaultAccountId = data?.accounts?.[0]?._id || ''
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('income')
  const [editTx, setEditTx] = useState(null)
  const [form, setForm] = useState(() => getEmptyForm('income', defaultAccountId))
  const [showPresetBrowser, setShowPresetBrowser] = useState(false)
  const [descTouched, setDescTouched] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [editGoalId, setEditGoalId] = useState(null)
  const [goalInput, setGoalInput] = useState('')
  const [entryFeedback, setEntryFeedback] = useState(null)
  const [pendingComposerAction, setPendingComposerAction] = useState(null)
  const [pendingRecurringActions, setPendingRecurringActions] = useState({})
  const [recurringDateTarget, setRecurringDateTarget] = useState(null)
  const [recurringDateDraft, setRecurringDateDraft] = useState(today())
  const [recurringDateSaving, setRecurringDateSaving] = useState(false)
  const [editingDayBalance, setEditingDayBalance] = useState(false)
  const [dayBalanceDraft, setDayBalanceDraft] = useState('')
  const [dayBalanceSaving, setDayBalanceSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 1024 : false)
  const [calendarViewMode, setCalendarViewMode] = useState('cash')

  const totalSavings = useMemo(() => getTakdaTotalSavings(data?.savings), [data?.savings])
  const totalDebts = useMemo(() => getTakdaTotalDebts(data?.accounts, data?.debts), [data?.accounts, data?.debts])
  const totalCryptoAssets = useMemo(() => {
    const holdings = Array.isArray(data?.portfolioHoldings) ? data.portfolioHoldings : []
    return getTakdaTotalAssets([], holdings)
  }, [data?.portfolioHoldings])

  const navLock = useRef(false)
  const feedbackTimerRef = useRef(null)
  const selectedDayRef = useRef(null)
  const transactionModalRef = useRef(null)
  const recurringDateModalRef = useRef(null)
  const amountInputRef = useRef(null)
  const focusProxyRef = useRef(null)
  const dayBalanceInputRef = useRef(null)

  useEffect(() => {
    if (showModal) {
      const timer = setTimeout(() => {
        amountInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [showModal])

  const overlayOpen = Boolean(selected || showModal || recurringDateTarget)

  const todayStr = today()
  const accountLookup = useMemo(
    () => Object.fromEntries((data.accounts || []).map(account => [account._id, account])),
    [data.accounts],
  )
  const label = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()
  const totalCalendarCells = 42
  const trailingDayCount = Math.max(0, totalCalendarCells - (firstDay + daysInMonth))
  const dailyBalanceOverrides = profile?.dailyBalanceOverrides && typeof profile.dailyBalanceOverrides === 'object' && !Array.isArray(profile.dailyBalanceOverrides)
    ? profile.dailyBalanceOverrides
    : {}
  const monthStartBalances = profile?.monthStartBalances && typeof profile.monthStartBalances === 'object' && !Array.isArray(profile.monthStartBalances)
    ? profile.monthStartBalances
    : {}
  const balanceOverrides = useMemo(
    () => getBalanceOverrides(dailyBalanceOverrides, monthStartBalances),
    [dailyBalanceOverrides, monthStartBalances],
  )
  const balanceOverrideLog = Array.isArray(data.balanceOverrideLog) ? data.balanceOverrideLog : []
  const latestOverrideEvent = useMemo(() => {
    if (!selected) return null
    return balanceOverrideLog
      .filter(event => event?.dateKey === selected && event?.scope === 'takda-closing-balance')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null
  }, [balanceOverrideLog, selected])

  const accountList = useMemo(() => (Array.isArray(data?.accounts) ? data.accounts : []), [data?.accounts])
  const incomeList = useMemo(() => (Array.isArray(data?.income) ? data.income : []), [data?.income])
  const expenseList = useMemo(() => (Array.isArray(data?.expenses) ? data.expenses : []), [data?.expenses])
  const transferList = useMemo(() => (Array.isArray(data?.transfers) ? data.transfers : []), [data?.transfers])
  const goalsList = useMemo(() => (Array.isArray(data?.goals) ? data.goals : []), [data?.goals])

  const projected = useMemo(() => getProjectedTransactions(incomeList, expenseList, year, month), [incomeList, expenseList, year, month])
  const projectedIncome = useMemo(() => projected.filter(t => t.type === 'income'), [projected])
  const projectedExpenses = useMemo(() => projected.filter(t => t.type === 'expense'), [projected])

  const actualIncome = useMemo(() => getMonthTransactions(incomeList, year, month), [incomeList, year, month])
  const actualExpenses = useMemo(() => getMonthTransactions(expenseList, year, month), [expenseList, year, month])

  const allIncome = useMemo(() => [...actualIncome, ...projectedIncome], [actualIncome, projectedIncome])
  const allExpenses = useMemo(() => [...actualExpenses, ...projectedExpenses], [actualExpenses, projectedExpenses])
  const allTransfers = useMemo(() => getMonthTransactions(transferList, year, month), [transferList, year, month])

  const monthSummaryTotals = useMemo(() => {
    const totalInc = (allIncome || []).reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
    const totalExp = (allExpenses || []).reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
    return { totalInc, totalExp, net: totalInc - totalExp }
  }, [allIncome, allExpenses])

  const forecastMap = useMemo(
    () => getMonthForecast(accountList, transferList, incomeList, expenseList, projectedIncome, projectedExpenses, year, month, balanceOverrides),
    [accountList, transferList, incomeList, expenseList, projectedIncome, projectedExpenses, year, month, balanceOverrides],
  )

  const unpaidBillsByDateKey = useMemo(() => {
    const map = {}
    if (!data?.bills || !Array.isArray(data.bills)) return map
    data.bills.forEach(bill => {
      const dates = getBillOccurrencesForMonth(bill, year, month)
      dates.forEach(date => {
        const paid = isBillPaidForPeriod(bill, date)
        if (!paid) {
          if (!map[date]) {
            map[date] = []
          }
          map[date].push(bill)
        }
      })
    })
    return map
  }, [data?.bills, year, month])

  const dueDebtsByDateKey = useMemo(() => {
    const map = {}
    if (!data?.debts || !Array.isArray(data.debts)) return map
    
    const currentMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const explicitBillAccountIds = new Set((data?.bills || []).map(b => b.accountId).filter(Boolean))
    const todayStr = today()

    data.debts.forEach(debt => {
      if (debt.paidPeriods && debt.paidPeriods[currentMonthKey]) return
      if (debt.accountId && explicitBillAccountIds.has(debt.accountId)) return

      const dayStr = String(debt.dueDate || '').trim()
      if (!dayStr) return
      const day = parseInt(dayStr, 10)
      if (isNaN(day) || day < 1 || day > 31) return
      
      let currentBalance = Number(debt.balance) || 0
      if (debt.accountId && Array.isArray(data.accounts)) {
        const linkedAccount = data.accounts.find(a => a._id === debt.accountId)
        if (linkedAccount) {
          currentBalance = Math.abs(Number(linkedAccount.balance) || 0)
        }
      }

      const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
      const effectiveDay = Math.min(day, lastDayOfMonth)
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(effectiveDay).padStart(2, '0')}`
      
      if (debt.startDate) {
        const startKey = normalizeDate(debt.startDate)
        if (startKey && dateKey < startKey) return
      }

      // Check if debt has statement cut-off date (Credit Card Cycle)
      const statementDay = parseDayOfMonth(debt.statementDate)
      const dueDay = parseDayOfMonth(debt.dueDate)
      let balanceForDue = currentBalance

      if (statementDay && dueDay) {
        const cycle = getCreditCardCycleDetails(
          { ...debt, balance: currentBalance },
          data?.expenses || [],
          data?.transfers || [],
          dateKey
        )
        // If this due date has passed and that cycle was already paid:
        if (dateKey < todayStr && cycle.isPaid) {
          return // Settled / Paid! Do not resurrect with post-cutoff swipes
        }
        balanceForDue = dateKey <= todayStr ? cycle.billedAmount : (cycle.billedAmount || cycle.unbilledAmount || currentBalance)
        if (balanceForDue <= 0 && dateKey <= todayStr) {
          return // Paid!
        }
      }

      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push({ ...debt, balance: balanceForDue })
    })
    return map
  }, [data?.debts, data?.accounts, data?.bills, data?.expenses, data?.transfers, year, month])

  const statementDebtsByDateKey = useMemo(() => {
    const map = {}
    if (!data?.debts || !Array.isArray(data.debts)) return map

    const currentMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`

    data.debts.forEach(debt => {
      if (debt.paidPeriods && debt.paidPeriods[currentMonthKey]) return

      const dayStr = String(debt.statementDate || '').trim()
      if (!dayStr) return
      const day = parseInt(dayStr, 10)
      if (isNaN(day) || day < 1 || day > 31) return
      
      let currentBalance = Number(debt.balance) || 0
      if (debt.accountId && Array.isArray(data.accounts)) {
        const linkedAccount = data.accounts.find(a => a._id === debt.accountId)
        if (linkedAccount) {
          currentBalance = Math.abs(Number(linkedAccount.balance) || 0)
        }
      }

      const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
      const effectiveDay = Math.min(day, lastDayOfMonth)
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(effectiveDay).padStart(2, '0')}`
      
      const statementDay = parseDayOfMonth(debt.statementDate)
      const dueDay = parseDayOfMonth(debt.dueDate)
      let stmtBalance = currentBalance

      if (statementDay && dueDay) {
        const cycle = getCreditCardCycleDetails(
          { ...debt, balance: currentBalance },
          data?.expenses || [],
          data?.transfers || [],
          dateKey
        )
        stmtBalance = cycle.billedAmount || cycle.totalBalance || currentBalance
      }

      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push({ ...debt, balance: stmtBalance })
    })
    return map
  }, [data?.debts, data?.accounts, data?.expenses, data?.transfers, year, month])

  const dailyVolumes = useMemo(() => {
    const map = {}
    let maxInc = 0
    let maxExp = 0
    
    allIncome.forEach(tx => {
      const ds = normalizeDate(tx.date)
      if (!ds) return
      if (!map[ds]) map[ds] = { income: 0, expense: 0 }
      map[ds].income += Number(tx.amount) || 0
    })
    
    allExpenses.forEach(tx => {
      const ds = normalizeDate(tx.date)
      if (!ds) return
      if (!map[ds]) map[ds] = { income: 0, expense: 0 }
      map[ds].expense += Number(tx.amount) || 0
    })
    
    Object.values(map).forEach(v => {
      if (v.income > maxInc) maxInc = v.income
      if (v.expense > maxExp) maxExp = v.expense
    })
    
    return { map, maxInc: maxInc || 1, maxExp: maxExp || 1 }
  }, [allIncome, allExpenses])

  const isIncome = modalType === 'income'
  const cats = getTransactionCategories(modalType)
  const quickPresets = getQuickItems(modalType)
  const presetGroups = getPresetGroups(modalType)
  const subcats = getTransactionSubcategories(modalType, form.cat)
  const selectedPreset = getPresetByKey(modalType, form.presetKey)
  const visibleQuickPresets = useMemo(() => {
    const limited = quickPresets.slice(0, 6)
    if (!selectedPreset || selectedPreset.isCustom || limited.some(item => item.key === selectedPreset.key)) return limited
    return [...limited.slice(0, 5), selectedPreset]
  }, [quickPresets, selectedPreset])
  const money = value => (privacyMode ? 'Hidden' : fmt(value, s))
  const balanceMoney = value => (privacyMode ? 'Hidden' : formatRoundedBalance(value, s))
  const formatBalanceDate = value => {
    if (!value) return ''
    const parsed = new Date(`${value}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const formatDayPanelEyebrow = value => {
    if (!value) return ''
    const parsed = new Date(`${value}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toLocaleDateString('en-PH', { weekday: 'long' })
  }
  const formatCellBalance = value => {
    if (privacyMode) return ''
    return formatFullCellBalance(value, s)
  }

  function bumpMonth(direction) {
    if (navLock.current) return
    navLock.current = true
    setSelected(null)
    setEditingDayBalance(false)
    setDayBalanceDraft('')
    if (direction < 0) {
      if (month === 0) {
        setMonth(11)
        setYear(current => current - 1)
      } else {
        setMonth(current => current - 1)
      }
    } else if (month === 11) {
      setMonth(0)
      setYear(current => current + 1)
    } else {
      setMonth(current => current + 1)
    }

    window.setTimeout(() => {
      navLock.current = false
    }, 240)
  }

  function prev() {
    playTick()
    bumpMonth(-1)
  }

  function next() {
    playTick()
    bumpMonth(1)
  }

  function handleJumpToDate(event) {
    playTick()
    const nextDateKey = normalizeDate(event.target.value)
    if (!nextDateKey) return
    const nextDate = new Date(`${nextDateKey}T00:00:00`)
    if (Number.isNaN(nextDate.getTime())) return
    setYear(nextDate.getFullYear())
    setMonth(nextDate.getMonth())
    setSelected(nextDateKey)
    setEditingDayBalance(false)
    setDayBalanceDraft('')
  }

  function set(key, value) {
    if (key === 'desc') setDescTouched(true)
    setFormError('')
    setForm(current => ({ ...current, [key]: value }))
  }

  function dateStr(day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const lowestBalanceDip = useMemo(() => {
    let minVal = Infinity
    let minDate = ''
    let peakVal = -Infinity
    let peakDate = ''

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = dateStr(d)
      const forecast = forecastMap[ds]
      const baseValue = forecast ? forecast.runningBalance : 0
      const cellTotalDebts = getTakdaTotalDebts(accountList, data?.debts, ds, incomeList, expenseList)
      const displayValue = calendarViewMode === 'netWorth'
        ? (baseValue + (Number(totalSavings) || 0) + totalCryptoAssets - cellTotalDebts)
        : baseValue

      if (displayValue < minVal) {
        minVal = displayValue
        minDate = ds
      }
      if (displayValue > peakVal) {
        peakVal = displayValue
        peakDate = ds
      }
    }
    return {
      minVal: minVal === Infinity ? 0 : minVal,
      minDate,
      peakVal: peakVal === -Infinity ? 0 : peakVal,
      peakDate,
    }
  }, [daysInMonth, year, month, forecastMap, accountList, data?.debts, incomeList, expenseList, calendarViewMode, totalSavings, totalCryptoAssets])

  const upcomingMonthDeadlines = useMemo(() => {
    const list = []
    
    // Unpaid bills for this month
    Object.entries(unpaidBillsByDateKey).forEach(([dateKey, bills]) => {
      bills.forEach(bill => {
        list.push({
          id: `bill-${bill._id}-${dateKey}`,
          type: 'bill',
          name: bill.name,
          cat: bill.cat || 'Bills',
          amount: bill.amount,
          date: dateKey,
          billId: bill._id,
        })
      })
    })

    // Due debts for this month
    Object.entries(dueDebtsByDateKey).forEach(([dateKey, debts]) => {
      debts.forEach(debt => {
        list.push({
          id: `debt-${debt._id}-${dateKey}`,
          type: 'debt',
          name: debt.name,
          cat: debt.type || 'Debt',
          amount: debt.balance,
          date: dateKey,
          debtId: debt._id,
        })
      })
    })

    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [unpaidBillsByDateKey, dueDebtsByDateKey])

  function jumpToToday() {
    playTick()
    setYear(currentYear)
    setMonth(currentMonth)
    setSelected(todayStr)
  }

  function closeSelectedDay() {
    playTick()
    if (dayBalanceSaving || recurringDateSaving) return
    if (recurringDateTarget) {
      closeRecurringDateEditor()
      return
    }
    if (showModal) closeTransactionEditor()
    if (editingDayBalance) closeDayBalanceEditor()
    setSelected(null)
  }

  function getDayData(day) {
    const ds = dateStr(day)
    return {
      income: allIncome.filter(tx => normalizeDate(tx.date) === ds),
      expenses: allExpenses.filter(tx => normalizeDate(tx.date) === ds),
      transfers: allTransfers.filter(tx => normalizeDate(tx.date) === ds),
    }
  }

  function openComposer(type = 'income') {
    playTick()
    focusProxyRef.current?.focus({ preventScroll: true })
    const nextDraft = getEmptyForm(type, defaultAccountId)
    closeDayBalanceEditor()
    flushSync(() => {
      setEditTx(null)
      setModalType(type)
      setForm(nextDraft)
      setShowPresetBrowser(false)
      setDescTouched(false)
      setFormError('')
      setShowModal(true)
    })
    amountInputRef.current?.focus()
  }

  function openComposerForDate(type = 'income', targetDate = selected || todayStr) {
    if (!targetDate) return
    if (selected === targetDate) {
      openComposer(type)
      return
    }
    setPendingComposerAction({ type, date: targetDate, token: Date.now() })
    setSelected(targetDate)
  }

  const calTouchStartRef = useRef({ x: 0, y: 0 })
  const lastDayTapRef = useRef({ ds: '', time: 0 })

  function handleGridTouchStart(e) {
    if (!e.touches?.[0]) return
    const t = e.touches[0]
    calTouchStartRef.current = { x: t.clientX, y: t.clientY }
  }

  function handleGridTouchEnd(e) {
    if (!e.changedTouches?.[0]) return
    const t = e.changedTouches[0]
    const dx = t.clientX - calTouchStartRef.current.x
    const dy = t.clientY - calTouchStartRef.current.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) {
        triggerHaptic('light')
        playHapticTick(900, 0.03)
        next()
      } else {
        triggerHaptic('light')
        playHapticTick(750, 0.03)
        prev()
      }
    }
  }

  function handleDayCellClick(ds) {
    playTick()
    const now = Date.now()
    if (lastDayTapRef.current.ds === ds && now - lastDayTapRef.current.time < 300) {
      lastDayTapRef.current = { ds: '', time: 0 }
      triggerHaptic('medium')
      playHapticTick(1100, 0.04)
      openComposerForDate('expense', ds)
    } else {
      lastDayTapRef.current = { ds, time: now }
      setSelected(ds)
    }
  }

  function clearComposerPreset(nextType = modalType, nextCat = 'Other', nextSubcat = 'Miscellaneous') {
    const resolvedCat = sanitizeTransactionCategory(nextType, nextCat)
    const resolvedSubcat = sanitizeTransactionSubcategory(nextType, resolvedCat, nextSubcat)
    setShowPresetBrowser(false)
    setForm(current => ({
      ...current,
      cat: resolvedCat,
      subcat: resolvedSubcat,
      presetKey: '',
      desc: descTouched ? current.desc : getSuggestedDescription(nextType, resolvedCat, resolvedSubcat),
    }))
    setFormError('')
  }

  function applyComposerPreset(nextPresetKey) {
    playTick()
    const preset = getPresetByKey(modalType, nextPresetKey)
    if (!preset || preset.isCustom) {
      clearComposerPreset(modalType, 'Other', 'Miscellaneous')
      return
    }
    setShowPresetBrowser(false)
    setForm(current => ({
      ...current,
      cat: preset.cat,
      subcat: preset.subcat,
      presetKey: preset.key,
      desc: preset.desc || preset.label,
    }))
    setDescTouched(false)
    setFormError('')
  }

  function applyComposerCategory(nextCat) {
    playTick()
    const resolvedCat = sanitizeTransactionCategory(modalType, nextCat)
    const resolvedSubcat = getTransactionSubcategories(modalType, resolvedCat)[0]
    setForm(current => ({
      ...current,
      cat: resolvedCat,
      subcat: resolvedSubcat,
      presetKey: '',
      desc: descTouched ? current.desc : getSuggestedDescription(modalType, resolvedCat, resolvedSubcat),
    }))
    setFormError('')
  }

  function applyComposerSubcategory(nextSubcat) {
    playTick()
    const resolvedSubcat = sanitizeTransactionSubcategory(modalType, form.cat, nextSubcat)
    setForm(current => ({
      ...current,
      subcat: resolvedSubcat,
      presetKey: '',
      desc: descTouched ? current.desc : getSuggestedDescription(modalType, current.cat, resolvedSubcat),
    }))
    setFormError('')
  }

  function switchComposerType(nextType) {
    playTick()
    if (nextType === modalType) return
    const nextDraft = getEmptyForm(nextType, form.accountId || defaultAccountId)
    setModalType(nextType)
    setShowPresetBrowser(false)
    setForm({
      ...nextDraft,
      accountId: form.accountId || defaultAccountId,
    })
    setDescTouched(false)
    setFormError('')
  }

  function openEdit(tx) {
    playTick()
    const nextType = tx.type || 'income'
    const nextCat = sanitizeTransactionCategory(nextType, tx.cat)
    const nextMatchedPreset =
      getPresetByKey(nextType, tx.presetKey || '')
      || findPresetByLabel(nextType, tx.desc || '')
    const nextSubcat = sanitizeTransactionSubcategory(nextType, nextCat, tx.subcat || nextMatchedPreset?.subcat)
    const nextDesc = tx.desc || ''
    focusProxyRef.current?.focus({ preventScroll: true })
    closeDayBalanceEditor()
    flushSync(() => {
      setEditTx(tx)
      setModalType(nextType)
      setShowPresetBrowser(false)
      setForm({
        desc: nextDesc,
        amount: String(tx.amount || ''),
        type: nextType,
        cat: nextCat,
        subcat: nextSubcat,
        presetKey: nextMatchedPreset && !nextMatchedPreset.isCustom && nextMatchedPreset.cat === nextCat && nextMatchedPreset.subcat === nextSubcat
          ? nextMatchedPreset.key
          : '',
        recur: tx.recur || '',
        accountId: tx.accountId || '',
        paymentStatus: tx.paymentStatus || 'paid',
      })
      setDescTouched(Boolean(nextDesc))
      setFormError('')
      setShowModal(true)
    })
    amountInputRef.current?.focus()
  }

  function closeTransactionEditor() {
    setShowModal(false)
    setEditTx(null)
    setModalType('income')
    setShowPresetBrowser(false)
    setForm(getEmptyForm('income', defaultAccountId))
    setDescTouched(false)
    setFormError('')
    setFormSaving(false)
  }

  function openRecurringDateEditor(tx) {
    if (!tx?._projected || !tx?._sourceId) return
    setRecurringDateTarget(tx)
    setRecurringDateDraft(todayStr)
    setRecurringDateSaving(false)
  }

  function closeRecurringDateEditor(force = false) {
    if (recurringDateSaving && !force) return
    setRecurringDateTarget(null)
    setRecurringDateDraft(todayStr)
    setRecurringDateSaving(false)
  }

  function showEntryFeedback(nextFeedback) {
    setEntryFeedback(nextFeedback)
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = window.setTimeout(() => {
      setEntryFeedback(null)
    }, 4200)
  }

  function buildEntryFeedback() {
    const title = editTx
      ? 'Transaction updated'
      : modalType === 'income'
        ? 'Income logged'
        : 'Expense tracked'

    let tone = modalType === 'income' ? 'var(--accent)' : 'var(--blue)'
    let body = editTx
      ? 'Your ledger has been updated and the forecast is refreshed.'
      : modalType === 'income'
        ? 'Nice. Keeping income current makes the rest of the month easier to trust.'
        : 'Logged. Honest tracking is what turns this into a real control panel.'

    if (formImpact?.msg) {
      body = formImpact.msg
      if (formImpact.level === 'negative') tone = 'var(--red)'
      else if (formImpact.level === 'tight') tone = 'var(--amber)'
      else if (formImpact.level === 'healthy') tone = 'var(--accent)'
    }

    return { title, body, tone }
  }

  function openDayBalanceEditor() {
    playTick()
    if (!selected) return
    const nextValue = Number.isFinite(Number(selectedDayBalance)) ? Number(selectedDayBalance).toFixed(2) : '0.00'
    setEditingDayBalance(true)
    setDayBalanceDraft(nextValue)
  }

  function closeDayBalanceEditor() {
    setEditingDayBalance(false)
    setDayBalanceDraft('')
  }

  async function handleSaveDayBalance() {
    playTick()
    if (!selected) return
    const rawValue = dayBalanceDraft.trim()
    if (!rawValue) {
      notifyApp({ title: 'Balance needed', message: 'Enter a valid opening balance before saving.', tone: 'warning' })
      return
    }
    const value = Number(rawValue)
    if (!Number.isFinite(value)) {
      notifyApp({ title: 'Check balance', message: 'Enter a valid opening balance before saving.', tone: 'warning' })
      return
    }

    setDayBalanceSaving(true)
    try {
      await fsSetDailyBalanceOverrideAudited(user.uid, selected, value, {
        scope: 'takda-closing-balance',
        source: 'calendar',
      })
      if (legacyMonthStartKeyForSelectedDay) {
        await fsClearMonthStartBalance(user.uid, legacyMonthStartKeyForSelectedDay)
      }
      showEntryFeedback({
        eyebrow: 'Day balance',
        title: hasManualBalanceOnSelectedDay ? 'Balance updated' : 'Balance pinned',
        body: `${selected} now opens at ${formatRoundedBalance(value, s)}. Later days inherit from this point until another manual day balance appears.`,
        tone: 'var(--blue)',
      })
      closeDayBalanceEditor()
    } catch {
      notifyApp({ title: 'Balance not saved', message: 'Could not save the day balance right now. Try again.', tone: 'error' })
    } finally {
      setDayBalanceSaving(false)
    }
  }

  async function handleClearDayBalance() {
    playTick()
    if (!selected) return
    if (!hasManualBalanceOnSelectedDay) {
      closeDayBalanceEditor()
      return
    }

    setDayBalanceSaving(true)
    try {
      if (Object.prototype.hasOwnProperty.call(dailyBalanceOverrides, selected)) {
        await fsClearDailyBalanceOverrideAudited(user.uid, selected, {
          scope: 'takda-closing-balance',
          source: 'calendar',
        })
      }
      if (legacyMonthStartKeyForSelectedDay) {
        await fsClearMonthStartBalance(user.uid, legacyMonthStartKeyForSelectedDay)
      }
      showEntryFeedback({
        eyebrow: 'Day balance',
        title: 'Balance reset',
        body: `${selected} is back on automatic calculation from your ledger and prior anchors.`,
        tone: 'var(--accent)',
      })
      closeDayBalanceEditor()
    } catch {
      notifyApp({ title: 'Balance not reset', message: 'Could not reset the day balance right now. Try again.', tone: 'error' })
    } finally {
      setDayBalanceSaving(false)
    }
  }

  async function handleSave() {
    playTick()
    const amount = parseFloat(form.amount)
    const targetDate = editTx?.date || selected
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Add a valid amount before saving.')
      return
    }
    if (!editTx && !selected) {
      setFormError('Pick a date on the calendar before saving.')
      return
    }
    
    const trimmedDesc = form.desc.trim()
    if (editTx) {
      const col = editTx.type === 'income' ? 'income' : 'expenses'
      fsUpdateTransaction(user.uid, col, editTx, {
        desc: trimmedDesc,
        amount,
        cat: form.cat,
        subcat: form.subcat,
        presetKey: form.presetKey || '',
        recur: form.recur,
        paymentStatus: form.paymentStatus,
        accountId: form.accountId || defaultAccountId,
        accountBalanceLinked: Boolean(form.accountId || defaultAccountId),
      }, data.accounts).catch(err => console.error(err))
    } else {
      const col = modalType === 'income' ? 'income' : 'expenses'
      fsAddTransaction(user.uid, col, {
        desc: trimmedDesc,
        amount,
        date: selected,
        cat: form.cat,
        subcat: form.subcat,
        presetKey: form.presetKey || '',
        recur: form.recur,
        type: modalType,
        paymentStatus: form.paymentStatus,
        accountId: form.accountId || defaultAccountId,
        accountBalanceLinked: Boolean(form.accountId || defaultAccountId),
      }, data.accounts).catch(err => console.error(err))
    }
    showEntryFeedback(buildEntryFeedback())
    closeTransactionEditor()
  }

  async function handleDelete(tx) {
    playTick()
    if (tx._projected) {
      notifyApp({
        title: 'Projection only',
        message: 'This entry is only a projection. Edit or remove the original recurring transaction instead.',
        tone: 'warning',
      })
      return
    }
    if (!(await confirmApp({
      title: 'Delete this transaction?',
      message: `Delete ${tx.desc || 'this entry'} from ${tx.date || 'this day'}? Linked account balances will be updated if this entry already affected them.`,
      confirmLabel: 'Delete transaction',
      cancelLabel: 'Keep it',
      tone: 'danger',
    }))) return
    fsDeleteTransaction(user.uid, tx.type === 'income' ? 'income' : 'expenses', tx, data.accounts).catch(e => console.error(e))
  }

  async function handleDeleteTransfer(transfer) {
    if (!user?.uid) return
    playTick()
    if (!(await confirmApp({
      title: 'Delete this transfer?',
      message: `Delete ${transfer.desc || 'this transfer'} from ${transfer.date || 'this day'}? Linked account balances will be reverted.`,
      confirmLabel: 'Delete transfer',
      cancelLabel: 'Keep it',
      tone: 'danger',
    }))) return
    fsDeleteTransfer(user.uid, transfer, data.accounts).catch(e => console.error(e))
  }

  async function handleTogglePaymentStatus(tx) {
    playTick()
    if (tx._projected) {
      notifyApp({
        title: 'Projection only',
        message: 'This is a projected recurring entry (a forecast). Tap "Pay now" to settle this cycle today, "Choose date" to record it on another day, or "Keep due date" to save the real entry on the scheduled day. Use "Edit recurrence" to change future projections.',
        tone: 'warning',
      })
      return
    }

    const nextStatus = isTransactionPaid(tx) ? 'unpaid' : 'paid'
    const collection = tx.type === 'income' ? 'income' : 'expenses'
    try {
      await fsSetTransactionPaymentStatus(user.uid, collection, tx, nextStatus, data.accounts)
      showEntryFeedback({
        eyebrow: 'Payment status',
        title: nextStatus === 'paid' ? 'Marked paid' : 'Marked unpaid',
        body: nextStatus === 'paid'
          ? 'This entry counts in balances and totals again.'
          : 'This entry stays visible, but it is no longer counted in balances or totals.',
        tone: nextStatus === 'paid' ? 'var(--accent)' : 'var(--amber)',
      })
    } catch {
      notifyApp({
        title: 'Status not updated',
        message: 'Could not update this transaction right now. Try again.',
        tone: 'error',
      })
    }
  }

  function handleFastPayDebt(debt, amount, dateKey) {
    if (!user?.uid || !debt?.accountId || !amount) {
      notifyApp({ title: 'Cannot pay', message: 'Missing account or amount.', tone: 'warning' })
      return
    }
    const defaultCash = (data.accounts || []).find(a => String(a.type || '').toLowerCase() === 'cash' || String(a.type || '').toLowerCase() === 'bank') || data.accounts?.[0]
    if (!defaultCash) {
      notifyApp({ title: 'No cash account', message: 'You need a cash or bank account to pay from.', tone: 'warning' })
      return
    }
    playTick()
    fsTransferAccounts(user.uid, {
      amount: Number(amount),
      fromAccountId: defaultCash._id,
      toAccountId: debt.accountId,
      date: dateKey,
      desc: `Payment: ${debt.name}`
    }, data.accounts).catch(e => console.error(e))
    
    notifyApp({
      title: 'Payment Sent',
      message: `${fmt(amount, symbol)} was transferred from ${defaultCash.name} to ${debt.name}.`,
      tone: 'success'
    })
  }


  async function handleLogProjected(tx) {
    playTick()
    if (!tx?._projected || !tx?._sourceId) return
    if (selectedDateLocked) {
      notifyApp({ title: 'Date locked', message: 'You cannot add entries on a locked date.', tone: 'warning' })
      return
    }

    const actionKey = getRecurringActionKey(tx)
    const col = tx.type === 'income' ? 'income' : 'expenses'
    const existingEntries = tx.type === 'income' ? allIncome : allExpenses
    if (hasLoggedRecurringCycle(existingEntries, tx)) {
      notifyApp({
        title: 'Cycle already recorded',
        message: 'That recurring cycle already has a real entry. Edit the real entry instead of recording it again.',
        tone: 'warning',
      })
      return
    }
    if (actionKey && pendingRecurringActions[actionKey]) return

    const accountId = tx.accountId || ''
    try {
      if (actionKey) {
        setPendingRecurringActions(current => ({ ...current, [actionKey]: true }))
      }
      await fsAddTransaction(user.uid, col, {
        desc: tx.desc || '',
        amount: Number(tx.amount) || 0,
        date: tx.date || selected,
        cat: tx.cat || 'Other',
        subcat: tx.subcat || 'Miscellaneous',
        presetKey: tx.presetKey || '',
        recur: '',
        type: tx.type,
        paymentStatus: 'paid',
        accountId,
        accountBalanceLinked: Boolean(accountId),
        recurrenceSourceId: tx._sourceId,
        recurrenceOccurrenceKey: normalizeDate(tx._occurrenceKey || tx.date),
        source: 'recurrence-log',
      }, data.accounts)

      showEntryFeedback({
        eyebrow: 'Recurring',
        title: 'Recorded on due date',
        body: `Recorded on ${formatRecurringDateLabel(tx.date || selected)} for the ${formatRecurringDateLabel(getRecurringOccurrenceKey(tx))} cycle.`,
        tone: 'var(--accent)',
      })
    } catch {
      notifyApp({
        title: 'Could not log entry',
        message: 'Try again in a moment.',
        tone: 'error',
      })
    } finally {
      if (actionKey) {
        setPendingRecurringActions(current => {
          const next = { ...current }
          delete next[actionKey]
          return next
        })
      }
    }
  }

  async function handleSettleProjectedNow(tx) {
    playTick()
    if (!tx?._projected || !tx?._sourceId) return

    const actualDate = todayStr
    const occurrenceKey = normalizeDate(tx._occurrenceKey || tx.date)
    const actionKey = getRecurringActionKey(tx)
    const col = tx.type === 'income' ? 'income' : 'expenses'
    const existingEntries = tx.type === 'income' ? allIncome : allExpenses
    if (hasLoggedRecurringCycle(existingEntries, tx)) {
      notifyApp({
        title: 'Cycle already settled',
        message: 'That recurring cycle already has a real entry. Edit the real entry instead of settling it again.',
        tone: 'warning',
      })
      return
    }
    if (actionKey && pendingRecurringActions[actionKey]) return

    const accountId = tx.accountId || data.accounts[0]?._id || ''

    try {
      if (actionKey) {
        setPendingRecurringActions(current => ({ ...current, [actionKey]: true }))
      }
      await fsAddTransaction(user.uid, col, {
        desc: tx.desc || '',
        amount: Number(tx.amount) || 0,
        date: actualDate,
        cat: tx.cat || 'Other',
        subcat: tx.subcat || 'Miscellaneous',
        presetKey: tx.presetKey || '',
        recur: '',
        type: tx.type,
        paymentStatus: 'paid',
        accountId,
        accountBalanceLinked: Boolean(accountId),
        recurrenceSourceId: tx._sourceId,
        recurrenceOccurrenceKey: occurrenceKey,
        source: 'recurrence-pay-now',
      }, data.accounts)

      showEntryFeedback({
        eyebrow: 'Recurring',
        title: tx.type === 'expense' ? 'Cycle settled' : 'Cycle recorded',
        body: `${tx.type === 'expense' ? 'Paid' : 'Recorded'} on ${formatRecurringDateLabel(actualDate)} for the ${formatRecurringDateLabel(occurrenceKey)} cycle.`,
        tone: tx.type === 'expense' ? 'var(--red)' : 'var(--accent)',
      })
    } catch {
      notifyApp({
        title: 'Could not settle cycle',
        message: 'Try again in a moment.',
        tone: 'error',
      })
    } finally {
      if (actionKey) {
        setPendingRecurringActions(current => {
          const next = { ...current }
          delete next[actionKey]
          return next
        })
      }
    }
  }

  async function handleSaveRecurringDate() {
    if (!recurringDateTarget?._projected || !recurringDateTarget?._sourceId) return

    const actualDate = normalizeDate(recurringDateDraft)
    if (!actualDate) {
      notifyApp({
        title: 'Choose a date',
        message: 'Pick the real payment date before saving this recurring cycle.',
        tone: 'warning',
      })
      return
    }

    const tx = recurringDateTarget
    const occurrenceKey = getRecurringOccurrenceKey(tx)
    const actionKey = getRecurringActionKey(tx)
    const col = tx.type === 'income' ? 'income' : 'expenses'
    const existingEntries = tx.type === 'income' ? allIncome : allExpenses
    if (hasLoggedRecurringCycle(existingEntries, tx)) {
      notifyApp({
        title: 'Cycle already settled',
        message: 'That recurring cycle already has a real entry. Edit the real entry instead of settling it again.',
        tone: 'warning',
      })
      closeRecurringDateEditor(true)
      return
    }
    if (actionKey && pendingRecurringActions[actionKey]) return

    const accountId = tx.accountId || ''

    try {
      setRecurringDateSaving(true)
      if (actionKey) {
        setPendingRecurringActions(current => ({ ...current, [actionKey]: true }))
      }
      await fsAddTransaction(user.uid, col, {
        desc: tx.desc || '',
        amount: Number(tx.amount) || 0,
        date: actualDate,
        cat: tx.cat || 'Other',
        subcat: tx.subcat || 'Miscellaneous',
        presetKey: tx.presetKey || '',
        recur: '',
        type: tx.type,
        paymentStatus: 'paid',
        accountId,
        accountBalanceLinked: Boolean(accountId),
        recurrenceSourceId: tx._sourceId,
        recurrenceOccurrenceKey: occurrenceKey,
        source: 'recurrence-custom-date',
      }, data.accounts)

      showEntryFeedback({
        eyebrow: 'Recurring',
        title: tx.type === 'expense' ? 'Cycle settled' : 'Cycle recorded',
        body: `${tx.type === 'expense' ? 'Paid' : 'Recorded'} on ${formatRecurringDateLabel(actualDate)} for the ${formatRecurringDateLabel(occurrenceKey)} cycle.`,
        tone: tx.type === 'expense' ? 'var(--red)' : 'var(--accent)',
      })
      closeRecurringDateEditor()
    } catch {
      notifyApp({
        title: 'Could not save date',
        message: 'Try again in a moment.',
        tone: 'error',
      })
    } finally {
      setRecurringDateSaving(false)
      if (actionKey) {
        setPendingRecurringActions(current => {
          const next = { ...current }
          delete next[actionKey]
          return next
        })
      }
    }
  }

  function handleEditRecurrence(tx) {
    if (!tx?._projected || !tx?._sourceId) return
    const masterList = tx.type === 'income' ? incomeList : expenseList
    const source = masterList.find(item => item && item._id === tx._sourceId)
    if (!source) {
      notifyApp({
        title: 'Original not found',
        message: 'Could not find the original recurring transaction. It may have been deleted.',
        tone: 'warning',
      })
      return
    }
    openEdit(source)
  }

  async function handleGoalUpdate(goal) {
    const value = parseFloat(goalInput)
    if (Number.isNaN(value)) return
    if (value < 0) {
      notifyApp({ title: 'Check saved amount', message: 'Savings progress cannot be below zero.', tone: 'warning' })
      return
    }
    await fsUpdate(user.uid, 'goals', goal._id, { current: Math.min(goal.target, value) })
    setEditGoalId(null)
    setGoalInput('')
  }

  const selectedIncome = selected ? allIncome.filter(tx => normalizeDate(tx.date) === selected) : []
  const selectedExpenses = selected ? allExpenses.filter(tx => normalizeDate(tx.date) === selected) : []
  const selectedTransfers = selected ? allTransfers.filter(tx => normalizeDate(tx.date) === selected) : []
  const selectedDueDebts = selected ? (dueDebtsByDateKey[selected] || []) : []
  const selectedStatementDebts = selected ? (statementDebtsByDateKey[selected] || []) : []
  const selectedDayCount = selectedIncome.length + selectedExpenses.length + selectedTransfers.length
  const selectedDayIncome = selectedIncome.filter(isTransactionPaid).reduce((sum, tx) => sum + (tx.amount || 0), 0)
  const selectedDayExpense = selectedExpenses.filter(isTransactionPaid).reduce((sum, tx) => sum + (tx.amount || 0), 0)
  const selectedDayNet = selectedDayIncome - selectedDayExpense
  const selectedDayUnpaidCount = [...selectedIncome, ...selectedExpenses].filter(tx => !tx._projected && !isTransactionPaid(tx)).length
  const selectedDayRawBalance = selected
    ? (forecastMap[selected]?.runningBalance ?? getBalanceAtDateWithOverrides(accountList, transferList, incomeList, expenseList, selected, balanceOverrides))
    : 0


  const selectedDayTotalDebts = getTakdaTotalDebts(accountList, data?.debts, selected, incomeList, expenseList)
  const selectedDayBalance = calendarViewMode === 'netWorth'
    ? (selectedDayRawBalance + (Number(totalSavings) || 0) + totalCryptoAssets - selectedDayTotalDebts)
    : selectedDayRawBalance
  const selectedDayAutoBalance = selected
    ? getBalanceAtDate(accountList, transferList, incomeList, expenseList, selected)
    : 0
  const isCurrentMonthView = year === currentYear && month === currentMonth
  const defaultBalanceDate = useMemo(() => {
    const fallbackDay = isCurrentMonthView
      ? Math.min(currentDay, daysInMonth)
      : daysInMonth
    return dateStr(fallbackDay)
  }, [currentDay, daysInMonth, isCurrentMonthView])
  const balanceFocusDate = selected || defaultBalanceDate
  const baseFocusValue = balanceFocusDate
    ? (forecastMap[balanceFocusDate]?.runningBalance ?? getBalanceAtDateWithOverrides(accountList, transferList, incomeList, expenseList, balanceFocusDate, balanceOverrides))
    : 0
  const focusTotalDebts = getTakdaTotalDebts(accountList, data?.debts, balanceFocusDate, incomeList, expenseList)
  const balanceFocusValue = calendarViewMode === 'netWorth'
    ? (baseFocusValue + (Number(totalSavings) || 0) + totalCryptoAssets - focusTotalDebts)
    : baseFocusValue
  const balanceRailMeta = selected
    ? 'Calendar close · includes forecast'
    : isCurrentMonthView
      ? 'Today close · includes forecast'
      : 'Forecast close · includes forecast'
  const balanceRailLabel = formatBalanceDate(balanceFocusDate)
  const balanceRailCompactLabel = balanceRailMeta

  const selectedDateLocked = false
  const legacyMonthStartKeyForSelectedDay = selected ? getLegacyMonthStartKeyForDate(selected, monthStartBalances) : ''
  const hasManualBalanceOnSelectedDay = Boolean(
    selected
      && (
        Object.prototype.hasOwnProperty.call(dailyBalanceOverrides, selected)
        || Boolean(legacyMonthStartKeyForSelectedDay)
      ),
  )
  const nextManualBalanceDate = useMemo(() => {
    if (!selected) return ''
    return Object.keys(balanceOverrides)
      .filter(date => date > selected)
      .sort()
      .shift() || ''
  }, [balanceOverrides, selected])
  const formImpact = useMemo(() => {
    if (!selected || !form.amount || !parseFloat(form.amount)) return null
    if (form.paymentStatus === 'unpaid') {
      return {
        level: 'ok',
        msg: 'Unpaid entries stay visible on the calendar, but they do not change closing balances until you mark them paid.',
      }
    }
    if (hasManualBalanceOnSelectedDay) {
      return {
        level: 'ok',
        msg: "This day has a manual opening balance pin. Transactions on this day affect the balance but prior history doesn't carry forward.",
      }
    }
    const impact = getTransactionImpact(forecastMap, selected, parseFloat(form.amount), modalType, {
      stopAtDate: nextManualBalanceDate,
    })
    if (!impact || !nextManualBalanceDate) return impact
    return {
      ...impact,
      msg: `${impact.msg} This only carries until ${nextManualBalanceDate}, where a manual day balance takes over.`,
    }
  }, [forecastMap, selected, form.amount, form.paymentStatus, modalType, hasManualBalanceOnSelectedDay, nextManualBalanceDate])
  const accountHint = useMemo(() => {
    const targetDate = normalizeDate(editTx?.date || selected)
    const selectedAccount = accountLookup[form.accountId]

    if (!accountList.length) {
      return 'Add an account first if you want calendar entries to update current balances automatically.'
    }
    if (!form.accountId) {
      return 'No account selected. This entry will stay in the ledger only and will not change current account balances.'
    }

    const isCreditCard = String(selectedAccount?.type || '').toLowerCase() === 'credit card'
    const ccAction = modalType === 'income' ? 'reduce outstanding debt' : 'increase outstanding debt'

    if (form.paymentStatus === 'unpaid') {
      return `${selectedAccount?.name || 'Selected account'} is linked, but this entry will not change balances until you mark it paid.`
    }
    if (editTx && !editTx.accountBalanceLinked) {
      return `${selectedAccount?.name || 'Selected account'} will become linked when you save, so balances can stay in sync from here.`
    }

    let baseMsg = ''
    if (targetDate && targetDate <= todayStr) {
      baseMsg = `${selectedAccount?.name || 'Selected account'} updates right away because this date is today or earlier.`
    } else {
      baseMsg = `${selectedAccount?.name || 'Selected account'} is linked, but current balances will wait until this date arrives.`
    }

    if (isCreditCard) {
      return `💳 ${baseMsg} Mapped to a Credit Card: this will ${ccAction} by ${s}${form.amount || '0.00'}.`
    }
    return baseMsg
  }, [accountLookup, accountList.length, editTx, form.accountId, form.paymentStatus, selected, todayStr, modalType, s, form.amount])

  const balanceImpact = useMemo(() => {
    const targetDate = normalizeDate(editTx?.date || selected)
    const isPaid = String(form.paymentStatus || 'paid').toLowerCase() !== 'unpaid'
    const hasAccount = Boolean(form.accountId)
    const affectsBalances = Boolean(isPaid && hasAccount)
    const appliesNow = Boolean(affectsBalances && targetDate && targetDate <= todayStr)
    const appliesLater = Boolean(affectsBalances && targetDate && targetDate > todayStr)

    const accountLabel = hasAccount ? (accountLookup[form.accountId]?.name || 'Selected account') : 'Ledger only'
    const affectsLabel = affectsBalances ? (appliesNow ? 'Yes (now)' : appliesLater ? 'Yes (on date)' : 'Yes') : 'No'

    const prevAccountId = editTx?.accountId || ''
    const nextAccountId = form.accountId || ''
    const prevAccountLabel = prevAccountId ? (accountLookup[prevAccountId]?.name || 'Previous account') : 'Ledger only'
    const nextAccountLabel = nextAccountId ? (accountLookup[nextAccountId]?.name || 'Selected account') : 'Ledger only'

    let meta = accountHint
    if (editTx && prevAccountId !== nextAccountId) {
      if (!nextAccountId) meta = 'When you save, this entry will no longer be linked to an account, so it will stop affecting balances.'
      else if (!isPaid) meta = `When you save, this entry will be linked to ${nextAccountLabel}, but it will not affect balances until you mark it paid.`
      else if (targetDate && targetDate > todayStr) meta = `When you save, this entry will be linked to ${nextAccountLabel}. Current balances update when the date arrives.`
      else meta = `When you save, the balance impact moves from ${prevAccountLabel} to ${nextAccountLabel}.`
    }

    return {
      affectsBalances,
      affectsLabel,
      accountLabel,
      meta,
    }
  }, [accountHint, accountLookup, editTx, form.accountId, form.paymentStatus, selected, todayStr])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => setIsMobile(window.innerWidth <= 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    setEditingDayBalance(false)
    setDayBalanceDraft('')
  }, [selected, year, month])

  useEffect(() => {
    if (!showModal || editTx || form.accountId || !defaultAccountId) return
    setForm(current => ({ ...current, accountId: defaultAccountId }))
  }, [defaultAccountId, editTx, form.accountId, showModal])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (onSelectedDateChange) onSelectedDateChange(selected || '')
  }, [selected, onSelectedDateChange])


  useEffect(() => {
    if (!showModal || !transactionModalRef.current) return undefined
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frameId = window.requestAnimationFrame(() => {
      // Always open at the top so it never looks blank until you scroll.
      transactionModalRef.current.scrollTop = 0
      transactionModalRef.current?.focus({ preventScroll: true })
    })
    return () => {
      window.cancelAnimationFrame(frameId)
      if (previousFocus?.isConnected && previousFocus !== document.body) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [showModal])

  useEffect(() => {
    if (!recurringDateTarget || !recurringDateModalRef.current) return undefined
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frameId = window.requestAnimationFrame(() => {
      recurringDateModalRef.current.scrollTop = 0
      recurringDateModalRef.current?.focus({ preventScroll: true })
    })
    return () => {
      window.cancelAnimationFrame(frameId)
      if (previousFocus?.isConnected && previousFocus !== document.body) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [recurringDateTarget])

  useEffect(() => {
    if (!pendingComposerAction || selected !== pendingComposerAction.date) return undefined
    const frameId = window.requestAnimationFrame(() => {
      openComposer(pendingComposerAction.type)
      setPendingComposerAction(null)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [pendingComposerAction, selected])

  useEffect(() => {
    if (!overlayOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [overlayOpen])

  useEffect(() => {
    if (!selected && !showModal && !recurringDateTarget) return undefined
    const handleKeyDownGlobal = event => {
      if (event.key === 'Escape') {
        if (recurringDateTarget) {
          if (recurringDateSaving) return
          closeRecurringDateEditor()
          return
        }
        if (showModal) {
          if (formSaving) return
          closeTransactionEditor()
          return
        }
        if (editingDayBalance) {
          closeDayBalanceEditor()
          return
        }
        closeSelectedDay()
        return
      }

      if (event.key === 'Tab') {
        let activeRef = null
        if (recurringDateTarget) activeRef = recurringDateModalRef
        else if (showModal) activeRef = transactionModalRef
        else if (selected) activeRef = selectedDayRef

        const container = activeRef?.current
        if (!container) return

        const focusables = container.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return

        const activeFocusables = Array.from(focusables).filter(
          el => !el.disabled && el.getAttribute('aria-hidden') !== 'true'
        )
        if (activeFocusables.length === 0) return

        const first = activeFocusables[0]
        const last = activeFocusables[activeFocusables.length - 1]

        if (event.shiftKey) {
          if (document.activeElement === first) {
            last.focus()
            event.preventDefault()
          }
        } else {
          if (document.activeElement === last) {
            first.focus()
            event.preventDefault()
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDownGlobal)
    return () => window.removeEventListener('keydown', handleKeyDownGlobal)
  }, [selected, showModal, recurringDateTarget, recurringDateSaving, editingDayBalance, dayBalanceSaving, defaultAccountId, formSaving])

  useEffect(() => {
    const handleGlobalKey = event => {
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (showModal || recurringDateTarget || editingDayBalance) return

      if (event.key === 't' || event.key === 'T') {
        event.preventDefault()
        jumpToToday()
      }
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [currentYear, currentMonth, todayStr, showModal, recurringDateTarget, editingDayBalance])


  const renderedDayPanel = (
    <section
      ref={selectedDayRef}
      tabIndex={-1}
      className={calStyles.dayPanel}
      aria-labelledby="calendar-day-panel-title"
      aria-modal="true"
      role="dialog"
      onClick={event => event.stopPropagation()}
    >
      {selected ? (
        <>
          <div className={calStyles.dayPanelHandle} aria-hidden="true" />
          <div className={calStyles.dayPanelTop}>
            <div className={calStyles.dayPanelHeader}>
              <div className={calStyles.dayPanelHeaderMain}>
                <div className={calStyles.dayPanelEyebrowRow}>
                  <span className={calStyles.dayPanelEyebrow}>{formatDayPanelEyebrow(selected)}</span>
                  {selected === todayStr && <span className={calStyles.dayPanelTodayBadge}>Today</span>}
                </div>
                <div id="calendar-day-panel-title" className={calStyles.dayPanelTitle}>{formatBalanceDate(selected)}</div>
              </div>
              <div className={calStyles.dayPanelHeaderRight}>
                <button type="button" onClick={closeSelectedDay} className={calStyles.dayPanelClose} aria-label="Close day details">
                  ✕
                </button>
              </div>
            </div>
            <div className={calStyles.dayBalanceCard}>
              {(selectedIncome.length > 0 || selectedExpenses.length > 0) && (
                privacyMode ? (
                  <div className={`${calStyles.daySummary} ${calStyles.privacySummary}`}>
                    Totals are hidden while privacy mode is on.
                  </div>
                ) : (
                  <div className={calStyles.daySummary}>
                    <span style={{ color: 'var(--accent)' }}>
                      {`+${fmt(selectedDayIncome, s)}`}
                    </span>
                    <span style={{ color: 'var(--text3)' }}>·</span>
                    <span style={{ color: 'var(--red)' }}>
                      {`−${fmt(selectedDayExpense, s)}`}
                    </span>
                    <span style={{ color: 'var(--text3)' }}>·</span>
                    <span style={{ color: selectedDayNet >= 0 ? 'var(--blue)' : 'var(--red)', fontWeight: 600 }}>
                      {`Net ${fmt(selectedDayNet, s)}`}
                    </span>
                  </div>
                )
              )}

              {!editingDayBalance ? (
                <>
                  <div className={calStyles.dayBalanceHeader}>
                    <span className={calStyles.dayBalanceLabel}>
                      {hasManualBalanceOnSelectedDay ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          Pinned day opening balance
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 'bold',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            background: 'color-mix(in srgb, var(--blue) 12%, transparent)',
                            color: 'var(--blue)',
                            padding: '1px 6px',
                            borderRadius: '999px',
                            border: '1px solid color-mix(in srgb, var(--blue) 30%, transparent)'
                          }}>
                            Pinned
                          </span>
                        </span>
                      ) : (
                        'Day opening balance'
                      )}
                    </span>
                    <Button type="button" variant="secondary" size="sm" onClick={openDayBalanceEditor} aria-label={`Edit opening balance for ${selected}`} disabled={selectedDateLocked}>
                      Edit
                    </Button>
                  </div>
                  <div className={`${calStyles.dayBalanceValue} ${privacyMode ? calStyles.privacyValuePill : ''}`}>{balanceMoney(selectedDayBalance)}</div>
                  
                  <div className={calStyles.dayBalanceMeta}>
                    {hasManualBalanceOnSelectedDay
                      ? 'Manual balance override active.'
                      : selectedDayUnpaidCount > 0
                        ? `Day balance excludes ${selectedDayUnpaidCount} unpaid entr${selectedDayUnpaidCount === 1 ? 'y' : 'ies'}.`
                        : 'Day balance includes paid entries only.'}
                    {latestOverrideEvent?.createdAt && (
                      <div style={{ marginTop: 6, color: 'var(--text3)', fontSize: 11, lineHeight: 1.45 }}>
                        Last manual balance change: {new Date(latestOverrideEvent.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.
                      </div>
                    )}
                    {hasManualBalanceOnSelectedDay && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid color-mix(in srgb, var(--border) 32%, transparent)', color: 'var(--text2)', fontSize: 11, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>Ledger calculation: <strong style={{ color: 'var(--text)' }}>{balanceMoney(selectedDayAutoBalance)}</strong></span>
                        <span style={{ color: 'var(--text3)' }}>·</span>
                        <span>Adjustment: <strong style={{ color: selectedDayBalance - selectedDayAutoBalance >= 0 ? 'var(--accent)' : 'var(--red)' }}>{selectedDayBalance - selectedDayAutoBalance >= 0 ? '+' : ''}{balanceMoney(selectedDayBalance - selectedDayAutoBalance)}</strong></span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <label className={calStyles.dayBalanceField}>
                    <span className={calStyles.dayBalanceLabel}>Day opening balance for {selected}</span>
                    <div className={calStyles.dayBalanceInputWrap}>
                      <span>{s}</span>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        autoFocus
                        value={dayBalanceDraft}
                        onChange={event => setDayBalanceDraft(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') handleSaveDayBalance()
                          if (event.key === 'Escape') closeDayBalanceEditor()
                        }}
                        placeholder="0.00"
                        disabled={dayBalanceSaving}
                      />
                    </div>
                  </label>
                  <div className={calStyles.dayBalanceMeta}>
                    This pins the calendar opening balance for this day and recalculates later days from here. It does not edit individual account balances.
                  </div>
                  <div className={calStyles.dayBalanceActions}>
                    <Button type="button" variant="ghost" onClick={closeDayBalanceEditor} disabled={dayBalanceSaving}>
                      Cancel
                    </Button>
                    {hasManualBalanceOnSelectedDay && (
                      <Button type="button" variant="ghost" onClick={handleClearDayBalance} disabled={dayBalanceSaving}>
                        Clear
                      </Button>
                    )}
                    <Button type="button" variant="primary" onClick={handleSaveDayBalance} disabled={dayBalanceSaving}>
                      {dayBalanceSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </>
              )}
            </div>
            {!editingDayBalance && (
              <div className={calStyles.dayPanelActions} style={{ marginTop: '8px' }}>
                <Button type="button" variant="income" fullWidth onClick={() => openComposer('income')} disabled={selectedDateLocked}>
                  Record income
                </Button>
                <Button type="button" variant="danger" fullWidth onClick={() => openComposer('expense')} disabled={selectedDateLocked}>
                  Record expense
                </Button>
              </div>
            )}
          </div>

          <div className={calStyles.dayPanelBody}>

            {(unpaidBillsByDateKey[selected] || []).length > 0 && (
              <div className={calStyles.daySection}>
                <div className={calStyles.daySectionHeader}>
                  <div className={calStyles.daySectionLabel} style={{ color: 'var(--amber)' }}>Unpaid Bills Due</div>
                  <div className={calStyles.daySectionCount}>{(unpaidBillsByDateKey[selected] || []).length}</div>
                </div>
                {(unpaidBillsByDateKey[selected] || []).map((bill, index) => (
                  <div
                    key={bill._id}
                    className={`${calStyles.txRow} ${calStyles.dayTxRowStaggered} ${calStyles.txRowUnpaid}`}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className={calStyles.txLeft}>
                      <div className={calStyles.txIcon} style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>📄</div>
                      <div className={calStyles.txInfoBlock}>
                        <div className={calStyles.txDesc}>
                          {bill.name}
                          <span className={calStyles.projBadge} style={{ background: 'var(--amber-dim)', color: 'var(--amber)', borderColor: 'rgba(255,179,71,0.3)' }}>bill</span>
                        </div>
                        <div className={calStyles.txMeta}>
                          {bill.cat || 'Bills'}
                          <span className={`${calStyles.statusBadge} ${calStyles.statusUnpaid}`}>Unpaid</span>
                        </div>
                      </div>
                    </div>
                    <div className={calStyles.txRight}>
                      <div className={`${calStyles.txAmount} ${privacyMode ? calStyles.privacyValueInline : ''}`} style={{ color: privacyMode ? 'var(--text3)' : 'var(--amber)' }}>
                        {privacyMode ? 'Hidden' : `−${fmt(bill.amount, s)}`}
                      </div>
                      <div className={calStyles.projectedActionStack}>
                        <div className={calStyles.projectedActionRowPrimary}>
                          <button
                            type="button"
                            className={`${calStyles.logBtn} ${calStyles.primaryProjectedBtn}`}
                            onClick={() => onPayBill?.(bill._id)}
                            aria-label={`Pay bill ${bill.name} now`}
                            style={{ background: 'var(--amber)', borderColor: 'var(--amber)', color: '#fff' }}
                          >
                            Pay now
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedIncome.length > 0 && (
              <div className={calStyles.daySection}>
                <div className={calStyles.daySectionHeader}>
                  <div className={calStyles.daySectionLabel} style={{ color: 'var(--income)' }}>Income</div>
                  <div className={calStyles.daySectionCount}>{selectedIncome.length}</div>
                </div>
                {selectedIncome.map((tx, index) => (
                  <DayTxRow
                    key={tx._id}
                    t={tx}
                    s={s}
                    privacyMode={privacyMode}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onTogglePaymentStatus={handleTogglePaymentStatus}
                    onSettleProjectedNow={handleSettleProjectedNow}
                    onOpenRecurringDateEditor={openRecurringDateEditor}
                    onLogProjected={handleLogProjected}
                    onEditRecurrence={handleEditRecurrence}
                    recurringActionPending={Boolean(pendingRecurringActions[getRecurringActionKey(tx)])}
                    locked={selectedDateLocked}
                    accountLabel={tx.accountId ? (accountLookup[tx.accountId]?.name || 'Missing account') : ''}
                    animationDelay={`${index * 40}ms`}
                  />
                ))}
              </div>
            )}

            {selectedExpenses.length > 0 && (
              <div className={calStyles.daySection}>
                <div className={calStyles.daySectionHeader}>
                  <div className={calStyles.daySectionLabel} style={{ color: 'var(--red)' }}>Expenses</div>
                  <div className={calStyles.daySectionCount}>{selectedExpenses.length}</div>
                </div>
                {selectedExpenses.map((tx, index) => (
                  <DayTxRow
                    key={tx._id}
                    t={tx}
                    s={s}
                    privacyMode={privacyMode}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onTogglePaymentStatus={handleTogglePaymentStatus}
                    onSettleProjectedNow={handleSettleProjectedNow}
                    onOpenRecurringDateEditor={openRecurringDateEditor}
                    onLogProjected={handleLogProjected}
                    onEditRecurrence={handleEditRecurrence}
                    recurringActionPending={Boolean(pendingRecurringActions[getRecurringActionKey(tx)])}
                    locked={selectedDateLocked}
                    accountLabel={tx.accountId ? (accountLookup[tx.accountId]?.name || 'Missing account') : ''}
                    animationDelay={`${(selectedIncome.length + index) * 40}ms`}
                  />
                ))}
              </div>
            )}

            {selectedStatementDebts.length > 0 && (
              <div className={calStyles.daySection}>
                <div className={calStyles.daySectionHeader}>
                  <div className={calStyles.daySectionLabel} style={{ color: 'var(--text2)' }}>Statement Closes</div>
                  <div className={calStyles.daySectionCount}>{selectedStatementDebts.length}</div>
                </div>
                {selectedStatementDebts.map((debt) => (
                  <div key={`stmt-${debt._id}`} className={calStyles.debtRow}>
                    <div className={calStyles.debtRowMain}>
                      <span className={calStyles.debtRowName}>{debt.name}</span>
                      <span className={calStyles.debtRowMeta}>Day {debt.statementDate}</span>
                    </div>
                    <div className={calStyles.debtRowAmounts}>
                      <span className={calStyles.debtRowBalance}>{privacyMode ? 'Hidden' : fmt(debt.balance || 0, s)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedDueDebts.length > 0 && (
              <div className={calStyles.daySection}>
                <div className={calStyles.daySectionHeader}>
                  <div className={calStyles.daySectionLabel} style={{ color: 'var(--amber)' }}>Debt Due</div>
                  <div className={calStyles.daySectionCount}>{selectedDueDebts.length}</div>
                </div>
                {selectedDueDebts.map((debt) => {
                  const cashAccounts = data.accounts || []
                  const totalCash = cashAccounts
                    .filter(a => String(a.type || '').toLowerCase() !== 'credit card')
                    .reduce((sum, a) => sum + (Number(a.balance) || 0), 0)

                  const minAmount = debt.minPayment || 0
                  const statementAmount = debt.balance || 0
                  
                  const isMinOverdraft = totalCash < minAmount
                  const isFullOverdraft = totalCash < statementAmount

                  return (
                    <div key={`due-${debt._id}`} className={calStyles.debtRow} style={{ flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className={calStyles.debtRowMain}>
                          <span className={calStyles.debtRowName}>{debt.name}</span>
                          <span className={calStyles.debtRowMeta}>Due {debt.dueDate ? `Day ${debt.dueDate}` : '—'}</span>
                        </div>
                        <div className={calStyles.debtRowAmounts}>
                          <span className={calStyles.debtRowBalance}>{privacyMode ? 'Hidden' : fmt(debt.balance || 0, s)}</span>
                          {debt.minPayment > 0 && (
                            <span className={calStyles.debtRowMin}>{privacyMode ? 'Hidden' : `Min ${fmt(debt.minPayment, s)}`}</span>
                          )}
                        </div>
                      </div>
                      
                      {debt.balance > 0 && (
                        <div style={{ background: 'var(--bg2)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem', marginTop: '4px' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '6px', color: 'var(--text2)' }}>Payment Recommendations</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>1. Pay Minimum:</span>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ color: isMinOverdraft ? 'var(--red)' : 'var(--accent)', fontWeight: 'bold' }}>
                                  {privacyMode ? 'Hidden' : fmt(minAmount, s)}
                                </span>
                                {debt.accountId && minAmount > 0 && (
                                  <Button size="small" variant="ghost" onClick={() => handleFastPayDebt(debt, minAmount, selected)}>Pay now</Button>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                              <span>2. Pay Full Balance:</span>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ color: isFullOverdraft ? 'var(--red)' : 'var(--accent)', fontWeight: 'bold' }}>
                                  {privacyMode ? 'Hidden' : fmt(statementAmount, s)}
                                </span>
                                {debt.accountId && statementAmount > 0 && (
                                  <Button size="small" variant="ghost" onClick={() => handleFastPayDebt(debt, statementAmount, selected)}>Pay now</Button>
                                )}
                              </div>
                            </div>
                          </div>
                          {(isMinOverdraft || isFullOverdraft) && (
                            <div style={{ marginTop: '8px', color: 'var(--red)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                              <span>⚠️ {isMinOverdraft ? 'Low Cash: Risk of Overdraft even on Minimum!' : 'Risk of Overdraft on Full Balance payment!'}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {selectedTransfers.length > 0 && (
              <div className={calStyles.daySection}>
                <div className={calStyles.daySectionHeader}>
                  <div className={calStyles.daySectionLabel} style={{ color: 'var(--blue)' }}>Transfers</div>
                  <div className={calStyles.daySectionCount}>{selectedTransfers.length}</div>
                </div>
                {selectedTransfers.map((tx) => (
                  <div key={tx._id} className={calStyles.debtRow}>
                    <div className={calStyles.debtRowMain}>
                      <span className={calStyles.debtRowName}>{tx.desc || 'Transfer'}</span>
                      <span className={calStyles.debtRowMeta}>{tx.fromAccountName || 'Cash'} → {tx.toAccountName || 'Bank'}</span>
                    </div>
                    <div className={calStyles.debtRowAmounts}>
                      <span className={calStyles.debtRowBalance} style={{ color: 'var(--blue)' }}>
                        {privacyMode ? 'Hidden' : fmt(tx.amount || 0, s)}
                      </span>
                      <button
                        type="button"
                        className={calStyles.delBtnSm}
                        onClick={() => handleDeleteTransfer(tx)}
                        aria-label={`Delete transfer ${tx.desc}`}
                        disabled={selectedDateLocked}
                        style={{ marginTop: '4px', padding: '0 6px', minHeight: '22px', fontSize: '10px' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedIncome.length === 0 && selectedExpenses.length === 0 && selectedTransfers.length === 0 && selectedDueDebts.length === 0 && selectedStatementDebts.length === 0 && (
              <EmptyState
                compact
                description="No entries on this day yet."
                action={
                  <button
                    type="button"
                    onClick={() => { playTick(); setShowModal(true); }}
                    style={{
                      background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                      color: 'var(--text)',
                      borderRadius: '999px',
                      padding: '4px 12px',
                      fontSize: 'var(--type-caption)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginTop: '8px'
                    }}
                  >
                    + Add Transaction
                  </button>
                }
              />
            )}

            

            {!editingDayBalance && (
              <div className={calStyles.daySystemNote}>
                Forecast rows are upcoming recurring items. Paid linked entries update account balances.
              </div>
            )}

            {goalsList.length > 0 && (
              <details className={calStyles.goalDisclosure}>
                <summary className={calStyles.goalDisclosureSummary}>
                  <span>Savings goals</span>
                  <span className={calStyles.goalDisclosureCount}>{goalsList.length}</span>
                </summary>
                <div className={calStyles.goalDisclosureBody}>
                  {goalsList.map(goal => {
                    const pct = Math.min(100, Math.round(((goal.current || 0) / (goal.target || 1)) * 100))
                    const isEditing = editGoalId === goal._id

                    return (
                      <div key={goal._id} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{goal.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{money(goal.current || 0)}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>/ {money(goal.target)}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditGoalId(isEditing ? null : goal._id)
                                setGoalInput(String(goal.current || 0))
                              }}
                              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                            >
                              {isEditing ? 'Cancel' : 'Edit'}
                            </button>
                          </div>
                        </div>
                        <div style={{ height: 5, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? 'var(--amber)' : 'var(--accent)', borderRadius: 3, transition: 'width 0.4s' }} />
                        </div>
                        {isEditing && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <input
                              type="number"
                              min="0"
                              value={goalInput}
                              onChange={event => setGoalInput(event.target.value)}
                              placeholder="Updated saved total"
                              style={{ flex: 1, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 16, outline: 'none', fontFamily: 'var(--font-body)' }}
                            />
                            <button type="button" onClick={() => handleGoalUpdate(goal)} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#0a0a0f', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </details>
            )}
          </div>
        </>
      ) : (
        <div className={calStyles.outlookContainer}>
          <div className={calStyles.outlookHeader}>
            <div className={calStyles.outlookKicker}>Month Outlook</div>
            <h3 id="calendar-day-panel-title" className={calStyles.outlookTitle}>{label}</h3>
            <p className={calStyles.outlookSubtitle}>Predictive financial radar & cashflow overview.</p>
          </div>

          <div className={calStyles.outlookRadarGrid}>
            <div className={calStyles.outlookRadarCard}>
              <span className={calStyles.outlookRadarLabel}>Lowest Dip</span>
              <strong className={calStyles.outlookRadarValue} style={{ color: lowestBalanceDip.minVal < 0 ? 'var(--red)' : lowestBalanceDip.minVal < 2000 ? 'var(--amber)' : 'var(--text)' }}>
                {balanceMoney(lowestBalanceDip.minVal)}
              </strong>
              <span className={calStyles.outlookRadarSub}>
                {lowestBalanceDip.minDate ? formatBalanceDate(lowestBalanceDip.minDate) : '—'}
              </span>
            </div>

            <div className={calStyles.outlookRadarCard}>
              <span className={calStyles.outlookRadarLabel}>Peak Balance</span>
              <strong className={calStyles.outlookRadarValue} style={{ color: 'var(--accent)' }}>
                {balanceMoney(lowestBalanceDip.peakVal)}
              </strong>
              <span className={calStyles.outlookRadarSub}>
                {lowestBalanceDip.peakDate ? formatBalanceDate(lowestBalanceDip.peakDate) : '—'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text2)' }}>Total Income</span>
              <strong style={{ fontSize: '13px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>+{money(monthSummaryTotals.totalInc)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text2)' }}>Total Expenses</span>
              <strong style={{ fontSize: '13px', color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>−{money(monthSummaryTotals.totalExp)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text2)' }}>Net Cashflow</span>
              <strong style={{ fontSize: '13px', color: monthSummaryTotals.net >= 0 ? 'var(--accent)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                {monthSummaryTotals.net >= 0 ? '+' : ''}{money(monthSummaryTotals.net)}
              </strong>
            </div>
          </div>

          {upcomingMonthDeadlines.length > 0 && (
            <div className={calStyles.outlookDeadlinesSection}>
              <div className={calStyles.outlookDeadlinesHeader}>
                <span className={calStyles.outlookDeadlinesLabel}>Upcoming Deadlines</span>
                <span className={calStyles.outlookDeadlinesCount}>{upcomingMonthDeadlines.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {upcomingMonthDeadlines.slice(0, 4).map(item => (
                  <div key={item.id} className={calStyles.outlookDeadlineCard}>
                    <div className={calStyles.outlookDeadlineLeft}>
                      <div className={calStyles.outlookDeadlineName}>{item.name}</div>
                      <div className={calStyles.outlookDeadlineMeta}>
                        <span>{formatBalanceDate(item.date)}</span>
                        <span>·</span>
                        <span>{item.cat}</span>
                      </div>
                    </div>
                    <div className={calStyles.outlookDeadlineRight}>
                      <span className={calStyles.outlookDeadlineAmount}>−{fmt(item.amount, s)}</span>
                      {item.type === 'bill' && onPayBill ? (
                        <button
                          type="button"
                          className={calStyles.outlookPayBtn}
                          onClick={() => onPayBill(item.billId)}
                          aria-label={`Pay ${item.name} now`}
                        >
                          Pay
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={calStyles.outlookPayBtn}
                          style={{ background: 'var(--surface3)', color: 'var(--text)' }}
                          onClick={() => {
                            playTick()
                            setSelected(item.date)
                          }}
                          aria-label={`View date ${item.date}`}
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="primary"
            fullWidth
            onClick={jumpToToday}
            style={{ marginTop: 'auto' }}
          >
            📅 Select Today ({formatDisplayDate(todayStr)}) <kbd style={{ marginLeft: 6, opacity: 0.6, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.2)' }}>T</kbd>
          </Button>
        </div>
      )}
    </section>
  );

  return (
    <div className={styles.page}>
      <input ref={focusProxyRef} type="text" inputMode="decimal" style={{ opacity: 0, position: 'fixed', top: 0, left: 0, width: 1, height: 1, pointerEvents: 'none' }} aria-hidden="true" tabIndex={-1} />
      <div className={styles.pageHero}>
        <div className={styles.pageHeader}>
          <div className={styles.pageEyebrow}>Calendar</div>
          <div className={styles.pageTitle}>Predict the future of your money.</div>
          <div className={styles.pageSub}>
            Plan upcoming income, bills, and see exactly what your balance will be on any given day.
          </div>
        </div>
      </div>
      {entryFeedback && (
        <div className={`${styles.card} ${calStyles.feedbackBanner} ${calStyles.feedbackDock}`} style={{ '--feedback-tone': entryFeedback.tone }}>
          <div className={calStyles.feedbackEyebrow}>{entryFeedback.eyebrow || 'Entry saved'}</div>
          <div className={calStyles.feedbackTitle}>{entryFeedback.title}</div>
          <div className={calStyles.feedbackBody}>{entryFeedback.body}</div>
        </div>
      )}

      <div id="takda-calendar" className={`${styles.card} ${calStyles.calendarCard}`}>
        <div className={calStyles.calHeader}>
          <div className={calStyles.calHeaderTop}>
            <div className={calStyles.nav}>
              <button type="button" className={calStyles.navBtn} onClick={prev} aria-label="Previous month">‹</button>
              <label className={calStyles.monthJumpWrap} aria-label={`Jump to another date. Currently showing ${label}.`}>
                <span className={calStyles.monthLabel} id="calendar-month-label">{label} ▾</span>
                <input
                  type="date"
                  className={calStyles.monthJumpInput}
                  value={selected || balanceFocusDate || todayStr}
                  onChange={handleJumpToDate}
                  aria-label="Jump to any date"
                />
              </label>
              <button type="button" className={calStyles.navBtn} onClick={next} aria-label="Next month">›</button>
              <button type="button" className={calStyles.todayNavBtn} onClick={jumpToToday} title="Jump to today (Shortcut: T)">
                Today
              </button>
            </div>

            <div className={calStyles.viewToggleWrap}>
              <button 
                type="button"
                className={`${calStyles.viewToggleBtn} ${calendarViewMode === 'cash' ? calStyles.viewToggleActive : ''}`}
                onClick={() => setCalendarViewMode('cash')}
              >Cash</button>
              <button 
                type="button"
                className={`${calStyles.viewToggleBtn} ${calendarViewMode === 'netWorth' ? calStyles.viewToggleActive : ''}`}
                onClick={() => setCalendarViewMode('netWorth')}
              >Net Worth</button>
            </div>
          </div>

          <div className={calStyles.calHeaderBottom}>
            <div className={calStyles.monthLowestChip} title={`Lowest forecasted balance this month (${formatBalanceDate(lowestBalanceDip.minDate)})`}>
              <span className={calStyles.monthLowestLabel}>Lowest Dip</span>
              <strong className={lowestBalanceDip.minVal < 0 ? calStyles.monthLowestNegative : lowestBalanceDip.minVal < 2000 ? calStyles.monthLowestTight : calStyles.monthLowestNormal}>
                {balanceMoney(lowestBalanceDip.minVal)}
              </strong>
            </div>

            <div className={calStyles.monthNetChip} title="Net Cashflow for this month">
              <span className={calStyles.monthNetLabel}>Net Cashflow</span>
              <strong className={monthSummaryTotals.net >= 0 ? calStyles.monthNetPositive : calStyles.monthNetNegative}>
                {monthSummaryTotals.net >= 0 ? '+' : '−'}{balanceMoney(Math.abs(monthSummaryTotals.net))}
              </strong>
            </div>
          </div>
        </div>

        <div className={calStyles.monthBoard}>
          <div className={calStyles.calendarMain}>
          <div className={calStyles.dayNames}>
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, index) => <div key={index} className={calStyles.dayName}>{day}</div>)}
          </div>

          <div
            key={`${year}-${month}`}
            className={`${calStyles.grid} ${calStyles.gridAnimated}`}
            aria-label={`${label} calendar`}
            onTouchStart={handleGridTouchStart}
            onTouchEnd={handleGridTouchEnd}
          >
            {Array.from({ length: firstDay }, (_, index) => (
              <div key={`p${index}`} className={`${calStyles.cell} ${calStyles.otherMonth}`} aria-hidden="true">
                <div className={calStyles.dateNum}>{prevDays - firstDay + 1 + index}</div>
              </div>
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1
              const ds = dateStr(day)
              const { income, expenses, transfers } = getDayData(day)
              const hasIncome = income.length > 0
              const hasExpense = expenses.length > 0
              const hasTransfer = transfers.length > 0
              const hasManualBalance = Object.prototype.hasOwnProperty.call(balanceOverrides, ds)
              const isSelected = selected === ds
              const isToday = ds === todayStr
              const forecast = forecastMap[ds]
              const baseValue = forecast ? forecast.runningBalance : 0
              const cellTotalDebts = getTakdaTotalDebts(accountList, data?.debts, ds, incomeList, expenseList)
              const displayValue = calendarViewMode === 'netWorth' ? (baseValue + (Number(totalSavings) || 0) + totalCryptoAssets - cellTotalDebts) : baseValue
              const dayAriaLabel = buildDayAriaLabel({ ds, day, displayValue, hasIncome, hasExpense, hasManualBalance, isToday, isSelected, privacyMode, s })
              
              const dayDueDebts = dueDebtsByDateKey[ds] || []
              const dayStatementDebts = statementDebtsByDateKey[ds] || []
              const hasUnpaidBill = (unpaidBillsByDateKey[ds] || []).length > 0
              const isDangerDay = displayValue < 0
              const isLowestDip = ds === lowestBalanceDip.minDate && !isDangerDay
              return (
                <button
                  type="button"
                  key={day}
                  className={`${calStyles.cell} ${isToday ? calStyles.today : ''} ${isSelected ? calStyles.selectedCell : ''} ${(hasIncome || hasExpense || hasTransfer) ? calStyles.hasData : ''} ${isDangerDay ? calStyles.cellDanger : ''} ${isLowestDip ? calStyles.cellLowestDip : ''}`}
                  onClick={() => handleDayCellClick(ds)}
                  aria-pressed={isSelected}
                  aria-label={dayAriaLabel}
                >
                  <div className={calStyles.cellAlerts}>
                    {hasUnpaidBill && (
                      <div className={calStyles.cellDueBadge} title="Unpaid bill due" />
                    )}
                    {dayDueDebts.map(debt => (
                      <div 
                        key={debt._id} 
                        className={calStyles.debtDueAlert} 
                        style={{ background: debt.color || 'var(--amber)', boxShadow: `0 0 6px ${debt.color || 'var(--amber)'}` }} 
                        title={`Payment due: ${debt.name}`} 
                      />
                    ))}
                    {dayStatementDebts.map(debt => (
                      <svg 
                        key={debt._id} 
                        className={calStyles.debtStatementAlert} 
                        style={{ color: debt.color || 'var(--text3)' }} 
                        title={`Statement closes: ${debt.name}`} 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="3"
                      >
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <line x1="7" y1="8" x2="17" y2="8" />
                        <line x1="7" y1="12" x2="13" y2="12" />
                      </svg>
                    ))}
                  </div>

                  <div className={calStyles.cellTop}>
                    <span className={`${calStyles.dateNum} ${isToday ? calStyles.todayDateBadge : ''}`}>{day}</span>
                    {hasManualBalance && <div className={calStyles.manualBalancePin} title="Manual balance override" />}
                  </div>

                  {(hasIncome || hasExpense || hasTransfer) ? (
                    <div className={calStyles.activityDots}>
                      {hasIncome && <div className={calStyles.activityDotInc} title="Income" />}
                      {hasExpense && <div className={calStyles.activityDotExp} title="Expense" />}
                      {hasTransfer && <div className={calStyles.activityDotTrsf} title="Transfer" />}
                    </div>
                  ) : (
                    <div className={calStyles.activityDotsSpacer} />
                  )}

                  {!privacyMode && forecast && (
                    <div
                      className={calStyles.cellBalance}
                      title={formatRoundedBalance(displayValue, s)}
                    >
                      <span className={calStyles.balanceCurrency}>{s}</span>
                      {formatCompactCellBalance(displayValue)}
                    </div>
                  )}
                </button>
              )
            })}
            {Array.from({ length: trailingDayCount }, (_, index) => (
              <div key={`n${index}`} className={`${calStyles.cell} ${calStyles.otherMonth}`} aria-hidden="true">
                <div className={calStyles.dateNum}>{index + 1}</div>
              </div>
            ))}
          </div>
          </div>
          {!isMobile && renderedDayPanel}
        </div>

        {isMobile && selected && typeof document !== 'undefined' && createPortal(
          <div className={calStyles.daySheetOverlay} onClick={closeSelectedDay}>
            <div className={calStyles.daySheet} onClick={event => event.stopPropagation()}>
              {renderedDayPanel}
            </div>
          </div>,
          document.body
        )}


      </div>

      {recurringDateTarget && typeof document !== 'undefined'
        ? createPortal(
          <div className={calStyles.modalOverlay} onClick={() => { if (!recurringDateSaving) closeRecurringDateEditor() }}>
            <div
              ref={recurringDateModalRef}
              tabIndex={-1}
              className={calStyles.modal}
              onClick={event => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="calendar-recurring-date-modal-title"
            >
              <div className={calStyles.modalHeader}>
                <div className={calStyles.modalTitle} id="calendar-recurring-date-modal-title">
                  {recurringDateTarget.type === 'income' ? 'Record recurring income' : 'Settle recurring cycle'}
                </div>
                <button type="button" onClick={() => closeRecurringDateEditor()} className={calStyles.modalClose} disabled={recurringDateSaving} aria-label="Close recurring date editor">✕</button>
              </div>

              <div className={calStyles.balanceImpactCard}>
                <div className={calStyles.balanceImpactGrid}>
                  <div className={calStyles.balanceImpactLabel}>Recurring item</div>
                  <div className={calStyles.balanceImpactValue}>{recurringDateTarget.desc || recurringDateTarget.cat || 'Recurring entry'}</div>
                  <div className={calStyles.balanceImpactLabel}>Scheduled cycle</div>
                  <div className={calStyles.balanceImpactValue}>{formatRecurringDateLabel(getRecurringOccurrenceKey(recurringDateTarget))}</div>
                  <div className={calStyles.balanceImpactLabel}>Account used</div>
                  <div className={`${calStyles.balanceImpactValue} ${calStyles.balanceImpactAccount}`}>
                    {recurringDateTarget.accountId
                      ? (accountLookup[recurringDateTarget.accountId]?.name || 'Linked account')
                      : 'Ledger only'}
                  </div>
                </div>
                <div className={calStyles.balanceImpactMeta}>
                  Choose the real payment date. Takda will save the entry on that day and still settle the scheduled recurring cycle.
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Real {recurringDateTarget.type === 'income' ? 'received' : 'payment'} date</label>
                <input
                  type="date"
                  value={recurringDateDraft}
                  onChange={event => setRecurringDateDraft(event.target.value)}
                  disabled={recurringDateSaving}
                />
              </div>

              <div className={calStyles.modalActions}>
                <Button type="button" onClick={() => closeRecurringDateEditor()} variant="ghost" disabled={recurringDateSaving}>Cancel</Button>
                <Button
                  type="button"
                  onClick={handleSaveRecurringDate}
                  variant={recurringDateTarget.type === 'income' ? 'primary' : 'danger'}
                  disabled={recurringDateSaving || !normalizeDate(recurringDateDraft)}
                >
                  {recurringDateSaving
                    ? 'Saving...'
                    : recurringDateTarget.type === 'income'
                      ? 'Save income date'
                      : 'Save payment date'}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}

      {showModal && typeof document !== 'undefined'
        ? createPortal(
          <div className={calStyles.modalOverlay} onClick={() => { if (!formSaving) closeTransactionEditor() }}>
            <div
              ref={transactionModalRef}
              tabIndex={-1}
              className={calStyles.modal}
              onClick={event => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="calendar-transaction-modal-title"
            >
            <div className={calStyles.modalHeader}>
              <div className={calStyles.modalTitle} id="calendar-transaction-modal-title">
                {editTx ? 'Edit transaction' : `Add ${isIncome ? 'Income' : 'Expense'}`}
                {selected && !editTx && <span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 8 }}>{selected}</span>}
              </div>
            <button type="button" onClick={closeTransactionEditor} className={calStyles.modalClose} disabled={formSaving} aria-label="Close transaction editor">✕</button>
            </div>

            {!editTx && (
              <div className={calStyles.typeToggle}>
                <button type="button" className={`${calStyles.typeBtn} ${isIncome ? calStyles.typeBtnIncome : ''}`} onClick={() => switchComposerType('income')} disabled={formSaving} aria-pressed={isIncome}>
                  <span className={calStyles.typeBtnSign}>+</span><span>Income</span>
                </button>
                <button type="button" className={`${calStyles.typeBtn} ${!isIncome ? calStyles.typeBtnExpense : ''}`} onClick={() => switchComposerType('expense')} disabled={formSaving} aria-pressed={!isIncome}>
                  <span className={calStyles.typeBtnSign}>−</span><span>Expense</span>
                </button>
              </div>
            )}

            <div className={calStyles.amountField}>
              <span className={calStyles.amountSign} style={{ color: isIncome ? 'var(--income)' : 'var(--red)' }}>
                {isIncome ? '+' : '−'}
              </span>
              <span className={calStyles.amountSymbol}>{s}</span>
              <input
                ref={amountInputRef}
                className={calStyles.amountInput}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                disabled={formSaving}
                onChange={event => set('amount', normalizeAmountInput(event.target.value))}
                style={{ color: isIncome ? 'var(--income)' : 'var(--red)' }}
                aria-label={`${isIncome ? 'Income' : 'Expense'} amount`}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '16px' }}>
              {[100, 500, 1000, 5000].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('amount', String(Number(form.amount || 0) + v))}
                  style={{
                    flex: '1 1 0',
                    padding: '6px 0',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '999px',
                    border: '1px solid color-mix(in srgb, var(--text) 15%, transparent)',
                    background: 'color-mix(in srgb, var(--text) 6%, transparent)',
                    color: 'var(--text2)',
                    cursor: 'pointer',
                  }}
                >
                  +{v.toLocaleString()}
                </button>
              ))}
              <button
                type="button"
                onClick={() => set('amount', '')}
                style={{
                  flex: '1 1 0',
                  padding: '6px 0',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '999px',
                  border: '1px solid color-mix(in srgb, var(--red, #ff453a) 30%, transparent)',
                  background: 'color-mix(in srgb, var(--red, #ff453a) 8%, transparent)',
                  color: 'var(--red, #ff453a)',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>

            <div className={calStyles.modalSectionLabel}>{isIncome ? 'What did you receive?' : 'What did you pay for?'}</div>
            <div className={calStyles.quickCats}>
              {visibleQuickPresets.map(item => (
                <button
                  key={item.key}
                  className={`${calStyles.quickCat} ${form.presetKey === item.key ? calStyles.quickCatActive : ''}`}
                  style={form.presetKey === item.key ? {
                    borderColor: isIncome ? 'var(--income)' : 'var(--red)',
                    background: isIncome ? 'var(--income-dim)' : 'var(--red-dim)',
                    color: isIncome ? 'var(--income)' : 'var(--red)',
                  } : {}}
                  disabled={formSaving}
                  onClick={() => {
                    if (item.isCustom) clearComposerPreset(modalType, 'Other', 'Miscellaneous')
                    else applyComposerPreset(item.key)
                  }}
                  aria-pressed={form.presetKey === item.key}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className={calStyles.presetActions}>
              <button
                type="button"
                className={`${calStyles.presetToggle} ${showPresetBrowser ? calStyles.presetToggleActive : ''}`}
                onClick={() => setShowPresetBrowser(current => !current)}
                disabled={formSaving}
                aria-expanded={showPresetBrowser}
              >
                {showPresetBrowser ? 'Hide presets' : 'More presets'}
              </button>
            </div>

            <div className={calStyles.modalFields}>
              {showPresetBrowser && (
                <div className={`${styles.formGroup} ${calStyles.modalFieldFull}`}>
                  <label>Browse presets</label>
                  <select
                    value={form.presetKey || 'other-custom'}
                    onChange={event => {
                      if (event.target.value === 'other-custom') clearComposerPreset(modalType, 'Other', 'Miscellaneous')
                      else applyComposerPreset(event.target.value)
                    }}
                    disabled={formSaving}
                  >
                    {presetGroups.map(group => (
                      <optgroup key={group.label} label={group.label}>
                        {group.items.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                      </optgroup>
                    ))}
                    <option value="other-custom">Other / custom</option>
                  </select>
                </div>
              )}
              <div className={styles.formGroup}>
                <label>{selectedPreset ? 'Description' : (isIncome ? 'Payer or note' : 'Merchant, biller, or note')}</label>
                <input placeholder="Merchant, payer, or note (optional)" value={form.desc} onChange={event => set('desc', event.target.value)} disabled={formSaving} />
              </div>
              <div className={styles.formGroup}>
                <label>Account</label>
                <select value={form.accountId} onChange={event => set('accountId', event.target.value)} disabled={formSaving}>
                  <option value="">No account selected</option>
                  {accountList.map(account => (
                    <option key={account._id} value={account._id}>
                      {account.name} · {account.type}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Counts in balances</label>
                <select value={form.paymentStatus} onChange={event => set('paymentStatus', event.target.value)} disabled={formSaving}>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
            </div>

            <div className={calStyles.presetHint}>
              {selectedPreset
                ? `${selectedPreset.label} auto-fills ${selectedPreset.cat} → ${selectedPreset.subcat}.`
                : isIncome
                  ? 'No preset selected. Choose a familiar income source, or keep this as a custom entry.'
                  : 'No preset selected. Choose a familiar biller or merchant, or keep this as a custom entry.'}
            </div>

            <details className={calStyles.advancedBox}>
              <summary className={calStyles.advancedSummary}>
                <span>More options</span>
                <small>Payment status, category, subcategory, recurrence</small>
              </summary>
              <div className={calStyles.advancedGrid}>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select value={form.cat} onChange={event => applyComposerCategory(event.target.value)} disabled={formSaving}>
                    {cats.map(option => <option key={option}>{option}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Subcategory</label>
                  <select value={form.subcat} onChange={event => applyComposerSubcategory(event.target.value)} disabled={formSaving}>
                    {subcats.map(option => <option key={option}>{option}</option>)}
                  </select>
                </div>
                <div className={`${styles.formGroup} ${calStyles.advancedFull}`}>
                  <label>Recurrence</label>
                  <div className={calStyles.recurGrid}>
                    {RECUR_OPTIONS.map(option => (
                      <button
                        type="button"
                        key={option.value}
                        onClick={() => set('recur', option.value)}
                        className={`${calStyles.recurChip} ${form.recur === option.value ? calStyles.recurChipActive : ''}`}
                        disabled={formSaving}
                        aria-pressed={form.recur === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </details>

            {formError && <div className={calStyles.formError} role="alert">{formError}</div>}

            {formImpact && (
              <div
                className={calStyles.impactPreview}
                role="status"
                style={{
                  background: formImpact.level === 'negative' ? 'var(--red-dim)' : formImpact.level === 'tight' ? 'var(--amber-dim)' : 'var(--accent-glow)',
                  borderColor: formImpact.level === 'negative' ? 'var(--red)' : formImpact.level === 'tight' ? 'var(--amber)' : 'var(--accent)',
                  color: formImpact.level === 'negative' ? 'var(--red)' : formImpact.level === 'tight' ? 'var(--amber)' : 'var(--accent)',
                }}
              >
                {formImpact.msg}
              </div>
            )}

            <div className={calStyles.modalActions}>
              <Button type="button" onClick={closeTransactionEditor} variant="ghost" disabled={formSaving}>Cancel</Button>
              <Button
                type="button"
                onClick={handleSave}
                variant={isIncome ? 'primary' : 'danger'}
                disabled={formSaving || !Number.isFinite(parseFloat(form.amount)) || parseFloat(form.amount) <= 0}
              >
                {formSaving ? 'Saving...' : editTx ? 'Save changes' : isIncome ? '+ Add income' : '− Add expense'}
              </Button>
            </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </div>
  )
}

function DayTxRow({
  t,
  s,
  privacyMode,
  onEdit,
  onDelete,
  onTogglePaymentStatus,
  onSettleProjectedNow,
  onOpenRecurringDateEditor,
  onLogProjected,
  onEditRecurrence,
  recurringActionPending = false,
  locked = false,
  accountLabel = '',
  animationDelay = '0ms',
}) {
  if (!t) return null
  const isIncome = t?.type === 'income'
  const lifecycle = getTakdaTransactionLifecycle(t || {}, today())
  const isPaid = lifecycle.paid
  const isProjected = lifecycle.projected
  const classification = [t.cat, t.subcat].filter(Boolean).join(' · ')
  const metaParts = [
    classification || t.cat,
    accountLabel,
    t.recur ? `every ${t.recur}` : null,
  ].filter(Boolean)
  const metaSubtitle = metaParts.join(' · ')

  return (
    <div
      className={`${calStyles.txRow} ${calStyles.dayTxRowStaggered} ${isPaid ? '' : calStyles.txRowUnpaid} ${isProjected ? calStyles.projectedTxRow : ''}`}
      style={{ animationDelay }}
    >
      <div className={calStyles.txLeft}>
        <div
          className={calStyles.txIcon}
          style={{
            background: isIncome ? 'color-mix(in srgb, #30d158 16%, transparent)' : 'color-mix(in srgb, #ff453a 16%, transparent)',
            color: isIncome ? '#30d158' : '#ff453a',
          }}
        >
          {isIncome ? '+' : '−'}
        </div>
        <div className={calStyles.txInfoBlock}>
          <div className={calStyles.txDesc}>
            {t.desc || t.cat}
            {t._projected && <span className={calStyles.projBadge}>recurring</span>}
          </div>
          <div className={calStyles.txMeta} title={metaSubtitle}>
            {metaSubtitle}
          </div>
        </div>
      </div>
      <div className={`${calStyles.txRight} ${isProjected ? calStyles.projectedTxRight : ''}`}>
        <div className={`${calStyles.txAmount} ${privacyMode ? calStyles.privacyValueInline : ''} ${isProjected ? calStyles.projectedTxAmount : ''}`} style={{ color: privacyMode ? 'var(--text3)' : (isIncome ? '#30d158' : '#ff453a') }}>
          {privacyMode ? 'Hidden' : `${isIncome ? '+' : '−'}${fmt(t.amount, s)}`}
        </div>
        {t._projected ? (
          <div className={calStyles.projectedActionStack}>
            <div className={calStyles.projectedActionRowPrimary}>
              <button
                type="button"
                className={`${calStyles.logBtn} ${calStyles.primaryProjectedBtn}`}
                onClick={() => onSettleProjectedNow?.(t)}
                aria-label={`${isIncome ? 'Record' : 'Pay'} ${t.desc || t.cat} now`}
                disabled={locked || recurringActionPending}
                style={recurringActionPending
                  ? undefined
                  : {
                    background: isIncome ? '#30d158' : '#ff453a',
                    borderColor: isIncome ? '#30d158' : '#ff453a',
                    color: '#ffffff',
                  }}
              >
                {recurringActionPending ? 'Saving...' : isIncome ? 'Record now' : 'Pay now'}
              </button>
            </div>
            <details className={calStyles.txActionDetails}>
              <summary className={calStyles.txActionSummary}>
                <span>More options</span>
                <small>Change date or recurrence</small>
              </summary>
              <div className={calStyles.txActionGrid}>
                <button
                  type="button"
                  className={`${calStyles.logBtn} ${calStyles.secondaryProjectedBtn}`}
                  onClick={() => onOpenRecurringDateEditor?.(t)}
                  aria-label={`Choose another date for ${t.desc || t.cat}`}
                  disabled={locked || recurringActionPending}
                >
                  Choose date
                </button>
                <button
                  type="button"
                  className={`${calStyles.logBtn} ${calStyles.tertiaryProjectedBtn}`}
                  onClick={() => onLogProjected?.(t)}
                  aria-label={`Keep the scheduled date for ${t.desc || t.cat}`}
                  disabled={locked || recurringActionPending}
                >
                  Keep due date
                </button>
                <button
                  type="button"
                  className={calStyles.recurBtn}
                  onClick={() => onEditRecurrence?.(t)}
                  aria-label={`Edit recurrence for ${t.desc || t.cat}`}
                  disabled={locked || recurringActionPending}
                >
                  Edit recurrence
                </button>
              </div>
            </details>
          </div>
        ) : (
          <div className={calStyles.txActions}>
            <button
              type="button"
              className={`${calStyles.statusBtn} ${isPaid ? calStyles.statusBtnPaid : calStyles.statusBtnUnpaid}`}
              onClick={() => onTogglePaymentStatus(t)}
              aria-label={`${isPaid ? 'Mark unpaid' : 'Mark paid'} for ${t.desc || t.cat}`}
              disabled={locked}
            >
              {isPaid ? 'Paid' : 'Unpaid'}
            </button>
            <button
              type="button"
              className={calStyles.editBtn}
              onClick={() => onEdit(t)}
              aria-label={`Edit ${t.desc || t.cat}`}
              title="Edit transaction"
              disabled={locked}
            >
              ✏️
            </button>
            <button
              type="button"
              className={calStyles.delBtnSm}
              onClick={() => onDelete(t)}
              aria-label={`Delete ${t.desc || t.cat}`}
              title="Delete transaction"
              disabled={locked}
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
