import { useMemo, useState } from 'react'
import { fsCompleteOnboarding } from '../lib/firestore'
import { notifyApp } from '../lib/appFeedback'
import { CURRENCIES, RECUR_OPTIONS, fmt } from '../lib/utils'
import styles from './Onboarding.module.css'
import BrandLogo from '../components/BrandLogo'

const STEPS = ['currency', 'accounts', 'bills', 'review']
const STEP_DETAILS = {
  currency: { label: 'Currency', desc: 'Choose your default currency' },
  accounts: { label: 'Accounts', desc: 'Starting balances across cash & banks' },
  bills: { label: 'Bills & Income', desc: 'Recurring income and monthly commitments' },
  review: { label: 'Cockpit Review', desc: 'Verify your baseline & launch' },
}

const ACCOUNT_PRESETS = [
  { name: 'Physical Cash', type: 'Cash', color: '#22d87a', icon: '💵' },
  { name: 'GCash / Maya', type: 'E-wallet', color: '#007dfc', icon: '📱' },
  { name: 'Primary Bank (BDO/BPI)', type: 'Bank', color: '#6eb5ff', icon: '🏦' },
  { name: 'High-Yield Savings', type: 'Bank', color: '#b48eff', icon: '💰' },
  { name: 'Crypto Holdings', type: 'Investment', color: '#ffb347', icon: '₿' },
  { name: 'Credit Card', type: 'Credit Card', color: '#ff5370', icon: '💳' },
]

const BILL_PRESETS = [
  { desc: 'Monthly Salary', type: 'income', cat: 'Salary', amount: 35000, due: 15, recur: 'monthly' },
  { desc: 'Rent / Housing', type: 'expense', cat: 'Housing', amount: 12000, due: 1, recur: 'monthly' },
  { desc: 'Electricity (Meralco)', type: 'expense', cat: 'Utilities', amount: 3500, due: 18, recur: 'monthly' },
  { desc: 'Internet / Wi-Fi', type: 'expense', cat: 'Utilities', amount: 1899, due: 20, recur: 'monthly' },
  { desc: 'Water Utility', type: 'expense', cat: 'Utilities', amount: 450, due: 22, recur: 'monthly' },
  { desc: 'Netflix & Spotify', type: 'expense', cat: 'Subscriptions', amount: 798, due: 10, recur: 'monthly' },
]

function createDefaultAccount(id, name, type, color, balance = '') {
  return { id, name, type, color, balance }
}

export default function Onboarding({ user, onComplete }) {
  const [step, setStep] = useState(0)
  const [currency, setCurrency] = useState('PHP')
  const [accounts, setAccounts] = useState([
    createDefaultAccount('acc-1', 'Cash & E-Wallets', 'Cash', '#22d87a', '5000'),
    createDefaultAccount('acc-2', 'Main Checking Account', 'Bank', '#6eb5ff', '25000'),
  ])
  const [bills, setBills] = useState([
    { id: 'bill-1', desc: 'Rent / Housing', amount: '12000', due: '1', recur: 'monthly', type: 'expense', cat: 'Housing' },
    { id: 'bill-2', desc: 'Electricity & Internet', amount: '4500', due: '18', recur: 'monthly', type: 'expense', cat: 'Utilities' },
  ])
  const [saving, setSaving] = useState(false)

  const curr = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0]
  const symbol = curr.symbol

  const totalStartingBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0)
  }, [accounts])

  const totalMonthlyBills = useMemo(() => {
    return bills
      .filter(b => b.type === 'expense')
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
  }, [bills])

  const currentStepKey = STEPS[step]

  function addAccount(preset) {
    const newId = `acc-${Date.now()}`
    setAccounts(currAccs => [
      ...currAccs,
      createDefaultAccount(newId, preset.name, preset.type, preset.color, ''),
    ])
  }

  function removeAccount(id) {
    setAccounts(currAccs => currAccs.filter(acc => acc.id !== id))
  }

  function updateAccount(id, field, value) {
    setAccounts(currAccs =>
      currAccs.map(acc => (acc.id === id ? { ...acc, [field]: value } : acc))
    )
  }

  function addBill(preset) {
    const newId = `bill-${Date.now()}`
    setBills(currBills => [
      ...currBills,
      {
        id: newId,
        desc: preset.desc,
        amount: String(preset.amount || ''),
        due: String(preset.due || '1'),
        recur: preset.recur || 'monthly',
        type: preset.type || 'expense',
        cat: preset.cat || 'General',
      },
    ])
  }

  function removeBill(id) {
    setBills(currBills => currBills.filter(b => b.id !== id))
  }

  function updateBill(id, field, value) {
    setBills(currBills =>
      currBills.map(b => (b.id === id ? { ...b, [field]: value } : b))
    )
  }

  async function handleFinish() {
    if (saving) return
    setSaving(true)

    try {
      const formattedAccounts = accounts
        .filter(acc => acc.name.trim())
        .map(acc => ({
          _id: acc.id,
          name: acc.name.trim(),
          type: acc.type,
          color: acc.color,
          balance: Number(acc.balance) || 0,
        }))

      const formattedBills = bills
        .filter(b => b.desc.trim() && Number(b.amount) > 0)
        .map(b => ({
          _id: b.id,
          desc: b.desc.trim(),
          amount: Number(b.amount) || 0,
          due: Number(b.due) || 1,
          recur: b.recur || 'monthly',
          type: b.type || 'expense',
          cat: b.cat || 'General',
        }))

      const payload = {
        profile: {
          currency,
          displayName: user?.displayName || '',
          email: user?.email || '',
          onboardedAt: Date.now(),
        },
        accounts: formattedAccounts,
        bills: formattedBills,
      }

      await fsCompleteOnboarding(user.uid, payload)
      notifyApp('Financial cockpit initialized!', { type: 'success' })
      if (onComplete) onComplete()
    } catch (err) {
      notifyApp('Failed to initialize setup. Please try again.', { type: 'error' })
      setSaving(false)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.shell}>
        <aside className={styles.sideRail}>
          <div className={styles.brandBlock}>
            <BrandLogo to="/" />
            <div className={styles.kicker} style={{ marginTop: '12px' }}>Bawat araw, mas malinaw.</div>
            <h2 className={styles.sideTitle}>Set your baseline in under 60 seconds.</h2>
            <p className={styles.sideSub}>
              Zero bank passwords required. You control every balance, bill, and forecast projection.
            </p>
          </div>

          <div className={styles.progressCard}>
            <div className={styles.progressHeader}>Setup Steps</div>
            <div className={styles.stepList}>
              {STEPS.map((sKey, idx) => {
                const sDetail = STEP_DETAILS[sKey]
                const isCurrent = idx === step
                const isDone = idx < step
                return (
                  <div
                    key={sKey}
                    className={`${styles.stepItem} ${isCurrent ? styles.stepItemActive : ''} ${isDone ? styles.stepItemDone : ''}`}
                  >
                    <div className={styles.stepBadge}>{isDone ? '✓' : idx + 1}</div>
                    <div className={styles.stepInfo}>
                      <div className={styles.stepLabel}>{sDetail.label}</div>
                      <div className={styles.stepDesc}>{sDetail.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>

        <main className={styles.card}>
          {currentStepKey === 'currency' && (
            <div className={styles.stepWrap}>
              <div className={styles.kicker}>Step 1 of 4</div>
              <h1 className={styles.stepTitle}>Choose your default currency</h1>
              <p className={styles.stepSub}>This sets the symbol and format for your cashflow calendar, balances, and reports.</p>

              <div className={styles.currencyGrid}>
                {CURRENCIES.map(c => {
                  const isSelected = c.code === currency
                  return (
                    <button
                      key={c.code}
                      type="button"
                      className={`${styles.currencyBtn} ${isSelected ? styles.currencyBtnActive : ''}`}
                      onClick={() => setCurrency(c.code)}
                    >
                      <span className={styles.currencySymbol}>{c.symbol}</span>
                      <strong className={styles.currencyCode}>{c.code}</strong>
                      <span className={styles.currencyName}>{c.name}</span>
                    </button>
                  )
                })}
              </div>

              <div className={styles.actionBar}>
                <div />
                <button type="button" className={styles.btnNext} onClick={() => setStep(1)}>
                  Next: Starting Accounts →
                </button>
              </div>
            </div>
          )}

          {currentStepKey === 'accounts' && (
            <div className={styles.stepWrap}>
              <div className={styles.kicker}>Step 2 of 4</div>
              <h1 className={styles.stepTitle}>Add your starting accounts</h1>
              <p className={styles.stepSub}>Enter the opening balances you want to track. These establish your day 1 net worth and starting cash runway.</p>

              <div className={styles.presetChipWrap}>
                <span className={styles.presetLabel}>Quick Add:</span>
                {ACCOUNT_PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    className={styles.presetChip}
                    onClick={() => addAccount(preset)}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>

              <div className={styles.accountStack}>
                {accounts.map(acc => (
                  <div key={acc.id} className={styles.accountRowCard}>
                    <div className={styles.accountRowMain}>
                      <input
                        type="text"
                        className={styles.inputName}
                        placeholder="Account name"
                        value={acc.name}
                        onChange={e => updateAccount(acc.id, 'name', e.target.value)}
                      />
                      <div className={styles.balanceInputWrap}>
                        <span className={styles.currencyPrefix}>{symbol}</span>
                        <input
                          type="number"
                          className={styles.inputBalance}
                          placeholder="0.00"
                          value={acc.balance}
                          onChange={e => updateAccount(acc.id, 'balance', e.target.value)}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.removeRowBtn}
                      onClick={() => removeAccount(acc.id)}
                      title="Remove account"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className={styles.insightCard}>
                <div className={styles.insightLabel}>Total Starting Balance</div>
                <div className={styles.insightValue}>{fmt(totalStartingBalance, symbol)}</div>
                <div className={styles.insightSub}>Your starting liquidity across {accounts.length} account{accounts.length === 1 ? '' : 's'}.</div>
              </div>

              <div className={styles.actionBar}>
                <button type="button" className={styles.btnSkip} onClick={() => setStep(0)}>← Back</button>
                <button type="button" className={styles.btnNext} onClick={() => setStep(2)}>
                  Next: Recurring Bills →
                </button>
              </div>
            </div>
          )}

          {currentStepKey === 'bills' && (
            <div className={styles.stepWrap}>
              <div className={styles.kicker}>Step 3 of 4</div>
              <h1 className={styles.stepTitle}>Add recurring bills & commitments</h1>
              <p className={styles.stepSub}>Your calendar automatically forecasts safe daily spend and alerts you before these bills land.</p>

              <div className={styles.presetChipWrap}>
                <span className={styles.presetLabel}>Quick Add:</span>
                {BILL_PRESETS.map(preset => (
                  <button
                    key={preset.desc}
                    type="button"
                    className={styles.presetChip}
                    onClick={() => addBill(preset)}
                  >
                    <span>{preset.desc}</span>
                    <span className={styles.presetAmount}>{symbol}{preset.amount.toLocaleString()}</span>
                  </button>
                ))}
              </div>

              <div className={styles.accountStack}>
                {bills.map(bill => (
                  <div key={bill.id} className={styles.accountRowCard}>
                    <div className={styles.accountRowMain}>
                      <input
                        type="text"
                        className={styles.inputName}
                        placeholder="Bill description (e.g. Meralco)"
                        value={bill.desc}
                        onChange={e => updateBill(bill.id, 'desc', e.target.value)}
                      />
                      <div className={styles.billDueWrap}>
                        <span>Due Day:</span>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          className={styles.inputDue}
                          value={bill.due}
                          onChange={e => updateBill(bill.id, 'due', e.target.value)}
                        />
                      </div>
                      <div className={styles.balanceInputWrap}>
                        <span className={styles.currencyPrefix}>{symbol}</span>
                        <input
                          type="number"
                          className={styles.inputBalance}
                          placeholder="0.00"
                          value={bill.amount}
                          onChange={e => updateBill(bill.id, 'amount', e.target.value)}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.removeRowBtn}
                      onClick={() => removeBill(bill.id)}
                      title="Remove bill"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className={styles.insightCard}>
                <div className={styles.insightLabel}>Estimated Monthly Fixed Outflows</div>
                <div className={styles.insightValue}>{fmt(totalMonthlyBills, symbol)} / mo</div>
                <div className={styles.insightSub}>Automatically mapped onto your 30-day cashflow runway.</div>
              </div>

              <div className={styles.actionBar}>
                <button type="button" className={styles.btnSkip} onClick={() => setStep(1)}>← Back</button>
                <button type="button" className={styles.btnNext} onClick={() => setStep(3)}>
                  Review Cockpit →
                </button>
              </div>
            </div>
          )}

          {currentStepKey === 'review' && (
            <div className={styles.stepWrap}>
              <div className={styles.kicker}>Step 4 of 4</div>
              <h1 className={styles.stepTitle}>Your Financial Baseline is Ready</h1>
              <p className={styles.stepSub}>Review your starting numbers. You can freely edit, add, or adjust any of these anytime inside the app.</p>

              <div className={styles.reviewGrid}>
                <div className={styles.reviewCard}>
                  <div className={styles.reviewLabel}>Default Currency</div>
                  <div className={styles.reviewValue}>{curr.code} ({curr.symbol})</div>
                  <div className={styles.reviewSub}>All reports formatted in {curr.name}</div>
                </div>

                <div className={styles.reviewCard}>
                  <div className={styles.reviewLabel}>Starting Liquidity</div>
                  <div className={styles.reviewValue}>{fmt(totalStartingBalance, symbol)}</div>
                  <div className={styles.reviewSub}>Across {accounts.length} active account{accounts.length === 1 ? '' : 's'}</div>
                </div>

                <div className={styles.reviewCard}>
                  <div className={styles.reviewLabel}>Monthly Fixed Commitments</div>
                  <div className={styles.reviewValue}>{fmt(totalMonthlyBills, symbol)} / mo</div>
                  <div className={styles.reviewSub}>{bills.length} recurring bill{bills.length === 1 ? '' : 's'} mapped</div>
                </div>

                <div className={styles.reviewCard}>
                  <div className={styles.reviewLabel}>Initial Runway Buffer</div>
                  <div className={styles.reviewValue}>
                    {totalMonthlyBills > 0 ? `${(totalStartingBalance / totalMonthlyBills).toFixed(1)} Months` : 'Infinite'}
                  </div>
                  <div className={styles.reviewSub}>Based on starting liquid balance vs fixed burn</div>
                </div>
              </div>

              <div className={styles.finalLaunchBox}>
                <div className={styles.finalLaunchTitle}>🚀 Ready to take full control?</div>
                <p className={styles.finalLaunchText}>
                  Your 30-day cashflow calendar, envelope budget runway, and liquidity dashboard are ready to launch.
                </p>
                <button
                  type="button"
                  className={styles.btnFinish}
                  onClick={handleFinish}
                  disabled={saving}
                >
                  {saving ? 'Initializing Cockpit...' : 'Launch My Financial Cockpit →'}
                </button>
              </div>

              <div className={styles.actionBar}>
                <button type="button" className={styles.btnSkip} onClick={() => setStep(2)}>← Back</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
