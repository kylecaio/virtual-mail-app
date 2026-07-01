# Virtual Mail — BIG Oakland (fresh build)

Next.js 14 (App Router) + Supabase (Postgres, Auth, Storage) + Vercel.
Single baked-in **Balanced** theme from the prototype (no theme-switcher).

## Env
Copy `.env.example` → `.env.local`. Points at Supabase project **big-oakland-mail** (`tvonyznxsovyudwulmvk`).

## Run
```
npm install
npm run dev      # http://localhost:3000
npm run build
```

## Phase 1 (Foundation) — done
- Supabase schema: profiles, customers, mail_pieces, service_requests, billing_history, plans, pricing_rules, shipping_margins, operators, audit_log
- RLS for customer / staff / admin; storage buckets (envelope-photos, scan-pdfs, id-uploads)
- Pricing seeded from `platform/docs/PRICING.md`
- App scaffold: landing + `/status` (live DB read through RLS)

## Phase 2 (Auth & roles) — done (build-verified)
- Email/password + magic-link auth; SSR session middleware
- Roles via admin-only `role_grants` allowlist (self-signup can't claim a role)
- Route protection: customer `/dashboard`, staff `/ops`, admin `/admin`
- See `DEPLOY.md` §5 for the Supabase Auth URL config needed on deploy.

Next: Phase 3 (Intake).
