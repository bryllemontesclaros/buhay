# Buhay Balance QA Checklist (Phase 6)

Use this checklist after any change that touches:
- Paid/Unpaid
- Account linking
- Calendar editing
- Balance overrides
- Transfers

## Core Truths

1. Unpaid transactions do not affect:
   - Takda Total Balance (now)
   - Calendar closing balances
   - Month totals / insights

2. Linked + Paid transactions affect account balances:
   - immediately when `date <= today`
   - later when `date > today` (they should show as "Applies on date")

3. Manual day balance overrides:
   - change the calendar "closing balance anchor"
   - do not edit any individual account balance
   - should be visible/auditable

## Test Scenarios

### A) Paid/Unpaid Toggle
- Create an expense today with an account selected.
- Verify it shows: `In account` (or `Due to sync` briefly) and reduces Total Balance.
- Toggle to Unpaid:
  - badge becomes `No balance impact`
  - Total Balance returns to prior value
  - month totals exclude it
- Toggle back to Paid:
  - badge returns to `In account`
  - Total Balance changes again

### B) Future-Dated Linked Transaction
- Create an expense with date = tomorrow and an account selected.
- Verify badge shows `Applies on date` and Total Balance does not change today.
- Change date to today:
  - badge becomes `In account` (or `Due to sync`)
  - Total Balance changes immediately

### C) Ledger-Only Transaction
- Create an expense with no account selected.
- Verify badge shows `Ledger only` and Total Balance does not change.
- Verify calendar closing balance changes (paid entries affect closing balance).

### D) Manual Closing Balance Override
- Open a day and set a manual closing balance.
- Verify:
  - day shows "Pinned closing balance"
  - meta mentions global anchor (not per-account)
  - `balanceOverrideLog` receives a new entry
- Reset to auto:
  - pinned label disappears
  - `balanceOverrideLog` receives a clear entry

### E) Transfers
- Transfer between two accounts.
- Verify:
  - From account decreases, To account increases
  - Takda Total Balance stays the same (unless credit card rules invert expectations)

### F) Credit Cards
- Add a credit card account balance.
- Verify total balance treats it as negative liability.
- Add a paid expense linked to credit card:
  - should move the liability correctly (direction depends on model; verify it matches UI expectations)

## Mobile / Desktop Sanity
- iOS Safari: no crashes during page switches or opening modals/sheets.
- All sheets can be dismissed:
  - Close button works
  - Backdrop click works
  - ESC closes on desktop

