# Buhay

> Bawat araw, mas malinaw. Every day, clearer.

Buhay is a personal finance tracker for everyday money clarity. It is the current home of Takda: a React + Firebase app for tracking balances, income, expenses, bills, budgets, savings, debts, cashflow, and crypto holdings in one installable web app.

## What Buhay Includes Today

- Calendar-first finance tracking with daily balances and selected-day details.
- Accounts for cash, bank, e-wallet, credit card, investment, and other balances.
- Income and expense logging with categories, subcategories, notes, account links, recurrence, and quick add flows.
- Recurring bills, subscriptions, due/overdue states, and mark-paid flows that can create real expense records.
- Monthly budgets with pacing, category limits, warnings, and recent outflow review.
- Savings goals with targets, contributions, progress, and summary views.
- Debt tracking for credit cards, loans, payment targets, and payoff planning.
- History and insights for search, review, editing, spending breakdowns, reports, and month comparisons.
- Crypto portfolio tracking with holdings, manual price context, fiat-to-crypto and crypto-to-fiat transfer flows.
- Privacy mode, light/dark theme, guided onboarding, app feedback, and responsive desktop/mobile navigation.

## App Areas

- **Calendar**: day-by-day money view, daily closing balances, projected recurring items, and quick finance actions.
- **Accounts**: account balances, transfers, debts, and crypto holdings.
- **Recurring**: recurring income, bills, subscriptions, and scheduled money movement.
- **Budgets**: monthly budget status, category limits, and budget pacing.
- **Insights**: history, breakdowns, financial statements, trends, and reports.
- **Settings**: profile, currency, notifications, privacy mode, account security, data export/import, legal links, feedback, and account deletion.

## Privacy And Safety

- Per-user Firestore records live under `users/{uid}`.
- Firestore rules restrict user data to the authenticated owner.
- Privacy mode masks sensitive money values on screen, but Firebase Auth, Firestore rules, Storage rules, and App Check are the real access controls.
- JSON backup/restore and CSV export are available for finance data portability.
- Account deletion and data reset controls are available in Settings.
- Legal pages explain privacy, terms, third-party services, import behavior, and product limits.

## Tech Stack

- Frontend: React + Vite
- Auth: Firebase Authentication, Email/Password
- Database: Firestore, real-time per-user collections
- Storage: Firebase Storage, kept for compatibility with existing project configuration
- Hosting: Vercel
- PWA: Installable web app with service worker caching

## System Docs

- [Buhay system rules](docs/buhay-system-rules.md)
- [Buhay architecture map](docs/buhay-architecture-map.md)
- [Buhay balance system spec](docs/buhay-balance-system-spec.md)
- [Buhay balance QA checklist](docs/buhay-balance-qa-checklist.md)

Some older docs may still mention removed Lakas or Tala modules. The active app code is currently finance-focused.

## Getting Started

```bash
git clone <your-buhay-repo-url>
cd <your-buhay-folder>
npm install
cp .env.example .env.local
npm run dev
```

Fill in Firebase values in `.env.local`.

## Environment Variables

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIREBASE_APPCHECK_SITE_KEY=your_recaptcha_v3_site_key
```

`VITE_FIREBASE_APPCHECK_SITE_KEY` is optional for local development. For production, create a Firebase App Check reCAPTCHA v3 provider for the deployed domain, add the site key to Vercel, and keep token auto-refresh enabled in the app.

## Production Privacy Hardening

- Firestore records are stored under `users/{uid}` and rules require `request.auth.uid == userId`.
- Enable Firebase App Check for the production Vercel domain and set `VITE_FIREBASE_APPCHECK_SITE_KEY` before enforcing App Check in Firebase.
- After every Firebase rules change, deploy rules and verify with two test accounts that User A cannot read User B's `accounts`, `expenses`, `income`, `bills`, `budgets`, `debts`, `goals`, or `portfolioHoldings`.

## Deploy Firestore And Storage Rules

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,storage
```

## Deploy To Vercel

1. Push to GitHub.
2. Import the repo into Vercel.
3. Add all `VITE_FIREBASE_*` environment variables in Vercel project settings.
4. Deploy.
5. Add the Vercel domain to Firebase Console > Authentication > Authorized domains.
6. Add the Vercel domain to Firebase App Check, set `VITE_FIREBASE_APPCHECK_SITE_KEY`, confirm App Check requests are healthy, then enforce App Check for Firestore and Storage.

## PWA Install

1. Open the deployed URL in Chrome on Android or Safari on iOS.
2. Android: tap the browser menu, then Add to Home Screen.
3. iOS: tap Share, then Add to Home Screen.
4. Buhay caches the app shell and static assets for installed-app launches, while Firebase/Auth/API requests stay network-only for safety.

## Release Checklist

Run before pushing a production deploy:

```bash
npm install
npm run build
npm run preview
```

Manual QA:

- Auth: sign up, log in, log out, remember-me, password reset, and email verification banner.
- Onboarding: currency, opening balances, recurring bills, and bill pay-from account.
- Calendar: month navigation, selected-day detail, projected recurring items, quick add, and daily balance display.
- Accounts: create/edit accounts, transfers, balance adjustment, debts, and crypto holdings.
- Recurring: recurring income, recurring expenses, bills, subscriptions, settlement behavior, and duplicate-prevention checks.
- Budgets: monthly budget setup, category limits, warning states, and recent budget outflows.
- Savings: create goals, update contributions, edit targets, and verify summaries.
- History and insights: filters, search, inline editing, category breakdowns, reports, and financial statement export/print.
- Privacy mode: verify sensitive values are masked across finance views.
- PWA: install on iOS Safari and Android Chrome, launch from home screen, navigate while offline, then reconnect and verify Firebase-backed data refreshes.
- Firebase/Vercel: Firestore rules, Storage rules, App Check site key/enforcement status, Firebase Auth authorized domains, Vercel environment variables, and service worker cache version.

## Firestore Structure

```text
users/{uid}/
  profile/main        { currency, privacyMode, notificationPrefs, cryptoPrices, ... }
  income/             { desc, amount, date, cat, subcat, recur, accountId, source, createdAt, ... }
  expenses/           { desc, amount, date, cat, subcat, recur, accountId, source, createdAt, ... }
  transfers/          { amount, date, fromAccountId, fromAccountName, toAccountId, toAccountName, desc, source, createdAt, ... }
  bills/              { name, amount, due, cat, subcat, freq, accountId, accountName, paid, createdAt, ... }
  goals/              { name, target, current, date, createdAt, ... }
  accounts/           { name, type, balance, color, notes, createdAt, ... }
  budgets/            { cat, limit, createdAt, ... }
  debts/              { name, balance, interestRate, minPayment, dueDay, accountId, notes, createdAt, ... }
  calendarEvents/     { title, date, notes, source, createdAt, ... }
  balanceOverrideLog/ { accountId, previousBalance, nextBalance, difference, date, notes, createdAt, ... }
  portfolioHoldings/  { coinId, symbol, name, amount, averageCost, currency, createdAt, ... }
  feedback/           { kind, rating, message, allowFeature, email, createdBy, createdAt, ... }
```

## Notes

- The public landing page lives at `/`.
- Auth lives at `/login`.
- The signed-in app lives at `/app`.
- The whole product is named Buhay.
- The finance system inside Buhay is still named Takda in parts of the code and documentation.
- Lakas and Tala were removed from the active app. Any remaining mentions in older docs or assets are historical and should not be treated as current product scope.
- Google Sign-In is not enabled in the active auth screen.
- Build verification requires Node/npm.

## License

MIT
