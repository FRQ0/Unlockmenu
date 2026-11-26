"use client";
// Caixa do fim de semana: toca nos produtos, recebe (Pix/débito/crédito/dinheiro) e imprime
// uma ficha por item, cada uma com código e QR que só vale uma vez.
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Loader2, Minus, Plus, Printer, Receipt, Trash2, X } from "lucide-react";
import { preco } from "@/lib/format";
import { api } from "./api";
import { Pagamento, type PagamentoInput, type PixConfig } from "./Pagamento";

type Produto = { id: string; nome: string; preco: number; categoria_id: string | null; disponivel: boolean };
type Ficha = { codigo: string; nome: string; preco: number };
type Resumo = {
  porMetodo: Record<"pix" | "debito" | "credito" | "dinheiro", number>;
  total: number;
  fichas: { vendidas: number; usadas: number; pendentes: number; canceladas: number };
  vendas: { id: string; total: number; criado_em: string; cancelada: boolean; itens: string }[];
};

const NOME_METODO = { pix: "Pix", debito: "Débito", credito: "Crédito", dinheiro: "Dinheiro" };

export function CaixaFichas({
  nomeEstabelecimento,
  categorias,
  produtos,
  pix,
  resumoInicial,
  podeCancelar,
  infinitepay = false,
}: {
  nomeEstabelecimento: string;
  categorias: { id: string; nome: string }[];
  produtos: Produto[];
  pix: PixConfig;
  resumoInicial: Resumo;
  podeCancelar: boolean;
  infinitepay?: boolean;
}) {
  const [aba, setAba] = useState(categorias[0]?.id ?? "__todos");
  const [carrinho, setCarrinho] = useState<Record<string, number>>({});
  const [pagos, setPagos] = useState<PagamentoInput[]>([]);
  const [pagando, setPagando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [fichas, setFichas] = useState<Ficha[] | null>(null);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [resumo, setResumo] = useState(resumoInicial);
  const [verResumo, setVerResumo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const itens = Object.entries(carrinho).filter(([, q]) => q > 0);
  const total = Math.round(itens.reduce((s, [id, q]) => s + (porId.get(id)?.preco ?? 0) * q, 0) * 100) / 100;
  const pago = Math.round(pagos.reduce((s, p) => s + p.valor, 0) * 100) / 100;
  const falta = Math.max(0, Math.round((total - pago) * 100) / 100);
  const lista = produtos.filter((p) => aba === "__todos" || p.categoria_id === aba);

  function somar(id: string, d: number) {
    setCarrinho((c) => ({ ...c, [id]: Math.max(0, Math.min(50, (c[id] ?? 0) + d)) }));
  }

  async function recarregarResumo() {
    try {
      setResumo(await api<Resumo>("/api/app/caixa/resumo", "GET"));
    } catch {}
  }

  async function finalizar(todos: PagamentoInput[]) {
    setErro(null);
    setFinalizando(true);
    try {
      const r = await api<{ venda_id: string; fichas: Ficha[] }>("/api/app/caixa/vender", "POST", {
        itens: itens.map(([product_id, quantidade]) => ({ product_id, quantidade })),
        pagamentos: todos,
      });
      const mapa: Record<string, string> = {};
      await Promise.all(r.fichas.map(async (f) => (mapa[f.codigo] = await QRCode.toDataURL(f.codigo, { margin: 0, width: 220 }))));
      setQrs(mapa);
      setFichas(r.fichas);
      setCarrinho({});
      setPagos([]);
      recarregarResumo();
      setTimeout(() => window.print(), 300);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao vender");
    } finally {
      setFinalizando(false);
    }
  }

  async function cancelarVenda(id: string) {
    if (!confirm("Cancelar esta venda? As fichas que ainda não foram trocadas deixam de valer.")) return;
    try {
      await api(`/api/app/caixa/vendas/${id}/cancelar`, "POST");
      recarregarResumo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    }
  }

  // voltou do app InfinitePay (aproximação): recupera a venda e conclui com a cobrança paga
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("cobranca");
    if (!id) return;
    history.replaceState(null, "", "/app/caixa");
    (async () => {
      try {
        const salvo = JSON.parse(sessionStorage.getItem("caixa_pendente") ?? "null") as { carrinho: Record<string, number>; pagos: PagamentoInput[]; cobranca: string } | null;
        sessionStorage.removeItem("caixa_pendente");
        if (!salvo || salvo.cobranca !== id) return;
        const s = await api<{ status: string; metodo: "pix" | "debito" | "credito" | null; valor: number }>(`/api/app/cobrancas/${id}`, "GET");
        if (s.status !== "paga") return setErro("O pagamento não foi confirmado. Cobre de novo.");
        setCarrinho(salvo.carrinho);
        setPagos([...salvo.pagos, { metodo: s.metodo ?? "credito", valor: s.valor, cobranca_id: id }]);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!pagando && pagos.length && falta === 0 && !finalizando && !fichas) finalizar(pagos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagos, falta, pagando]);

  return (
    <main className="mx-auto max-w-6xl p-3 pb-28 lg:p-6 lg:pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Caixa e fichas</h1>
        <button onClick={() => setVerResumo(true)} className="btn-secundario ml-auto"><Receipt className="h-4 w-4" /> Caixa de hoje · {preco(resumo.total)}</button>
      </div>
      {erro && <p role="alert" className="mt-3 rounded-xl bg-estado-vermelho/10 p-3 text-sm font-semibold text-estado-vermelho">{erro}</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0">
          <nav className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-2">
            {[...categorias, { id: "__todos", nome: "Todos" }].map((c) => (
              <button key={c.id} onClick={() => setAba(c.id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${aba === c.id ? "bg-carvao text-papel" : "bg-white shadow-suave"}`}>
                {c.nome}
              </button>
            ))}
          </nav>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {lista.map((p) => {
              const q = carrinho[p.id] ?? 0;
              return (
                <li key={p.id}>
                  <button
                    disabled={!p.disponivel}
                    onClick={() => somar(p.id, 1)}
                    className={`relative flex h-full min-h-[92px] w-full flex-col justify-between rounded-2xl p-3 text-left transition active:scale-95 disabled:opacity-40 ${q ? "bg-carvao text-papel" : "bg-white shadow-suave"}`}
                  >
                    <span className="text-sm font-bold leading-snug">{p.nome}</span>
                    <span className={`text-sm ${q ? "text-papel/80" : "text-grafite"}`}>{p.disponivel ? preco(p.preco) : "Esgotado"}</span>
                    {q > 0 && <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-areia px-2 text-sm font-extrabold text-carvao">{q}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside id="venda" className="card h-fit scroll-mt-20 p-4 lg:sticky lg:top-4">
          <h2 className="font-bold">Venda atual</h2>
          {!itens.length ? (
            <p className="py-6 text-center text-sm text-grafite">Toque nos produtos para adicionar.</p>
          ) : (
            <ul className="mt-2 divide-y divide-pedra">
              {itens.map(([id, q]) => {
                const p = porId.get(id)!;
                return (
                  <li key={id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.nome}</p>
                      <p className="text-xs text-grafite">{preco(p.preco * q)}</p>
                    </div>
                    <button onClick={() => somar(id, -1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-pedra" aria-label="Menos"><Minus className="h-4 w-4" /></button>
                    <span className="w-6 text-center font-extrabold tabular-nums">{q}</span>
                    <button onClick={() => somar(id, 1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-carvao text-papel" aria-label="Mais"><Plus className="h-4 w-4" /></button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex items-baseline justify-between border-t border-pedra pt-3">
            <span className="font-semibold text-grafite">Total</span>
            <span className="text-3xl font-extrabold tabular-nums">{preco(total)}</span>
          </div>
          {pagos.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {pagos.map((p, i) => (
                <li key={i} className="flex justify-between text-grafite"><span>{NOME_METODO[p.metodo]}</span><span>{preco(p.valor)}</span></li>
              ))}
              <li className="flex justify-between font-bold"><span>Falta</span><span>{preco(falta)}</span></li>
            </ul>
          )}
          <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
            <button onClick={() => { setCarrinho({}); setPagos([]); }} disabled={!itens.length} className="btn-secundario px-3" aria-label="Limpar"><Trash2 className="h-4 w-4" /></button>
            <button onClick={() => setPagando(true)} disabled={!itens.length || finalizando} className="btn-escuro py-3.5 text-base">
              {finalizando ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Receber {preco(falta || total)}
            </button>
          </div>
        </aside>
      </div>

      {/* celular: total e "Receber" sempre à mão, sem rolar até o fim da lista */}
      {itens.length > 0 && !fichas && (
        <div className="pb-seguro fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-pedra bg-white px-4 pt-3 shadow-2xl lg:hidden">
          <a href="#venda" className="min-w-0 flex-1">
            <p className="text-xs text-grafite">{itens.reduce((s, [, q]) => s + q, 0)} item(ns) · ver venda</p>
            <p className="text-xl font-extrabold tabular-nums">{preco(falta || total)}</p>
          </a>
          <button onClick={() => setPagando(true)} disabled={finalizando} className="btn-escuro px-6 py-3 text-base">
            {finalizando ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Receber
          </button>
        </div>
      )}

      {pagando && (
        <Pagamento
          titulo="Venda de fichas"
          falta={falta}
          pix={pix}
          txid={`FICHA${Date.now().toString(36).toUpperCase()}`}
          onFechar={() => setPagando(false)}
          infinitepay={infinitepay ? { origem: "fichas" } : null}
          onAntesDeSair={(cobranca) => {
            try {
              sessionStorage.setItem("caixa_pendente", JSON.stringify({ carrinho, pagos, cobranca }));
            } catch {}
          }}
          onConfirmar={async (p) => {
            const novos = [...pagos, p];
            setPagos(novos);
            setPagando(false);
          }}
        />
      )}

      {fichas && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="card pb-seguro w-full max-w-md rounded-b-none p-5 text-center sm:rounded-b-[18px] sm:pb-5">
            <p className="text-sm text-grafite">Venda concluída</p>
            <p className="mt-1 text-2xl font-extrabold">{fichas.length} ficha{fichas.length > 1 ? "s" : ""}</p>
            <p className="mt-1 text-sm text-grafite">{fichas.map((f) => f.nome).join(", ")}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => window.print()} className="btn-secundario py-3"><Printer className="h-4 w-4" /> Imprimir de novo</button>
              <button onClick={() => setFichas(null)} className="btn-escuro py-3">Nova venda</button>
            </div>
          </div>
        </div>
      )}

      {verResumo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="card flex max-h-[92dvh] w-full max-w-lg flex-col rounded-b-none sm:rounded-b-[18px]">
            <header className="flex items-center border-b border-pedra p-4">
              <h2 className="text-lg font-extrabold">Caixa de hoje</h2>
              <button onClick={() => setVerResumo(false)} className="ml-auto p-2" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </header>
            <div className="rolagem p-4">
              <p className="text-xs text-grafite">Mesas e fichas, desde 0h</p>
              <p className="text-4xl font-extrabold tabular-nums">{preco(resumo.total)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(Object.keys(NOME_METODO) as (keyof typeof NOME_METODO)[]).map((m) => (
                  <div key={m} className="rounded-xl bg-papel p-3">
                    <p className="text-xs font-semibold text-grafite">{NOME_METODO[m]}</p>
                    <p className="text-lg font-extrabold tabular-nums">{preco(resumo.porMetodo[m])}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-papel p-3"><p className="text-xs text-grafite">Fichas vendidas</p><p className="text-lg font-extrabold">{resumo.fichas.vendidas}</p></div>
                <div className="rounded-xl bg-papel p-3"><p className="text-xs text-grafite">Já trocadas</p><p className="text-lg font-extrabold">{resumo.fichas.usadas}</p></div>
                <div className="rounded-xl bg-papel p-3"><p className="text-xs text-grafite">Não trocadas</p><p className="text-lg font-extrabold">{resumo.fichas.pendentes}</p></div>
              </div>
              <h3 className="mt-5 text-sm font-bold">Vendas de fichas</h3>
              <ul className="mt-2 divide-y divide-pedra">
                {resumo.vendas.map((v) => (
                  <li key={v.id} className={`flex items-center gap-2 py-2 text-sm ${v.cancelada ? "opacity-50" : ""}`}>
                    <span className="w-12 text-xs text-grafite">{new Date(v.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="min-w-0 flex-1 truncate">{v.itens}</span>
                    <span className={`tabular-nums ${v.cancelada ? "line-through" : "font-semibold"}`}>{preco(v.total)}</span>
                    {podeCancelar && !v.cancelada && <button onClick={() => cancelarVenda(v.id)} className="text-xs font-semibold text-estado-vermelho">Cancelar</button>}
                  </li>
                ))}
                {!resumo.vendas.length && <li className="py-4 text-center text-sm text-grafite">Nenhuma venda hoje.</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Fichas impressas: uma por página (impressora térmica) */}
      {fichas && (
        <div className="ticket">
          {fichas.map((f, i) => (
            <div key={f.codigo} style={{ textAlign: "center", pageBreakAfter: i < fichas.length - 1 ? "always" : "auto", padding: "4mm 0" }}>
              <div style={{ fontWeight: 700 }}>{nomeEstabelecimento}</div>
              <div style={{ fontSize: 11 }}>FICHA · vale 1 item</div>
              <div style={{ fontSize: 22, fontWeight: 800, margin: "6px 0" }}>{f.nome}</div>
              {qrs[f.codigo] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrs[f.codigo]} alt="" style={{ width: "28mm", height: "28mm", margin: "0 auto" }} />
              )}
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 3 }}>{f.codigo}</div>
              <div style={{ fontSize: 11 }}>{new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
