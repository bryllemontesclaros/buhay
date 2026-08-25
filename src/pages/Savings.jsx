import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fsAdd, fsDel, fsUpdate } from '../lib/firestore'
import { confirmDeleteApp, notifyApp } from '../lib/appFeedback'
import { displayValue, fmt, formatDisplayDate, maskMoney, playTick, today } from '../lib/utils'
import { safeScrollIntoView } from '../lib/ui'
import styles from './Page.module.css'
import sStyles from './Savings.module.css'
import SwipeableCard from '../components/SwipeableCard'

const EMPTY_GOAL_FORM = {
  name: '',
  target: '',
  current: '',
  date: '',
  accountId: '',
}

const DEPOSIT_PRESETS = [500, 1000, 2500, 5000]

export default function Savings({
  user,
  data,
  profile = {},
  symbol,
  privacyMode = false,
  actionRequest = null,
  onActionHandled = () => {},
  hideHeader = false,
}) {
  const s = symbol || '₱'
  const accounts = Array.isArray(data.accounts) ? data.accounts.filter(Boolean) : []
  const bankAccounts = accounts.filter(acc => acc && acc.type !== 'Credit Card')

  const [showModal, setShowModal] = useState(false)
  const [editGoal, setEditGoal] = useState(null)
  const [form, setForm] = useState(EMPTY_GOAL_FORM)
  const [contribs, setContribs] = useState({})
  const [activeDepositGoalId, setActiveDepositGoalId] = useState(null)

  const handledActionTokenRef = useRef(null)
  const contributionInputRefs = useRef({})

  function set(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function openAddModal() {
    playTick()
    setEditGoal(null)
    setForm(EMPTY_GOAL_FORM)
    setShowModal(true)
  }

  function openEditModal(goal) {
    playTick()
    setEditGoal(goal)
    setForm({
      name: goal.name || '',
      target: String(goal.target || ''),
      current: String(goal.current || 0),
      date: goal.date || '',
      accountId: goal.accountId || '',
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditGoal(null)
    setForm(EMPTY_GOAL_FORM)
  }

  async function handleSaveGoal(e) {
    if (e) e.preventDefault()
    if (!form.name || !form.target) {
      notifyApp({ title: 'Goal needs details', message: 'Add a goal name and target amount before saving.', tone: 'warning' })
      return
    }
    const target = Number(form.target)
    const current = form.current === '' ? 0 : Number(form.current)
    if (!Number.isFinite(target) || target <= 0) {
      notifyApp({ title: 'Check target', message: 'Target amount must be greater than zero.', tone: 'warning' })
      return
    }
    if (!Number.isFinite(current) || current < 0) {
      notifyApp({ title: 'Check current saved', message: 'Current saved cannot be below zero.', tone: 'warning' })
      return
    }

    const payload = {
      name: form.name,
      target,
      current,
      date: form.date,
      accountId: form.accountId || '',
      accountBalanceLinked: Boolean(form.accountId),
    }

    try {
      if (editGoal) {
        await fsUpdate(user.uid, 'goals', editGoal._id, payload)
        notifyApp({ title: 'Goal updated', message: `${form.name} saved.`, tone: 'success' })
      } else {
        await fsAdd(user.uid, 'goals', payload)
        notifyApp({ title: 'Goal created', message: `${form.name} added to your savings targets.`, tone: 'success' })
      }
      closeModal()
    } catch {
      notifyApp({ title: 'Save failed', message: 'Could not save goal.', tone: 'error' })
    }
  }

  async function handleContrib(goal, amountOverride = null) {
    const rawVal = amountOverride !== null ? amountOverride : contribs[goal._id]
    const value = parseFloat(rawVal || 0)
    if (!Number.isFinite(value) || value <= 0) {
      notifyApp({ title: 'Check deposit', message: 'Add a deposit amount greater than zero.', tone: 'warning' })
      return
    }

    const newValue = Math.min(goal.target, (goal.current || 0) + value)
    try {
      await fsUpdate(user.uid, 'goals', goal._id, { current: newValue })
      setContribs(current => ({ ...current, [goal._id]: '' }))
      setActiveDepositGoalId(null)
      notifyApp({
        title: 'Funds Added! 💰',
        message: `Added ${fmt(value, s)} toward ${goal.name}.`,
        tone: 'success',
      })
    } catch {
      notifyApp({ title: 'Deposit failed', message: 'Could not update savings goal.', tone: 'error' })
    }
  }

  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))
  const goals = (data.goals || []).map(goal => {
    const current = Number(goal.current) || 0
    const target = Number(goal.target) || 0
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
    const remaining = Math.max(0, target - current)
    return { ...goal, current, target, pct, remaining }
  })

  const totalSaved = goals.reduce((sum, goal) => sum + goal.current, 0)
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target, 0)
  const totalRemaining = Math.max(0, totalTarget - totalSaved)
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0
  const completedGoals = goals.filter(goal => goal.pct >= 100).length

  // Action deep-linking handler
  useEffect(() => {
    if (!actionRequest?.token || handledActionTokenRef.current === actionRequest.token) return undefined
    if (actionRequest.type !== 'goal-contribution' || !actionRequest.goalId) {
      handledActionTokenRef.current = actionRequest.token
      onActionHandled(actionRequest.token)
      return undefined
    }

    handledActionTokenRef.current = actionRequest.token
    const frameId = window.requestAnimationFrame(() => {
      setActiveDepositGoalId(actionRequest.goalId)
      const targetInput = contributionInputRefs.current[actionRequest.goalId]
      if (targetInput) {
        safeScrollIntoView(targetInput, { behavior: 'smooth', block: 'center' })
        targetInput.focus()
      }
      onActionHandled(actionRequest.token)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [actionRequest, onActionHandled])

  const renderGoalCard = (goal) => {
    const isComplete = goal.pct >= 100
    const linkedAcc = goal.accountId ? accounts.find(a => a._id === goal.accountId) : null
    const isDepositOpen = activeDepositGoalId === goal._id

    return (
      <SwipeableCard
        key={goal._id}
        onSwipeRight={() => {
          playTick()
          setActiveDepositGoalId(prev => prev === goal._id ? null : goal._id)
        }}
        rightLabel="Deposit"
        rightIcon="💰"
        rightTone="success"
        onSwipeLeft={() => openEditModal(goal)}
        leftLabel="Edit"
        leftIcon="✎"
        leftTone="amber"
        onDoubleTap={() => openEditModal(goal)}
      >
        <div
          className={`${sStyles.goalCard} ${isComplete ? sStyles.goalCardComplete : ''}`}
          id={`goal-card-${goal._id}`}
        >
          <div className={sStyles.goalCardMain}>
            <div className={sStyles.goalLeading}>
              <div className={sStyles.goalIconWrap}>
                {isComplete ? '🎉' : '🎯'}
              </div>
              <div className={sStyles.goalInfo}>
                <div className={sStyles.goalNameRow}>
                  <span className={sStyles.goalName}>{goal.name}</span>
                  {linkedAcc && (
                    <span className={sStyles.linkedPill}>🔗 {linkedAcc.name}</span>
                  )}
                  {goal.date && (
                    <span className={sStyles.datePill}>Target {formatDisplayDate(goal.date)}</span>
                  )}
                </div>
                <div className={sStyles.goalMeta}>
                  <span>{money(goal.current)} saved</span>
                  <span className={sStyles.goalTargetMeta}>of {money(goal.target)}</span>
                </div>
              </div>
            </div>

            <div className={sStyles.goalTrailing}>
              <div className={`${sStyles.goalPctBadge} ${isComplete ? sStyles.pctComplete : ''}`}>
                {displayValue(privacyMode, `${goal.pct}%`, '•••')}
              </div>
              <span className={sStyles.goalRemainingText}>
                {isComplete ? 'Goal Met!' : `${money(goal.remaining)} left`}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className={sStyles.goalProgressBar}>
            <div
              className={`${sStyles.goalProgressFill} ${isComplete ? sStyles.progressFillComplete : ''}`}
              style={{ width: `${goal.pct}%` }}
            />
          </div>

          {/* Quick Deposit Preset Bar (Expandable or always accessible) */}
          {!isComplete && (
            <div className={sStyles.depositPresetRow}>
              {DEPOSIT_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  className={sStyles.btnPreset}
                  onClick={() => {
                    playTick()
                    handleContrib(goal, preset)
                  }}
                >
                  +{fmt(preset, s)}
                </button>
              ))}
              <button
                type="button"
                className={`${sStyles.btnPreset} ${isDepositOpen ? sStyles.btnPresetActive : ''}`}
                onClick={() => {
                  playTick()
                  setActiveDepositGoalId(prev => prev === goal._id ? null : goal._id)
                }}
              >
                Custom ✍️
              </button>
            </div>
          )}

          {/* Inline Custom Deposit Input */}
          {!isComplete && isDepositOpen && (
            <div className={sStyles.customDepositInputRow}>
              <input
                ref={node => { contributionInputRefs.current[goal._id] = node }}
                type="number"
                min="0"
                inputMode="decimal"
                className={sStyles.depositInput}
                placeholder={`Deposit amount (${s})`}
                value={contribs[goal._id] || ''}
                onChange={e => setContribs(c => ({ ...c, [goal._id]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleContrib(goal)
                }}
                autoFocus
              />
              <button
                type="button"
                className={sStyles.btnDepositSubmit}
                onClick={() => { playTick(); handleContrib(goal); }}
              >
                Deposit
              </button>
            </div>
          )}

          {/* Card Footer Micro-Actions */}
          <div className={sStyles.cardFooterRow}>
            <div className={sStyles.microActions}>
              <button
                type="button"
                className={sStyles.btnMini}
                onClick={() => openEditModal(goal)}
                title="Edit goal"
              >
                ✎ Edit
              </button>
              <button
                type="button"
                className={`${sStyles.btnMini} ${sStyles.btnMiniDanger}`}
                onClick={async () => {
                  playTick()
                  if (await confirmDeleteApp(goal.name)) {
                    await fsDel(user.uid, 'goals', goal._id)
                  }
                }}
                title="Delete goal"
              >
                🗑
              </button>
            </div>

            <span className={sStyles.cardSubStatus}>
              {isComplete ? '🎉 Target Achieved' : goal.date ? `Pace: ${formatDisplayDate(goal.date)}` : 'Self-paced'}
            </span>
          </div>
        </div>
      </SwipeableCard>
    )
  }

  const mainContent = (
    <div className={sStyles.wrap}>
      {/* 1. COMMAND BAR (When in tab hub) */}
      <div className={sStyles.commandBar}>
        <div className={sStyles.commandMetrics}>
          <div className={sStyles.commandMetricGroup}>
            <span className={sStyles.commandLabel}>Total Goals Funded</span>
            <div className={sStyles.commandValueRow}>
              <span className={sStyles.commandValue}>{money(totalSaved)}</span>
              <span className={sStyles.commandTargetSub}>of {money(totalTarget)} target</span>
              <span className={sStyles.overallPctBadge}>{overallPct}% Funded</span>
            </div>
          </div>

          <button
            type="button"
            className={sStyles.btnPrimary}
            onClick={openAddModal}
          >
            + Add Goal
          </button>
        </div>

        {/* Global Progress Track */}
        {goals.length > 0 && (
          <div className={sStyles.commandProgressTrack}>
            <div className={sStyles.trackBar}>
              <div
                className={sStyles.trackFill}
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <div className={sStyles.trackMetaRow}>
              <span>{completedGoals} of {goals.length} goals completed</span>
              <span>{money(totalRemaining)} remaining gap</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. GOALS GRID */}
      {!goals.length ? (
        <div className={sStyles.emptyCard}>
          <div className={sStyles.emptyIcon}>🎯</div>
          <div className={sStyles.emptyTitle}>No savings goals yet</div>
          <div className={sStyles.emptyBody}>
            Create concrete targets like Emergency Fund, Travel, Gadgets, or Tuition to track your financial growth.
          </div>
          <button type="button" className={sStyles.btnPrimary} onClick={openAddModal} style={{ marginTop: 8 }}>
            + Create First Goal
          </button>
        </div>
      ) : (
        <div className={sStyles.goalsGrid}>
          {goals.map(renderGoalCard)}
        </div>
      )}

      {/* 3. PORTALED ADD / EDIT GOAL MODAL */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div className={sStyles.modalOverlay} onClick={closeModal}>
          <div className={sStyles.modalCard} onClick={e => e.stopPropagation()}>
            <div className={sStyles.modalHeader}>
              <div>
                <div className={sStyles.modalEyebrow}>{editGoal ? 'Editing Goal' : 'New Savings Target'}</div>
                <div className={sStyles.modalTitle}>{editGoal ? `Update ${editGoal.name}` : 'Set a New Goal'}</div>
              </div>
              <button type="button" className={sStyles.modalClose} onClick={closeModal}>✕</button>
            </div>

            <form onSubmit={handleSaveGoal} className={sStyles.modalBody}>
              <div className={sStyles.field}>
                <label className={sStyles.fieldLabel} htmlFor="goal-name">Goal Name</label>
                <input
                  id="goal-name"
                  className={sStyles.fieldInput}
                  placeholder="e.g. Emergency Fund, New Laptop, Japan Trip"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  autoFocus
                />
              </div>

              <div className={sStyles.formRowTwoCol}>
                <div className={sStyles.field}>
                  <label className={sStyles.fieldLabel} htmlFor="goal-target">Target Amount ({s})</label>
                  <input
                    id="goal-target"
                    type="number"
                    min="0"
                    step="any"
                    className={sStyles.fieldInputBig}
                    placeholder="0.00"
                    value={form.target}
                    onChange={e => set('target', e.target.value)}
                  />
                </div>

                <div className={sStyles.field}>
                  <label className={sStyles.fieldLabel} htmlFor="goal-current">Current Saved ({s})</label>
                  <input
                    id="goal-current"
                    type="number"
                    min="0"
                    step="any"
                    className={sStyles.fieldInputBig}
                    placeholder="0.00"
                    value={form.current}
                    onChange={e => set('current', e.target.value)}
                  />
                </div>
              </div>

              <div className={sStyles.formRowTwoCol}>
                <div className={sStyles.field}>
                  <label className={sStyles.fieldLabel} htmlFor="goal-date">Target Date (Optional)</label>
                  <input
                    id="goal-date"
                    type="date"
                    className={sStyles.fieldInput}
                    value={form.date}
                    onChange={e => set('date', e.target.value)}
                  />
                </div>

                <div className={sStyles.field}>
                  <label className={sStyles.fieldLabel} htmlFor="goal-account">Link to Account (Optional)</label>
                  <select
                    id="goal-account"
                    className={sStyles.fieldInput}
                    value={form.accountId}
                    onChange={e => set('accountId', e.target.value)}
                  >
                    <option value="">Virtual tracking (No account link)</option>
                    {bankAccounts.map(acc => (
                      <option key={acc._id} value={acc._id}>
                        {acc.name} ({fmt(acc.balance, s)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={sStyles.modalActions}>
                <button type="button" className={sStyles.btnSecondary} onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className={sStyles.btnPrimary}>
                  {editGoal ? 'Save Changes' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )

  return hideHeader ? mainContent : <div className={styles.page}>{mainContent}</div>
}
