import { fromDbError, HttpError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { mesaEditar, uuid } from "@/lib/schemas";
import { PODE_GERIR } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";

export const PATCH = staffRoute<{ id: string }>(PODE_GERIR, async ({ supabase, tenant }, req, { id }) => {
  const body = mesaEditar.parse(await readJson(req));
  if (body.area !== undefined && body.area !== null) requireFeature(tenant, "painel_garcom_setores");
  const { data, error } = await supabase
    .from("tables").update(body).eq("id", uuid.parse(id)).eq("tenant_id", tenant.id)
    .select("id,tenant_id,nome,token_publico,area,ordem,ativa").maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, "Mesa não encontrada.");
  return json(data);
});

export const DELETE = staffRoute<{ id: string }>(PODE_GERIR, async ({ supabase, tenant }, _req, { id }) => {
  const { error } = await supabase.from("tables").delete().eq("id", uuid.parse(id)).eq("tenant_id", tenant.id);
  if (error) throw fromDbError(error);
  return json({ ok: true });
});
