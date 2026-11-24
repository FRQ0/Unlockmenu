import { fromDbError, HttpError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { produtoEditar, uuid } from "@/lib/schemas";
import { PODE_GERIR } from "@/lib/staff";
import { conferirPlanoProduto } from "@/lib/produto-regras";
import { PRODUTO_COLS } from "@/lib/types";

export const PATCH = staffRoute<{ id: string }>(PODE_GERIR, async ({ supabase, tenant }, req, { id }) => {
  const body = produtoEditar.parse(await readJson(req));
  conferirPlanoProduto(tenant, body);
  const { data, error } = await supabase
    .from("products").update(body).eq("id", uuid.parse(id)).eq("tenant_id", tenant.id)
    .select(PRODUTO_COLS).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, "Produto não encontrado.");
  return json(data);
});

export const DELETE = staffRoute<{ id: string }>(PODE_GERIR, async ({ supabase, tenant }, _req, { id }) => {
  const { error } = await supabase.from("products").delete().eq("id", uuid.parse(id)).eq("tenant_id", tenant.id);
  if (error) throw fromDbError(error);
  return json({ ok: true });
});
