"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Play, Search, Star } from "lucide-react";
import type { CategoriaPublica, ProdutoPublico } from "@/lib/public-data";
import { preco, TAG_NOME } from "@/lib/format";
import { LogoTenant } from "./TenantTema";
import { Reels } from "./Reels";
import { enviarEvento } from "./evento";

type Props = {
  tenant: { nome: string; slug: string; logo_url: string | null };
  mesa: { nome: string; token: string } | null;
  categorias: CategoriaPublica[];
  produtos: ProdutoPublico[];
};

const TODOS = "__todos";
const DESTAQUES = "__destaques";

export function Cardapio({ tenant, mesa, categorias, produtos }: Props) {
  const [aba, setAba] = useState(TODOS);
  const [busca, setBusca] = useState("");
  const [reels, setReels] = useState<{ lista: ProdutoPublico[]; inicio: number } | null>(null);

  useEffect(() => enviarEvento(tenant.slug, mesa?.token ?? null, "view_cardapio"), [tenant.slug, mesa?.token]);

  const temDestaque = produtos.some((p) => p.destaque);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const norm = (s: string | null) => (s ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    return produtos.filter((p) => {
      if (aba === DESTAQUES && !p.destaque) return false;
      if (aba !== TODOS && aba !== DESTAQUES && p.categoria_id !== aba) return false;
      if (q && !norm(p.nome).includes(q) && !norm(p.descricao).includes(q)) return false;
      return true;
    });
  }, [produtos, aba, busca]);

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  function abrir(p: ProdutoPublico) {
    const i = lista.findIndex((x) => x.id === p.id);
    setReels({ lista, inicio: Math.max(0, i) });
    enviarEvento(tenant.slug, mesa?.token ?? null, "view_produto", p.id);
  }

  const voltar = mesa ? `/${tenant.slug}/m/${mesa.token}` : null;

  return (
    <main className="mx-auto min-h-dvh max-w-2xl pb-10">
      <header className="sticky top-0 z-20 bg-papel/95 px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur">
        {voltar && (
          <Link href={voltar} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-grafite">
            <ArrowLeft className="h-4 w-4" /> Voltar para a mesa
          </Link>
        )}
        <div className="flex items-center gap-3">
          <LogoTenant tenant={tenant} size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-extrabold">{tenant.nome}</h1>
            <p className="text-[11px] font-bold uppercase tracking-wider text-grafite">
              Cardápio{mesa ? ` · ${mesa.nome}` : ""} · {produtos.length} itens
            </p>
          </div>
        </div>
        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grafite" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no cardápio..."
            className="campo pl-9"
            inputMode="search"
            maxLength={60}
            aria-label="Buscar no cardápio"
          />
        </label>
        <nav className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" aria-label="Categorias">
          {[
            { id: TODOS, nome: "Todos" },
            ...(temDestaque ? [{ id: DESTAQUES, nome: "★ Destaques" }] : []),
            ...categorias,
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setAba(c.id)}
              aria-pressed={aba === c.id}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                aba === c.id ? "bg-marca text-marca-texto" : "bg-white text-carvao shadow-suave"
              }`}
            >
              {c.nome}
            </button>
          ))}
        </nav>
      </header>

      <ul className="space-y-3 px-4">
        {lista.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => abrir(p)}
              className={`card flex w-full gap-3 p-3 text-left transition active:scale-[.99] ${p.disponivel ? "" : "opacity-55"}`}
            >
              {(p.foto_url || p.poster_url || p.video_url) && (
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-pedra">
                {(p.foto_url || p.poster_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={(p.foto_url || p.poster_url)!} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                )}
                {p.video_url && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                    <span className="rounded-full bg-white/90 p-2 text-carvao shadow"><Play className="h-4 w-4 fill-current" /></span>
                  </span>
                )}
              </div>
              )}
              <div className="min-w-0 flex-1 py-1">
                <div className="flex items-start gap-2">
                  <h2 className="flex-1 font-bold leading-snug">{p.nome}</h2>
                  {p.destaque && <Star className="mt-0.5 h-4 w-4 shrink-0 fill-marca text-marca" aria-label="Destaque" />}
                </div>
                {p.descricao && <p className="mt-0.5 line-clamp-2 text-sm text-grafite">{p.descricao}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {p.preco_antigo && p.preco_antigo > p.preco && <span className="text-xs text-grafite line-through">{preco(p.preco_antigo)}</span>}
                  <span className="font-extrabold">{preco(p.preco)}</span>
                  {!p.disponivel && <span className="selo bg-estado-vermelho text-white">Indisponível</span>}
                  {p.tags.map((t) => (
                    <span key={t} className="selo bg-pedra text-grafite normal-case">{TAG_NOME[t] ?? t}</span>
                  ))}
                </div>
              </div>
            </button>
          </li>
        ))}
        {!lista.length && <li className="py-16 text-center text-sm text-grafite">Nenhum item encontrado.</li>}
      </ul>

      {reels && (
        <Reels
          lista={reels.lista}
          inicio={reels.inicio}
          porId={porId}
          slug={tenant.slug}
          token={mesa?.token ?? null}
          onFechar={() => setReels(null)}
          onAbrirOutro={(p) => {
            const i = reels.lista.findIndex((x) => x.id === p.id);
            if (i >= 0) setReels({ lista: reels.lista, inicio: i });
            else setReels({ lista: [p, ...reels.lista.filter((x) => x.id !== p.id)], inicio: 0 });
          }}
        />
      )}
    </main>
  );
}
