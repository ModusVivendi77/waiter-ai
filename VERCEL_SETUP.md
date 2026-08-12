# Waiter AI — Vercel Deployment Setup

This repository is deployed on Vercel and connected to GitHub.

Production URL: `https://waiter-ai-iota.vercel.app`

## Current Status

- Local Next.js app builds successfully once dependencies are installed
- Supabase environment variables are configured locally
- GitHub Actions CI workflow exists at `.github/workflows/ci.yml`
- Repository is connected to GitHub and Vercel

## 1. Create or Connect a GitHub Repository

If you already created the GitHub repository, add it as the remote:

```bash
git remote add origin https://github.com/<your-org-or-user>/waiter-ai.git
git push -u origin master
```

If the remote already exists, push the current branch:

```bash
git push -u origin master
```

## 2. Import the Repository in Vercel

1. Go to `https://vercel.com/new`
2. Import the `waiter-ai` repository
3. Keep the detected framework as `Next.js`
4. Leave the build command as `next build`
5. Leave the output setting empty so Vercel uses the Next.js default

## 3. Configure Environment Variables

Add these variables in the Vercel project settings for `Production`, `Preview`, and `Development` as appropriate:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

Recommended values:

- `NEXT_PUBLIC_SUPABASE_URL`: your project base URL, for example `https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase publishable anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `NEXT_PUBLIC_APP_URL`:
  - Production: `https://waiter-ai-iota.vercel.app`
  - Preview: Vercel automatically injects branch preview URLs, but this app currently expects a fixed public app URL, so set this to the main deployment domain first

## 4. Preview Deployments

Current behavior:

- pushes to `master` or `main` create production deployments based on Vercel project settings
- pull requests and non-production branches create preview deployments automatically

## 5. Verify the Deployment

After the first deployment:

1. Open the Vercel preview URL
2. Verify `/login` renders
3. Verify `/platform/signup` can create an owner account against Supabase
4. Verify `/platform` loads after login
5. Check Vercel function logs if auth or database calls fail

## 6. Known Follow-Up

The current protected platform routes use the client-side Supabase session path because SSR session parsing did not behave correctly in the local setup. That is deployable, but you may want to revisit SSR auth handling later for stronger server-side route protection.
