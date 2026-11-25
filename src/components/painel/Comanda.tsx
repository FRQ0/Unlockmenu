"use client";
// Comanda do garçom: escolhe os pratos da mesa, quantidade e observação, e envia para a cozinha.
// O preço mostrado é só referência: o total oficial é calculado no banco.
import { useMemo, useState } from "react";
import { Loader2, Minus, Plus, Search, Send, X } from "lucide-react";
import { preco } from "@/lib/format";
import { api } from "./api";

export type ProdutoComanda = { id: string; nome: string; preco: number; categoria_id: string | null; disponivel: boolean };
export type CategoriaComanda = { id: string; nome: string };

type Linha = { qtd: number; obs: string };

export function Comanda({
  mesa,
  categorias,
  produtos,
  onFechar,
  onEnviado,
}: {
  mesa: { id: string; nome: string };
  categorias: CategoriaComanda[];
  produtos: ProdutoComanda[];
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const [itens, setItens] = useState<Record<string, Linha>>({});
  const [aba, setAba] = useState<string>("__todos");
  const [busca, setBusca] = useState("");
  const [obsAberta, setObsAberta] = useState<string | null>(null);
  const [obsGeral, setObsGeral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const lista = useMemo(
    () => produtos.filter((p) => (aba === "__todos" || p.categoria_id === aba) && (!busca || norm(p.nome).includes(norm(busca)))),
    [produtos, aba, busca],
  );
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const escolhidos = Object.entries(itens).filter(([, l]) => l.qtd > 0);
  const total = escolhidos.reduce((s, [id, l]) => s + (porId.get(id)?.preco ?? 0) * l.qtd, 0);
  const qtdTotal = escolhidos.reduce((s, [, l]) => s + l.qtd, 0);

  function somar(id: string, d: number) {
    setItens((it) => {
      const atual = it[id] ?? { qtd: 0, obs: "" };
      const qtd = Math.max(0, Math.min(50, atual.qtd + d));
      return { ...it, [id]: { ...atual, qtd } };
    });
  }

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      await api("/api/app/pedidos", "POST", {
        table_id: mesa.id,
        itens: escolhidos.map(([product_id, l]) => ({ product_id, quantidade: l.qtd, ...(l.obs.trim() ? { observacao: l.obs.trim() } : {}) })),
        ...(obsGeral.trim() ? { observacao: obsGeral.trim() } : {}),
      });
      navigator.vibrate?.(80);
      onEnviado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-papel">
      <header className="flex items-center gap-3 bg-carvao px-4 py-3 text-papel">
        <div className="flex-1">
          <p className="text-xs text-papel/60">Novo pedido</p>
          <p className="text-lg font-extrabold">{mesa.nome}</p>
        </div>
        <button onClick={onFechar} className="rounded-full p-2" aria-label="Fechar"><X className="h-5 w-5" /></button>
      </header>

      <div className="space-y-2 px-4 pt-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grafite" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prato..." className="campo pl-9" maxLength={60} />
        </label>
        <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: "__todos", nome: "Todos" }, ...categorias].map((c) => (
            <button key={c.id} onClick={() => setAba(c.id)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${aba === c.id ? "bg-carvao text-papel" : "bg-white shadow-suave"}`}>
              {c.nome}
            </button>
          ))}
        </nav>
      </div>

      <ul className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {lista.map((p) => {
          const l = itens[p.id];
          const q = l?.qtd ?? 0;
          return (
            <li key={p.id} className={`card p-3 ${p.disponivel ? "" : "opacity-50"}`}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug">{p.nome}</p>
                  <p className="text-sm text-grafite">{p.disponivel ? preco(p.preco) : "Esgotado"}</p>
                </div>
                {p.disponivel && (
                  <div className="flex items-center gap-1">
                    {q > 0 && (
                      <>
                        <button onClick={() => somar(p.id, -1)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-pedra" aria-label="Menos"><Minus className="h-4 w-4" /></button>
                        <span className="w-8 text-center text-lg font-extrabold tabular-nums">{q}</span>
                      </>
                    )}
                    <button onClick={() => somar(p.id, 1)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-carvao text-papel" aria-label="Mais"><Plus className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              {q > 0 &&
                (obsAberta === p.id || l?.obs ? (
                  <input
                    autoFocus={obsAberta === p.id}
                    value={l?.obs ?? ""}
                    onChange={(e) => setItens((it) => ({ ...it, [p.id]: { ...(it[p.id] ?? { qtd: 1 }), obs: e.target.value } }))}
                    placeholder="Observação (ex.: sem cebola, ao ponto)"
                    maxLength={200}
                    className="campo mt-2 py-2"
                  />
                ) : (
                  <button onClick={() => setObsAberta(p.id)} className="mt-1 text-xs font-semibold text-areia-escura">+ observação</button>
                ))}
            </li>
          );
        })}
        {!lista.length && <li className="py-10 text-center text-sm text-grafite">Nenhum prato encontrado.</li>}
      </ul>

      <footer className="border-t border-pedra bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <input value={obsGeral} onChange={(e) => setObsGeral(e.target.value)} placeholder="Observação do pedido (opcional)" maxLength={200} className="campo mb-2 py-2" />
        {erro && <p role="alert" className="mb-2 text-sm font-semibold text-estado-vermelho">{erro}</p>}
        <button onClick={enviar} disabled={!qtdTotal || enviando} className="btn-escuro w-full py-3.5 text-base">
          {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {qtdTotal ? `Enviar para a cozinha · ${qtdTotal} ${qtdTotal === 1 ? "item" : "itens"} · ${preco(total)}` : "Escolha os pratos"}
        </button>
      </footer>
    </div>
  );
}
