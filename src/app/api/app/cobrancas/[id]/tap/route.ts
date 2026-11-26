// Volta do app InfinitePay depois da aproximação. O InfiniteTap não tem API para conferir,
// então a confirmação é da equipe logada (e fica registrada com NSU e autorização para conciliar).
import { fromDbError, HttpError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { cobrancaTap, uuid } from "@/lib/schemas";
import { PODE_ATENDER } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";
import { adminClient } from "@/lib/supabase/admin";

export const POST = staffRoute<{ id: string }>(PODE_ATENDER, async ({ supabase, tenant }, req, { id }) => {
  requireFeature(tenant, "pagamentos");
  const b = cobrancaTap.parse(await readJson(req));
  const cobrancaId = uuid.parse(id);
  const { data: c } = await supabase.from("cobrancas").select("id,tipo,status,metodo,origem").eq("id", cobrancaId).eq("tenant_id", tenant.id).maybeSingle();
  if (!c || c.tipo !== "tap") throw new HttpError(404, "Cobrança não encontrada.");
  if (c.status !== "pendente") return json({ status: c.status, origem: c.origem });
  const { data, error } = await adminClient().rpc("confirmar_cobranca", {
    p_id: cobrancaId, p_metodo: c.metodo, p_transaction_nsu: b.nsu, p_aut: b.aut ?? null, p_slug: null, p_receipt: null,
  });
  if (error) throw fromDbError(error);
  return json({ status: data, origem: c.origem });
});
