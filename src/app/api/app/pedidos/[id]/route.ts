// Cozinha: preparando/pronto · Salão: entregue/cancelado (as regras ficam no banco).
import { after } from "next/server";
import { fromDbError, HttpError, json, readJson } from "@/lib/http";
import { tenantHas } from "@/lib/plans";
import { enviarPush } from "@/lib/push";
import { staffRoute } from "@/lib/route";
import { pedidoStatus, uuid } from "@/lib/schemas";
import { requireFeature } from "@/lib/plans";

export const PATCH = staffRoute<{ id: string }>(undefined, async ({ supabase, tenant }, req, { id }) => {
  requireFeature(tenant, "pedidos");
  const { status } = pedidoStatus.parse(await readJson(req));
  const { data, error } = await supabase.from("orders").update({ status }).eq("id", uuid.parse(id)).eq("tenant_id", tenant.id).select("id,status,tables(nome)").maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, "Pedido não encontrado.");
  if (status === "pronto" && tenantHas(tenant, "push")) {
    const mesa = (data.tables as unknown as { nome: string } | null)?.nome ?? "Mesa";
    after(() => enviarPush(tenant.id, { title: `Pedido pronto: ${mesa}`, body: "Pode levar à mesa", url: "/app/garcom", tag: `pronto-${data.id}` }, ["garcom", "gerente", "dono"]));
  }
  return json(data);
});
