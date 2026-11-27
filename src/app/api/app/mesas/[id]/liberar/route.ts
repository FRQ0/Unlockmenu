// Libera a mesa (cliente foi embora sem consumir): encerra a presença e cancela chamados abertos.
// Mesa com pedido não pago não libera: tem que fechar a conta.
import { fromDbError, json } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { uuid } from "@/lib/schemas";
import { PODE_ATENDER } from "@/lib/staff";

export const POST = staffRoute<{ id: string }>(PODE_ATENDER, async ({ supabase }, _req, { id }) => {
  const { error } = await supabase.rpc("liberar_mesa", { p_table: uuid.parse(id) });
  if (error) throw fromDbError(error);
  return json({ ok: true });
});
