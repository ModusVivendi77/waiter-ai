# Supabase Project Setup — Step-by-Step Guide

## Important: Complete Sign-Up Manually

Due to browser sandbox limitations, you'll need to complete the Supabase account creation manually (takes ~2 minutes). Follow these exact steps:

---

## Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Click **"Start your project"** or click the sign-up link
3. Enter email: **sotirisantypas@gmail.com**
4. Create a strong password (must contain: uppercase, lowercase, number, special character, 8+ chars)
   - Suggested: `WaiterAI2026!`
5. Click **"Sign up"**
6. **Check your email** (sotirisantypas@gmail.com) for verification link
7. Click the verification link to confirm email

---

## Step 2: Create Your First Project

1. Once logged in, click **"New Project"**
2. Name: **waiter-ai**
3. Database Password: Create a strong password (save this somewhere safe!)
4. Region: **Europe (Frankfurt)** ← as you selected
5. Click **"Create new project"**

⏳ **Wait 2-3 minutes** for the project to initialize...

---

## Step 3: Get Your Credentials

Once the project is ready, you'll see the dashboard. Find these values:

### From the Dashboard:

1. **Project URL** — Copy the Project URL (looks like `https://xxxxxxxxxxxx.supabase.co`)
2. **Anon Key** — In left sidebar: Settings → API → Project API keys → Copy the `anon` public key
3. **Service Role Key** — In left sidebar: Settings → API → Project API keys → Copy the `service_role` secret key

### They'll look like:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 4: Update Your `.env.local` File

After you have the credentials, update your `.env.local` file:

```bash
# Replace with actual values from Step 3
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Step 5: Enable Row-Level Security (RLS)

Before deploying migrations, enable RLS on your Supabase project:

1. Go to Supabase Dashboard → Settings → Authentication
2. Ensure **JWT Secret** is set (default is pre-configured)
3. Note: RLS policies will be enabled via migrations in Task 2.3

---

## Step 6: Assign the Initial SUPER_ADMIN Account

After running migrations, assign at least one platform super admin:

1. Go to Supabase Dashboard → SQL Editor
2. Run the statement below with the email you use for platform operations:

```sql
insert into public.platform_admin_users (user_id)
select id
from auth.users
where email = 'your-admin-email@example.com'
on conflict (user_id) do nothing;
```

3. Confirm assignment:

```sql
select pau.user_id, u.email, pau.created_at
from public.platform_admin_users pau
join auth.users u on u.id = pau.user_id;
```

Notes:
- SUPER_ADMIN is a platform-level role and is separate from restaurant OWNER/MANAGER/STAFF roles.
- A SUPER_ADMIN can still be added to restaurant memberships when restaurant-scoped workflows are needed.

---

## Next Steps After Supabase Setup

Once you have the credentials and `.env.local` is updated:

1. Run `npm run dev` to start the development server
2. Proceed to **Task 1.3: Vercel Deployment Setup**
3. Proceed to **Phase 2: Database Schema Migrations** (IMPLEMENTATION_PLAN.md → Task 2.1–2.4)

---

## Troubleshooting

### "Connection refused" when testing Supabase

- Verify `.env.local` has correct URL and keys (no typos)
- Ensure Supabase project status is "Healthy" in dashboard

### Can't find API keys in settings

- Make sure you're in the correct project (check project selector)
- Keys are under Settings → API → Project API keys

### Email verification didn't arrive

- Check spam/junk folder
- Request new verification email in Settings → Auth

---

## Keep These Safe! 🔐

- `.env.local` — Never commit to git (already in `.gitignore`)
- Service Role Key — Never expose in browser or client code
- Database Password — Save in secure password manager

---

**Estimated time:** 5–10 minutes total  
**Next document:** Return here and confirm once `.env.local` is configured
