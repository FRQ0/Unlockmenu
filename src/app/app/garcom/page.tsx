import type { Metadata } from "next";
import { staffPage } from "@/lib/staff";
import { carregarSalao } from "@/lib/salao";
import { tenantHas } from "@/lib/plans";
import { PainelGarcom } from "@/components/painel/PainelGarcom";

export const metadata: Metadata = { title: "Salão" };

export default async function GarcomPage() {
  const { supabase, tenant, membership } = await staffPage();
  const salao = await carregarSalao(supabase, tenant.id);
  return (
    <PainelGarcom
      tenantId={tenant.id}
      inicial={salao}
      recursos={{
        grade: tenantHas(tenant, "painel_garcom_grade"),
        som: tenantHas(tenant, "painel_garcom_som"),
        setores: tenantHas(tenant, "painel_garcom_setores"),
        push: tenantHas(tenant, "push") && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        alertaGerente: tenantHas(tenant, "alerta_gerente"),
      }}
      alertaMinutos={tenantHas(tenant, "alerta_gerente") ? tenant.alerta_minutos : 5}
      gerente={membership.papel === "dono" || membership.papel === "gerente"}
      podeAtender={membership.papel !== "cozinha"}
      meusSetores={membership.setores}
      vapid={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
    />
  );
}
