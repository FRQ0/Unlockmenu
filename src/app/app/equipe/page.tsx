import type { Metadata } from "next";
import { staffPage } from "@/lib/staff";
import { tenantHas } from "@/lib/plans";
import { AdminEquipe } from "@/components/painel/AdminEquipe";
import type { Membership } from "@/lib/types";

export const metadata: Metadata = { title: "Equipe" };

export default async function EquipePage() {
  const { supabase, tenant, user } = await staffPage(["dono"]);
  const [{ data }, { data: mesas }] = await Promise.all([
    supabase.from("memberships").select("id,tenant_id,user_id,papel,nome,setores,ativo").eq("tenant_id", tenant.id).order("created_at"),
    supabase.from("tables").select("area").eq("tenant_id", tenant.id).not("area", "is", null),
  ]);
  const areas = Array.from(new Set((mesas ?? []).map((m) => m.area as string).filter(Boolean))).sort();
  return (
    <AdminEquipe
      iniciais={(data ?? []) as Membership[]}
      eu={user.id}
      slug={tenant.slug}
      setores={tenantHas(tenant, "painel_garcom_setores")}
      areas={areas}
      temCozinha={tenantHas(tenant, "pedidos")}
    />
  );
}
