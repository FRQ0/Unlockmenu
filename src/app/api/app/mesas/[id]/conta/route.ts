import { json } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { uuid } from "@/lib/schemas";
import { PODE_ATENDER } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";
import { contaDaMesa } from "@/lib/pedidos";

export const GET = staffRoute<{ id: string }>(PODE_ATENDER, async ({ supabase, tenant }, _req, { id }) => {
  requireFeature(tenant, "pedidos");
  return json(await contaDaMesa(supabase, tenant.id, uuid.parse(id)));
});
