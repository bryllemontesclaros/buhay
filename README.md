# Buhay

> Bawat araw, mas malinaw. Every day, clearer.

Buhay is an all-in-one life tracker built with Filipino clarity and warmth for everyday use anywhere. It brings three focused spaces into one installable React + Firebase app:

- Takda: finance, daily balances, bills, budgets, savings, reports, and cashflow.
- Lakas: fitness, workouts, routines, meals, activity, body progress, habits, and goals.
- Tala: mind, journal, mood, tasks, life goals, calendar patterns, and insights.

## App Spaces

Takda finance:

- Calendar
- Overview
- Money
  - Accounts
  - History
  - Insights
- Plan
  - Savings
  - Bills
  - Budget
- Settings

Lakas fitness:

- Train
  - Beginner-friendly gym session mode
  - Routines and workout logging
  - Exercise sets, reps, weight, duration, rest, notes, form cues, and embedded proper-form videos
- Log
  - Activity
  - Habits
  - Calendar signals
- Nutrition
  - Manual meal logs
  - Calories and macros
- Progress
  - Body
  - Goals
  - Records and charts
- Overview
- Settings

Tala mind and everyday life:

- Journal
- Mood
- Tasks
- Goals
- Calendar
  - Selectable days with inline check-in, journal, mood, task, and goal details
- Insights
- Check-in
- Settings

## Core Features

- Email/password authentication with registration, login, logout, remember-me, password reset, and email verification support.
- First-run onboarding for preferred currency, opening account balances, recurring bills, and optional bill pay-from accounts.
- Mobile-first all-in-one app shell with separate Takda, Lakas, and Tala spaces.
- Desktop sidebar and mobile bottom navigation with per-space tabs and More sheets.
- Space homes are action-first: Takda opens Calendar, Lakas opens Gym Session/Train, and Tala opens Journal.
- Grouped Takda pages keep finance tools easier to reach: Money groups Accounts, History, and Insights; Plan groups Savings, Bills, and Budget.
- Grouped Lakas pages keep fitness focused: Train, Log, Nutrition, Progress, and Settings.
- Liquid-glass inspired UI, light/dark theme, privacy mode, and responsive desktop/mobile layouts.
- Firestore-backed real-time sync for signed-in users.
- Installable PWA with service worker caching for static assets and an app-shell fallback for navigation launches.
- JSON backup/restore, CSV export, printable monthly finance reports, and account/data deletion controls.
- Settings for account security, profile, email, password, notifications, legal links, feedback, support, currency, exchange-rate context, data tools, and storage summary.

## Takda Finance

- Dashboard with current balance, monthly income/expense summary, savings rate, budget health, recent transactions, and projected month-end balance.
- Calendar-based finance tracking with daily closing balances, selected-day detail, date/month/year jump, and privacy-safe display.
- Income and expense tracking with categories, subcategories, recurrence, notes, account links, add/edit/delete flows, and quick add.
- Transfers between accounts.
- Bills with recurring schedules, due/overdue handling, pay-from account support, and mark-paid behavior that can create a real expense and update balances.
- Accounts for cash, bank, e-wallet, credit card, investment, and other balances.
- Savings goals with target dates, progress tracking, contribution updates, and summaries.
- Budgets with category limits, overspending warnings, unbudgeted spending visibility, and budget status.
- History with search, filters, sorting, and inline editing.
- Breakdown charts with category views, trends, and month comparisons.

## Lakas Fitness

- Overview dashboard for fitness stats, recent activity, goals, and quick actions.
- Workout log for exercises, sets, reps, weight, duration, rest time, and notes.
- Routines/plans such as Push/Pull/Legs, full body, home workout, cardio, and custom routines.
- Meal tracking with manual meal logs and editable meal details.
- Body progress with weight, measurements, BMI/body trend, notes, and legacy photo support for older entries.
- Steps and activity tracking for walking, cardio minutes, active days, distance, and activity notes.
- Habit check-ins for water, protein, sleep, stretching, rest day, vitamins, and custom habits.
- Fitness goals for weight, muscle, steps, workout frequency, habits, activity, and body progress.
- Reminders for workouts, weigh-ins, rest days, meals, habits, and custom reminders.
- Calendar and trend-style views for workout days, activity consistency, meals, habits, and progress.
- Lakas settings for units, workout defaults, meal defaults, reminders, privacy, export, and Lakas-only data deletion.

## Tala Mind And Life Admin

- Today check-in with mood, energy, stress, sleep quality, priority, gratitude, and reflection.
- Journal with title, body, mood, tags, private/open setting, and privacy-mode masking.
- Mood tracker with mood, energy, stress, sleep quality, triggers, notes, and trends.
- Tasks with due dates, priorities, notes, open/done status, and overdue visibility.
- Life goals with area, target date, progress percentage, notes, and direct progress updates.
- Calendar view with dots for check-ins, journal entries, mood logs, task due dates, and goal target dates, plus selected-day details under the calendar.
- Insights for journal streaks, mood averages, energy trends, task completion, top tags, and common triggers.
- Tala settings for reminder time, weekly review day, prompt style, journal privacy default, mood insight visibility, export, and Tala-only data deletion.
- Clear disclaimer behavior: Tala is for tracking/reflection, not diagnosis or medical/mental-health advice.

## Privacy And Safety

- Per-user Firestore data under `users/{uid}`.
- Firestore rules restrict user data to the authenticated owner.
- Firebase Storage rules should restrict any older saved user images to the authenticated owner.
- Privacy mode masks sensitive money and personal values across app views.
- Workouts, tasks, and goals use review-before-save behavior where relevant.
- JSON backups include app data and any legacy image metadata links, but image files are not re-uploaded from backups.
- Account deletion and data reset tools are available in Settings.
- Legal pages explain privacy, terms, third-party services, import behavior, and product limits.

## Tech Stack

- Frontend: React + Vite
- Auth: Firebase Authentication, Email/Password
- Database: Firestore, real-time per-user collections
- Storage: Firebase Storage for older saved fitness images
- Hosting: Vercel
- PWA: Installable web app with service worker caching

## System Docs

- [Buhay system rules](/Users/bryllemontesclaros/Documents/New%20project/takda_patch/docs/buhay-system-rules.md)
- [Buhay architecture map](/Users/bryllemontesclaros/Documents/New%20project/takda_patch/docs/buhay-architecture-map.md)
- [Buhay balance system spec](/Users/bryllemontesclaros/Documents/New%20project/takda_patch/docs/buhay-balance-system-spec.md)

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

- Firestore records are stored under `users/{uid}` and rules require `request.auth.uid == userId`, so signed-in users cannot read or write another user's app records.
- Older saved meal and body progress image files are stored under `users/{uid}/...` and require the same authenticated owner.
- Privacy mode is screen privacy only: it masks sensitive values in the UI when someone is looking at the device. Firebase Auth, Firestore rules, Storage rules, and App Check are the real access controls.
- Enable Firebase App Check for the production Vercel domain and set `VITE_FIREBASE_APPCHECK_SITE_KEY` before enforcing App Check in Firebase.
- After every Firebase rules change, deploy rules and verify with two test accounts that User A cannot read User B's `accounts`, `expenses`, `income`, `lakasBodyLogs`, or `talaJournal`.

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
- Onboarding: currency, opening balances, recurring bills, bill pay-from account, and optional Lakas/Tala starter paths.
- Takda: calendar home, overview dashboard, quick add, selected-day detail, accounts, history, savings, bills, budget, and breakdown.
- Bills trust check: marking a bill paid should create only one expense when enabled.
- Lakas: beginner recommendation, Gym Session start, muted in-session YouTube autoplay, warm-up, set tracker, rest timer, next exercise, save workout, meal log, body log, activity, habits, goals, and settings/logout.
- Tala: journal home, check-in, calm plan, journal prompts/privacy masking, mood trends, tasks done/reopen, goals, calendar selected-day detail, insights, and settings/logout.
- PWA: install on iOS Safari and Android Chrome, launch from home screen, navigate while offline, then reconnect and verify Firebase-backed data refreshes.
- Firebase/Vercel: Firestore rules, Storage rules, App Check site key/enforcement status, Firebase Auth authorized domains, Vercel environment variables, and service worker cache version.

## Firestore Structure

```text
users/{uid}/
  profile/main      { currency, privacyMode, notificationPrefs, lakasSettings, talaSettings, ... }
  income/           { desc, amount, date, cat, subcat, recur, accountId, source, createdAt, ... }
  expenses/         { desc, amount, date, cat, subcat, recur, accountId, source, createdAt, ... }
  transfers/        { amount, date, fromAccountId, fromAccountName, toAccountId, toAccountName, desc, source, createdAt }
  bills/            { name, amount, due, cat, subcat, freq, accountId, accountName, paid, createdAt, ... }
  goals/            { name, target, current, date, createdAt, ... }
  accounts/         { name, type, balance, color, notes, createdAt, ... }
  budgets/          { cat, limit, createdAt, ... }
  calendarEvents/   { title, date, notes, source, createdAt, ... }
  feedback/         { kind, rating, message, allowFeature, email, createdBy, createdAt }
  lakasRoutines/    { name, focus, exercises, exerciseCount, setCount, duration, notes, createdAt, ... }
  lakasWorkouts/    { title, date, exercises, exerciseCount, duration, notes, createdAt, ... }
  lakasMeals/       { name, date, mealType, calories, protein, carbs, fat, photoPath?, notes, createdAt, ... }
  lakasBodyLogs/    { date, weight, measurements, bmi, photoPath?, notes, createdAt, ... }
  lakasActivities/  { date, type, steps, activeMinutes, cardioMinutes, distance, notes, createdAt, ... }
  lakasHabits/      { date, habits, score, notes, createdAt, ... }
  lakasReminders/   { title, date, time, type, frequency, notes, createdAt, ... }
  lakasGoals/       { name, type, target, current, unit, targetDate, notes, createdAt, ... }
  talaCheckins/     { date, mood, energy, stress, sleepQuality, priority, gratitude, reflection, createdAt, ... }
  talaJournal/      { date, title, mood, tags, body, private, createdAt, ... }
  talaMoods/        { date, mood, energy, stress, sleepQuality, triggers, notes, createdAt, ... }
  talaTasks/        { title, dueDate, priority, notes, done, completedAt, createdAt, ... }
  talaGoals/        { name, area, targetDate, progress, notes, createdAt, ... }
```

## Storage Structure (Legacy Saved Images)

```text
users/{uid}/
  lakas/meals/{mealId}/photo.{ext}
  lakas/bodyLogs/{bodyLogId}/photo.{ext}
```

## Notes

- The public landing page lives at `/`.
- Auth lives at `/login`.
- The signed-in app lives at `/app`.
- The whole product is named Buhay.
- The finance space inside Buhay is still named Takda.
- Google Sign-In is not enabled in the active auth screen.
- JSON backup/restore covers Takda, Lakas, Tala, profile settings, and metadata links for images.
- Build verification requires Node/npm. If this environment has no Node/npm installed, `npm run build` cannot run.

## License

MIT
