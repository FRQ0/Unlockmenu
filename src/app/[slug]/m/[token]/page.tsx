import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { mesaPublica, registrarEvento, registrarPresenca, tenantPublico } from "@/lib/public-data";
import { Indisponivel, TenantTema } from "@/components/cliente/TenantTema";
import { MesaCliente } from "@/components/cliente/MesaCliente";

type P = { params: Promise<{ slug: string; token: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const t = await tenantPublico(slug);
  return {
    title: t ? t.nome : "Cardápio",
    robots: { index: false, follow: false }, // página da mesa não vai para o Google
    icons: t?.logo_url ? { icon: t.logo_url, apple: t.logo_url } : undefined,
  };
}

export default async function MesaPage({ params }: P) {
  const { slug, token } = await params;
  const tenant = await tenantPublico(slug);
  if (!tenant) notFound();
  if (!tenant.ativo) return <Indisponivel nome={tenant.nome} />;
  const mesa = await mesaPublica(tenant.id, token);
  if (!mesa) notFound();

  // grava depois de enviar a página: o cliente não espera por isso
  after(() => Promise.all([registrarPresenca(token), registrarEvento(tenant.id, "scan_mesa", { table_id: mesa.id })]));

  return (
    <TenantTema tenant={tenant}>
      <MesaCliente
        tenant={{ nome: tenant.nome, slug: tenant.slug, logo_url: tenant.logo_url, instagram: tenant.instagram, google_review_url: tenant.google_review_url }}
        mesa={{ nome: mesa.nome, token: mesa.token }}
      />
    </TenantTema>
  );
}
