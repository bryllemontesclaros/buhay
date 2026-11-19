# Buhay Architecture Map

Buhay is a finance-only personal cashflow application. It has one product identity, one finance shell, and one shared projected ledger.

## Platform Layer

- Email/password authentication
- Email verification and password reset
- Owner-scoped Firestore access
- Privacy mode and light/dark theme
- CSV export and JSON backup/restore
- Account deletion and financial-data reset
- Desktop sidebar and mobile bottom navigation
- Responsive error recovery and offline-friendly transaction handling

## Product Areas

### Calendar

- Monthly date grid
- Actual and projected daily balances
- Selected-day detail panel
- Scheduled income, expenses, bills, transfers, and debt items
- Actual transaction recording and editing

### Accounts

- Cash, bank, e-wallet, savings, investment, and credit-card accounts
- Account reconciliation and adjustments
- Account-to-account transfers
- Current balance and net-worth summaries

### Recurring

- Recurring income
- Recurring expenses
- Bill schedules
- Active and paused schedules
- One occurrence identity per schedule and date

Bills are expense schedules with bill metadata. They are not a second independent transaction system.

### History

- Posted income, expenses, transfers, and adjustments
- Search, filtering, editing, and deletion
- Actual transaction review without mixing virtual projections into the ledger

### Optional Tools

- Budgets
- Savings goals
- Debt and credit-card payoff tracking
- Manual-price crypto portfolio
- Insights and reports

## Primary Records

- `income`
- `expenses`
- `transfers`
- `accounts`
- `bills`
- `debts`
- `budgets`
- `goals`
- `portfolioHoldings`
- `calendarEvents`
- `balanceOverrideLog`
- `profile/main`

Existing collections are preserved for compatibility. The application adapts them into one logical finance model in memory.

## Shared Ledger Flow

1. Load actual records and account balances.
2. Generate virtual occurrences from active recurring rules.
3. Generate virtual bill occurrences.
4. Generate scheduled transfers and optional debt projections.
5. Deduplicate by schedule and occurrence identity.
6. Calculate daily running balances.
7. Mark each item as actual, projected, unpaid, or settled.
8. Let every finance screen read the same result.

The shared implementation lives in `src/lib/projectedLedger.js`. It is read-only and never creates Firestore records during calculation.

## Occurrence Identity

Recurring items use:

```text
sourceScheduleId + occurrenceDate
```

Bill payments use:

```text
billId + billPeriodKey
```

When an occurrence is recorded, the actual transaction links back to that identity. This prevents duplicate rows and duplicate payments.

## Actual and Projected Rules

- Actual balances use posted transactions and completed transfers.
- Future schedules affect projected balances only.
- Recording a payment creates one actual transaction.
- Recording the same payment twice is idempotent.
- A future schedule never requires a payment action to affect the forecast.
- Future schedules do not reduce the current actual account balance.

## Responsibility Map

- `src/lib/projectedLedger.js`: shared actual/projected calculation
- `src/lib/recurrence.js`: recurring dates and occurrence keys
- `src/lib/bills.js`: bill periods and bill compatibility helpers
- `src/lib/ledgerAdapter.js`: legacy Firestore data adaptation
- `src/pages/Calendar.jsx`: daily forecast and selected-day actions
- `src/pages/Recurring.jsx`: schedule management
- `src/pages/History.jsx`: actual transaction review
- `src/pages/Accounts.jsx`: account balances and reconciliation
