// Fecha a conta: soma no banco, marca pedidos como pagos e libera a mesa.
import { fromDbError, json } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { uuid } from "@/lib/schemas";
import { PODE_ATENDER } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";

export const POST = staffRoute<{ id: string }>(PODE_ATENDER, async ({ supabase, tenant }, _req, { id }) => {
  requireFeature(tenant, "pedidos");
  const { data, error } = await supabase.rpc("fechar_conta", { p_table: uuid.parse(id) });
  if (error) throw fromDbError(error);
  return json({ total: Number(data ?? 0) });
});
