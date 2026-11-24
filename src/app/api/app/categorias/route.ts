import { fromDbError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { categoriaCriar } from "@/lib/schemas";
import { PODE_GERIR } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";

export const POST = staffRoute(PODE_GERIR, async ({ supabase, tenant }, req) => {
  requireFeature(tenant, "cardapio_foto");
  const body = categoriaCriar.parse(await readJson(req));
  const { count } = await supabase.from("categories").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id);
  const { data, error } = await supabase
    .from("categories")
    .insert({ ...body, tenant_id: tenant.id, ordem: count ?? 0 })
    .select("id,tenant_id,nome,ordem,ativa")
    .single();
  if (error) throw fromDbError(error);
  return json(data, 201);
});
