// Endereço público da mesa (o que vai no QR/NFC). White-label: prioriza o domínio
// do cliente, depois o subdomínio {slug}.dominio, e por último /{slug}/m/... no domínio principal.
import { tenantHas, type TenantPlano } from "./plans";

export function baseDoTenant(t: TenantPlano & { slug: string; dominio_custom: string | null }): { base: string; prefixo: string } {
  if (t.dominio_custom && tenantHas(t, "dominio_proprio")) return { base: `https://${t.dominio_custom}`, prefixo: "" };
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && process.env.NEXT_PUBLIC_USE_SUBDOMAINS === "1") return { base: `https://${t.slug}.${root}`, prefixo: "" };
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return { base: site, prefixo: `/${t.slug}` };
}

export function urlMesa(t: TenantPlano & { slug: string; dominio_custom: string | null }, token: string) {
  const { base, prefixo } = baseDoTenant(t);
  return `${base}${prefixo}/m/${token}`;
}
