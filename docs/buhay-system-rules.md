# Buhay System Rules

This document describes the finance-only behavior of Buhay.

## 1. Account Rules

- A user owns and controls their own finance records.
- Account balances represent actual current balances.
- Cash, bank, e-wallet, and savings accounts use positive available balances.
- Credit-card balances represent outstanding debt.
- Account adjustments are recorded and auditable.
- Transfers change two accounts but are not income or expenses.

## 2. Transaction Rules

- A posted transaction is an actual recorded event.
- A projected schedule is a forecast-only event.
- A future schedule never changes the current actual balance.
- An expense decreases the applicable account when posted.
- Income increases the applicable account when posted.
- A transaction without an account can remain ledger-only.

## 3. Recurring Rules

- Every active schedule creates virtual future occurrences.
- A schedule requires a name, amount, type, frequency, and start date.
- A schedule may have an account, end date, and active/paused status.
- Supported frequencies include daily, weekly, biweekly, monthly, quarterly, and yearly.
- Bills are expense schedules with due-date metadata.
- One schedule and one date produce one occurrence.

## 4. Payment Rules

- A scheduled occurrence is included in future projections automatically.
- Recording payment creates one posted expense transaction.
- The posted transaction links to the source schedule and occurrence key.
- The projected occurrence is then replaced by the actual transaction.
- Repeating the payment action is safe and must not create another expense.

## 5. Balance Rules

```text
Actual balance = recorded income - recorded expenses + account adjustments
Projected balance = actual balance + future scheduled items
```

For future dates, the calendar displays projected balance. For past dates, it displays actual balance. Today may include valid same-day scheduled items in the projection.

## 6. UI Rules

The UI must identify each item as:

- Actual
- Scheduled
- Projected
- Paid
- Unpaid

The UI must not show the same scheduled bill in both a bill section and a recurring-expense section.

The UI must not require a payment action to calculate future balances.

## 7. Data Safety Rules

- Do not delete existing financial records during feature changes.
- Preserve legacy fields while adapters are in use.
- Use deterministic occurrence keys for idempotent writes.
- Reverse account effects when actual transactions are edited or deleted.
- Keep authentication and owner-scoped database rules intact.
