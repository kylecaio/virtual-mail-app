# Phase 1 — Deploy (new GitHub repo → Vercel)

> **Already done for you (2026-07-01, via browser):**
> - Vercel **Deployment Protection** disabled on `big-oakland-mail` → deployments are now
>   publicly viewable (this was the cause of the `BLOCKED` status).
> - Supabase **Auth → Redirect URLs** added: `http://localhost:3000/**` and
>   `https://*-kyle-rawlins-projects.vercel.app/**` (matches any Vercel domain under your team).
>
> **Heads-up on env vars:** `big-oakland-mail` already has env vars from a May attempt,
> including a Supabase key stored as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. This app reads
> **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** (see step 3). When you pick the project to deploy on,
> make sure that exact name exists with the publishable value below (and that
> `NEXT_PUBLIC_SUPABASE_URL` points to `tvonyznxsovyudwulmvk`).


The fresh app in this folder is ready to push. Init git locally (the workspace is a
Drive-synced folder, so run git from your own machine, not here), then push and connect Vercel.

## 1. Init git and push to a new GitHub repo
```bash
cd platform-fresh
git init && git add -A && git commit -m "Virtual Mail — fresh Supabase + Next.js foundation (Phase 1)"
git branch -M main
# create an EMPTY repo on GitHub named e.g. virtual-mail-app (no README/license)
git remote add origin https://github.com/kylecaio/virtual-mail-app.git
git push -u origin main
```
(Leaves the old `github.com/kylecaio/virtual-mail` repo untouched as reference.)

## 2. Point the Vercel project at the new repo
In Vercel → project **big-oakland-mail** → Settings → Git:
- Disconnect the old `virtual-mail` repo, connect **`virtual-mail-app`** (branch `main`).
- Framework preset: **Next.js** (auto-detected). Root directory: repo root.

(Or create a new Vercel project from the repo and retire big-oakland-mail — either works.)

## 3. Set environment variables (Vercel → Settings → Environment Variables)
Both are safe publishable values (Supabase project `big-oakland-mail` / `tvonyznxsovyudwulmvk`):
```
NEXT_PUBLIC_SUPABASE_URL=https://tvonyznxsovyudwulmvk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_RAJqdupqgW3Ew6LtDaOvZA_IDOnWKZ7
```

## 4. Deploy & verify
- Trigger a deploy (push, or Vercel “Redeploy”).
- Visit `/` (Balanced-theme landing) and **`/status`** — it should show
  “Supabase connection: healthy” and render the **four plans** (Starter/Standard/Premium/Enterprise)
  read live from Postgres through the RLS “public read” policy. That confirms the whole Phase-1 stack.

## Note
The existing production deployment shows `BLOCKED` and the project isn't live — likely Vercel
**Deployment Protection** (SSO/password). If the new deploy is also gated, disable or adjust it under
Settings → Deployment Protection.

Once `/status` is green with four plans, Phase 1 is complete.

## 5. Phase 2 — Supabase Auth config (required for login to work)
In Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL:** your Vercel production domain (e.g. `https://virtual-mail-app.vercel.app`).
- **Redirect URLs:** add
  `https://<your-domain>/auth/confirm`, `https://<your-domain>/auth/post-login`,
  and for local dev `http://localhost:3000/auth/confirm`, `http://localhost:3000/auth/post-login`.
- For fast testing you may turn **off** "Confirm email" (Authentication → Providers → Email);
  re-enable for production.

Then verify roles:
- Sign up at `/signup` as **`kyle@bigoakland.space`** → after confirm you land on **`/admin`**
  (the allowlist auto-grants admin). Any other signup lands on **`/dashboard`** as a customer.
- `/ops` requires staff/admin; `/admin` requires admin; unauthenticated hits redirect to `/login`.
- To add staff/admins later: insert their email into `public.role_grants` (admin-only) **before**
  they sign up.

Phase 2 done when the three role homes gate correctly → proceed to **Phase 3 (Intake)**.
