import { fromDbError, HttpError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { mesaCriar } from "@/lib/schemas";
import { PODE_GERIR } from "@/lib/staff";
import { LIMITES, requireFeature } from "@/lib/plans";

export const POST = staffRoute(PODE_GERIR, async ({ supabase, tenant }, req) => {
  requireFeature(tenant, "chamar_garcom");
  const body = mesaCriar.parse(await readJson(req));
  const qtd = body.quantidade ?? 1;

  const { count } = await supabase.from("tables").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("arquivada", false);
  const atual = count ?? 0;
  const max = LIMITES[tenant.plano].maxMesas;
  if (max !== null && atual + qtd > max) throw new HttpError(403, `Seu plano permite até ${max} mesas.`);

  const linhas = Array.from({ length: qtd }, (_, i) => ({
    tenant_id: tenant.id,
    nome: qtd === 1 && body.nome ? body.nome : `Mesa ${String(atual + i + 1).padStart(2, "0")}`,
    area: body.area ?? null,
    ordem: atual + i,
  }));
  const { data, error } = await supabase.from("tables").insert(linhas).select("id,tenant_id,nome,token_publico,area,ordem,ativa");
  if (error) throw fromDbError(error);
  return json(data, 201);
});
