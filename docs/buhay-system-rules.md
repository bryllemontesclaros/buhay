# Buhay System Rules

This is the plain-language source of truth for how Buhay behaves as an information system.

## 1. Platform Rules

- A Buhay account is one identity across Takda, Lakas, and Tala.
- Authentication, privacy controls, export, backup/restore, and deletion belong to the shared platform layer.
- Each space has different domain behavior, but they should feel like one product and follow the same save, edit, delete, and error-recovery patterns.

## 2. Domain Rules

### Takda

- Takda is a ledger-and-balance system, not just a list of transactions.
- The calendar shows a date-based closing balance, not only the sum of visible rows.
- Current balance, historical balance, and projected balance are different values and must stay clearly separated.
- Paid status controls whether a real transaction affects balances.
- Account linking controls where a paid transaction applies.
- Manual balance overrides are trusted anchors and take precedence over calculated day totals for that day.

### Lakas

- Lakas is a training-log system first.
- Sessions, sets, reps, and workout records are the primary truth, not motivational prompts.
- Guidance should help users start, but real logged workout data is the system of record.

### Tala

- Tala is a reflection-and-life-tracking system.
- Journal entries, check-ins, moods, tasks, and goals are separate record types even when they appear in one calm workflow.
- Tala records reflection data; it does not make medical or mental-health claims.

## 3. Recurrence Rules (Takda)

- A recurring rule creates projected cycles.
- A projected cycle is not yet a real transaction.
- A recurring cycle is identified by:
  - recurrence source
  - occurrence date
- Settling a recurring cycle creates a real entry linked back to the original recurrence via:
  - `recurrenceSourceId`
  - `recurrenceOccurrenceKey`
- A recurring cycle is settled if a non-projected transaction exists with the same source and occurrence key.
- A cycle can be settled on:
  - the due date
  - an earlier date
  - a later chosen date
- The actual payment/record date and the scheduled cycle date are allowed to differ.

## 4. Transaction State Rules (Takda)

- Unpaid transactions never affect balances.
- Paid transactions can affect balances if they are due and linked correctly.
- Linked transactions require an account.
- If an account is missing, the transaction may remain ledger-only/reference-only.
- Deleting a real recurring settlement may allow the forecast cycle to appear again.

Canonical lifecycle states:

- `forecast`
- `paid`
- `unpaid`

Canonical balance-impact states:

- `none`
- `in-account`
- `due-to-sync`
- `applies-on-date`
- `linked`
- `reference-only`
- `ledger-only`

## 5. UI Truthfulness Rules

- The UI should explain whether something is:
  - real
  - projected
  - paid
  - unpaid
  - linked
  - applied
- Labels should favor user meaning over internal wording.
  - Example: `Pay now` is clearer than `Log projected`
- If a screen summarizes balances, it should make clear whether unpaid or projected items are excluded.

## 6. Operational Rules

- Screenshots and marketing assets must be bundled or committed with the code they depend on.
- Shared domain logic should live in shared helpers, not be reimplemented in multiple page files.
- Domain rules should be documented whenever balance, recurrence, or account behavior changes.
