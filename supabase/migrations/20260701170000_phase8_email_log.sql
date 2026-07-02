-- Phase 8a — email_log
-- Records every outbound notification. Written server-side via the service-role
-- client (createAdminClient), which bypasses RLS. The unique index on dedupe_key
-- is the idempotency backstop for the claim-first notify() helper (lib/email.ts):
-- a duplicate/retried send conflicts on insert and is skipped.
--
-- Apply via the Supabase MCP (project big-oakland-mail / tvonyznxsovyudwulmvk),
-- consistent with how Phases 1–7 migrations were applied. Additive + low-risk.

create table if not exists public.email_log (
  id           bigint generated always as identity primary key,
  dedupe_key   text        not null unique,
  recipient    text        not null,
  event        text        not null,           -- mail_received | scan_ready | welcome | admin_test | ...
  status       text        not null default 'sending'
                 check (status in ('sending', 'sent', 'failed', 'skipped')),
  provider_id  text,                            -- Resend message id
  error        text,
  customer_id  uuid        references public.customers(id) on delete set null,
  metadata     jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists email_log_created_at_idx on public.email_log (created_at desc);
create index if not exists email_log_event_idx       on public.email_log (event);
create index if not exists email_log_customer_idx     on public.email_log (customer_id);

-- RLS: staff/admin may read the log (admin email-log surface, 8e). Inserts/updates
-- come from the service-role client, which bypasses RLS, so no write policy is needed
-- for authenticated users.
alter table public.email_log enable row level security;

drop policy if exists email_log_select_staff on public.email_log;
create policy email_log_select_staff on public.email_log
  for select using (is_staff());
