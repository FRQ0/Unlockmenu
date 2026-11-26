import { fromDbError, HttpError, json } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { uuid } from "@/lib/schemas";
import { PODE_ATENDER } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";

export const GET = staffRoute<{ id: string }>(PODE_ATENDER, async ({ supabase, tenant }, _req, { id }) => {
  requireFeature(tenant, "pagamentos");
  const { data, error } = await supabase
    .from("cobrancas").select("id,status,metodo,valor,origem,receipt_url").eq("id", uuid.parse(id)).eq("tenant_id", tenant.id).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, "Cobrança não encontrada.");
  return json({ ...data, valor: Number(data.valor) });
});

export const DELETE = staffRoute<{ id: string }>(PODE_ATENDER, async ({ supabase, tenant }, _req, { id }) => {
  requireFeature(tenant, "pagamentos");
  const { error } = await supabase.rpc("cancelar_cobranca", { p_id: uuid.parse(id) });
  if (error) throw fromDbError(error);
  return json({ ok: true });
});
