import { fromDbError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { produtoCriar } from "@/lib/schemas";
import { PODE_GERIR } from "@/lib/staff";
import { conferirPlanoProduto } from "@/lib/produto-regras";
import { PRODUTO_COLS } from "@/lib/types";

export const POST = staffRoute(PODE_GERIR, async ({ supabase, tenant }, req) => {
  const body = produtoCriar.parse(await readJson(req));
  conferirPlanoProduto(tenant, body);
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id);
  const { data, error } = await supabase
    .from("products")
    .insert({ ...body, tenant_id: tenant.id, ordem: count ?? 0 })
    .select(PRODUTO_COLS)
    .single();
  if (error) throw fromDbError(error);
  return json(data, 201);
});
