import { fromDbError, json } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { uuid } from "@/lib/schemas";
import { PODE_GERIR } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";

export const POST = staffRoute<{ id: string }>(PODE_GERIR, async ({ supabase, tenant }, _req, { id }) => {
  requireFeature(tenant, "fichas");
  const { error } = await supabase.rpc("cancelar_venda", { p_venda: uuid.parse(id) });
  if (error) throw fromDbError(error);
  return json({ ok: true });
});
