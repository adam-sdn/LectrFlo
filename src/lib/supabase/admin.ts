import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseEnv, serviceRoleKey } from "@/lib/env";

let client: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS: every caller must enforce ownership itself. */
export function adminClient(): SupabaseClient {
  if (!client) {
    client = createClient(publicSupabaseEnv().url, serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
