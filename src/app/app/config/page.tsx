import type { Metadata } from "next";
import { PODE_GERIR, staffPage } from "@/lib/staff";
import { tenantHas } from "@/lib/plans";
import { AdminConfig } from "@/components/painel/AdminConfig";

export const metadata: Metadata = { title: "Estabelecimento" };

export default async function ConfigPage() {
  const { tenant } = await staffPage(PODE_GERIR);
  return (
    <AdminConfig
      inicial={{
        nome: tenant.nome,
        logo_url: tenant.logo_url,
        capa_url: tenant.capa_url,
        cor_primaria: tenant.cor_primaria,
        cor_secundaria: tenant.cor_secundaria,
        instagram: tenant.instagram,
        whatsapp: tenant.whatsapp,
        endereco: tenant.endereco,
        horarios: tenant.horarios,
        google_review_url: tenant.google_review_url,
        alerta_minutos: tenant.alerta_minutos,
        pix_chave: tenant.pix_chave,
        pix_nome: tenant.pix_nome,
        pix_cidade: tenant.pix_cidade,
      }}
      slug={tenant.slug}
      recursos={{ pagamentos: tenantHas(tenant, "pagamentos"), cores: tenantHas(tenant, "cores"), avaliacao: tenantHas(tenant, "avaliacao_google"), alerta: tenantHas(tenant, "alerta_gerente") }}
    />
  );
}
