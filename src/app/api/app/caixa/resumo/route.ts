import { json } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { PODE_ATENDER } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";
import { resumoCaixa } from "@/lib/caixa";

export const GET = staffRoute(PODE_ATENDER, async ({ supabase, tenant }) => {
  requireFeature(tenant, "fichas");
  return json(await resumoCaixa(supabase, tenant.id));
});
