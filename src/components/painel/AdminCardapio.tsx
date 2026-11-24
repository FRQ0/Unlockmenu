"use client";
import { useMemo, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, GripVertical, Loader2, Lock, Pencil, Play, Plus, Star, Trash2, Upload, X } from "lucide-react";
import type { Categoria, Produto } from "@/lib/types";
import { preco, TAG_NOME } from "@/lib/format";
import { api, enviarMidia } from "./api";

type Props = {
  categoriasIniciais: Categoria[];
  produtosIniciais: Produto[];
  recursos: { reels: boolean; combinaCom: boolean };
  linkCardapio: string;
};

const TODOS = "__todos";

function Arrastavel({ id, children }: { id: string; children: (alca: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }} className={isDragging ? "opacity-80" : ""}>
      {children(
        <button {...attributes} {...listeners} className="cursor-grab touch-none p-1 text-grafite active:cursor-grabbing" aria-label="Arrastar para reordenar">
          <GripVertical className="h-4 w-4" />
        </button>,
      )}
    </li>
  );
}

export function AdminCardapio({ categoriasIniciais, produtosIniciais, recursos, linkCardapio }: Props) {
  const [categorias, setCategorias] = useState(categoriasIniciais);
  const [produtos, setProdutos] = useState(produtosIniciais);
  const [catAtiva, setCatAtiva] = useState<string>(TODOS);
  const [editando, setEditando] = useState<Produto | "novo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novaCat, setNovaCat] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const lista = useMemo(() => produtos.filter((p) => catAtiva === TODOS || p.categoria_id === catAtiva), [produtos, catAtiva]);
  const nomeCat = new Map(categorias.map((c) => [c.id, c.nome]));

  async function tentar(fn: () => Promise<void>) {
    setErro(null);
    try {
      await fn();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    }
  }

  const criarCategoria = () =>
    tentar(async () => {
      if (!novaCat.trim()) return;
      const c = await api<Categoria>("/api/app/categorias", "POST", { nome: novaCat.trim() });
      setCategorias((cs) => [...cs, c]);
      setNovaCat("");
    });

  const renomearCategoria = (c: Categoria) =>
    tentar(async () => {
      const nome = prompt("Novo nome da categoria", c.nome)?.trim();
      if (!nome || nome === c.nome) return;
      const n = await api<Categoria>(`/api/app/categorias/${c.id}`, "PATCH", { nome });
      setCategorias((cs) => cs.map((x) => (x.id === c.id ? n : x)));
    });

  const alternarCategoria = (c: Categoria) =>
    tentar(async () => {
      const n = await api<Categoria>(`/api/app/categorias/${c.id}`, "PATCH", { ativa: !c.ativa });
      setCategorias((cs) => cs.map((x) => (x.id === c.id ? n : x)));
    });

  const apagarCategoria = (c: Categoria) =>
    tentar(async () => {
      if (!confirm(`Apagar a categoria "${c.nome}"? Os pratos ficam sem categoria.`)) return;
      await api(`/api/app/categorias/${c.id}`, "DELETE");
      setCategorias((cs) => cs.filter((x) => x.id !== c.id));
      setProdutos((ps) => ps.map((p) => (p.categoria_id === c.id ? { ...p, categoria_id: null } : p)));
      if (catAtiva === c.id) setCatAtiva(TODOS);
    });

  const patchProduto = (p: Produto, campos: Partial<Produto>) =>
    tentar(async () => {
      setProdutos((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...campos } : x))); // otimista
      try {
        await api(`/api/app/produtos/${p.id}`, "PATCH", campos);
      } catch (e) {
        setProdutos((ps) => ps.map((x) => (x.id === p.id ? p : x)));
        throw e;
      }
    });

  function fimArrastoCategorias(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const de = categorias.findIndex((c) => c.id === e.active.id);
    const para = categorias.findIndex((c) => c.id === e.over!.id);
    const nova = arrayMove(categorias, de, para);
    setCategorias(nova);
    tentar(() => api("/api/app/categorias/reordenar", "POST", { ids: nova.map((c) => c.id) }).then(() => {}));
  }

  function fimArrastoProdutos(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const de = lista.findIndex((p) => p.id === e.active.id);
    const para = lista.findIndex((p) => p.id === e.over!.id);
    const novaLista = arrayMove(lista, de, para);
    const ordem = new Map(novaLista.map((p, i) => [p.id, i]));
    const todos = [...produtos].sort((a, b) => (ordem.get(a.id) ?? 1e6 + a.ordem) - (ordem.get(b.id) ?? 1e6 + b.ordem));
    setProdutos(todos);
    tentar(() => api("/api/app/produtos/reordenar", "POST", { ids: todos.map((p) => p.id) }).then(() => {}));
  }

  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Cardápio</h1>
        <a href={linkCardapio} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-areia-escura">
          Ver como o cliente vê <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button onClick={() => setEditando("novo")} className="btn-escuro ml-auto"><Plus className="h-4 w-4" /> Novo prato</button>
      </div>
      {erro && <p role="alert" className="mt-3 rounded-xl bg-estado-vermelho/10 p-3 text-sm font-semibold text-estado-vermelho">{erro}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <section className="card h-fit p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-grafite">Categorias</h2>
          <button onClick={() => setCatAtiva(TODOS)} className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${catAtiva === TODOS ? "bg-areia/25" : "hover:bg-papel"}`}>
            Todos ({produtos.length})
          </button>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={fimArrastoCategorias}>
            <SortableContext items={categorias.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {categorias.map((c) => (
                  <Arrastavel key={c.id} id={c.id}>
                    {(alca) => (
                      <div className={`group flex items-center gap-1 rounded-xl pr-1 ${catAtiva === c.id ? "bg-areia/25" : "hover:bg-papel"}`}>
                        {alca}
                        <button onClick={() => setCatAtiva(c.id)} className={`flex-1 truncate py-2 text-left text-sm font-semibold ${c.ativa ? "" : "text-grafite line-through"}`}>
                          {c.nome} <span className="font-normal text-grafite">({produtos.filter((p) => p.categoria_id === c.id).length})</span>
                        </button>
                        <button onClick={() => renomearCategoria(c)} className="p-1 text-grafite" aria-label="Renomear"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => alternarCategoria(c)} className="px-1 text-[10px] font-bold uppercase text-grafite">{c.ativa ? "Ocultar" : "Mostrar"}</button>
                        <button onClick={() => apagarCategoria(c)} className="p-1 text-estado-vermelho" aria-label="Apagar"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </Arrastavel>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <form onSubmit={(e) => { e.preventDefault(); criarCategoria(); }} className="mt-3 flex gap-2">
            <input value={novaCat} onChange={(e) => setNovaCat(e.target.value)} maxLength={40} placeholder="Nova categoria" className="campo" />
            <button className="btn-secundario px-3" aria-label="Adicionar categoria"><Plus className="h-4 w-4" /></button>
          </form>
        </section>

        <section>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={fimArrastoProdutos}>
            <SortableContext items={lista.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {lista.map((p) => (
                  <Arrastavel key={p.id} id={p.id}>
                    {(alca) => (
                      <div className={`card flex items-center gap-3 p-3 ${p.disponivel ? "" : "bg-white/60"}`}>
                        {alca}
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-pedra">
                          {(p.foto_url || p.poster_url) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={(p.foto_url || p.poster_url)!} alt="" className="h-full w-full object-cover" />
                          )}
                          {p.video_url && <Play className="absolute bottom-1 right-1 h-4 w-4 fill-white text-white drop-shadow" />}
                        </div>
                        <button onClick={() => setEditando(p)} className="min-w-0 flex-1 text-left">
                          <p className={`truncate font-bold ${p.disponivel ? "" : "text-grafite"}`}>{p.nome}</p>
                          <p className="text-sm text-grafite">
                            {preco(p.preco)}
                            {p.preco_antigo ? <span className="ml-1 line-through">{preco(p.preco_antigo)}</span> : null}
                            {catAtiva === TODOS && p.categoria_id ? ` · ${nomeCat.get(p.categoria_id) ?? ""}` : ""}
                          </p>
                        </button>
                        <button onClick={() => patchProduto(p, { destaque: !p.destaque })} aria-label="Destaque" aria-pressed={p.destaque} className="p-2">
                          <Star className={`h-5 w-5 ${p.destaque ? "fill-areia text-areia" : "text-pedra"}`} />
                        </button>
                        <button
                          onClick={() => patchProduto(p, { disponivel: !p.disponivel })}
                          className={`w-28 shrink-0 rounded-xl py-2.5 text-xs font-extrabold uppercase tracking-wide transition active:scale-95 ${
                            p.disponivel ? "bg-estado-verde/15 text-estado-verde" : "bg-estado-vermelho text-white"
                          }`}
                        >
                          {p.disponivel ? "Disponível" : "Esgotado"}
                        </button>
                      </div>
                    )}
                  </Arrastavel>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {!lista.length && <p className="card p-10 text-center text-sm text-grafite">Nenhum prato aqui ainda.</p>}
        </section>
      </div>

      {editando && (
        <EditorProduto
          produto={editando === "novo" ? null : editando}
          categoriaPadrao={catAtiva === TODOS ? (categorias[0]?.id ?? null) : catAtiva}
          categorias={categorias}
          produtos={produtos}
          recursos={recursos}
          onFechar={() => setEditando(null)}
          onSalvo={(p, novo) => {
            setProdutos((ps) => (novo ? [...ps, p] : ps.map((x) => (x.id === p.id ? p : x))));
            setEditando(null);
          }}
          onApagado={(id) => {
            setProdutos((ps) => ps.filter((x) => x.id !== id));
            setEditando(null);
          }}
        />
      )}
    </main>
  );
}

function EditorProduto({
  produto,
  categoriaPadrao,
  categorias,
  produtos,
  recursos,
  onFechar,
  onSalvo,
  onApagado,
}: {
  produto: Produto | null;
  categoriaPadrao: string | null;
  categorias: Categoria[];
  produtos: Produto[];
  recursos: { reels: boolean; combinaCom: boolean };
  onFechar: () => void;
  onSalvo: (p: Produto, novo: boolean) => void;
  onApagado: (id: string) => void;
}) {
  const [f, setF] = useState({
    nome: produto?.nome ?? "",
    descricao: produto?.descricao ?? "",
    categoria_id: produto?.categoria_id ?? categoriaPadrao,
    preco: produto ? String(produto.preco) : "",
    preco_antigo: produto?.preco_antigo ? String(produto.preco_antigo) : "",
    foto_url: produto?.foto_url ?? null,
    video_url: produto?.video_url ?? null,
    poster_url: produto?.poster_url ?? null,
    destaque: produto?.destaque ?? false,
    disponivel: produto?.disponivel ?? true,
    tags: produto?.tags ?? [],
    combina_com: produto?.combina_com ?? [],
  });
  const [enviando, setEnviando] = useState<"foto" | "video" | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function upload(tipo: "foto" | "video", file: File | undefined) {
    if (!file) return;
    setErro(null);
    setEnviando(tipo);
    try {
      const r = await enviarMidia(file, tipo);
      setF((x) => (tipo === "foto" ? { ...x, foto_url: r.url } : { ...x, video_url: r.url, poster_url: r.poster_url ?? x.poster_url }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no envio");
    } finally {
      setEnviando(null);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const corpo = {
      nome: f.nome.trim(),
      descricao: f.descricao.trim() || null,
      categoria_id: f.categoria_id,
      preco: Number(f.preco.replace(",", ".")),
      preco_antigo: f.preco_antigo ? Number(f.preco_antigo.replace(",", ".")) : null,
      foto_url: f.foto_url,
      ...(recursos.reels ? { video_url: f.video_url, poster_url: f.poster_url } : {}),
      destaque: f.destaque,
      disponivel: f.disponivel,
      tags: f.tags,
      ...(recursos.combinaCom ? { combina_com: f.combina_com } : {}),
    };
    try {
      const p = produto ? await api<Produto>(`/api/app/produtos/${produto.id}`, "PATCH", corpo) : await api<Produto>("/api/app/produtos", "POST", corpo);
      onSalvo({ ...p, preco: Number(p.preco), preco_antigo: p.preco_antigo === null ? null : Number(p.preco_antigo) }, !produto);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!produto || !confirm(`Apagar "${produto.nome}"?`)) return;
    try {
      await api(`/api/app/produtos/${produto.id}`, "DELETE");
      onApagado(produto.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <form onSubmit={salvar} className="card relative max-h-[95dvh] w-full max-w-3xl overflow-y-auto rounded-b-none p-5 sm:rounded-b-[18px]">
        <div className="mb-4 flex items-center">
          <h2 className="text-lg font-extrabold">{produto ? "Editar prato" : "Novo prato"}</h2>
          <button type="button" onClick={onFechar} className="ml-auto p-2" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-5 md:grid-cols-[1fr_200px]">
          <div className="space-y-4">
            <div>
              <label className="rotulo" htmlFor="nome">Nome</label>
              <input id="nome" required maxLength={80} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} className="campo" />
            </div>
            <div>
              <label className="rotulo" htmlFor="desc">Descrição</label>
              <textarea id="desc" maxLength={500} rows={3} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} className="campo" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-1">
                <label className="rotulo" htmlFor="cat">Categoria</label>
                <select id="cat" value={f.categoria_id ?? ""} onChange={(e) => setF({ ...f, categoria_id: e.target.value || null })} className="campo">
                  <option value="">Sem categoria</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="rotulo" htmlFor="preco">Preço (R$)</label>
                <input id="preco" required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={f.preco} onChange={(e) => setF({ ...f, preco: e.target.value })} className="campo" />
              </div>
              <div>
                <label className="rotulo" htmlFor="antigo">Preço antigo</label>
                <input id="antigo" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="opcional" value={f.preco_antigo} onChange={(e) => setF({ ...f, preco_antigo: e.target.value })} className="campo" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TAG_NOME).map(([k, v]) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setF({ ...f, tags: f.tags.includes(k) ? f.tags.filter((t) => t !== k) : [...f.tags, k] })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${f.tags.includes(k) ? "bg-carvao text-papel" : "bg-papel"}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.destaque} onChange={(e) => setF({ ...f, destaque: e.target.checked })} /> Destaque</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.disponivel} onChange={(e) => setF({ ...f, disponivel: e.target.checked })} /> Disponível</label>
            </div>

            <div>
              <p className="rotulo">Combina com (até 2)</p>
              {recursos.combinaCom ? (
                <div className="flex flex-wrap gap-2">
                  {produtos.filter((p) => p.id !== produto?.id).map((p) => {
                    const on = f.combina_com.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        disabled={!on && f.combina_com.length >= 2}
                        onClick={() => setF({ ...f, combina_com: on ? f.combina_com.filter((x) => x !== p.id) : [...f.combina_com, p.id] })}
                        className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-40 ${on ? "bg-areia text-carvao" : "bg-papel"}`}
                      >
                        {p.nome}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-grafite"><Lock className="h-3.5 w-3.5" /> Disponível no plano Completo.</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="rotulo">Foto</p>
              <label className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-pedra bg-papel">
                {f.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.foto_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-xs font-semibold text-grafite"><Upload className="h-5 w-5" /> Enviar foto</span>
                )}
                {enviando === "foto" && <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-6 w-6 animate-spin" /></span>}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload("foto", e.target.files?.[0])} />
              </label>
              {f.foto_url && <button type="button" onClick={() => setF({ ...f, foto_url: null })} className="mt-1 text-xs font-semibold text-estado-vermelho">Remover foto</button>}
            </div>
            <div>
              <p className="rotulo">Reels do prato (9:16, 5 a 15 s)</p>
              {recursos.reels ? (
                <>
                  <label className="relative mx-auto flex aspect-[9/16] w-full max-w-[160px] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-pedra bg-carvao">
                    {f.video_url ? (
                      <video src={f.video_url} poster={f.poster_url ?? undefined} muted loop playsInline autoPlay className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex flex-col items-center gap-1 px-2 text-center text-xs font-semibold text-papel/80"><Upload className="h-5 w-5" /> Enviar vídeo MP4</span>
                    )}
                    {enviando === "video" && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-xs text-white"><Loader2 className="h-6 w-6 animate-spin" /> Comprimindo...</span>
                    )}
                    <input type="file" accept="video/mp4,video/quicktime" className="sr-only" onChange={(e) => upload("video", e.target.files?.[0])} />
                  </label>
                  {f.video_url && <button type="button" onClick={() => setF({ ...f, video_url: null, poster_url: null })} className="mt-1 text-xs font-semibold text-estado-vermelho">Remover vídeo</button>}
                </>
              ) : (
                <p className="flex items-center gap-1.5 rounded-xl bg-papel p-3 text-sm text-grafite"><Lock className="h-3.5 w-3.5 shrink-0" /> Reels disponível a partir do plano Profissional.</p>
              )}
            </div>
          </div>
        </div>

        {erro && <p role="alert" className="mt-4 text-sm font-semibold text-estado-vermelho">{erro}</p>}
        <div className="mt-5 flex items-center gap-2">
          {produto && <button type="button" onClick={apagar} className="btn text-estado-vermelho"><Trash2 className="h-4 w-4" /> Apagar</button>}
          <button type="button" onClick={onFechar} className="btn-secundario ml-auto">Cancelar</button>
          <button disabled={salvando || !!enviando} className="btn-escuro">{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</button>
        </div>
      </form>
    </div>
  );
}
