// Cliente com service_role: IGNORA o RLS. Só pode ser importado no servidor
// ("server-only" quebra o build se alguém tentar usar num componente de navegador).
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "../env";

let cached: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(serverEnv.supabaseUrl, serverEnv.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
