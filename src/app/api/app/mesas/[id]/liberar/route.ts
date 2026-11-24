// Libera a mesa (encerra a "presença confirmada").
import { fromDbError, json } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { uuid } from "@/lib/schemas";
import { PODE_ATENDER } from "@/lib/staff";

export const POST = staffRoute<{ id: string }>(PODE_ATENDER, async ({ supabase, tenant }, _req, { id }) => {
  const { error } = await supabase
    .from("sessions")
    .update({ encerrada_em: new Date().toISOString() })
    .eq("tenant_id", tenant.id)
    .eq("table_id", uuid.parse(id))
    .is("encerrada_em", null);
  if (error) throw fromDbError(error);
  return json({ ok: true });
});
