// Comanda do garçom: cria pedido (preço calculado no banco) e lista os pedidos em andamento.
import { fromDbError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { pedidoCriar } from "@/lib/schemas";
import { PODE_ATENDER } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";
import { pedidosAtivos } from "@/lib/pedidos";

export const GET = staffRoute(undefined, async ({ supabase, tenant }) => {
  requireFeature(tenant, "pedidos");
  return json({ pedidos: await pedidosAtivos(supabase, tenant.id) });
});

export const POST = staffRoute(PODE_ATENDER, async ({ supabase, tenant }, req) => {
  requireFeature(tenant, "pedidos");
  const b = pedidoCriar.parse(await readJson(req, 16 * 1024));
  const { data, error } = await supabase.rpc("criar_pedido", { p_table: b.table_id, p_itens: b.itens, p_observacao: b.observacao ?? null });
  if (error) throw fromDbError(error);
  return json({ id: data }, 201);
});
