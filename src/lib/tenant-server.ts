import "server-only";
import { adminClient } from "./supabase/admin";
import type { TenantPlano } from "./plans";

export async function adminTenantPlano(tenantId: string): Promise<TenantPlano | null> {
  const { data } = await adminClient().from("tenants").select("plano,status,trial_ends_at").eq("id", tenantId).maybeSingle();
  return (data as TenantPlano) ?? null;
}
