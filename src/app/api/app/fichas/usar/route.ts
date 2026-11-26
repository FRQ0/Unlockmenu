// Entrega: valida a ficha (só vale uma vez).
import { fromDbError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { usarFicha } from "@/lib/schemas";
import { requireFeature } from "@/lib/plans";
import { requireRateLimit } from "@/lib/security";

export const POST = staffRoute(undefined, async ({ supabase, tenant, user }, req) => {
  requireFeature(tenant, "fichas");
  await requireRateLimit(`ficha:${user.id}`, 120, 60);
  const { codigo } = usarFicha.parse(await readJson(req));
  const { data, error } = await supabase.rpc("usar_ficha", { p_tenant: tenant.id, p_codigo: codigo });
  if (error) throw fromDbError(error);
  const r = (Array.isArray(data) ? data[0] : data) as { resultado: string; nome: string | null; usada_em: string | null };
  return json(r);
});
