// Recebe o pagamento da conta da mesa (pode ser dividido em vários).
import { fromDbError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { pagamentoMesa, uuid } from "@/lib/schemas";
import { PODE_ATENDER } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";

export const POST = staffRoute<{ id: string }>(PODE_ATENDER, async ({ supabase, tenant }, req, { id }) => {
  requireFeature(tenant, "pagamentos");
  const { pagamentos } = pagamentoMesa.parse(await readJson(req));
  const { data, error } = await supabase.rpc("registrar_pagamento_mesa", { p_table: uuid.parse(id), p_pagamentos: pagamentos });
  if (error) throw fromDbError(error);
  return json({ falta: Number(data ?? 0) });
});
