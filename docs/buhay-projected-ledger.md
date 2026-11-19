# Buhay Projected Ledger Contract

`src/lib/projectedLedger.js` is the phase 2 read-only ledger adapter.

## Entry statuses

- `actual`: a saved transaction that is not marked unpaid.
- `unpaid`: a saved transaction explicitly marked unpaid. It has zero balance impact.
- `projected`: a virtual recurring, scheduled, or bill occurrence.

## Occurrence identities

- Recurring and schedule entries use `schedule:<sourceId>:<occurrenceDate>`.
- Bills use `bill:<billId>:<billPeriodKey>`.
- Existing records are matched using `billId` and `billPeriodKey`, or recurrence source and occurrence date.

## Read-only API

```js
getProjectedLedger({
  data,
  startDate,
  endDate,
  anchorDate,
  startingBalance,
})
```

The result contains:

- `entries`: deduplicated actual, unpaid, and projected items.
- `daily`: opening balance, projected balance, cashflow, and items per date.
- `summary`: counts and opening/closing balances.

For a month-shaped range, use:

```js
getProjectedLedgerForMonth(data, year, month, options)
```

## Rollout rule

This module is intentionally not connected to Calendar or other pages in phase 2. The next phase should compare its output against the current Calendar forecast before replacing any existing calculation.

