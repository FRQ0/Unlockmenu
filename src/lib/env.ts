import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

export const serverEnv = {
  get supabaseUrl() { return req("NEXT_PUBLIC_SUPABASE_URL"); },
  get anonKey() { return req("NEXT_PUBLIC_SUPABASE_ANON_KEY"); },
  get serviceRoleKey() { return req("SUPABASE_SERVICE_ROLE_KEY"); },
  get ipHashSecret() { return process.env.IP_HASH_SECRET || req("SUPABASE_SERVICE_ROLE_KEY"); },
  get turnstileSecret() { return process.env.TURNSTILE_SECRET_KEY || ""; },
  get cronSecret() { return process.env.CRON_SECRET || ""; },
  get vapid() {
    return {
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
      privateKey: process.env.VAPID_PRIVATE_KEY || "",
      subject: process.env.VAPID_SUBJECT || "mailto:contato@unlockmenu.com.br",
    };
  },
};
