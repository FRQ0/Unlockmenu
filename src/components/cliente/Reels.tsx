"use client";
// Reels do prato: vídeo vertical em tela cheia, desliza para o próximo prato.
// Performance: só o prato atual e o vizinho carregam vídeo; os demais mostram o poster.
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronUp, Film, Image as ImageIcon, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import type { ProdutoPublico } from "@/lib/public-data";
import { preco } from "@/lib/format";
import { enviarEvento } from "./evento";

type Props = {
  lista: ProdutoPublico[];
  inicio: number;
  porId: Map<string, ProdutoPublico>;
  slug: string;
  token: string | null;
  onFechar: () => void;
  onAbrirOutro: (p: ProdutoPublico) => void;
};

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(chave: string, v: string) {
  try {
    localStorage.setItem(chave, v);
  } catch {}
}

export function Reels({ lista, inicio, porId, slug, token, onFechar, onAbrirOutro }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const videos = useRef<Map<number, HTMLVideoElement>>(new Map());
  const assistidos = useRef<Set<string>>(new Set());
  const [ativo, setAtivo] = useState(inicio);
  const [modoVideo, setModoVideo] = useState(true);
  const [fotoForcada, setFotoForcada] = useState<Set<string>>(new Set());
  const [mudo, setMudo] = useState(true);
  const [pausado, setPausado] = useState(false);
  const [dica, setDica] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  // preferências: modo foto (internet fraca) e dica de deslizar só na 1ª vez
  useEffect(() => {
    setModoVideo(ler("reels_modo") !== "foto");
    if (!ler("reels_dica")) {
      setDica(true);
      gravar("reels_dica", "1");
      const t = setTimeout(() => setDica(false), 3500);
      return () => clearTimeout(t);
    }
  }, []);

  // trava a rolagem da página de trás e fecha com "voltar" do celular / Esc
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    history.pushState({ reels: true }, "");
    const onPop = () => onFechar();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && history.back();
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
  }, [onFechar]);

  // posiciona no prato escolhido
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: inicio * el.clientHeight, behavior: ativo === inicio ? "instant" : "smooth" });
    setAtivo(inicio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, lista]);

  // descobre qual prato está na tela
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setAtivo(Number((e.target as HTMLElement).dataset.i));
      },
      { root: el, threshold: 0.6 },
    );
    el.querySelectorAll("[data-i]").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [lista]);

  const usaVideo = useCallback((p: ProdutoPublico) => modoVideo && !!p.video_url && !fotoForcada.has(p.id), [modoVideo, fotoForcada]);

  // toca só o vídeo da tela
  useEffect(() => {
    setPausado(false);
    setExpandido(null);
    videos.current.forEach((v, i) => {
      if (i === ativo) {
        v.muted = mudo;
        v.play().catch(() => setPausado(true));
      } else {
        v.pause();
      }
    });
    const p = lista[ativo];
    if (p && usaVideo(p) && !assistidos.current.has(p.id)) {
      assistidos.current.add(p.id);
      enviarEvento(slug, token, "play_reels", p.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, lista, usaVideo]);

  useEffect(() => {
    const v = videos.current.get(ativo);
    if (v) v.muted = mudo;
  }, [mudo, ativo]);

  function alternarPausa() {
    const v = videos.current.get(ativo);
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPausado(false);
    } else {
      v.pause();
      setPausado(true);
    }
  }

  function alternarModo() {
    const novo = !modoVideo;
    setModoVideo(novo);
    gravar("reels_modo", novo ? "video" : "foto");
  }

  const atual = lista[ativo];

  return (
    <div className="fixed inset-0 z-50 bg-black text-white" role="dialog" aria-modal="true" aria-label="Reels do prato">
      {/* barra do topo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 to-transparent px-3 pb-8 pt-[max(.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center gap-2">
          {atual?.video_url && modoVideo ? (
            <button
              onClick={() =>
                setFotoForcada((s) => {
                  const n = new Set(s);
                  if (n.has(atual.id)) n.delete(atual.id);
                  else n.add(atual.id);
                  return n;
                })
              }
              className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {fotoForcada.has(atual.id) ? "Ver vídeo" : "Ver foto"}
            </button>
          ) : (
            <span />
          )}
          <span className="mx-auto rounded-full bg-white/15 px-3 py-1 text-xs font-bold tabular-nums backdrop-blur">
            {ativo + 1} de {lista.length}
          </span>
          <button onClick={alternarModo} className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur" aria-label="Alternar entre vídeo e foto">
            {modoVideo ? <Film className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />} Modo
          </button>
          <button onClick={() => setMudo((m) => !m)} className="rounded-full bg-white/15 p-2 backdrop-blur" aria-label={mudo ? "Ligar som" : "Desligar som"}>
            {mudo ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button onClick={() => history.back()} className="rounded-full bg-white/15 p-2 backdrop-blur" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scroller} className="no-scrollbar h-dvh snap-y snap-mandatory overflow-y-scroll overscroll-contain">
        {lista.map((p, i) => {
          const perto = Math.abs(i - ativo) <= 1;
          const video = usaVideo(p);
          const imagem = p.foto_url || p.poster_url;
          const combina = p.combina_com.map((id) => porId.get(id)).filter((x): x is ProdutoPublico => !!x).slice(0, 2);
          const aberto = expandido === p.id;
          return (
            <section key={p.id} data-i={i} className="relative h-dvh w-full snap-start snap-always overflow-hidden">
              {video ? (
                <video
                  ref={(el) => {
                    if (el) videos.current.set(i, el);
                    else videos.current.delete(i);
                  }}
                  src={perto ? p.video_url! : undefined}
                  poster={p.poster_url ?? p.foto_url ?? undefined}
                  preload={i === ativo || i === ativo + 1 ? "auto" : "none"}
                  muted
                  loop
                  playsInline
                  disablePictureInPicture
                  onClick={alternarPausa}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : imagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagem} alt={p.nome} loading={perto ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-neutral-800 to-black" />
              )}

              {video && i === ativo && pausado && (
                <button onClick={alternarPausa} className="absolute inset-0 z-10 flex items-center justify-center" aria-label="Continuar">
                  <span className="rounded-full bg-black/40 p-5 backdrop-blur"><Play className="h-10 w-10 fill-white" /></span>
                </button>
              )}

              {!p.disponivel && (
                <div className="absolute inset-x-0 top-24 z-10 bg-estado-vermelho/95 py-2 text-center text-sm font-bold uppercase tracking-wider">
                  Indisponível no momento
                </div>
              )}

              {/* rodapé */}
              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/70 to-transparent px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-24">
                {combina.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-white/70">Combina com...</p>
                    <div className="flex gap-2">
                      {combina.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            enviarEvento(slug, token, "click_combina", c.id);
                            onAbrirOutro(c);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white/15 p-2 text-left backdrop-blur"
                        >
                          {(c.foto_url || c.poster_url) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={(c.foto_url || c.poster_url)!} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-bold">{c.nome}</span>
                            <span className="text-xs text-white/80">{preco(c.preco)}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {p.video_url && <span className="selo bg-marca text-marca-texto">Reels do prato</span>}
                  {p.destaque && <span className="selo bg-white text-carvao">Destaque</span>}
                </div>
                <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight">{p.nome}</h2>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-extrabold">{preco(p.preco)}</span>
                  {p.preco_antigo && p.preco_antigo > p.preco && <span className="text-sm text-white/60 line-through">{preco(p.preco_antigo)}</span>}
                </div>
                {p.descricao && (
                  <p className={`mt-2 text-sm text-white/85 ${aberto ? "" : "line-clamp-2"}`}>
                    {p.descricao}
                  </p>
                )}
                {p.descricao && p.descricao.length > 90 && !aberto && (
                  <button onClick={() => setExpandido(p.id)} className="text-sm font-semibold text-white">...leia mais</button>
                )}
                {video && i === ativo && (
                  <p className="mt-3 flex items-center gap-1 text-[11px] text-white/55">
                    {pausado ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />} Toque para {pausado ? "continuar" : "pausar"}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {dica && lista.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2">
          <ChevronUp className="h-10 w-10 animate-bounce" />
          <p className="rounded-full bg-black/50 px-4 py-2 text-sm font-semibold backdrop-blur">Deslize a tela para o próximo prato</p>
        </div>
      )}
    </div>
  );
}
