# Buhay Balance System Spec (Task 1)

This document defines the balance rules for Buhay so every screen can answer:

- What balance is being shown?
- What data changes it?
- When should it update?
- What is the source of truth?

## Balance Types (Canonical)

### 1) Current Balance (Now)
Definition: Sum of account balances right now.

Source of truth:
- `accounts[].balance` (Firestore: `users/{uid}/accounts`)

Rules:
- Credit cards are treated as negative (liability).
- Unlinked transactions do not change this balance.
- Linked transactions change this balance when they are both:
  - `paymentStatus = paid`
  - `date <= today`
  - and the transaction has been applied (`accountBalanceApplied = true`)

Used by:
- "Total balance" style numbers that represent *right now*, not a historical date.

### 2) Balance As Of Date (Historical)
Definition: Balance for a specific date (e.g. month start, a calendar day).

Sources of truth:
- Accounts (current state)
- Paid ledger entries (income + expenses)
- Optional balance overrides (anchors)

Rules:
- Only paid transactions count.
- Uses signed ledger math (income adds, expense subtracts).
- Can be anchored by `dailyBalanceOverrides` (preferred) or `monthStartBalances` (legacy).

Used by:
- Calendar day totals / month views
- "Balance on that day" displays

### 3) Projected Balance (Future / Forecast)
Definition: Balance as-of a future date, including scheduled/projected entries.

Sources of truth:
- All sources from Balance As Of Date
- Projected recurrence entries (planned)

Rules:
- Paid transactions count immediately.
- Projected entries count when their projected dates occur.

Used by:
- Forecast pages / "end of month" projections

## Transaction State (User-Facing)

Every transaction should be explainable by these properties:

- `paymentStatus`: `paid` or `unpaid`
- `accountId`: which account it is attached to (optional)
- `accountBalanceLinked`: intent: "this transaction should affect an account"
- `accountBalanceApplied`: effect: "it already impacted account balance"
- `date`: when the transaction becomes eligible

Recommended user-visible state machine (labels can differ, the logic must match):

- Unpaid: never affects balances.
- Paid (future): paid but `date > today`, so not applied yet.
- Paid (due): paid + `date <= today` but not applied yet (should reconcile).
- Applied: paid + linked + applied (already reflected in account balance).

## System Invariants (Must Always Hold)

1. Unpaid transactions never affect:
   - current balance
   - historical balance
   - forecasts (unless explicitly included as projections)

2. A transaction cannot be "linked" without an account:
   - If `accountId` is empty, `accountBalanceLinked` must be false.

3. If a transaction is linked and becomes due:
   - it must either become applied automatically (background sync)
   - or the UI must show that it is "due / pending apply"

4. When editing:
   - changing `paymentStatus`, `date`, `amount`, or `accountId` can change balances.
   - the UI must clearly communicate which balance type is affected.

## Known Implementation Anchors (Code References)

- Firestore transaction writes and account adjustments:
  - [firestore.js](/Users/bryllemontesclaros/Documents/New%20project/takda_patch/src/lib/firestore.js)
    - `fsAddTransaction`, `fsUpdateTransaction`, `fsDeleteTransaction`
    - `fsSyncDueLinkedTransactions`

- Ledger math and balance-as-of calculations:
  - [finance.js](/Users/bryllemontesclaros/Documents/New%20project/takda_patch/src/lib/finance.js)
    - `isTransactionPaid`, `getCurrentBalance`
    - `getBalanceAtDateWithOverrides`, `getMonthForecast`

- Global loading / background reconciliation behavior:
  - [AppShell.jsx](/Users/bryllemontesclaros/Documents/New%20project/takda_patch/src/pages/AppShell.jsx)
    - Realtime listeners
    - `fsSyncDueLinkedTransactions` effect

## Open Decisions (Need Product Confirmation)

- Are balance overrides:
  - global "total balance anchors" (current model), or
  - per-account closing balances (more attributable)?

- Should forecasts include unpaid transactions as "planned" by default, or keep them excluded?

