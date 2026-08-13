# Waiter AI — Task Status Tracker

**Last Updated:** August 13, 2026
**Current Phase:** 8/9 — Testing & Hardening In Progress

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
- Confirmation email dispatched via `admin.auth.resend({ type: 'signup' })` — uses the project's existing Supabase "Confirm signup" template
- `/auth/callback` handles the template's `?token_hash=...&type=signup` link, calls `verifyOtp({ token_hash })`, and redirects to `/login?verified=1` on success (or `/verify-email?error=invalid-link` on failure)
- `resendConfirmationEmail` is rate-limited to 3 sends per 10 minutes per email
- `sendRegistrationEmail` (Resend-backed welcome email) still fires after account provisioning

**What still needs to happen:**
1. Complete the reset-password flow with a real inbox-backed account
2. Confirm the "Confirm signup" template's site URL is set to `<APP_URL>/auth/callback` in Supabase Auth settings
3. Decide whether to keep the current client-side protected-route strategy or revisit SSR session handling later

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

**What still needs to happen:**
1. Add broader setup E2E scenarios for rename/delete/import success paths
2. Add QR PDF/export batching if printable assets need exact page sizing
3. Decide whether to graduate Phase 4 from scaffold/hardening into full production verification

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

**What still needs to happen:**
1. Add public guardrails around order edits/cancellation windows if needed
2. Expand automated checks around multi-item totals and item removal edge cases
3. Re-run full E2E suite after real-time implementation

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

**What still needs to happen:**
1. Test real-time functionality end-to-end in staging
2. Monitor real-time connection stability and latency metrics
3. Re-run full E2E suite with new real-time implementation

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
- [x] Unit tests (50 passing: order validation, auth schemas, rate limiter, CSV import, analytics)
- [x] Integration tests (analytics query libraries with mocked Supabase client, incl. week-over-week comparisons)
- [x] Initial E2E tests/config added
- [x] Expanded E2E coverage for setup rename/delete/import and public QR menu flow
- [x] Rate limiting added (Task 6.3) and wired into public API routes
- [x] Security review (initial pass complete)

**Implementation details:**
- Added `@` path alias to `vitest.config.ts` so tests resolve `@/lib/...` imports
- `src/lib/validation/__tests__/orders.test.ts` — 10 cases for `createOrderSchema`
- `src/lib/auth/__tests__/schemas.test.ts` — 9 cases for registration and password reset schemas
- `src/lib/utils/__tests__/rateLimit.test.ts` — 7 cases for the rate limiter
- Rate limiter applies to `/api/orders` POST (30 req / 10 min) and `/api/order-status/[trackingToken]` GET (120 req / min) with `Retry-After` and `X-RateLimit-Remaining` headers
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
| 3. Auth | 🟡 95% | Registration email hook added; email verification via Supabase Confirm signup template + /auth/callback + /verify-email; reset-password end-to-end still pending inbox confirmation |
| 4. Restaurant Setup | 🟡 95% | Setup workspace now supports create/edit/toggle/delete flows, QR print/export, preview-first CSV import, and E2E coverage |
| 5. Customer Ordering | 🟢 100% | Public QR ordering, submission, and tracking status surfaces are now live with optimized polling and status timeline |
| 6. Real-Time & Dashboard | 🟡 85% | Staff real-time subscriptions + public broadcast tracking + reconnect/retry logic; staging E2E verification pending |
| 7. Analytics & Admin | 🟢 100% | Full analytics suite: WoW comparisons, custom date ranges, order status funnel, exports, timezone fixes |
| 8. Testing | 🟡 60% | 50 unit/integration tests passing; rate limiting + security pass complete |
| 9. Pilot Deployment | ⚪ 0% | After testing complete |

---

## 🚀 Next Immediate Actions

### Right Now (Do This First)
```bash
# 1. Commit Phase 7 funnel + Phase 6 reconnect/retry
git add .
git commit -m "feat: add order status funnel and real-time reconnect logic

- Add statusFunnel to getRestaurantAnalytics (order lifecycle stages over 30 days)
- Render Order Status Funnel panel in AnalyticsConsole
- Add reconnect/retry with exponential backoff to use-public-order-status and use-supabase-subscription hooks"
git push origin master

# 2. Validate changes with production build and tests
npm run typecheck && npm run build && npx vitest run

# 3. Next: Phase 6 staging E2E verification or full E2E re-run with real-time implementation
```

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

**Last commit:** Phase 7 custom date-range analytics (`a2f7d91`)
**Next commit:** Phase 7 order status funnel + Phase 6 reconnect/retry (see commit command above)
