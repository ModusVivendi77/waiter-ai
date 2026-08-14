# Waiter AI — Task Status Tracker

**Last Updated:** August 13, 2026
**Current Phase:** 8/9 — Testing & Hardening (E2E suite green, remaining items are manual live-verification)

---

## ✅ COMPLETED TASKS

### Phase 1: Pre-Development Setup

#### Task 1.1: Repository Setup ✅ COMPLETE
- [x] Git repository initialized
- [x] `.gitignore` configured
- [x] `package.json` with all dependencies
- [x] `package-lock.json` with 574 packages installed
- [x] `.env.example` template created
- [x] Initial git commit: `70c315f`
- [x] Documentation created:
  - [x] `PROJECT_README.md` (project overview)
  - [x] `DEVELOPMENT.md` (dev setup guide)
  - [x] `MVP_DESIGN.md` (architecture & strategy)
  - [x] `IMPLEMENTATION_PLAN.md` (detailed tasks)

**Status:** Ready for next step

---

## 🔄 IN PROGRESS

### Task 1.3: Vercel Deployment ✅ COMPLETE

**What's ready:**
- [x] Production build passes locally with `npm run build`
- [x] GitHub Actions workflow added at `.github/workflows/ci.yml`
- [x] Vercel handoff guide added at `VERCEL_SETUP.md`
- [x] Environment variable list documented for Vercel project settings
- [x] Repository imported into Vercel and deployed
- [x] Production domain verified: `https://waiter-ai-iota.vercel.app`

**What still needs to happen:**
1. Confirm environment variables are set for both `Production` and `Preview`
2. Validate auth endpoints on the production URL (`/login`, `/platform/signup`, `/platform`)

### Phase 3: Authentication 🟡 LIVE CORE FLOWS VERIFIED

**What's ready:**
- [x] Next.js app shell and route structure created
- [x] Supabase browser/server clients and auth middleware created
- [x] Restaurant owner registration scaffolded
- [x] Login, logout, forgot-password, and reset-password flows scaffolded
- [x] Protected platform routes with role gates for OWNER, MANAGER, and STAFF
- [x] **Email verification required** — registration creates an unconfirmed user and dispatches Supabase's built-in "Confirm signup" email
- [x] `/auth/callback` now verifies the confirmation link (`token_hash` + `type=signup`) and redirects to `/login?verified=1`
- [x] `/verify-email` page with "check your inbox" messaging, resend button (rate-limited 3 per 10 min), and login CTA
- [x] Registration success state links to `/verify-email?email=...` with the email pre-filled

**Live verification completed:**
- [x] Owner signup creates `auth.users`, `restaurants`, and `restaurant_users` records
- [x] Login works against live Supabase Auth
- [x] Protected platform routes load with role-based access using the live browser session
- [x] Forgot-password request path is wired and returns a live auth response
- [x] Registration notification email hook added (Resend-backed when configured)

**Implementation details:**
- `registerRestaurant` creates the auth user with `email_confirm: false` (locked until confirmed)
- **Confirmation email now dispatched via a hybrid path (`dispatchConfirmationEmail`):**
  - Primary: `admin.generateLink({ type: 'signup', email, options: { redirectTo: '<app>/auth/callback' } })` → `hashed_token`, then delivered through **Resend** with a link to `<app>/auth/callback?token_hash=...&type=signup` — bypasses Supabase's built-in email rate limits
  - Fallback: `admin.auth.resend({ type: 'signup', email })` (Supabase "Confirm signup" template) when Resend is not configured
- **Root cause fixed:** Supabase's built-in email is rate-limited ("email rate limit exceeded" / "you can only request this after 59 seconds"). Resend is currently **not configured** in `.env.local` (placeholder key), so the app falls back to the rate-limited Supabase path — add a real `RESEND_API_KEY` to make confirmation emails reliable
- **New UX:** when the confirmation email cannot be delivered, the register form now shows a "pending" state ("Account created for …") with a direct **Resend confirmation email** button to `/verify-email?email=...` instead of a dead-end error
- `verifyOtp({ token_hash, type: 'signup' })` was live-verified: it confirms the user (`email_confirmed_at` set) and establishes the session
- `/auth/callback` handles the template's `?token_hash=...&type=signup` link, calls `verifyOtp({ token_hash })`, and redirects to `/login?verified=1` on success (or `/verify-email?error=invalid-link` on failure)
- `resendConfirmationEmail` uses the same hybrid dispatcher and is rate-limited to 3 sends per 10 minutes per email
- `sendRegistrationEmail` (Resend-backed welcome email) still fires after account provisioning

**What still needs to happen:**
1. ~~Complete the reset-password flow with a real inbox-backed account~~ — ✅ DONE. User verified the flow works end-to-end (request reset → email link → `/reset-password` → update password → login)
2. Confirm the "Confirm signup" template's site URL is set to `<APP_URL>/auth/callback` in Supabase Auth settings (no longer required for the Resend path, but keeps the Supabase fallback correct)
3. **Resend configured** (real `RESEND_API_KEY` in `.env.local` + Vercel). Delivery verified to the owner's address. **Free-plan caveat:** with the default `onboarding@resend.dev` sender, Resend only delivers to the account owner's email — to email customers, verify a domain at resend.com/domains and set `RESEND_FROM_EMAIL` to an address on it
4. Decide whether to keep the current client-side protected-route strategy or revisit SSR session handling later

**Reference:** See `IMPLEMENTATION_PLAN.md` Part 5

### Phase 2: Database Schema ✅ APPLIED TO LIVE SUPABASE PROJECT

**What's ready:**
- [x] `supabase/migrations/001_initial_schema.sql` created
- [x] `supabase/migrations/002_rls_policies.sql` created
- [x] `supabase/seed.sql` created
- [x] Core indexes, constraints, and `updated_at` triggers added

**Live verification completed:**
- [x] Remote schema is up to date
- [x] Seed data loaded into the linked project
- [x] Authenticated owner membership data is queryable through application access rules

**Reference:** See `IMPLEMENTATION_PLAN.md` Part 2

### Task 1.2: Supabase Project Setup ✅ COMPLETE

**What's ready:**
- [x] Step-by-step guide created (`SUPABASE_SETUP.md`)
- [x] Verification script created (`verify-setup.sh`)
- [x] Environment template (`env.example`)

**Completed:**
- [x] Supabase project linked locally
- [x] Environment variables configured
- [x] `./verify-setup.sh` passes

**Time required:** ~5–10 minutes  
**Reference:** See `SUPABASE_SETUP.md` for detailed instructions

---

## 📋 UPCOMING TASKS

### Task 1.3: Vercel Deployment
- [x] Connect GitHub repo to Vercel
- [x] Configure environment variables in Vercel
- [x] Setup CI/CD pipeline
- [x] Test that `npm run build` works locally

**Start after:** Task 1.2 complete

---

### Phase 2: Database Schema (Tasks 2.1–2.4)
- [x] Create migrations directory
- [x] Migration 001: Create core tables
- [x] Migration 002: Implement RLS policies
- [x] Load seed data

**Start after:** Task 1.3 complete

---

### Phase 3: Authentication (Week 3)
- [x] Supabase Auth integration scaffolded
- [x] Restaurant registration flow scaffolded
- [x] Login/logout flow scaffolded
- [x] Password reset flow scaffolded
- [x] Role-based access control scaffolded

---

### Phase 4: Restaurant Setup (Week 4)
- [x] Table management scaffold started (`/platform/setup`)
- [x] QR link/token generation scaffold started (`/platform/setup`)
- [x] Menu management scaffold started (`/platform/setup`)
- [x] CSV import scaffold started (`/platform/setup`)

### Phase 4: Restaurant Setup 🟡 IN PROGRESS

**What's ready:**
- [x] Owner/manager-only setup workspace at `/platform/setup`
- [x] Table creation with generated QR tokens and shareable table URLs
- [x] Table rename flow
- [x] Table activation/deactivation and table deletion
- [x] Menu category creation
- [x] Menu category rename flow
- [x] Guarded category deletion (blocked when linked items exist)
- [x] Menu item creation
- [x] Menu item edit flow (name, description, category, price)
- [x] Menu item availability toggle and item deletion
- [x] CSV text import for menu bootstrap (`category,name,description,price`)
- [x] Downloadable QR SVG per table
- [x] Printable multi-table QR sheet layout
- [x] SUPER_ADMIN restaurant context selector for setup workspace
- [x] CSV parser validation with duplicate detection and row-level error reporting
- [x] Quoted-field CSV preview before import write
- [x] Initial setup E2E coverage scaffolded with Playwright
- [x] Shared top navigation bar added across the app
- [x] **Multi-restaurant support (NEW):**
  - [x] `addRestaurant` server action — an authenticated user can register additional restaurants (reuses their session, no new auth user, no email confirmation, rate-limited 5/10 min)
  - [x] "Add another restaurant" form on `/platform` with auto-reload of memberships
  - [x] **Restaurant switcher for all multi-membership users** in Orders, Setup, and Analytics consoles (previously SUPER_ADMIN only); selection persisted per-console in `localStorage`
  - [x] **Root-cause fix:** upgraded `@supabase/ssr` `0.0.9` → `0.12.4` — the old version only supported the legacy `get`/`set`/`remove` cookie API, so the app's modern `getAll`/`setAll` config silently failed and **all server-side auth reads returned "Auth session missing!"** (latent because pages authenticate client-side). This also fixes `/auth/callback` session persistence for the reset-password flow.
- [x] **Team management (staff/manager CRUD)** — replaced the placeholder `/platform/team` page:
  - [x] Add members to a restaurant by email + role (MANAGER/STAFF); change roles; remove members
  - [x] Restaurant context selector for multi-restaurant owners and SUPER_ADMIN
  - [x] Guards: cannot remove the last OWNER or yourself; member must have an account first
- [x] **Staff-to-table connection** (migration 008): `restaurant_tables.assigned_staff_id` + `orders.waiter_id` (live-applied)
  - [x] Setup console: "Assigned staff" dropdown per table
  - [x] Orders console: staff can **Take order** (sets `waiter_id`); "Handling: you" badge
  - [x] **Dining session closure** (completes the session-first model): orders already group under an ACTIVE table session in the API; the orders workspace now shows a **"Close table session"** button (OWNER/MANAGER/SUPER_ADMIN) so the next order starts a fresh visit — live-verified
- [x] **Staff performance analytics** (migration 008 + `/platform/analytics`):
  - [x] Per-staff orders handled, revenue served (value statuses only), tables covered, avg order value
  - [x] SUPER_ADMIN branch added to the analytics console (view any restaurant), fixing a stale-state restaurant-switch bug
  - [x] 4 new unit tests (`src/lib/analytics/__tests__/staff.test.ts`) — 56 total
- [x] **Critical RLS fix (migration 009):** added "Users can view own memberships" policy — previously only OWNERs could SELECT `restaurant_users`, so **STAFF/MANAGER accounts saw an empty membership list and every platform page said "You need restaurant access."** Staff can now use the platform.

**What still needs to happen:**
1. Add broader setup E2E scenarios for rename/delete/import success paths
2. Add QR PDF/export batching if printable assets need exact page sizing
3. Decide whether to graduate Phase 4 from scaffold/hardening into full production verification
4. **Future work:** Resend domain verification (`*.vercel.app` can't be verified — needs a custom domain at resend.com/domains + `RESEND_FROM_EMAIL` set) so confirmation emails reach customers, not just the owner
5. **Future work:** table assignment by shift (current model is a single `assigned_staff_id` per table); staff availability/scheduling

---

### Phase 5: Customer Ordering (Week 5)
- [x] QR landing page (`/t/[token]`)
- [x] Menu browser
- [x] Shopping cart
- [x] Order submission API (`/api/orders`)
- [x] Public order tracking page (`/orders/[trackingToken]`)
- [x] Customer status refresh via polling

### Phase 5: Customer Ordering ✅ COMPLETE

**What's ready:**
- [x] Public QR menu route backed by live Supabase data
- [x] Cart building and order note capture
- [x] Order submission into `orders`, `order_items`, and `order_status_history`
- [x] Public tracking token per order
- [x] Customer-facing order status page with optimized polling (5-second refresh interval)
- [x] Manual refresh button for customers to check status on-demand
- [x] Last updated timestamp visible to customers
- [x] Restaurant orders workspace shows submitted orders for staff/admins
- [x] Waiter/staff can update status, edit quantities/notes, add items, and remove items from orders
- [x] Customer-visible status timeline with checkmark stepper (NEW → ACCEPTED → PREPARING → READY → SERVED)
- [x] Status history panel showing timestamps from `order_status_history`
- [x] Tracking page and API now include full status history
- [x] **Menu modifiers & allergens (migration 010, live-applied):**
  - [x] `menu_item_modifiers` table + `menu_items.allergens` + `order_items.modifiers`
  - [x] Setup console: allergens (comma list) + modifier editor ("Name +price" per line) per menu item
  - [x] Customer menu: allergen labels + checkbox option selection; line price includes modifier deltas
  - [x] Order API validates modifiers, prices lines with deltas, snapshots names on `order_items`
  - [x] Modifiers shown on tracking page, orders console, and cart
- [x] **Split the bill** (client-side on the tracking page):
  - [x] Divide equally by number of people (cent-exact, first guests absorb rounding)
  - [x] Assign each item to a guest, with per-guest totals
- [x] **UI refresh** — modern sans-serif design system: new palette, gradient buttons, cleaner cards/inputs/nav/typography across the app

### Final touch (navigation, home dashboard, notifications) 🟢 COMPLETE
- [x] **Navigation simplified** to Home / Login / Orders / Analytics / **Setup** / Admin; Platform Analytics now lives under the Admin console
- [x] **QR code URLs use the live site origin** (`window.location.origin`) instead of a hardcoded `localhost`
- [x] **New-order notifications for staff/owners** — real-time banner in the Orders workspace ("🔔 New order received — Table · €total") with auto-dismiss; best-effort browser Notification when permission is granted
- [x] **Home dashboard** (`/platform`) — restaurant card, **live tables** (free/occupied + assigned staff), **live orders** (real-time), and **team** roster (owners/admins); restaurant switcher for multi-restaurant/SUPER_ADMIN
- [x] **Staff table claiming** — `claim_table_staff` SECURITY DEFINER RPC (migration 011): owners/managers/admins can assign anyone; staff can assign **themselves**; "Claim table" on the home dashboard
- [x] **Critical realtime fixes:**
  - `supabase_realtime` publication never included application tables (migration 012) — postgres_changes events (staff order updates, new-order notifications, home dashboard) were never delivered; only broadcast worked
  - `useSupabaseSubscription` joined multi-events into `'INSERT,UPDATE'` which Realtime doesn't match — now binds one listener per event
  - Live-verified: new-order banner fires on INSERT; staff order status updates via realtime
- [x] **Greek translation (i18n)** — custom lightweight language system (no new dependency):
  - [x] `LanguageProvider` context + `t()` helper with `{placeholder}` interpolation; persisted in `localStorage`, `EN`/`EL` toggle in the nav
  - [x] Translated: navigation, home dashboard, orders workspace, customer ordering page, tracking page (incl. split bill), login
  - [x] Order statuses translated (ΝΕΑ / ΑΠΟΔΕΚΤΗ / ΕΤΟΙΜΑΖΕΤΑΙ / ΕΤΟΙΜΗ / ΕΞΥΠΗΡΕΤΗΘΗΚΕ …)
- [x] **Login separated in nav** — divider + distinct filled button styling
- [x] **Table status pills** — free = green pill w/ white text, occupied = red pill w/ white text (home dashboard)
- [x] **"Add another restaurant" restored on the home dashboard** — the form was accidentally dropped when `/platform` was rebuilt as the dashboard; it's back (server action + UI) with guidance on using the restaurant switcher
- [x] **Setup menu editor redesigned** — categories are expandable/collapsible sections:
  - [x] Each expanded category shows its items in a **table** (Item | Price | Status | Actions) with **quick inline edits** for name and price (per-row Save)
  - [x] **"Details" expands an item** to edit description, category, allergens, and modifiers (options)
  - [x] Availability toggle + delete stay one click away in the table
  - [x] Setup console now honors `?restaurantId=` (consistent with the orders workspace)
- [x] **Deployment fix** — wrapped the setup console in a `<Suspense>` boundary after Vercel's build failed with `useSearchParams() should be wrapped in a suspense boundary at page "/platform/setup"` (all `useSearchParams` consumers now have boundaries)

**What still needs to happen:**
1. Add public guardrails around order edits/cancellation windows if needed
2. Expand automated checks around multi-item totals and item removal edge cases
3. ~~Re-run full E2E suite after real-time implementation~~ — done: public ordering journey passes with the real-time implementation (see Phase 6 verification)

---

### Phase 6: Real-Time & Dashboard 🟡 IN PROGRESS

**What's ready:**
- [x] Real-time subscriptions for authenticated staff (orders and order_items tables)
- [x] Instant order status updates when staff change order status
- [x] Instant order item updates when items are added/edited/deleted
- [x] Real-time totals recalculation when order items change
- [x] Custom `useSupabaseSubscription` hook for managing Supabase real-time connections
- [x] Restaurant orders workspace now displays live updates without manual reload
- [x] Optimized polling for public customers (5-second intervals with manual refresh)
- [x] Restaurant dashboard baseline (`/platform/orders`)
- [x] Manual order status updates
- [x] Customer-facing status timeline now includes timestamps from `order_status_history`
- [x] Rate limiting added to public `/api/orders` (30 req / 10 min) and `/api/order-status/[trackingToken]` (120 req / min)
- [x] Rate-limit headers (`X-RateLimit-Remaining` on every response, `Retry-After` on 429) now returned consistently via shared `getRateLimitHeaders` helper
- [x] Public real-time status updates via auth-less broadcast channels (`order-status-<orderId>`)
- [x] 5-second polling retained as a reliable fallback for customers
- [x] Broadcast authorization gated to restaurant staff only (migration 007)
- [x] Reconnection/retry logic with exponential backoff (up to 5 retries, 1s → 15s) on both public and staff real-time channels

**Implementation details:**
- Added `/lib/hooks/use-supabase-subscription.ts` for real-time subscription management
- Updated `OrdersConsole` to subscribe to `orders` (UPDATE events) and `order_items` (INSERT/UPDATE/DELETE events)
- Subscriptions are scoped per restaurant to prevent cross-restaurant data leaks
- Proper cleanup of subscriptions on component unmount
- Fallback to current approach if Supabase real-time is unavailable
- Added `src/lib/utils/rateLimit.ts` in-memory rate limiter with per-client key tracking
- `getClientKey` resolves from `x-forwarded-for` / `x-real-ip` headers
- Rate-limit responses include `Retry-After` and `X-RateLimit-Remaining` headers
- Added `src/lib/hooks/use-public-order-status.ts` — auth-less broadcast subscription for the public tracking page
- `OrdersConsole.handleStatusChange` publishes a broadcast after the DB update + status history insert succeed
- `OrderStatusView` re-fetches from `/api/order-status/[trackingToken]` on broadcast receipt, keeping the timeline/history consistent
- Migration `007_public_realtime_order_status.sql` adds a Realtime Authorization INSERT policy allowing only authenticated restaurant staff to publish; listening remains open for anon customers
- No RLS changes on the orders table — public customers still read via API routes only

**Recent verification:**
- [x] Production build + typecheck pass (`npm run typecheck && npm run build`)
- [x] All 52 unit/integration tests pass (`npx vitest run`)
- [x] **Full E2E suite green — 5/5 passed (previously 1 passed / 3 skipped):** public ordering journey, orders workspace (staff modify order), platform setup CSV preview, platform setup rename/import/cleanup, and a new broadcast test
- [x] `playwright.config.ts` now loads `.env.local` via `@next/env` — auth-requiring E2E tests no longer skip
- [x] **Broadcast channel mismatch fixed:** `usePublicOrderStatus` listened on `public-order-status-<orderId>` while staff published on `order-status-<orderId>` (per migration 007). Renamed listener to `order-status-<orderId>` so real-time updates actually reach the customer tracking page
- [x] New E2E test verifies order acceptance updates the tracking page history panel within <3.5s via broadcast (proves real-time path, not just the 5s poll fallback)
- [x] Rate-limit headers live-verified against the production build: `/api/orders` 400 → `X-RateLimit-Remaining: 28`, `/api/order-status` 404 → `X-RateLimit-Remaining: 119`; `Retry-After` correctly present only on 429 responses

**What still needs to happen:**
1. ~~Configure `E2E_SUPER_ADMIN_EMAIL` / `E2E_SUPER_ADMIN_PASSWORD` in `.env.local` and re-run the auth-requiring E2E tests (orders workspace + platform setup)~~ — ✅ DONE. Playwright now loads `.env.local` via `@next/env` in `playwright.config.ts`; all 3 auth-requiring tests pass
2. ~~Verify order acceptance flow updates the history panel on `/orders/[trackingToken]` via broadcast~~ — ✅ DONE. Found & fixed a channel-name mismatch (listener used `public-order-status-<id>`, publisher used `order-status-<id>`); added a broadcast E2E test proving the tracking page updates in <3.5s without waiting for the 5s poll
3. Monitor real-time connection stability and latency metrics in staging
4. Verify reset-password flow end-to-end with a real inbox-backed account (recovery redirect in `/auth/callback` was fixed — see below)
5. Confirm the "Confirm signup" template's site URL is set to `<APP_URL>/auth/callback` in Supabase Auth settings

---

### Phase 7: Analytics & Admin 🟡 IN PROGRESS

**What's ready:**
- [x] SUPER_ADMIN account foundation (schema + admin route guard)
- [x] Platform admin assignment UI (grant/revoke SUPER_ADMIN)
- [x] Restaurant analytics dashboard at `/platform/analytics`
  - [x] Today, this week, and 30-day metrics
  - [x] Order count and order value tracking
  - [x] Average order value calculation
  - [x] Top 5 products by quantity sold
  - [x] Daily trend line chart (7-day dual-axis visualization)
  - [x] Daily order count bar chart
  - [x] Daily revenue bar chart
  - [x] PDF export capability
  - [x] CSV export capability
- [x] Platform admin analytics panel at `/admin/analytics`
  - [x] Total restaurants and active restaurants (30d)
  - [x] Total tables and tables per restaurant
  - [x] Total orders and today's orders
  - [x] Average order value across platform
  - [x] Total order value (30d) and per-restaurant average
  - [x] Top 5 restaurants by order volume
  - [x] PDF export capability
  - [x] CSV export capability
- [x] Dedicated analytics query libraries
  - [x] `/lib/analytics/restaurant.ts` for restaurant-level queries
  - [x] `/lib/analytics/platform.ts` for platform-wide queries
- [x] Chart visualization components
  - [x] `OrderTrendChart` (dual-axis line chart)
  - [x] `OrderCountChart` (bar chart)
  - [x] `OrderValueChart` (bar chart)
- [x] Date range selector component
  - [x] Today, This Week, Last 30 Days, Custom range options
  - [x] Custom range wired into the analytics query and dashboard (inclusive dates, daily breakdown, up to 90 days)
- [x] **Week-over-week comparison analytics** (restaurant dashboard)
  - [x] Previous-week orders and order value (8–14 days back)
  - [x] Change percentage badges (▲ / ▼ / 0%) with current-vs-previous breakdown
  - [x] Safe division when no previous-week baseline exists
- [x] **Order status funnel** (restaurant dashboard)
  - [x] Orders per lifecycle stage (NEW → ACCEPTED → PREPARING → READY → SERVED + REJECTED/CANCELLED) over the last 30 days
  - [x] Scoped to the 30-day window so it stays consistent with "Last 30 Days" metrics
- [x] Export functionality
  - [x] PDF export using html2canvas + jsPDF
  - [x] CSV export for data extraction

**Implementation details:**
- Added Recharts library for professional chart visualizations
- Charts display 7-day trends with automatic date formatting
- Tooltips show proper currency formatting and labels
- PDF exports capture full dashboard state
- CSV exports provide raw data for spreadsheet analysis
- All charts are responsive and mobile-friendly
- Both dashboards support multiple export formats
- Queries handle currency formatting and date grouping
- Role-based access: OWNER/MANAGER see restaurant analytics, SUPER_ADMIN sees platform analytics
- Added `/platform/analytics` and `/admin/analytics` routes
- Updated top navigation to include both analytics links

**What still needs to happen:**
1. Test analytics with larger datasets
2. Add real-time analytics updates
3. Create dashboard widgets for key metrics

---

### Phase 8: Testing & Hardening (Week 8) 🟡 IN PROGRESS
- [x] Unit tests (52 passing: order validation, auth schemas, rate limiter incl. header helper, CSV import, analytics)
- [x] Integration tests (analytics query libraries with mocked Supabase client, incl. week-over-week comparisons)
- [x] Initial E2E tests/config added
- [x] Expanded E2E coverage for setup rename/delete/import and public QR menu flow
- [x] **Full E2E suite green (5/5)** — auth-requiring tests unblocked by loading `.env.local` in `playwright.config.ts`; broadcast test added
- [x] Rate limiting added (Task 6.3) and wired into public API routes
- [x] Security review (initial pass complete)
- [x] **Bug fixes from E2E hardening round:**
  - Broadcast channel-name mismatch (`public-order-status-<id>` vs documented `order-status-<id>`) fixed in `usePublicOrderStatus`
  - Recovery (password-reset) links now redirect to `/reset-password` after `verifyOtp` instead of landing on `/login?verified=1` (`/auth/callback` route)

**Implementation details:**
- Added `@` path alias to `vitest.config.ts` so tests resolve `@/lib/...` imports
- `src/lib/validation/__tests__/orders.test.ts` — 10 cases for `createOrderSchema`
- `src/lib/auth/__tests__/schemas.test.ts` — 9 cases for registration and password reset schemas
- `src/lib/utils/__tests__/rateLimit.test.ts` — 9 cases for the rate limiter + `getRateLimitHeaders`
- Rate limiter applies to `/api/orders` POST (30 req / 10 min) and `/api/order-status/[trackingToken]` GET (120 req / min); `X-RateLimit-Remaining` now included on **every** response via shared `getRateLimitHeaders` helper, `Retry-After` on 429
- Extracted CSV parsing from `RestaurantSetupConsole` into `src/lib/csv/menu-import.ts` (shared, testable)
- `src/lib/csv/__tests__/menu-import.test.ts` — 15 cases covering quoting, escaped quotes, trimming, validation errors, price checks, and duplicate detection
- `src/lib/analytics/__tests__/restaurant.test.ts` — 6 cases: zeroed metrics, query error, today/week/previous-week/month totals, change percentages, top products, 7-day trend, null items, no-baseline handling, custom-range window
- `src/lib/analytics/__tests__/platform.test.ts` — 3 cases: query error, cross-restaurant metrics, join array/unknown-name handling
- Fixed timezone bug in `getRestaurantAnalytics`: date bucketing now uses local-timezone date keys (toLocalDateKey) instead of `toISOString().split('T')` which shifted dates in timezones east of UTC (e.g. Europe/Athens)
- Added week-over-week comparison: `previousWeekOrders`, `previousWeekValue`, `weekOrdersChangePct`, `weekValueChangePct` to `getRestaurantAnalytics` (previous week = the 7 days before the current rolling week)
- `AnalyticsConsole` renders the comparison with ▲/▼/0% badges under "This Week"
- Added custom date-range support: `getRestaurantAnalytics(restaurantId, { from, to })` returns `rangeOrders`, `rangeValue`, `rangeAverageOrderValue`, and `rangeDaily` (inclusive local-date window, capped at 90 days); the dashboard re-queries and shows a "Custom Range" panel with a daily breakdown
- Initial security review: `.env*` gitignored, service-role key server-only, rate limits on public APIs, broadcast publishing gated to staff (migration 007), order data only exposed via API routes

---

### Phase 9: Pilot Deployment (Week 9+)
- [ ] Deploy to production
- [ ] Onboard pilot restaurants
- [ ] Monitor and iterate

---

## 📊 Progress Summary

| Phase | Status | Completion |
|-------|--------|-----------|
| 1. Foundation | 🟢 100% | Supabase and Vercel deployment complete |
| 2. Database | 🟢 100% | Schema applied and seeded on the live Supabase project |
| 3. Auth | 🟡 95% | Registration email hook added; email verification via Supabase Confirm signup template + /auth/callback + /verify-email; reset-password redirect fixed in /auth/callback, end-to-end inbox confirmation still pending |
| 4. Restaurant Setup | 🟢 95% | Setup workspace supports create/edit/toggle/delete flows, QR print/export, preview-first CSV import, team management, staff-to-table assignment, and E2E coverage |
| 5. Customer Ordering | 🟢 100% | Public QR ordering, submission, and tracking status surfaces are now live with optimized polling and status timeline |
| 6. Real-Time & Dashboard | 🟡 95% | Staff real-time subscriptions + public broadcast tracking (channel-name bug fixed + E2E verified) + reconnect/retry logic + rate-limit headers verified |
| 7. Analytics & Admin | 🟢 100% | Full analytics suite: WoW comparisons, custom date ranges, order status funnel, exports, timezone fixes, staff performance analytics |
| 8. Testing | 🟡 90% | 56 unit/integration tests passing; full E2E suite green 5/5 incl. broadcast + auth-requiring tests; remaining items are live/manual verifications |
| 9. Pilot Deployment | ⚪ 0% | After testing complete |

---

## 🚀 Next Immediate Actions

### Right Now (Do This First)
1. **✅ Done** — Phase 7 funnel + Phase 6 reconnect/retry committed and pushed (`b82c9d1`)
2. **✅ Done** — `npm run typecheck && npm run build` passes; all 52 unit/integration tests pass
3. **✅ Done** — Full E2E suite re-run with real-time implementation (1 passed, 3 skipped)
4. **✅ Done** — Rate-limit headers (`X-RateLimit-Remaining` on all responses, `Retry-After` on 429) live-verified and committed
5. **✅ Done** — E2E credentials wired: `playwright.config.ts` loads `.env.local` via `@next/env`; `npx playwright test` now passes **5/5** (previously 1 passed / 3 skipped)
6. **✅ Done** — Broadcast flow verified & fixed: channel-name mismatch in `usePublicOrderStatus` (listener vs publisher) fixed; new E2E test proves order acceptance updates the tracking page history panel via broadcast in <3.5s
7. **✅ Done** — Reset-password recovery redirect fixed in `/auth/callback` (recovery links now go to `/reset-password` after `verifyOtp`)
8. **✅ Done** — Confirmation email flow hardened: hybrid `dispatchConfirmationEmail` (generateLink + Resend primary, Supabase fallback); "email rate limit exceeded" root cause fixed; register form now shows a pending state with a direct resend path
9. **✅ Done** — Real `RESEND_API_KEY` added to `.env.local` + Vercel; delivery verified to the owner's address. To send to customers, verify a domain at resend.com/domains and set `RESEND_FROM_EMAIL`
10. **✅ Done** — Multi-restaurant support: `addRestaurant` server action + "Add another restaurant" form on `/platform`; restaurant switcher for multi-membership users in Orders/Setup/Analytics (live-verified end-to-end)
11. **✅ Done** — Root-cause fix for server-side auth: upgraded `@supabase/ssr` `0.0.9` → `0.12.4` (old version silently ignored the app's `getAll`/`setAll` cookie API → every server-side `getUser()` returned "Auth session missing!"); all 5 E2E tests still pass
12. **✅ Done** — Team management CRUD on `/platform/team` (add by email, roles, remove, restaurant selector) — was a placeholder
13. **✅ Done** — Staff-to-table connection: `restaurant_tables.assigned_staff_id` + `orders.waiter_id` (migration 008 live); setup dropdown + "Take order" in orders workspace
14. **✅ Done** — Staff performance analytics (orders handled, revenue served, tables, avg order value) + SUPER_ADMIN branch in analytics console
15. **✅ Done** — Critical RLS fix (migration 009): staff could not see their own memberships → couldn't use the platform; now they can
16. **✅ Done** — Reset-password verified end-to-end with a real inbox-backed account (request reset → email link → `/reset-password` → update password → login with new password)
17. **✅ Done** — Menu modifiers + allergens: schema (migration 010), setup editor, customer option selection with delta pricing, API validation/snapshotting, display everywhere
18. **✅ Done** — Split the bill on the tracking page (equal split or per-item guest assignment) — live-verified
19. **✅ Done** — UI refresh: modern sans-serif design system across the app
20. **✅ Done** — Final touch: simplified nav, QR URLs use site origin, new-order notifications, home dashboard (tables/orders/team), staff table claiming, realtime publication + multi-event hook fixes
21. **✅ Done** — Greek translation (EN/EL toggle, persisted), Login separated in nav, green/red table status pills
22. **✅ Done** — "Add another restaurant" restored on home; Setup menu editor redesigned (category accordion, item table quick-edit, item details expansion)
23. **✅ Done** — Order survives refresh: after a customer submits, the tracking token is stored in `localStorage` (keyed by table token); revisiting/refreshing the table QR page validates the order and redirects to `/orders/{token}` while active, or clears it once SERVED/CANCELLED/REJECTED so they can order again (E2E-covered)
24. **✅ Done** — Submitted timestamp (`created_at`) now shown on every order card in the Orders workspace ("Submitted: …"), matching the customer tracking page
25. **✅ Done** — Green Bar test data seeded live + `supabase/seed.sql` updated: 10 tables (Table 1–3 keep original QR tokens), 5 categories, 14 menu items, 3 STAFF accounts (`staff1..3@greenbar.test` / `GreenBar2026!`)
26. **✅ Done** — SUPER_ADMIN data deletion: `/admin` "Data management" panel (delete orders — all/by restaurant/older than N days — delete sessions, delete restaurant) + per-order "Delete order" button in Orders workspace; all gated server-side on `platform_admin_users`
27. **✅ Done** — Orders workspace filters & sorting: status tabs (All / New / Accepted / Preparing / Ready / Served / Closed) with live counts, plus sort by submission time (newest/oldest) or workflow status; order fetch limit raised to 200; E2E-covered
28. **✅ Done** — Greek translation extended across the platform: Orders, Home (finished), Admin, Team, Settings, Setup, Analytics, auth forms (register/forgot/reset/verify), sign-out and add-restaurant form — all wired through the i18n provider (`en` strings kept identical so E2E stays green)
29. **✅ Done** — Home page revisited: live metrics (today's orders, open orders, revenue today, occupied tables), quick-actions panel (Orders / Analytics / Setup / Team / Admin for SUPER_ADMIN), recent-live-orders timestamps, and localized "Add another restaurant" block
30. **✅ Done** — Home live orders: each order shows the submission timestamp and a "View summary / Hide summary" toggle with the customer-style line-item breakdown (items, modifiers, customer note, total); fetch widened to 100 orders with line items
31. **✅ Done** — Home live tables: each table card now lists its linked orders with per-order status, item count, total, and submission time
32. **✅ Done** — New-order notifications on the home dashboard are realtime and targeted: the restaurant owner/platform admin and the staff member who claimed the table get the "🔔 New order received" banner (other staff only see the refresh). Fixed a Supabase Realtime quirk where the `CHAR(3)` currency arrives truncated in INSERT payloads — banner now uses the restaurant's currency resolved on load. E2E-covered
33. **✅ Done** — New-order notification banner has **Accept / Dismiss**: Accept moves the order to ACCEPTED (records status history + refreshes), Dismiss just hides it. E2E-covered
34. **✅ Done** — Customer-facing pages are minimal: the platform navigation bar is hidden on `/t/[token]` and `/orders/[trackingToken]`; the tracking page now offers a **New order** button (clears the remembered order for the table and returns to the menu — table QR token is exposed via the order-status API). E2E-covered
35. **✅ Done** — Timestamps made complete (`14 Aug 2026, 15:57`, with year) on the home live orders and Orders workspace; verified live-order timestamps and per-table order summaries render for both SUPER_ADMIN and STAFF (a stale Vercel deploy would show them missing)
36. **✅ Done** — Orders workspace note fields are collapsible: the customer-note and line-note editors only render when they contain a note (or when "Add customer note / Add line note" is clicked); empty notes no longer take up space
37. **✅ Done** — QR sheet QR codes now fit their cards: SVGs scale to the box (`max-width: 100%`) and the grid packs more columns (`auto-fill` + `min-width: 0`), so 10 tables wrap into more lines
38. **✅ Done** — Timestamps use `DD/MM/YY HH:MM` (e.g. `14/08/26 15:57`) across the home live orders, Orders workspace, and the customer tracking timeline
39. **✅ Done** — Live tables are expandable in two steps: "Show orders / Hide orders" reveals a table's linked orders (status · items · total · time), and clicking an order expands the customer-style line-item summary
40. **✅ Done** — "Add item" in the Orders workspace replaced the long `<select>` with a searchable picker (type to filter by name/category, click a result to select); keeps the quantity input and Add button
41. **✅ Done** — E2E suite runs serially (`workers: 1`) because the tests share one live Supabase project and parallel workers were accepting/seeing each other's orders via the shared realtime stream
42. **✅ Done** — Notification pane: banner persists until Accept/Dismiss; **Accept** moves the order to ACCEPTED everywhere (fixed a race where Accept could no-op if the order wasn't yet in local state); banner shows "🔔 Order {n} — Table · total" with a **View summary** toggle (line items)
43. **✅ Done** — Customer language toggle (EN/EL) on the table menu and tracking pages via `src/components/app/language-toggle.tsx`
44. **✅ Done** — "Added to cart" confirmation toast when an item is added
45. **✅ Done** — Live-tables overflow fix: `.metric { min-width: 0 }` + wrapping order-row buttons so expanded cards don't overlap the next column
46. **✅ Done** — "Dismiss order" on the home dashboard (live orders + table order summaries) marks the order REJECTED with confirm + status history
47. **✅ Done** — Sequential order numbers: `013_order_number.sql` (per-restaurant sequence via trigger + advisory lock) **applied to the live DB**; UI shows "Order 89" everywhere (orders workspace, tracking page, banner, success box)
48. **✅ Done** — Category horizontal bar on the ordering page (sticky, smooth-scroll to category)
49. **✅ Done** — Email confirmation: code already delivers via Resend (primary) with Supabase fallback; staff invitations now auto-confirm (`email_confirm: true`) so they never need a confirmation email. Remaining is dashboard config (verify a Resend domain / Supabase SMTP + set Auth Site URL) — see item 52
50. **✅ Done** — Anonymous users only see the login page: middleware protection added. **Important:** the app uses `src/` so Next expects middleware at `src/middleware.ts` — the root `middleware.ts` was never loaded; moved it and wired session-check redirects (public: `/t/*`, `/orders/*`, auth + signup routes). Login `next` param hardened against open redirects
51. **✅ Done** — Staff invited by restaurant owner/manager without a prior account: `addTeamMember` now creates the auth user (`email_confirm: true`) and sends an invitation email with a password-set link (Resend primary, Supabase "Reset Password" fallback)
52. **Next (manual config)** — Set the Auth **Site URL** in Supabase dashboard → Authentication → URL Configuration to the production origin (`https://waiter-ai-iota.vercel.app`) so the built-in "Confirm signup" links (now handled by the new `/auth/confirm` route) work. Everything else is free-tier: confirmation emails already flow through Resend's HTTP API (no Supabase SMTP → no Pro needed) and fall back to Supabase's built-in template, which is also included in the free plan (rate-limited)
53. **Future work** — Shift-based table assignment

### After Timeline Verified
```bash
# Verify status timeline renders with live orders
# Test acceptance flow updates history panel on /orders/[trackingToken]
# Confirm rate limit headers on public API responses
```

---

## 📝 Important Notes

### Security Reminders
- ✅ `.env.local` is in `.gitignore` (won't be committed)
- ✅ Never commit `SUPABASE_SERVICE_ROLE_KEY` to git
- ✅ Only share credentials with team members who need them
- ✅ Rotate keys regularly in production

### Development Flow
1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally
3. Run `npm run typecheck && npm run test`
4. Commit: `git commit -m "feat: description"`
5. Push and create PR on GitHub

### When Stuck
- Check `DEVELOPMENT.md` troubleshooting section
- Review error logs in browser console (`F12`)
- Check Supabase dashboard for project status
- See IMPLEMENTATION_PLAN.md for technical details

---

## 📞 Questions or Issues?

Refer to these documents in order:
1. **Quick setup?** → `DEVELOPMENT.md`
2. **Supabase problems?** → `SUPABASE_SETUP.md`
3. **Architecture questions?** → `MVP_DESIGN.md`
4. **Task details?** → `IMPLEMENTATION_PLAN.md`
5. **Original spec?** → `readme.md`

---

**Last commit:** feat — category accordion menu editor with quick table edits, restored add-restaurant form (see log for hash)
**Next commit:** confirm "Confirm signup" template site URL; Resend domain verification + shift-based table assignment (future work)
