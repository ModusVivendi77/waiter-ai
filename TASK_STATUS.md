# Waiter AI — Task Status Tracker

**Last Updated:** August 12, 2026
**Current Phase:** 4 — Restaurant Setup

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

**Live verification completed:**
- [x] Owner signup creates `auth.users`, `restaurants`, and `restaurant_users` records
- [x] Login works against live Supabase Auth
- [x] Protected platform routes load with role-based access using the live browser session
- [x] Forgot-password request path is wired and returns a live auth response
- [x] Registration notification email hook added (Resend-backed when configured)

**What still needs to happen:**
1. Complete the reset-password flow with a real inbox-backed account
2. Decide whether to keep the current client-side protected-route strategy or revisit SSR session handling later

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
- [x] Table activation/deactivation and table deletion
- [x] Menu category creation
- [x] Guarded category deletion (blocked when linked items exist)
- [x] Menu item creation
- [x] Menu item availability toggle and item deletion
- [x] CSV text import for menu bootstrap (`category,name,description,price`)

**What still needs to happen:**
1. Add edit/rename flows for tables, categories, and menu items
2. Add downloadable/printable QR code rendering
3. Add robust CSV parsing/validation and duplicate handling
4. Add E2E coverage for setup workflows

---

### Phase 5: Customer Ordering (Week 5)
- [ ] QR landing page
- [ ] Menu browser
- [ ] Shopping cart
- [ ] Order submission

---

### Phase 6: Real-Time & Dashboard (Week 6)
- [ ] Real-time subscriptions
- [ ] Restaurant dashboard
- [ ] Order status updates

---

### Phase 7: Analytics & Admin (Week 7)
- [ ] Restaurant analytics
- [x] SUPER_ADMIN account foundation (schema + admin route guard)
- [ ] Platform admin panel

---

### Phase 8: Testing & Hardening (Week 8)
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Security review

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
| 3. Auth | 🟡 95% | Registration email hook added; reset-password end-to-end still pending inbox confirmation |
| 4. Restaurant Setup | 🟡 50% | Setup workspace now supports create/toggle/delete flows plus CSV bootstrap |
| 5. Customer Ordering | ⚪ 0% | Waiting on restaurant setup |
| 6. Real-Time & Dashboard | ⚪ 0% | Waiting on ordering |
| 7. Analytics & Admin | ⚪ 0% | Waiting on orders |
| 8. Testing | ⚪ 0% | Throughout development |
| 9. Pilot Deployment | ⚪ 0% | After testing complete |

---

## 🚀 Next Immediate Actions

### Right Now (Do This First)
```bash
# 1. Verify production environment variables in Vercel
#    NEXT_PUBLIC_SUPABASE_URL
#    NEXT_PUBLIC_SUPABASE_ANON_KEY
#    SUPABASE_SERVICE_ROLE_KEY
#    NEXT_PUBLIC_APP_URL=https://waiter-ai-iota.vercel.app

# 2. Smoke test production deployment
#    https://waiter-ai-iota.vercel.app/login
#    https://waiter-ai-iota.vercel.app/platform/signup
#    https://waiter-ai-iota.vercel.app/platform

# 3. Continue Phase 4 hardening
#    Add rename/edit flows, QR rendering, and stronger CSV validation
```

### After Supabase Setup Confirmed
```bash
# Start dev server to verify everything works
npm run dev

# In another terminal, check for errors
# Visit http://localhost:3000
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

**Last commit:** `ace015d`
**Next commit:** Add Phase 4 setup polish (rename flows, QR rendering, CSV validation)
