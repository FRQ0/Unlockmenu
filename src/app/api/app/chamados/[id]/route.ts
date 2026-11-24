// Garçom aceita ("Estou indo") / finaliza ("Atendido") / cancela um chamado.
import { fromDbError, HttpError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { chamadoAtualizar, uuid } from "@/lib/schemas";
import { PODE_ATENDER } from "@/lib/staff";

export const PATCH = staffRoute<{ id: string }>(PODE_ATENDER, async ({ supabase, tenant }, req, { id }) => {
  const callId = uuid.parse(id);
  const { status } = chamadoAtualizar.parse(await readJson(req));
  const { data, error } = await supabase
    .from("calls")
    .update({ status })
    .eq("id", callId)
    .eq("tenant_id", tenant.id)
    .select("id,status")
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, "Chamado não encontrado.");
  return json(data);
});
