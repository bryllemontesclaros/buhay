# Buhay UI/UX Audit - 2026-09-18

Scope: landing page, auth flow, public legal pages, and source-level review of the authenticated Buhay app. Public pages were checked in browser at desktop and mobile widths. The authenticated app was reviewed through code because the audit browser did not have a signed-in Firebase session.

Verification:
- Production build passes with `npm run build`.
- No app behavior or styling was changed during this audit.

Follow-up implementation status:
- The Bills drawer class mismatch was fixed by using the existing drawer content style.
- Landing primary CTA routing now opens `/signup` for unauthenticated users.
- Button touch-target and compact action sizing were normalized across the shared button, account, crypto, savings, debts, and bills controls touched by the audit.
- Calendar mobile balance text was made more readable and clipped with ellipsis instead of negative letter spacing.
- Privacy and Terms copy now describe JSON backup exports as plain JSON.
- Auth and onboarding fields received accessibility naming improvements.
- Landing header actions were adjusted to prevent CTA wrapping on narrow screens.

## Highest-priority findings

### P1 - Bills add/edit drawer uses a missing panel class

Evidence:
- `src/pages/Bills.jsx` renders the drawer panel with `bStyles.drawerModal`.
- `src/pages/Bills.module.css` defines `.drawerOverlay` and `.drawerContent`, but no `.drawerModal`.

Impact:
- The overlay exists, but the actual drawer panel does not receive the intended width, surface, height, shadow, and flex layout rules.
- This can make the Bills drawer feel broken or visually unpolished, especially on mobile.

Recommended fix:
- Change the JSX to use `bStyles.drawerContent`, or add `.drawerModal` only if it needs separate styling.
- Retest Bills add/edit on desktop and mobile.

### P2 - Button sizing is not consistently protected across the app

Evidence:
- `src/index.css` has a coarse-pointer rule for `button`, `[role=button]`, and `a.btn`.
- Several module classes later set smaller button heights, including:
  - `src/components/ui/Button.module.css` `.button` and `.small`
  - `src/pages/Accounts.module.css` card action buttons
  - `src/pages/CryptoPortfolio.module.css` transfer and micro action buttons

Impact:
- Some buttons can still be visually or physically small on touch devices.
- This explains why the UI can look polished in one section but cramped in another.

Recommended fix:
- Create one shared button sizing rule for app actions.
- Keep compact buttons only for desktop-dense areas, with a touch override that wins in module CSS.
- Retest Accounts, Credit Cards, Crypto/Portfolio, Savings, Debts, Bills, Settings, and auth.

### P2 - Calendar money labels become too tiny on phones

Evidence:
- `src/pages/Calendar.module.css` sets `.cellBalance` to `8px`.
- At very small widths it drops to `7.5px` with tight letter spacing.

Impact:
- Peso balances may become unreadable and can overflow inside a seven-column calendar grid.
- This is a layout tradeoff that hides information instead of prioritizing it.

Recommended fix:
- Use abbreviated amounts in cells, such as `1.2k`.
- Show the full amount in the selected-day detail area.
- Avoid shrinking financial text below a readable floor.

### P2 - Main landing CTA sends new users to login, not signup

Evidence:
- `src/pages/LandingPage.jsx` sends unauthenticated CTA clicks to `/login`.
- `src/pages/AuthScreen.jsx` opens register mode only when the route is `/signup`.
- `src/App.jsx` does not define a `/signup` route.

Impact:
- A user who taps "Get Started Free" lands on "Welcome back", then must find the create-account tab.
- This adds friction at the exact moment they are ready to start.

Recommended fix:
- Add `/signup`, or pass explicit register intent into the auth screen.
- Make primary signup CTAs open create-account mode directly.

### P2 - Mobile and mid-width landing header wraps awkwardly

Evidence:
- The landing header keeps the full desktop nav until `860px`.
- At mobile widths, CTA labels wrap into multiple lines.
- At around tablet width, the full nav plus both CTAs can make the primary CTA wrap into three lines.

Impact:
- The first impression feels less intentional.
- Buttons become taller for the wrong reason: text wrapping, not designed touch sizing.

Recommended fix:
- Switch to a compact/mobile header earlier.
- Shorten mobile CTA labels, or reserve stable button widths.
- Prevent CTA text wrapping.

## Accessibility and trust findings

### P2 - Auth and onboarding fields are visually labeled but not programmatically labeled

Evidence:
- Auth labels are rendered as text labels, but inputs do not have matching `id` and `htmlFor` connections.
- Some onboarding inputs rely on placeholders.

Impact:
- Screen reader and autofill behavior is weaker than it should be.
- Users navigating by accessibility tree may hear generic edit fields.

Recommended fix:
- Add stable `id` values and matching `htmlFor` labels.
- Avoid placeholder-only fields for required setup questions.

### P2 - Dialog behavior is inconsistent

Evidence:
- Some modals use role/aria attributes and Escape handling.
- Others are plain overlay/card structures without consistent `role="dialog"`, `aria-modal`, focus trapping, Escape behavior, or focus restoration.

Impact:
- Keyboard users can get inconsistent behavior from one modal to another.
- This is especially risky in money-moving flows such as transfer, account editing, and quick add.

Recommended fix:
- Introduce one shared modal shell for focus, Escape, aria naming, and restoration.
- Migrate account, transfer, details, quick add, crypto, debts, and savings dialogs into that shell.

### P2 - Legal copy says backups are encrypted, but export is plain JSON

Evidence:
- Privacy and Terms pages mention encrypted JSON backups.
- `src/pages/Settings.jsx` creates a normal `application/json` blob from `JSON.stringify`.

Impact:
- Users may believe local exports are encrypted when they are not.
- This is a trust and product-copy issue, even if not a code crash.

Recommended fix:
- Update the copy to say plain JSON export, or implement actual encrypted export separately.

### P2 - Green semantic colors have weak contrast on white

Evidence:
- The app uses bright green tokens for income, cleared, positive, and some CTA states.
- Calculated contrast for key greens against white is low enough to be visually soft.

Impact:
- Positive amounts and important success states can be harder to read.
- This shows up most in dense finance screens where small numbers matter.

Recommended fix:
- Separate "green fill" from "green text".
- Use a darker green text token for small text and financial values.

## Visual system findings

### P3 - Border and corner hierarchy is still inconsistent

Evidence:
- Cards use many different radius values across the app: 16, 18, 20, 24, 28, 32, and 36px.
- Finance cards, landing widgets, auth cards, page panels, and app shells also mix different border weights and shadows.

Impact:
- The UI can look like several design systems layered together.
- Nested white panels with faint borders create the corner/border artifacts the screenshots highlighted.

Recommended fix:
- Define a small radius scale, for example:
  - 8px for compact controls
  - 12px for inputs and small panels
  - 16px for cards
  - 20px for large surfaces
- Reduce nested card borders where a divider or spacing would be cleaner.
- Use accent borders only for selected, active, or warning states.

### P3 - Landing page delays the real product preview

Evidence:
- On mobile, the product preview begins below the first viewport.
- The hero spends much of the first screen on slogan, trust proof, and large CTAs.

Impact:
- Buhay is a practical money app, but the first screen reads closer to a marketing page.
- Users have to scroll before seeing what they will actually use.

Recommended fix:
- Bring a tighter product preview into the first viewport.
- Make "Buhay" and "money tracking" the strongest first-screen signal.
- Keep supporting copy shorter and let the product UI sell the value.

### P3 - Landing demo data can feel misleading or too hardcoded

Evidence:
- Some landing preview values are hardcoded.
- The budget preview clamps spending to the limit, so an over-budget example cannot appear.
- Calendar and transaction examples are static.

Impact:
- The demo looks polished but less trustworthy if details do not behave like real finance data.

Recommended fix:
- Treat the landing preview as a consistent sample dataset.
- Make over-budget, upcoming bills, and cashflow examples coherent across widgets.

### P3 - CSS cascade has too many late override layers

Evidence:
- Several files contain redesign override sections stacked late in the module.
- This makes it harder to know which rule owns a component's real shape.

Impact:
- Small fixes can accidentally regress another viewport or theme.
- This is one reason button and border polish keeps resurfacing.

Recommended fix:
- Consolidate repeated visual rules into shared tokens/components.
- Remove stale override blocks after replacing them with the intended base styles.

## Additional source audit notes

Potential missing CSS module class references found by source scan:
- `src/pages/Bills.jsx` references `drawerModal`; this is the serious one called out above.
- Other missing class references appear to be marker classes, legacy hooks, or low-risk styling gaps, but should be checked while doing cleanup:
  - `src/components/ui/LiquidTactileCard.jsx` `headerAction`
  - `src/pages/Accounts.jsx` `syncNoticeCopy`
  - `src/pages/AuthScreen.jsx` `logoWrap`
  - `src/pages/Breakdown.jsx` `breakdownPage`
  - `src/pages/Budget.jsx` `budgetPage`
  - `src/pages/Calendar.jsx` `hasData`, `manualBalancePin`
  - `src/pages/CryptoPortfolio.jsx` `heroPnlWrap`
  - `src/pages/Debts.jsx` `primaryButton`
  - `src/pages/History.jsx` `summaryCardButton`, `formRowTwoCol`
  - `src/pages/Settings.jsx` `goalItemCard`

## Recommended fix order

1. Fix the Bills drawer class mismatch.
2. Normalize touch-safe button sizing across shared and module CSS.
3. Fix landing CTA signup intent and mobile header wrapping.
4. Improve calendar money label strategy on mobile.
5. Create a shared modal shell and migrate the highest-risk money dialogs first.
6. Standardize card radius, border, and shadow tokens across app pages.
7. Fix auth/onboarding labels and legal export copy.
8. Tighten landing preview hierarchy and sample data consistency.

## Audit limits

- The authenticated app was not visually exercised with real user data in the browser during this pass.
- No screen reader, physical mobile device, or dark-theme browser pass was performed.
- This audit is design and source-focused; it does not replace user testing.
