// Cria cobrança na InfinitePay: link/QR (cliente paga no celular dele) ou aproximação (InfiniteTap).
import { fromDbError, HttpError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { cobrancaCriar } from "@/lib/schemas";
import { PODE_ATENDER } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";
import { adminClient } from "@/lib/supabase/admin";
import { criarLink } from "@/lib/infinitepay";
import { baseDoTenant } from "@/lib/urls";
import { requireRateLimit } from "@/lib/security";

function siteBase(req: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  return new URL(req.url).origin;
}

export const POST = staffRoute(PODE_ATENDER, async ({ supabase, tenant, user }, req) => {
  requireFeature(tenant, "pagamentos");
  if (!tenant.infinitepay_handle) throw new HttpError(400, "Cadastre a InfiniteTag em Estabelecimento → Pagamentos.");
  await requireRateLimit(`cobranca:${user.id}`, 60, 600);
  const b = cobrancaCriar.parse(await readJson(req));
  if (b.origem === "mesa" && !b.table_id) throw new HttpError(400, "Mesa não informada.");
  if (b.tipo === "tap" && !b.metodo) throw new HttpError(400, "Escolha débito ou crédito.");

  const { data, error } = await supabase.rpc("criar_cobranca", {
    p_tenant: tenant.id,
    p_origem: b.origem,
    p_tipo: b.tipo,
    p_table: b.table_id ?? null,
    p_valor: b.valor,
    p_metodo: b.metodo ?? null,
    p_parcelas: b.parcelas ?? 1,
  });
  if (error) throw fromDbError(error);
  const c = (Array.isArray(data) ? data[0] : data) as { id: string; valor: number; token: string };

  if (b.tipo === "tap") {
    return json({ id: c.id, valor: Number(c.valor), handle: tenant.infinitepay_handle, resultUrl: `${siteBase(req)}/app/pagamento/retorno` }, 201);
  }

  const { base, prefixo } = baseDoTenant(tenant);
  const link = await criarLink({
    handle: tenant.infinitepay_handle,
    orderNsu: c.id,
    centavos: Math.round(Number(c.valor) * 100),
    descricao: b.origem === "mesa" ? `Conta - ${tenant.nome}` : `Fichas - ${tenant.nome}`,
    redirectUrl: `${base}${prefixo}/pago`,
    webhookUrl: `${siteBase(req)}/api/webhooks/infinitepay?c=${c.id}&t=${c.token}`,
  }).catch(() => {
    throw new HttpError(502, "A InfinitePay não respondeu. Confira a InfiniteTag e tente de novo.");
  });
  await adminClient().rpc("salvar_link_cobranca", { p_id: c.id, p_url: link.url, p_slug: link.slug });
  return json({ id: c.id, valor: Number(c.valor), link_url: link.url }, 201);
});
