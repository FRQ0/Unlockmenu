import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cardapioPublico, mesaPublica, tenantPublico } from "@/lib/public-data";
import { Indisponivel, TenantTema } from "@/components/cliente/TenantTema";
import { Cardapio } from "@/components/cliente/Cardapio";

type P = { params: Promise<{ slug: string; token: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const t = await tenantPublico((await params).slug);
  return { title: t ? `Cardápio · ${t.nome}` : "Cardápio", robots: { index: false }, icons: t?.logo_url ? { icon: t.logo_url } : undefined };
}

export default async function CardapioMesaPage({ params }: P) {
  const { slug, token } = await params;
  const tenant = await tenantPublico(slug);
  if (!tenant) notFound();
  if (!tenant.ativo) return <Indisponivel nome={tenant.nome} />;
  const mesa = await mesaPublica(tenant.id, token);
  if (!mesa) notFound();
  const { categorias, produtos } = await cardapioPublico(tenant);
  return (
    <TenantTema tenant={tenant}>
      <Cardapio
        tenant={{ nome: tenant.nome, slug: tenant.slug, logo_url: tenant.logo_url }}
        mesa={{ nome: mesa.nome, token: mesa.token }}
        categorias={categorias}
        produtos={produtos}
      />
    </TenantTema>
  );
}
