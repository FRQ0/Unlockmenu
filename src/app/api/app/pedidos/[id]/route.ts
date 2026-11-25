// Cozinha: preparando/pronto · Salão: entregue/cancelado (as regras ficam no banco).
import { fromDbError, HttpError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { pedidoStatus, uuid } from "@/lib/schemas";
import { requireFeature } from "@/lib/plans";

export const PATCH = staffRoute<{ id: string }>(undefined, async ({ supabase, tenant }, req, { id }) => {
  requireFeature(tenant, "pedidos");
  const { status } = pedidoStatus.parse(await readJson(req));
  const { data, error } = await supabase.from("orders").update({ status }).eq("id", uuid.parse(id)).eq("tenant_id", tenant.id).select("id,status").maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, "Pedido não encontrado.");
  return json(data);
});
