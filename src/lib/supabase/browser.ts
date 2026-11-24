"use client";
// Cliente do navegador só para o tempo real dos painéis.
// Não guarda sessão: recebe um access token curto do servidor (/api/app/realtime-token).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function realtimeClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return cached;
}

export async function autenticarRealtime(): Promise<string | null> {
  const r = await fetch("/api/app/realtime-token", { cache: "no-store" });
  if (!r.ok) return null;
  const { token } = (await r.json()) as { token: string };
  const c = realtimeClient();
  await c.realtime.setAuth(token);
  return token;
}
