import { Component, useEffect, useMemo, useRef, useState } from 'react'
import { parseTakdaCommand, TAKDA_COMMAND_EXAMPLES } from '../lib/commandParser'
import styles from './AskTakdaCommand.module.css'

const ACTION_LABELS = {
  add_expense: 'Add expense',
  add_income: 'Add income',
  add_bill: 'Create bill',
  mark_bill_paid: 'Mark bill paid',
  transfer_account: 'Transfer',
  edit_account_balance: 'Set balance',
  add_savings_contribution: 'Savings contribution',
  set_budget: 'Set budget',
  add_calendar_event: 'Calendar reminder',
  open_receipt_scanner: 'Open receipts',
  add_receipt_expense: 'Receipt expense',
  query: 'Quick answer',
  clarify: 'Needs detail',
}

const RISK_LABELS = {
  low: 'Low risk',
  medium: 'Review first',
  high: 'High impact',
}

function formatMoney(value, symbol = '₱', privacyMode = false) {
  if (value == null) return ''
  if (privacyMode) return `${symbol}••••`
  return `${symbol}${Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
}

function formatDate(value = '') {
  if (!value) return ''
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getPreviewRows(parsed = {}, symbol = '₱', privacyMode = false) {
  const data = parsed?.data || {}
  const rows = []

  if (data.amount != null) rows.push(['Amount', formatMoney(data.amount, symbol, privacyMode)])
  if (data.category) rows.push(['Category', data.subcategory ? `${data.category} / ${data.subcategory}` : data.category])
  if (data.description) rows.push(['Details', data.description])
  if (data.date) rows.push(['Date', formatDate(data.date)])
  if (data.account) rows.push(['Account', data.account])
  if (data.fromAccount || data.toAccount) rows.push(['Transfer', `${data.fromAccount || 'From account'} → ${data.toAccount || 'To account'}`])
  if (data.billName) rows.push(['Bill', data.billName])
  if (data.dueDay) rows.push(['Due day', `Every ${data.dueDay}`])
  if (data.goalName) rows.push(['Goal', data.goalName])
  if (data.budgetCategory) rows.push(['Budget', data.budgetCategory])
  if (data.period) rows.push(['Period', String(data.period).replace(/_/g, ' ')])
  if (data.queryType) rows.push(['Query', String(data.queryType).replace(/_/g, ' ')])

  return rows
}

function getStatus(parsed) {
  if (!parsed) return 'idle'
  if (parsed.action === 'clarify') return 'clarify'
  if (parsed.requiresConfirmation) return 'preview'
  return 'ready'
}

class AskTakdaErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.open && this.props.open && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (!this.props.open) return null
    if (!this.state.hasError) return this.props.children

    return (
      <div className={styles.layer} role="presentation">
        <div className={styles.backdrop} onClick={this.props.onClose} aria-hidden="true" />
        <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="ask-takda-error-title">
          <div className={styles.handle} aria-hidden="true" />
          <div className={styles.header}>
            <div>
              <div className={styles.eyebrow}>Smart command</div>
              <h2 className={styles.title} id="ask-takda-error-title">Ask Takda</h2>
              <p className={styles.subtitle}>The command sheet hit a display issue. Close it and try again.</p>
            </div>
            <button type="button" className={styles.closeBtn} onClick={this.props.onClose} aria-label="Close Ask Takda">x</button>
          </div>
        </section>
      </div>
    )
  }
}

export default function AskTakdaCommand(props) {
  return (
    <AskTakdaErrorBoundary open={props.open} onClose={props.onClose}>
      <AskTakdaCommandInner {...props} />
    </AskTakdaErrorBoundary>
  )
}

function AskTakdaCommandInner({
  open,
  onClose,
  user,
  data,
  profile = {},
  symbol = '₱',
  privacyMode = false,
  onOpenReceiptScanner,
  onNavigate,
}) {
  const inputRef = useRef(null)
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [executing, setExecuting] = useState(false)

  const context = useMemo(() => ({
    user,
    data,
    profile,
    symbol,
    privacyMode,
    currency: profile.currency || 'PHP',
    accounts: data?.accounts || [],
    bills: data?.bills || [],
    goals: data?.goals || [],
    budgets: data?.budgets || [],
    defaultAccountName: data?.accounts?.[0]?.name || '',
    defaultAccountId: data?.accounts?.[0]?._id || '',
  }), [data, privacyMode, profile, symbol, user])

  useEffect(() => {
    if (!open) return
    setStatus('idle')
    setParsed(null)
    setMessage('')
    setExecuting(false)
    window.setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        if (parsed?.requiresConfirmation && !executing) handleConfirm()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [executing, onClose, open, parsed])

  if (!open) return null

  function resetForNewInput(value = '') {
    setInput(value)
    setParsed(null)
    setStatus('idle')
    setMessage('')
  }

  async function runParsed(nextParsed) {
    setExecuting(true)
    setStatus('executing')
    setMessage(nextParsed.responseMessage || '')
    try {
      const { executeTakdaCommand } = await import('../lib/commandExecutor')
      const result = await executeTakdaCommand(nextParsed, context)
      if (result.openReceiptScanner) {
        onOpenReceiptScanner?.()
        setExecuting(false)
        return
      }
      if (result.page) onNavigate?.(result.page)
      setMessage(result.message || 'Done.')
      setStatus('success')
    } catch (error) {
      setMessage(error?.message || 'Takda could not complete that command.')
      setStatus('error')
    } finally {
      setExecuting(false)
    }
  }

  function handleParse() {
    const nextParsed = parseTakdaCommand(input, context)
    const nextStatus = getStatus(nextParsed)
    setParsed(nextParsed)
    setStatus(nextStatus)
    setMessage(nextParsed.responseMessage || '')

    if (nextParsed.action !== 'clarify' && !nextParsed.requiresConfirmation) {
      runParsed(nextParsed)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!input.trim()) return
    if (parsed?.requiresConfirmation && status === 'preview') {
      handleConfirm()
      return
    }
    handleParse()
  }

  function handleConfirm() {
    if (!parsed) return
    runParsed(parsed)
  }

  const previewRows = getPreviewRows(parsed, symbol, privacyMode)
  const actionLabel = parsed ? ACTION_LABELS[parsed.action] || parsed.action : 'Ask Takda'
  const riskLabel = parsed ? RISK_LABELS[parsed.riskLevel] || parsed.riskLevel : ''
  const canConfirm = parsed?.requiresConfirmation && status === 'preview' && !executing

  return (
    <div className={styles.layer} role="presentation">
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="ask-takda-title">
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Smart command</div>
            <h2 className={styles.title} id="ask-takda-title">Ask Takda</h2>
            <p className={styles.subtitle}>Type a money command. Takda will preview it before anything changes.</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close Ask Takda">x</button>
        </div>

        <form className={styles.commandForm} onSubmit={handleSubmit}>
          <label className={styles.inputLabel} htmlFor="ask-takda-input">Command</label>
          <div className={styles.inputWrap}>
            <span className={styles.inputIcon} aria-hidden="true">AI</span>
            <input
              ref={inputRef}
              id="ask-takda-input"
              className={styles.input}
              value={input}
              onChange={event => resetForNewInput(event.target.value)}
              placeholder="e.g. paid electricity from Cash"
              autoComplete="off"
            />
            <button type="submit" className={styles.parseBtn} disabled={!input.trim() || executing}>
              {canConfirm ? 'Confirm' : 'Parse'}
            </button>
          </div>
        </form>

        {!parsed && (
          <div className={styles.examples}>
            <div className={styles.examplesLabel}>Try one</div>
            <div className={styles.exampleGrid}>
              {TAKDA_COMMAND_EXAMPLES.slice(0, 6).map(example => (
                <button
                  key={example}
                  type="button"
                  className={styles.exampleChip}
                  onClick={() => resetForNewInput(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {parsed && (
          <div className={`${styles.resultCard} ${styles[`status${status.charAt(0).toUpperCase()}${status.slice(1)}`] || ''}`}>
            <div className={styles.resultTop}>
              <div>
                <div className={styles.resultLabel}>{actionLabel}</div>
                <div className={styles.resultMessage}>{message || parsed.responseMessage}</div>
              </div>
              <div className={styles.badges}>
                <span className={styles.badge}>{Math.round((parsed.confidence || 0) * 100)}%</span>
                {riskLabel && <span className={`${styles.badge} ${styles[`risk${parsed.riskLevel}`] || ''}`}>{riskLabel}</span>}
              </div>
            </div>

            {previewRows.length > 0 && (
              <div className={styles.previewRows}>
                {previewRows.map(([label, value]) => (
                  <div key={`${label}-${value}`} className={styles.previewRow}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            )}

            {parsed.missing?.length > 0 && (
              <div className={styles.missingRow}>
                Needed: {parsed.missing.join(', ')}
              </div>
            )}
          </div>
        )}

        <div className={styles.actions}>
          {status === 'success' ? (
            <button type="button" className={styles.secondaryBtn} onClick={() => resetForNewInput('')}>
              New command
            </button>
          ) : (
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>
              Cancel
            </button>
          )}
          {status === 'error' && (
            <button type="button" className={styles.secondaryBtn} onClick={handleParse} disabled={!input.trim() || executing}>
              Try again
            </button>
          )}
          {canConfirm && (
            <button type="button" className={styles.primaryBtn} onClick={handleConfirm} disabled={executing}>
              Confirm action
            </button>
          )}
          {status === 'clarify' && (
            <button type="button" className={styles.primaryBtn} onClick={() => inputRef.current?.focus()}>
              Add detail
            </button>
          )}
          {status === 'executing' && (
            <button type="button" className={styles.primaryBtn} disabled>
              Working...
            </button>
          )}
        </div>

        <div className={styles.footerNote}>
          Works offline for common commands. No AI service is required in this version.
        </div>
      </section>
    </div>
  )
}
