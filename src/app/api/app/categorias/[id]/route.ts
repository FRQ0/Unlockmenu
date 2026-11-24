import { fromDbError, HttpError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { categoriaEditar, uuid } from "@/lib/schemas";
import { PODE_GERIR } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";

export const PATCH = staffRoute<{ id: string }>(PODE_GERIR, async ({ supabase, tenant }, req, { id }) => {
  requireFeature(tenant, "cardapio_foto");
  const body = categoriaEditar.parse(await readJson(req));
  const { data, error } = await supabase
    .from("categories").update(body).eq("id", uuid.parse(id)).eq("tenant_id", tenant.id)
    .select("id,tenant_id,nome,ordem,ativa").maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, "Categoria não encontrada.");
  return json(data);
});

export const DELETE = staffRoute<{ id: string }>(PODE_GERIR, async ({ supabase, tenant }, _req, { id }) => {
  requireFeature(tenant, "cardapio_foto");
  const { error } = await supabase.from("categories").delete().eq("id", uuid.parse(id)).eq("tenant_id", tenant.id);
  if (error) throw fromDbError(error);
  return json({ ok: true });
});
