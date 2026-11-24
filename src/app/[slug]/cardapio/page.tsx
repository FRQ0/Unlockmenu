// Cardápio sem mesa (só para olhar): link do Instagram, site do estabelecimento etc.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cardapioPublico, tenantPublico } from "@/lib/public-data";
import { Indisponivel, TenantTema } from "@/components/cliente/TenantTema";
import { Cardapio } from "@/components/cliente/Cardapio";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const t = await tenantPublico((await params).slug);
  if (!t) return { title: "Cardápio" };
  return {
    title: `Cardápio · ${t.nome}`,
    description: `Veja o cardápio de ${t.nome}.`,
    icons: t.logo_url ? { icon: t.logo_url } : undefined,
    openGraph: { title: `Cardápio · ${t.nome}`, images: t.capa_url ? [t.capa_url] : t.logo_url ? [t.logo_url] : [] },
  };
}

export default async function CardapioPage({ params }: P) {
  const { slug } = await params;
  const tenant = await tenantPublico(slug);
  if (!tenant) notFound();
  if (!tenant.ativo) return <Indisponivel nome={tenant.nome} />;
  const { categorias, produtos } = await cardapioPublico(tenant);
  return (
    <TenantTema tenant={tenant}>
      <Cardapio tenant={{ nome: tenant.nome, slug: tenant.slug, logo_url: tenant.logo_url }} mesa={null} categorias={categorias} produtos={produtos} />
    </TenantTema>
  );
}
