import { json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { reordenar as schema } from "@/lib/schemas";
import { PODE_GERIR } from "@/lib/staff";
import { reordenar } from "@/lib/reordenar";
import { requireFeature } from "@/lib/plans";

export const POST = staffRoute(PODE_GERIR, async ({ supabase, tenant }, req) => {
  requireFeature(tenant, "cardapio_foto");
  const { ids } = schema.parse(await readJson(req));
  await reordenar(supabase, "products", tenant.id, ids);
  return json({ ok: true });
});
