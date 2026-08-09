# Waiter AI — Development Setup Guide

## Prerequisites

- **Node.js** ≥ 20.0.0 ([download](https://nodejs.org/))
- **npm** ≥ 11.0.0 (comes with Node.js)
- **Git** ([download](https://git-scm.com/))
- **Supabase CLI** (optional, for local database: `npm install -g supabase`)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/waiter-ai.git
cd waiter-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Then fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Never commit `.env.local`** — it's in `.gitignore` for security.

### 4. Setup Supabase Project

#### Option A: Use Existing Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy project URL and anon key to `.env.local`

#### Option B: Local Supabase (with Supabase CLI)
```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase (Docker required)
supabase start

# Apply migrations
supabase migration up

# Load seed data (optional)
psql $DATABASE_URL -f supabase/seed.sql
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Verify Setup

- [ ] Next.js dev server running
- [ ] Can access http://localhost:3000
- [ ] Supabase connection working (check browser console for errors)
- [ ] No TypeScript errors (`npm run typecheck`)

---

## Available Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create production build |
| `npm start` | Run production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run unit/integration tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run test:e2e:ui` | Run E2E tests with UI |
| `npm run format` | Format code with Prettier |

---

## Project Structure

```
waiter-ai/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (public)/t/         # Customer QR pages
│   │   ├── (auth)/             # Authentication pages
│   │   ├── platform/           # Restaurant dashboard
│   │   ├── admin/              # Platform admin
│   │   └── api/                # API routes
│   ├── components/             # React components
│   │   ├── customer/
│   │   ├── admin/
│   │   └── shared/
│   ├── lib/                    # Utilities & helpers
│   │   ├── supabase/           # Supabase clients
│   │   ├── auth/               # Auth helpers
│   │   ├── orders/             # Order logic
│   │   ├── menu/               # Menu logic
│   │   └── validation/         # Zod schemas
│   ├── types/                  # TypeScript types
│   └── utils/                  # General utilities
├── public/                     # Static assets
├── supabase/
│   ├── migrations/             # SQL migrations
│   └── seed.sql                # Development seed data
├── tests/                      # Test files
│   └── e2e/                    # Playwright E2E tests
├── .github/
│   └── workflows/              # GitHub Actions CI/CD
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── next.config.js              # Next.js config
├── tailwind.config.ts          # Tailwind CSS config
└── README.md                   # Project overview
```

---

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Write code following TypeScript strict mode
- Follow the project structure
- Add tests for critical logic

### 3. Test Locally

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

### 4. Commit & Push

```bash
git add .
git commit -m "feat: description of changes"
git push origin feature/your-feature-name
```

### 5. Create Pull Request

- Push to GitHub
- Create PR with detailed description
- Wait for CI checks to pass
- Request code review

---

## Database Migrations

### Creating a New Migration

```bash
# Create a new migration file
supabase migration new add_new_table

# Edit supabase/migrations/XXX_add_new_table.sql

# Test locally
supabase migration up

# Push to Supabase (via dashboard or CLI)
```

### Important Rules

- ✅ Always create migrations for schema changes
- ✅ Test migrations locally before committing
- ✅ Never manually modify production schema
- ❌ Don't delete migrations that have been deployed

---

## Debugging

### Enable Debug Logging

```env
# .env.local
DEBUG=*
```

### Browser DevTools

- **Network tab** — Check API requests to Supabase
- **Console tab** — Look for JavaScript errors
- **Application tab** — Inspect cookies and storage

### Backend Debugging

Check Supabase dashboard:
- **Authentication** → View user sessions
- **Database** → Query data directly
- **Realtime** → Monitor active subscriptions
- **Logs** → View server-side errors

---

## Testing

### Unit Tests

```bash
npm run test
```

Tests are in `src/**/__tests__/*.test.ts`

### E2E Tests

```bash
npm run test:e2e
```

Tests are in `tests/e2e/*.spec.ts`

### Run Tests in Watch Mode

```bash
npm run test:watch
```

---

## Deployment

### Vercel (Recommended)

1. Connect GitHub repo to [Vercel](https://vercel.com)
2. Configure environment variables
3. Deploy button — automatic on push to `main`

### Manual Deployment

```bash
npm run build
npm start
```

---

## Troubleshooting

### "Cannot find module" Error

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors After Branch Switch

```bash
npm run typecheck
# Fix errors or update type definitions
```

### Supabase Connection Issues

- Verify `.env.local` has correct credentials
- Check Supabase project is active
- Verify network connectivity
- Check browser console for error messages

### Tests Failing

```bash
# Clear test cache
npm run test -- --clearCache

# Run with verbose output
npm run test -- --reporter=verbose
```

---

## Code Style & Standards

### TypeScript

- Strict mode enabled (`tsconfig.json`)
- No `any` types without explanation
- Export types from `src/types/`

### Naming Conventions

- **Files:** kebab-case (`user-service.ts`)
- **Directories:** kebab-case (`src/lib/auth/`)
- **Types:** PascalCase (`type User = {...}`)
- **Functions/variables:** camelCase (`const getUserId = () => {...}`)
- **Constants:** UPPER_SNAKE_CASE (`const MAX_RETRIES = 3`)

### Imports

```typescript
// Absolute imports (preferred)
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Relative imports (avoid)
import { createServerSupabaseClient } from '../../lib/supabase/server'
```

---

## Getting Help

- **GitHub Issues** — Report bugs or request features
- **Documentation** — See [MVP_DESIGN.md](./MVP_DESIGN.md) and [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
- **Supabase Docs** — https://supabase.com/docs
- **Next.js Docs** — https://nextjs.org/docs

---

## Security Checklist

Before committing:

- [ ] No `.env` or `.env.local` committed
- [ ] No API keys in code or comments
- [ ] No secrets in logs
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only in backend code
- [ ] TypeScript strict mode enabled
- [ ] All inputs validated with Zod

---

**Last updated:** August 9, 2026
