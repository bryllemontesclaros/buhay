# Buhay Architecture Map

This is the canonical system map for Buhay.

## Platform Layer

- Identity and auth
  - Email/password auth
  - Email verification
  - Password reset
- Trust and privacy
  - Privacy mode
  - Legal pages
  - Account deletion
- Data portability
  - Backup
  - Restore
  - Export
- Shell
  - Desktop sidebar
  - Mobile bottom nav
  - Shared header, overlays, and modals

## Domain Layer

### Takda (Money)

- Calendar / day balance engine
- Accounts
- History
- Bills
- Savings
- Budget
- Breakdown / reporting
- Receipts
- Portfolio
- Recurrence system

Primary records:
- income
- expenses
- accounts
- savings goals
- bills
- budgets
- receipts
- balance overrides
- holdings

### Lakas (Fitness)

- Workout cockpit
- Session logging
- Routines
- Body logs
- Meals / nutrition
- Progress and goals
- Habits / activity

Primary records:
- workouts
- workout sessions
- routines
- body logs
- meals
- habits
- goals

### Tala (Reflection)

- Journal
- Track
- Focus
- Mood / check-ins
- Tasks
- Goals
- Calendar / insights

Primary records:
- journal entries
- check-ins
- mood logs
- tasks
- goals

## Shared Services Layer

- Firebase auth
- Firestore persistence
- Storage media helpers
- Theme system
- Notifications / command surfaces
- Confirmation / feedback patterns
- Recurrence helpers
- Finance and balance helpers

## System Flow

1. User signs in once.
2. Shared shell loads the current space and records.
3. Domain logic computes the view state.
4. User actions create or mutate real records.
5. Shared services persist those changes.
6. Screens recompute summaries from the saved records.

## Takda Source Of Truth Map

- Current balance:
  - account balances now
- Historical day balance:
  - paid ledger entries
  - account anchors / overrides
- Forecast balance:
  - historical rules
  - projected recurring cycles

## Recurrence Responsibility Map

- `src/lib/recurrence.js`
  - recurring date generation
  - cycle keys
  - cycle-settlement checks
  - projection generation

- `src/pages/Calendar.jsx`
  - user actions for settling/projecting cycles
  - day-level recurrence UX

- `src/pages/History.jsx`
  - review/edit/delete of real recurring settlements

## Design Responsibility Map

- Landing page:
  - product explanation
  - trust framing
  - space overview

- App shell:
  - shared navigation
  - shared mobile/desktop rhythm
  - shared theme behavior

- Space pages:
  - domain-specific work
  - domain-specific actions
