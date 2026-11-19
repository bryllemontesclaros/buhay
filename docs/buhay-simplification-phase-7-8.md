# Buhay Simplification Phases 7-8

## Phase 7: Canonical Finance Navigation

- Recurring is the single destination for bills, recurring expenses, and recurring income.
- Legacy `bills` and `subscriptions` destinations remain supported as tab-preserving aliases.
- The planning shortcut now opens the same Recurring hub instead of mounting a second Bills screen.
- The embedded Bills view is bill-only; recurring expenses stay in the Recurring Expenses tab.
- The main Recurring page no longer receives an invalid page name as its selected tab.
- Old AppShell-only balance summaries were removed so shell status cannot drift from the shared projected ledger.
- Existing Firestore collections and write paths are unchanged.

## Phase 8: Regression and Release Gate

- Added a focused finance navigation regression suite.
- Existing projected-ledger regression coverage remains active.
- Production build and `git diff --check` are required before this phase is considered complete.
- Compatibility aliases and unknown destinations are tested without mounting the full Firebase shell.
