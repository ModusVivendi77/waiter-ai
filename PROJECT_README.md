# Waiter AI — QR Restaurant Ordering Platform

A modern, SaaS web application that enables restaurant customers to order food and drinks directly from their table using a QR code—no signup required.

[![Status](https://img.shields.io/badge/status-MVP-yellow)]() [![License](https://img.shields.io/badge/license-MIT-blue)]()

## 🎯 The Problem

Restaurants face challenges:
- Limited service capacity during peak hours
- Waiter management and table tracking overhead
- Manual order taking errors and delays
- Difficulty tracking order status

Customers want:
- Fast ordering without waiting for a waiter
- No account signup required
- Real-time order status updates
- Ability to add custom notes

## ✨ The Solution

**Waiter AI** provides:

### For Customers
📱 **Mobile-First Ordering**
- Scan table QR code
- Browse restaurant menu with images
- Add items, specify quantity, add notes
- Submit order instantly
- Track order status in real-time
- No account needed

### For Restaurants
📊 **Live Order Dashboard**
- Receive orders in real-time (< 2 seconds)
- Accept/reject orders
- Update order status (NEW → PREPARING → READY → SERVED)
- View order history and analytics
- Manage staff roles (OWNER, MANAGER, STAFF)
- Manage tables, menu, and pricing

### For Restaurant Owners
💼 **Complete Restaurant Setup**
- Register and manage restaurant profile
- Create and manage tables
- Generate QR codes (printable PDF)
- Build menu with categories and items
- Import menu via CSV
- View revenue analytics

---

## 🚀 Quick Start

### For Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed setup instructions.

```bash
# 1. Install dependencies
npm install

# 2. Setup environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 3. Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Test the Flow

1. **Restaurant setup:** http://localhost:3000/login (or /platform/signup)
2. **Customer ordering:** http://localhost:3000/t/[qr-token]
3. **Restaurant dashboard:** http://localhost:3000/platform/orders

---

## 📋 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Next.js Server Actions & API Routes |
| **Database** | PostgreSQL (Supabase) with Row-Level Security |
| **Auth** | Supabase Auth (Email/Password) |
| **Real-time** | Supabase Realtime subscriptions |
| **Hosting** | Vercel (Edge deployment) |
| **QR Codes** | qrcode TypeScript library |
| **Testing** | Vitest, Playwright, React Testing Library |
| **CI/CD** | GitHub Actions |

---

## 📁 Project Structure

```
waiter-ai/
├── src/
│   ├── app/                 # Next.js pages & routes
│   │   ├── (public)/t/      # Customer QR pages (/t/{token})
│   │   ├── (auth)/login     # Restaurant login
│   │   ├── platform/        # Restaurant dashboard
│   │   ├── admin/           # Platform admin
│   │   └── api/             # API endpoints
│   ├── components/          # React components
│   ├── lib/                 # Core logic
│   │   ├── supabase/        # DB clients
│   │   ├── orders/          # Order operations
│   │   ├── menu/            # Menu operations
│   │   └── validation/      # Input validation (Zod)
│   └── types/               # TypeScript definitions
├── supabase/
│   ├── migrations/          # SQL schema migrations
│   └── seed.sql             # Development data
├── tests/
│   └── e2e/                 # Playwright E2E tests
└── .github/
    └── workflows/           # GitHub Actions CI/CD
```

---

## 🔑 Key Features (MVP)

### Customer Side
- ✅ QR code scanning (no signup)
- ✅ Browse menu by category
- ✅ Add items with quantity & custom notes
- ✅ Review and submit order
- ✅ Real-time order status tracking
- ✅ Mobile-responsive design

### Restaurant Side
- ✅ User registration & authentication
- ✅ Restaurant profile management
- ✅ Table creation & QR code generation
- ✅ Menu management (categories, items, pricing)
- ✅ CSV menu import
- ✅ Live order dashboard with real-time updates
- ✅ Order status workflow (NEW → ACCEPTED → PREPARING → READY → SERVED)
- ✅ Order history & basic analytics
- ✅ Staff role management (OWNER, MANAGER, STAFF)
- ✅ Platform super-admin layer (SUPER_ADMIN) for service operations

### Platform
- ✅ Row-level security (RLS) on all data
- ✅ Rate limiting on public endpoints
- ✅ Idempotency keys (prevent duplicate orders)
- ✅ Transaction safety
- ✅ Comprehensive error handling
- ✅ Monitoring & logging

---

## 🚫 Out of Scope (MVP)

Intentionally excluded from MVP (but designed for future addition):
- ❌ Online payments (Stripe/Viva integration)
- ❌ Split bills
- ❌ Customer accounts
- ❌ Native mobile apps
- ❌ POS integration
- ❌ Kitchen display system (KDS)
- ❌ Multi-location chains
- ❌ SMS/WhatsApp notifications
- ❌ Delivery management

---

## 📚 Documentation

- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — Local setup & development guide
- **[MVP_DESIGN.md](./MVP_DESIGN.md)** — High-level architecture & strategy
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** — Detailed task breakdown with code
- **[readme.md](./readme.md)** — Original technical specification

---

## 🏗️ Architecture

```
┌─────────────────────┐
│  Customer (Mobile)  │
│   React Web App     │
└──────────┬──────────┘
           │ HTTPS
           ▼
┌─────────────────────┐       ┌──────────────────┐
│     Vercel          │◄─────►│  Supabase        │
│   (Edge Runtime)    │       │  (PostgreSQL +   │
│                     │       │   RLS + Realtime)│
│  • Next.js API      │       └──────────────────┘
│  • Server Actions   │
│  • Real-time Sync   │
└─────────────────────┘
```

---

## 🔐 Security

### Core Principles (Non-Negotiable)

1. **TypeScript Strict Mode** — Type safety by default
2. **No Secrets Client-Side** — Service role key server-only
3. **Row-Level Security (RLS)** — Tenant isolation at database level
4. **Server-Side Validation** — Never trust client prices/totals
5. **Database Transactions** — Atomic order creation
6. **Idempotency Keys** — Prevent duplicate submissions
7. **Rate Limiting** — Protect public endpoints
8. **HTTPS Enforced** — Encrypted in transit

### Authentication & Authorization

- **Customers:** Public QR access (no auth)
- **Staff:** Email/password via Supabase Auth
- **Restaurant Roles:** OWNER (full access), MANAGER (operational), STAFF (orders only)
- **Platform Role:** SUPER_ADMIN (service-level administration across tenants)
- **Data Access:** Enforced by RLS policies at database level

---

## 📊 Performance Targets

| Metric | Target |
|--------|--------|
| Customer menu load | < 2 seconds |
| Order submission | < 1 second |
| Order to dashboard | < 2 seconds |
| Real-time status update | < 500ms |
| Mobile support | iOS Safari, Android Chrome |

---

## 🧪 Testing

```bash
# Unit & integration tests
npm run test

# Watch mode
npm run test:watch

# E2E tests (Playwright)
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

---

## 📈 Roadmap

### Phase 1: MVP (Current)
✅ Core ordering workflow
✅ Real-time order management
✅ Basic analytics

### Phase 2: Payments (Q1 2027)
- Stripe/Viva/Adyen integration
- Online payment processing

### Phase 3: Advanced Analytics (Q2 2027)
- Revenue reports
- Menu performance
- Peak hour analysis

### Phase 4: POS Integration (Q3 2027)
- Kitchen display system
- Inventory sync

### Phase 5: Premium Features (Q4 2027)
- Loyalty program
- Promotions/coupons
- Waiter call button
- Multi-location support

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and test: `npm run test && npm run test:e2e`
3. Commit: `git commit -m "feat: description"`
4. Push and create a Pull Request

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed guidelines.

---

## 📦 Deployment

### Vercel (Recommended)

```bash
# Connect GitHub repo to Vercel
# Auto-deploys on push to main branch
```

### Environment Variables

Create in Vercel dashboard:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

---

## 📞 Support

- **Issues:** GitHub Issues
- **Documentation:** See docs/ directory
- **Questions:** Check GitHub Discussions

---

## 📄 License

MIT License — see LICENSE file

---

## 👥 Team

Built with ❤️ for restaurants and their customers.

**Current Version:** 0.1.0 (MVP)  
**Last Updated:** August 9, 2026

---

## 🎯 First Milestone

**The core technical loop works when:**

> A customer scans QR at Table 1 → sees restaurant menu → orders burger + 2 beers → restaurant dashboard receives order in real-time

Once this foundation is solid, all other features build on top.

---

**Ready to start building?** See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup instructions.
