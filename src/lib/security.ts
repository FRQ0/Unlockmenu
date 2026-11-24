// Rate limit, hash de IP e proteção anti-robô.
import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { adminClient } from "./supabase/admin";
import { serverEnv } from "./env";
import { HttpError } from "./http";

export async function clientIp(): Promise<string> {
  const h = await headers();
  // na Vercel o primeiro IP do x-forwarded-for é o do cliente (definido pela própria Vercel)
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "0.0.0.0").trim();
}

/** Guardamos só um HMAC do IP, nunca o IP puro. */
export function hashIp(ip: string): string {
  return createHmac("sha256", serverEnv.ipHashSecret).update(ip).digest("hex").slice(0, 32);
}

/** true = pode seguir. Em caso de erro no banco, bloqueia (falha fechada). */
export async function rateLimit(chave: string, max: number, janelaSeg: number): Promise<boolean> {
  const { data, error } = await adminClient().rpc("rate_limit_hit", { p_chave: chave, p_max: max, p_janela_seg: janelaSeg });
  if (error) {
    console.error("[rate-limit]", error.message);
    return false;
  }
  return data === true;
}

export async function requireRateLimit(chave: string, max: number, janelaSeg: number) {
  if (!(await rateLimit(chave, max, janelaSeg))) throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.");
}

/** Cloudflare Turnstile. Se não estiver configurado (dev), deixa passar. */
export async function verificarTurnstile(token: string | null | undefined, ip: string): Promise<boolean> {
  const secret = serverEnv.turnstileSecret;
  if (!secret) return process.env.NODE_ENV !== "production" || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean };
  return j.success === true;
}
