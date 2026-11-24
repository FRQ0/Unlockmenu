// Identidade e configurações do estabelecimento.
import { fromDbError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { configTenant } from "@/lib/schemas";
import { PODE_GERIR } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";
import { TENANT_COLS } from "@/lib/types";

export const PATCH = staffRoute(PODE_GERIR, async ({ supabase, tenant }, req) => {
  const body = configTenant.parse(await readJson(req));
  requireFeature(tenant, "logo");
  const mudou = <K extends keyof typeof body>(k: K) => body[k] !== undefined && body[k] !== (tenant as Record<string, unknown>)[k];
  if (mudou("cor_primaria") || mudou("cor_secundaria") || mudou("capa_url")) requireFeature(tenant, "cores");
  if (mudou("google_review_url") && body.google_review_url) requireFeature(tenant, "avaliacao_google");
  if (mudou("modo_atendimento") && body.modo_atendimento === "chamar_pedir") requireFeature(tenant, "pedidos");
  if (mudou("alerta_minutos")) requireFeature(tenant, "alerta_gerente");

  const { data, error } = await supabase.from("tenants").update(body).eq("id", tenant.id).select(TENANT_COLS).single();
  if (error) throw fromDbError(error);
  return json(data);
});
