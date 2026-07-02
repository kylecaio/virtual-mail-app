import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — SERVER ONLY.
 *
 * Bypasses RLS, so it is only ever constructed inside server routes / server actions
 * that have already authorized the caller (webhook signature, or requireStaff()).
 * All Phase-7 money writes (balance debit, credit grant/consume, billing_history)
 * run through this client or the SECURITY DEFINER RPCs it calls.
 *
 * Requires the service-role secret (never exposed to the browser). Accepts either
 * SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY — the live Vercel project uses
 * the latter (Supabase's newer "secret key" naming), so we resolve both.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "createAdminClient: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY"
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
