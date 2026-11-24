// Métricas anônimas (visualização de prato, play no Reels...). Sem dado pessoal.
import { assertSameOrigin, handle, json, readJson } from "@/lib/http";
import { eventoPublico } from "@/lib/schemas";
import { clientIp, hashIp, rateLimit } from "@/lib/security";
import { mesaPublica, registrarEvento, tenantPublico } from "@/lib/public-data";
import { adminClient } from "@/lib/supabase/admin";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const ev = eventoPublico.parse(await readJson(req, 1024));
  const ipHash = hashIp(await clientIp());
  // excesso de eventos é só ignorado (não atrapalha o cliente)
  if (!(await rateLimit(`evento:ip:${ipHash}`, 200, 300))) return json({ ok: true });

  const tenant = await tenantPublico(ev.slug);
  if (!tenant?.ativo) return json({ ok: true });
  const mesa = ev.token ? await mesaPublica(tenant.id, ev.token) : null;
  let productId: string | null = null;
  if (ev.product_id) {
    const { data } = await adminClient().from("products").select("id").eq("id", ev.product_id).eq("tenant_id", tenant.id).maybeSingle();
    productId = data?.id ?? null;
  }
  await registrarEvento(tenant.id, ev.tipo, { table_id: mesa?.id ?? null, product_id: productId });
  return json({ ok: true });
});
