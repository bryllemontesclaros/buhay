# Buhay Simplification Phase 1: Baseline and Safety Contract

Phase 1 freezes the current behavior before any screen is switched to the new projected ledger.

## Current product boundary

- Buhay is currently a finance-only app.
- The active primary workflow is Calendar, Accounts, Recurring, and History. Planning and optional analysis tools stay available from More.
- Buhay is a single finance product with no multi-space workspace model.
- Crypto remains optional and uses manual portfolio pricing.

## Current source collections

The existing app reads these Firestore collections or profile records:

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
- user profile settings

## Current balance contract

- Current account balances come from account records.
- Historical calculations use paid and applied ledger entries.
- Future calculations use recurring projections and projected bill expenses.
- Unpaid records do not affect actual account balances.
- Account-linked transactions are synchronized separately when their date is due.
- Existing records must not be deleted or rewritten as part of simplification.

## Known overlap to resolve later

- `recurrence.js` projects recurring income and expenses.
- `bills.js` creates virtual bills from bills, debts, credit cards, and recurring bill-shaped expenses.
- Calendar combines both systems.
- Breakdown, Debts, Budgets, and AppShell still calculate some totals independently.
- `autoRecurEngine.js` writes due recurring records, so it must not be changed until the new ledger is compared with its behavior.

## Safety gates

Before switching any screen:

1. The new ledger must be read-only.
2. Existing Firestore writes must remain unchanged.
3. Old and new totals must be compared for the same account and date range.
4. A mismatch must be visible in development logs or tests.
5. Each later phase must be a separate commit and deploy.
