# Waiter AI — QR Restaurant Ordering Platform MVP Design

**Document Status:** High-level MVP Design & Implementation Roadmap  
**Date:** August 2026  
**Target Release:** Q4 2026  

---

## 1. Executive Summary

**Waiter AI** is a web-based SaaS platform that enables restaurant customers to order food and drinks directly from their table using a QR code—no account signup required. The platform provides real-time order management for restaurants and instant status tracking for customers.

### Core Value Proposition

```
Customers          →  Scan QR, browse menu, order from table (no app needed)
Restaurants        →  Receive orders in real-time, manage table workflow
Platform owners    →  Recurring revenue through subscription model
```

---

## 2. MVP Scope

### 2.1 In Scope

#### Customer Experience
- ✅ Scan unique table QR code
- ✅ Browse restaurant menu (categories/items)
- ✅ Add items to cart with quantity/notes
- ✅ Review cart and submit order
- ✅ View real-time order status
- ✅ No account required

#### Restaurant/Staff Experience
- ✅ Register and create restaurant profile
- ✅ Create/manage restaurant tables
- ✅ Generate and print QR codes
- ✅ Build and manage menu (categories/items)
- ✅ Import menu via CSV
- ✅ Receive orders in real-time dashboard
- ✅ Accept/reject/update order status
- ✅ View order history and analytics
- ✅ Manage staff roles (OWNER, MANAGER, STAFF)
- ✅ Platform administration via SUPER_ADMIN accounts

#### Platform
- ✅ Role-based access control (RBAC)
- ✅ Basic platform analytics
- ✅ Row-level security (RLS) enforced
- ✅ Responsive mobile/tablet UI
- ✅ Secure authentication

### 2.2 Explicitly Out of Scope

- ❌ Online payments (Stripe/Viva integration)
- ❌ Tips/split bills
- ❌ Customer accounts
- ❌ Native mobile apps
- ❌ POS/KDS integration
- ❌ SMS/WhatsApp notifications
- ❌ Multi-location chains
- ❌ Delivery management
- ❌ Inventory system

**Note:** Architecture designed to support future payment/POS integration without major refactoring.

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER (Mobile Web)                     │
│                                                              │
│  Scan QR → Browse Menu → Cart → Order → Track Status       │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     VERCEL (Edge)                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Next.js 15+ / React / TypeScript                     │  │
│  │                                                       │  │
│  │  • Customer UI (/t/{token})                          │  │
│  │  • Restaurant Dashboard (/platform/orders)           │  │
│  │  • Admin Dashboard (/admin)                          │  │
│  │  • Server Actions & API Routes                       │  │
│  │  • Real-time Subscriptions                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE                                 │
│                                                              │
│  • PostgreSQL Database (with RLS)                           │
│  • Authentication (Email/Password via Supabase Auth)        │
│  • Real-time subscriptions                                  │
│  • File storage (for menu images, logos)                    │
│  • Row-level security policies                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Single codebase** — Customer, restaurant, and admin UIs in one Next.js app
2. **Server-first** — Next.js Server Components and Server Actions
3. **No separate backend** — Use managed Supabase infrastructure
4. **Tenant isolation** — RLS enforces data boundaries
5. **Real-time by default** — Supabase Realtime for instant updates
6. **Stateless auth** — Supabase Auth handles sessions

---

## 4. Core User Flows

### 4.1 Customer Ordering Flow

```
1. Scan QR code at table
   ↓
2. Server validates QR token
   ↓
3. Display restaurant logo + table name
   ↓
4. Click "Start Order" → Load menu
   ↓
5. Browse categories/items
   ↓
6. Add items with quantity + optional notes
   ↓
7. Review cart (items + total)
   ↓
8. Submit order
   ↓
9. Server validates items/prices/availability
   ↓
10. Create order (transactional)
    ↓
11. Return order status view
    ↓
12. Listen for real-time updates
    ↓
13. Display status progression (NEW → ACCEPTED → PREPARING → READY → SERVED)
```

### 4.2 Restaurant Management Flow

```
1. Restaurant owner registers
   ↓
2. Create restaurant profile
   ↓
3. Add staff members (roles: OWNER, MANAGER, STAFF)
   ↓
4. Create tables (e.g., Table 1–20)
   ↓
5. Generate QR codes for each table
   ↓
6. Download/print QR codes as PDF
   ↓
7. Place QR codes on tables
   ↓
8. Create menu categories (Food, Drinks, etc.)
   ↓
9. Add items to categories (name, description, price, image)
   ↓
10. Import additional items via CSV (optional)
    ↓
11. Go live — receive orders
```

### 4.3 Order Management Flow

```
Restaurant Dashboard:

NEW order arrives (real-time)
   ↓
Staff reviews: items, quantity, notes, total
   ↓
Accept / Reject
   ↓
If Accepted:
   • Update status: ACCEPTED
   • Start preparation
   • Update status: PREPARING
   • When ready: READY
   • When served: SERVED
   ↓
Customer sees each status change (real-time)
```

---

## 5. Technology Stack

### Frontend
- **Framework:** Next.js 15+ (App Router)
- **UI Library:** React 19
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui
- **Forms:** React Hook Form + Zod validation
- **Real-time:** Supabase JavaScript client

### Backend
- **Runtime:** Node.js (via Vercel)
- **Server:** Next.js Server Components & Server Actions
- **API:** Next.js Route Handlers
- **Database client:** Supabase PostgREST client

### Database & Infrastructure
- **Database:** PostgreSQL (Supabase)
- **Auth:** Supabase Auth (Email/Password)
- **Real-time:** Supabase Realtime subscriptions
- **Storage:** Supabase Storage (images)
- **Hosting:** Vercel (auto-scaling, edge functions)
- **Database migrations:** Supabase migrations

### QR Generation
- **Library:** `qrcode` or `qr-code-styling` (TypeScript-compatible)
- **Output:** SVG/PNG for download and PDF printing

### Testing
- **Unit/Integration:** Vitest or Jest
- **E2E:** Playwright
- **Component:** React Testing Library

### DevOps & Monitoring
- **VCS:** GitHub
- **CI/CD:** GitHub Actions
- **Monitoring:** Sentry (error tracking)
- **Analytics:** Basic in-app dashboards
- **Deployment:** Vercel (preview → production)

---

## 6. Database Schema (High-Level)

### Core Tables

#### `restaurants`
- Restaurant profile, currency, timezone
- Logo, branding

#### `restaurant_users`
- Links users to restaurants
- Roles: OWNER, MANAGER, STAFF

#### `platform_admin_users`
- Maps auth users to SUPER_ADMIN access
- Grants service-level visibility and operational controls across tenants

#### `restaurant_tables`
- Table name and unique QR token
- Active/inactive status

#### `dining_sessions`
- Tracks customer group currently at table
- Status: ACTIVE, CLOSED

#### `menu_categories`
- Food, Drinks, Cocktails, etc.
- Sort order for menu display

#### `menu_items`
- Item name, description, price, image
- Availability (active/inactive)

#### `orders`
- Order metadata (restaurant, table, session, status)
- Subtotal, total, currency
- Status: NEW → ACCEPTED → PREPARING → READY → SERVED

#### `order_items`
- Items in order with quantity, unit price, notes
- Stores snapshots (prices don't change if menu changes)

#### `order_status_history`
- Audit trail of status changes
- Enables analytics: acceptance time, prep time, service time

### Key Design Decisions

- ✅ **Soft deletion:** Deactivate items/tables rather than delete
- ✅ **RLS mandatory:** Every table protected by row-level security
- ✅ **Snapshots:** Order items store prices at creation time
- ✅ **Transactions:** Order creation atomic (no orphaned records)
- ✅ **Indexes:** On frequently queried columns (restaurant_id, table_id, status, created_at)
- ✅ **Denormalization:** Store restaurant_id directly in order items for query efficiency

---

## 7. Security Model

### Authentication
- **Customers:** No auth required (anonymous access via QR token)
- **Restaurant staff:** Email/password via Supabase Auth
- **Platform admins:** Email/password via Supabase Auth + SUPER_ADMIN assignment
- **Sessions:** Managed by Supabase

### Authorization (RLS)
```sql
-- Restaurant users can only access their own restaurant's data
-- Customers can only access public menu and their own order via token
-- Staff can only access based on role
```

### Public Access (QR Orders)
- ✅ QR endpoint validates token
- ✅ Tokens are cryptographically random (not sequential table IDs)
- ✅ Rate limiting on public endpoints (e.g., 20 submissions per 10 min per IP)
- ✅ Server validates prices/availability (never trust client)
- ✅ Idempotency key prevents duplicate submissions

### Secrets & Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL           (public)
NEXT_PUBLIC_SUPABASE_ANON_KEY      (public)
SUPABASE_SERVICE_ROLE_KEY          (backend only)
NEXT_PUBLIC_APP_URL                (public)
```

---

## 8. Key Features Breakdown

### Customer Features
| Feature | Priority | Complexity |
|---------|----------|-----------|
| Scan & QR validation | P0 | Low |
| Browse menu with categories | P0 | Low |
| Add to cart (qty, notes) | P0 | Low |
| Submit order | P0 | Medium |
| Real-time status tracking | P0 | Medium |
| View order history | P1 | Low |
| Mobile responsive | P0 | Medium |

### Restaurant Features
| Feature | Priority | Complexity |
|---------|----------|-----------|
| User registration & login | P0 | Low |
| Restaurant profile setup | P0 | Low |
| Table management | P0 | Low |
| QR generation & print | P0 | Medium |
| Menu management (CRUD) | P0 | Medium |
| CSV import | P1 | Medium |
| Live order dashboard | P0 | High |
| Order status updates | P0 | Medium |
| Order history & analytics | P1 | Low |
| Staff role management | P0 | Low |

### Platform Features
| Feature | Priority | Complexity |
|---------|----------|-----------|
| Admin dashboard | P1 | Medium |
| Platform analytics | P1 | Low |
| Error logging & monitoring | P1 | Low |

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1–2)
**Goal:** Infrastructure ready for development

- [ ] Create GitHub repository
- [ ] Setup Supabase project and database
- [ ] Create Vercel project and connect GitHub
- [ ] Configure CI/CD pipeline (GitHub Actions)
- [ ] Setup environment variables
- [ ] Implement database schema and migrations
- [ ] Setup Supabase RLS policies
- [ ] Create development seed data

**Deliverable:** Development environment with database ready

---

### Phase 2: Authentication & Core Entities (Week 3)
**Goal:** Restaurant users can register and manage core data

- [ ] Implement Supabase Auth integration
- [ ] Build restaurant registration & login
- [ ] Create restaurant profile page
- [ ] Implement role-based access control (OWNER, MANAGER, STAFF)
- [ ] Build staff user management UI
- [ ] Implement authorization middleware

**Deliverable:** Restaurant staff can log in and manage users

---

### Phase 3: Restaurant Setup (Week 4)
**Goal:** Restaurant can configure tables and menu

- [ ] Build table management (create/edit/deactivate)
- [ ] Implement QR token generation
- [ ] Build QR code display & download
- [ ] Create PDF QR code generator (for printing)
- [ ] Build menu category management
- [ ] Build menu item management (CRUD, images, pricing)
- [ ] Implement CSV menu import
- [ ] Build item availability toggle

**Deliverable:** Restaurant can set up tables and complete menu

---

### Phase 4: Customer Ordering (Week 5)
**Goal:** Customer can scan QR, browse menu, and place order

- [ ] Build QR landing page (/t/{token})
- [ ] Implement menu browser (categories, items, images)
- [ ] Build shopping cart with quantity controls
- [ ] Implement order review & submission
- [ ] Add item quantity limits & validation
- [ ] Implement order creation with transaction
- [ ] Add idempotency for duplicate prevention
- [ ] Build customer order status view

**Deliverable:** End-to-end customer ordering works

---

### Phase 5: Real-Time & Restaurant Dashboard (Week 6)
**Goal:** Restaurant receives orders instantly and can manage them

- [ ] Setup Supabase Realtime subscriptions
- [ ] Build restaurant live order dashboard
- [ ] Implement order status update workflow (ACCEPT/REJECT/UPDATE)
- [ ] Add real-time customer status updates
- [ ] Build order history view
- [ ] Implement order status state machine validation
- [ ] Add visual indicators for order status

**Deliverable:** Full real-time order management workflow

---

### Phase 6: Analytics & Admin (Week 7)
**Goal:** Restaurant analytics and platform administration

- [ ] Build restaurant analytics dashboard (orders, revenue, top items)
- [ ] Create platform admin panel
- [ ] Implement restaurant listing & management
- [ ] Add basic system metrics
- [ ] Build restaurant deactivation feature
- [ ] Create support information views

**Deliverable:** Dashboard analytics and admin controls

---

### Phase 7: Hardening & Testing (Week 8)
**Goal:** MVP security, reliability, and quality

- [ ] Implement comprehensive error handling
- [ ] Add rate limiting on public endpoints
- [ ] Implement server-side input validation (Zod)
- [ ] Add logging & monitoring (Sentry)
- [ ] Write unit tests (price calculation, validation)
- [ ] Write integration tests (order flow)
- [ ] Write E2E tests (complete customer journey)
- [ ] Test RLS policies and authorization
- [ ] Mobile browser testing (iOS Safari, Android Chrome)
- [ ] Security audit (secrets, CORS, XSS, SQL injection)
- [ ] Performance testing (menu load time, order submission)

**Deliverable:** Production-ready application

---

### Phase 8: Pilot Deployment (Week 9)
**Goal:** Real-world validation with 1–3 restaurants

- [ ] Deploy to production (Vercel)
- [ ] Onboard pilot restaurants
- [ ] Monitor errors and performance
- [ ] Gather feedback and iterate
- [ ] Fix critical bugs
- [ ] Document operational procedures

**Deliverable:** Live MVP with pilot customers

---

## 10. Critical Success Factors

### Non-Negotiable Principles (from spec section 63)

1. ✅ **TypeScript strict mode** — Type safety from day one
2. ✅ **No secrets in client code** — Service role key server-only
3. ✅ **RLS for all restaurant data** — Tenant isolation mandatory
4. ✅ **Never trust client prices** — Server calculates totals
5. ✅ **Server-side validation** — All mutations validated
6. ✅ **Database transactions** — Multi-step operations atomic
7. ✅ **Idempotency for orders** — Prevent duplicate submission
8. ✅ **Soft deletion** — Never physically delete historical orders
9. ✅ **No premature microservices** — Monolith until proven otherwise
10. ✅ **Payment architecture extensible** — Design for future payments
11. ✅ **Every feature tested** — Unit, integration, E2E
12. ✅ **Mobile-first UX** — Customer experience prioritized
13. ✅ **Tablet-friendly dashboard** — Restaurant workflow optimized

### Performance Targets

| Metric | Target |
|--------|--------|
| Customer menu load | < 2 seconds |
| Order submission response | < 1 second |
| Order to dashboard display | < 2 seconds |
| Real-time status update | < 500ms |

### First Milestone (Proof of Concept)

**Goal:** Validate core technical loop

```
Customer scans QR
  ↓
Sees restaurant + table
  ↓
Browses menu (1 burger, 2 beers)
  ↓
Places order
  ↓
Restaurant dashboard receives order (real-time)
```

Once this works reliably, team has proven:
- ✅ QR routing works
- ✅ Authentication/authorization works
- ✅ Menu rendering works
- ✅ Order creation/transaction works
- ✅ Real-time updates work
- ✅ Database RLS works

All other features are secondary polish.

---

## 11. Definition of Done (Acceptance Criteria)

### Restaurant Setup
- [ ] User registration complete
- [ ] Restaurant profile created
- [ ] Staff users added with roles
- [ ] Tables created (1–20+)
- [ ] QR codes generated and printed
- [ ] Menu categories created
- [ ] Menu items added with prices/images
- [ ] CSV import functional

### Customer Experience
- [ ] QR code opens correct restaurant
- [ ] Table number correctly identified
- [ ] Menu loads quickly
- [ ] Customer adds items with quantity/notes
- [ ] Cart displays correct total
- [ ] Order submission works without account
- [ ] Order confirmation shows

### Real-Time Workflow
- [ ] Order appears on restaurant dashboard instantly
- [ ] Staff can accept/reject/update status
- [ ] Customer sees each status change immediately
- [ ] Fallback polling works if connection drops

### Security & Quality
- [ ] RLS prevents cross-restaurant access
- [ ] Rate limiting prevents abuse
- [ ] Duplicate orders prevented (idempotency)
- [ ] Server calculates prices correctly
- [ ] Secrets not exposed client-side
- [ ] Unit/integration/E2E tests pass
- [ ] HTTPS enforced
- [ ] Mobile browsers supported (iOS Safari, Android Chrome)

---

## 12. Future Roadmap (Post-MVP)

### Phase 1: Payments (Q1 2027)
- Stripe/Viva/Adyen integration
- Online payment processing
- Refunds & dispute handling

### Phase 2: Advanced Analytics (Q2 2027)
- Revenue reports
- Menu performance
- Peak hour analysis
- Customer insights

### Phase 3: POS Integration (Q3 2027)
- Kitchen display system (KDS) integration
- Inventory sync
- Reporting bridge

### Phase 4: Premium Features (Q4 2027)
- Loyalty program
- Promotions/coupons
- Waiter call system
- SMS notifications
- Multi-location support

### Phase 5: Scale & Optimization (2028)
- Microservices (if needed)
- Advanced caching
- Machine learning (demand forecasting)
- Mobile native apps (if market demands)

---

## 13. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Real-time delays | High | Test Supabase Realtime at scale; implement polling fallback |
| QR tampering | Medium | Rate limit public endpoints; regenerate tokens if compromised |
| Order data loss | High | Implement transactional constraints; regular backups |
| Poor mobile UX | Medium | Test on real devices early; mobile-first CSS |
| Authorization bugs | High | Comprehensive RLS testing; manual security review |
| Pilot restaurant churn | Medium | Rapid bug fixes; dedicated support; gather feedback weekly |

---

## 14. Getting Started: Next Steps

1. **Setup Phase (Days 1–2)**
   - Create GitHub repo
   - Create Supabase project
   - Create Vercel project
   - Setup CI/CD

2. **Database Phase (Days 3–5)**
   - Create all migrations
   - Implement RLS policies
   - Create seed data
   - Validate schema design

3. **Core Loop Phase (Days 6–12)**
   - Implement auth
   - Build customer ordering
   - Build restaurant dashboard
   - Test real-time updates

4. **Hardening Phase (Days 13–15)**
   - Add tests
   - Security review
   - Performance tuning
   - Monitoring setup

5. **Pilot Phase (Days 16+)**
   - Deploy to production
   - Onboard pilot restaurants
   - Monitor and iterate

---

## Appendix: Key References

- **Product Spec:** [readme.md](readme.md) — Full technical specification (sections 1–64)
- **Database Schema:** Section 7 (schema design)
- **Security Model:** Section 10 (RLS, authentication, authorization)
- **Development Principles:** Section 63 (non-negotiable rules)

---

**Document Prepared:** August 9, 2026  
**Next Review:** When Phase 1 infrastructure is complete
