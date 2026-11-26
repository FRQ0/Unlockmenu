import { fromDbError, json } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { uuid } from "@/lib/schemas";
import { PODE_ATENDER } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";

export const DELETE = staffRoute<{ id: string }>(PODE_ATENDER, async ({ supabase, tenant }, _req, { id }) => {
  requireFeature(tenant, "pagamentos");
  const { error } = await supabase.rpc("estornar_pagamento", { p_pagamento: uuid.parse(id) });
  if (error) throw fromDbError(error);
  return json({ ok: true });
});
