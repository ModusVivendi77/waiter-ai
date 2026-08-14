# Waiter AI — CHECKPOINT (created 14 Aug 2026)

> Saved because the OneDrive folder (CloudStorage) hit a filesystem lock.
> After the reboot, resume from **"After reboot"** below.

---

## 1. State

### Committed & deployed to production (origin/master @ `a7422dd`)
| Commit | Work |
|---|---|
| `0e62a1b` | Order refresh persistence, orders filters/sort, Greek i18n, home metrics, SUPER_ADMIN data tools |
| `b3408e1` | Home live order summaries, table order summaries, targeted new-order notifications |
| `2a682fe` | Accept/Dismiss new-order banner, minimal customer UI + new order, fuller timestamps |
| `d385192` | Collapsible customer/line notes in Orders workspace |
| `a7422dd` | QR sheet fit, DD/MM/YY HH:MM timestamps, expandable live-table orders, searchable add-item picker, E2E serial (`workers: 1`) |

All five are on `origin/master` → Vercel production is running `a7422dd`.

### PENDING — implemented, validated, but NOT committed (working tree)
> Everything below passed `npm run typecheck`, `npx vitest run` (56/56) and
> `npx playwright test` (12/12) BEFORE the OneDrive lock hit.

1. **Notification pane** — banner persists until Accept/Dismiss; **Accept** moves the order to ACCEPTED (DB + status history, refreshes everywhere); banner now shows "🔔 Order {number} — Table · total" and has a **View summary** toggle with the line-item summary.
2. **Customer language toggle** — new `src/components/app/language-toggle.tsx`; fixed EN/EL button on the table menu page and the tracking page.
3. **Cart confirmation toast** — "Added to cart" pops up when an item is added (`table-ordering-experience.tsx`).
4. **Live tables overflow fix** — `.metric { min-width: 0 }` + wrapping order-row buttons so expanded cards don't overlap the next column.
5. **Dismiss orders from home dashboard** — "Dismiss order" button in expanded order summaries (live orders + live tables) → marks order **REJECTED** (confirm + status history + refresh).
6. **Sequential order numbers** — `supabase/migrations/013_order_number.sql` (**ALREADY APPLIED to the live DB**): per-restaurant `order_number` via trigger + advisory lock; orders are now `Order 89` everywhere — Orders workspace cards, customer tracking page, notification banner, success box.
7. **Category horizontal bar** — sticky category nav on the ordering page; clicking smooth-scrolls to the category.

**Files changed (pending):** `home-dashboard.tsx`, `orders-console.tsx`, `order-status-view.tsx`, `table-ordering-experience.tsx`, `restaurant-setup-console.tsx`, `globals.css`, `translations.ts`, `app/api/orders/route.ts`, `app/api/order-status/[trackingToken]/route.ts`, `app/orders/[trackingToken]/page.tsx`, new `src/components/app/language-toggle.tsx`, new `supabase/migrations/013_order_number.sql`, tests.

**Migration note:** while applying `013` via the CLI, migrations `008–011` were also recorded as applied in the CLI's remote history (they were applied manually before). The schema is correct; the DB now has `orders.order_number`.

---

## 2. After the reboot — resume here

1. Verify the folder is readable: `cd .../waiter_ai && git status --short`
2. `npm run build` (final check)
3. `git add -A && git commit -m "feat: notification summary + dismiss, customer lang toggle, cart toast, category nav, order numbers"`
4. `git push origin master` → Vercel auto-deploys.

---

## 3. Next steps (new feature requests)

### A. Email confirmation — can it be tackled?
**Yes.** Current: `dispatchConfirmationEmail` sends via Resend (primary) with Supabase's built-in email as fallback. The gap is that Resend's domain (`*.vercel.app`) can't be verified, and Supabase's built-in sender is rate-limited / may hit spam.
- **For staff invitations (see C):** create auth users via the admin API with `email_confirm: true` → no confirmation email needed at all (recommended path).
- **For owner signup:** make the confirmation reliable —
  1. Verify a real custom domain in Resend and set `RESEND_FROM_EMAIL` to that verified sender, OR
  2. Configure Supabase Auth → SMTP with a real domain so the built-in sender is trustworthy, and
  3. Ensure the Auth email template's **Site URL** is `<APP_URL>/auth/callback` (confirmation links currently point at the default site URL — a known follow-up in TASK_STATUS).

### B. Not logged in → only the login page
Add server-side protection in `middleware.ts` (Next.js middleware + `@supabase/ssr` cookie helpers):
- No session + path in `['/', '/platform/*', '/admin/*']` → redirect to `/login?next=<path>`.
- Keep public: `/t/*`, `/orders/*`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/platform/signup`, `/auth/*`.
- Keep the existing client-side role guards as a second layer.
- Note: the customer QR flow (`/t/`, `/orders/`) must stay public.

### C. Staff invited by manager — no prior account
Modify the `addTeamMember` server action (currently requires the email to already be an auth user):
- If no account exists → `admin.auth.admin.createUser({ email, password: <random>, email_confirm: true })` (auto-confirmed, skips email confirmation).
- Deliver a password-set link via `admin.generateLink({ type: 'invite', email, options: { redirectTo: '<app>/auth/callback?next=/reset-password' } })`, sent through Resend (fallback: Supabase email). Invited staff sets their own password and logs in.
- Access stays gated by the existing `authorizeRestaurantManager` (OWNER or platform admin); optionally allow MANAGERs to invite too.
- Ties into A: invited staff never need the confirmation email.
