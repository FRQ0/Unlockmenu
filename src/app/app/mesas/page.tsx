import type { Metadata } from "next";
import { PODE_GERIR, staffPage } from "@/lib/staff";
import { LIMITES, tenantHas } from "@/lib/plans";
import { urlMesa } from "@/lib/urls";
import { AdminMesas } from "@/components/painel/AdminMesas";

export const metadata: Metadata = { title: "Mesas e QR" };

export default async function MesasPage() {
  const { supabase, tenant } = await staffPage(PODE_GERIR);
  const { data } = await supabase.from("tables").select("id,nome,token_publico,area,ordem,ativa").eq("tenant_id", tenant.id).eq("arquivada", false).order("ordem").order("nome");
  return (
    <AdminMesas
      iniciais={(data ?? []).map((m) => ({ id: m.id, nome: m.nome, area: m.area, ativa: m.ativa, url: urlMesa(tenant, m.token_publico) }))}
      max={LIMITES[tenant.plano].maxMesas}
      setores={tenantHas(tenant, "painel_garcom_setores")}
    />
  );
}
