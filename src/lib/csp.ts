// Content-Security-Policy com nonce por requisição + cabeçalhos de segurança.
export function supabaseOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
}

export function buildCsp(nonce: string, dev = process.env.NODE_ENV !== "production", https = true): string {
  const sb = supabaseOrigin();
  const sbWs = sb.replace(/^https:/, "wss:");
  const turnstile = "https://challenges.cloudflare.com";
  const d: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", turnstile, ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", sb].filter(Boolean),
    "media-src": ["'self'", "blob:", sb].filter(Boolean),
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", sb, sbWs, turnstile, ...(dev ? ["ws:"] : [])].filter(Boolean),
    "frame-src": [turnstile],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };
  const parts = Object.entries(d).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!dev && https) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
};
