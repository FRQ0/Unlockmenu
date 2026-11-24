// Site de uma página do estabelecimento (plano Completo). Nos outros planos, vai direto ao cardápio.
// White-label: sem a marca do SaaS em lugar nenhum.
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Clock, MapPin, MessageCircle, Play } from "lucide-react";
import { cardapioPublico, tenantPublico } from "@/lib/public-data";
import { adminTenantPlano } from "@/lib/tenant-server";
import { tenantHas } from "@/lib/plans";
import { preco } from "@/lib/format";
import { IconeInstagram, Indisponivel, LogoTenant, TenantTema } from "@/components/cliente/TenantTema";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const t = await tenantPublico((await params).slug);
  if (!t) return {};
  const desc = [t.endereco, t.horarios].filter(Boolean).join(" · ") || `Conheça ${t.nome}.`;
  return {
    title: t.nome,
    description: desc,
    icons: t.logo_url ? { icon: t.logo_url, apple: t.logo_url } : undefined,
    openGraph: { title: t.nome, description: desc, type: "website", images: t.capa_url ? [t.capa_url] : t.logo_url ? [t.logo_url] : [] },
  };
}

export default async function SiteEstabelecimento({ params }: P) {
  const { slug } = await params;
  const t = await tenantPublico(slug);
  if (!t) notFound();
  if (!t.ativo) return <Indisponivel nome={t.nome} />;
  const plano = await adminTenantPlano(t.id);
  if (!plano || !tenantHas(plano, "site_institucional")) redirect(`/${slug}/cardapio`);

  const { produtos } = await cardapioPublico(t);
  const destaques = produtos.filter((p) => p.destaque && p.disponivel).slice(0, 6);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: t.nome,
    image: t.capa_url ?? t.logo_url ?? undefined,
    address: t.endereco ?? undefined,
    telephone: t.whatsapp ? `+${t.whatsapp}` : undefined,
    openingHours: t.horarios ?? undefined,
    sameAs: t.instagram ? [`https://instagram.com/${t.instagram}`] : undefined,
    hasMenu: `/${slug}/cardapio`,
  };

  return (
    <TenantTema tenant={t}>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="relative flex min-h-[70dvh] items-end overflow-hidden bg-marca-sec">
        {t.capa_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.capa_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="relative mx-auto w-full max-w-5xl px-5 pb-12 text-white">
          <LogoTenant tenant={t} size={84} />
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-6xl">{t.nome}</h1>
          {t.horarios && <p className="mt-2 max-w-xl text-white/85">{t.horarios}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/${slug}/cardapio`} className="btn bg-marca px-6 py-3 text-base text-marca-texto">Ver cardápio</Link>
            {t.whatsapp && (
              <a href={`https://wa.me/${t.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn bg-white px-6 py-3 text-base text-carvao">
                <MessageCircle className="h-5 w-5" /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-14">
        {destaques.length > 0 && (
          <section>
            <h2 className="text-2xl font-extrabold tracking-tight">Destaques do cardápio</h2>
            <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
              {destaques.map((p) => (
                <li key={p.id}>
                  <Link href={`/${slug}/cardapio`} className="group block overflow-hidden rounded-[18px] bg-white shadow-suave">
                    <div className="relative aspect-[4/5] bg-pedra">
                      {(p.poster_url || p.foto_url) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={(p.poster_url || p.foto_url)!} alt={p.nome} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                      )}
                      {p.video_url && <span className="absolute right-3 top-3 rounded-full bg-white/90 p-2"><Play className="h-4 w-4 fill-current" /></span>}
                    </div>
                    <div className="p-4">
                      <p className="font-bold">{p.nome}</p>
                      <p className="text-sm text-grafite">{preco(p.preco)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-14 grid gap-4 md:grid-cols-2">
          {t.endereco && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.endereco)}`} target="_blank" rel="noopener noreferrer" className="card flex gap-3 p-6">
              <MapPin className="h-6 w-6 shrink-0" />
              <div><p className="font-bold">Endereço</p><p className="text-sm text-grafite">{t.endereco}</p><p className="mt-1 text-sm font-semibold">Abrir no mapa →</p></div>
            </a>
          )}
          {t.horarios && (
            <div className="card flex gap-3 p-6">
              <Clock className="h-6 w-6 shrink-0" />
              <div><p className="font-bold">Horários</p><p className="whitespace-pre-line text-sm text-grafite">{t.horarios}</p></div>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-pedra py-8 text-center text-sm text-grafite">
        {t.instagram && (
          <a href={`https://instagram.com/${t.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold">
            <IconeInstagram /> @{t.instagram}
          </a>
        )}
        <p className="mt-2">© {new Date().getFullYear()} {t.nome}</p>
      </footer>
    </TenantTema>
  );
}
