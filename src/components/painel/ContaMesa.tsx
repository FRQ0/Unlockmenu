"use client";
// Conta da mesa: tudo que foi pedido desde que a mesa abriu, com total; e o botão de fechar.
import { useEffect, useState } from "react";
import { Loader2, Plus, Receipt, Wallet, X } from "lucide-react";
import { Pagamento, type PixConfig } from "./Pagamento";
import { preco } from "@/lib/format";
import { api } from "./api";

type Pag = { id: string; metodo: string; valor: number; recebido: number | null };
type Conta = { pedidos: Pedido[]; total: number; pagamentos: Pag[]; pago: number; falta: number };
const NOME_METODO: Record<string, string> = { pix: "Pix", debito: "Débito", credito: "Crédito", dinheiro: "Dinheiro" };
type Pedido = { id: string; status: string; total: number; criado_em: string; itens: { nome: string; quantidade: number; preco: number; observacao: string | null }[] };
const STATUS: Record<string, string> = { novo: "Na fila", preparando: "Preparando", pronto: "Pronto", entregue: "Entregue" };

export function ContaMesa({
  mesa,
  onFechar,
  onNovoPedido,
  onFechada,
  pix,
  comPagamento,
  infinitepay = false,
  permiteDinheiro = true,
  onLiberar,
}: {
  mesa: { id: string; nome: string };
  onFechar: () => void;
  onNovoPedido: () => void;
  onFechada: () => void;
  pix: PixConfig;
  comPagamento: boolean;
  infinitepay?: boolean;
  permiteDinheiro?: boolean;
  onLiberar?: () => Promise<void>;
}) {
  const [dados, setDados] = useState<Conta | null>(null);
  const [pagando, setPagando] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fechadaCom, setFechadaCom] = useState<number | null>(null);

  const carregar = () => api<Conta>(`/api/app/mesas/${mesa.id}/conta`, "GET").then(setDados).catch((e) => setErro(e.message));
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesa.id]);

  async function estornar(id: string) {
    if (!confirm("Desfazer este pagamento?")) return;
    try {
      await api(`/api/app/pagamentos/${id}`, "DELETE");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    }
  }

  async function fechar() {
    if (!confirm(`Fechar a conta da ${mesa.nome}${dados ? ` no valor de ${preco(dados.total)}` : ""}?`)) return;
    setErro(null);
    setFechando(true);
    try {
      const r = await api<{ total: number }>(`/api/app/mesas/${mesa.id}/fechar`, "POST");
      setFechadaCom(r.total);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setFechando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="card flex max-h-[92dvh] w-full max-w-md flex-col rounded-b-none sm:rounded-b-[18px]">
        <header className="flex items-center gap-2 border-b border-pedra p-4">
          <Receipt className="h-5 w-5" />
          <p className="flex-1 text-lg font-extrabold">Conta · {mesa.nome}</p>
          <button onClick={fechadaCom !== null ? onFechada : onFechar} className="p-2" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </header>
        {fechadaCom !== null ? (
          <div className="p-6 text-center">
            <p className="text-sm text-grafite">Conta fechada</p>
            <p className="mt-1 text-4xl font-extrabold">{preco(fechadaCom)}</p>
            <p className="mt-2 text-sm text-grafite">A mesa foi liberada.</p>
            <button onClick={onFechada} className="btn-escuro mt-5 w-full py-3">Concluir</button>
          </div>
        ) : !dados ? (
          <div className="flex justify-center p-10">{erro ? <p className="text-sm text-estado-vermelho">{erro}</p> : <Loader2 className="h-6 w-6 animate-spin" />}</div>
        ) : (
          <>
            <div className="flex-1 rolagem p-4">
              {!dados.pedidos.length && <p className="py-6 text-center text-sm text-grafite">Nenhum pedido nesta mesa ainda.</p>}
              {dados.pedidos.map((p) => (
                <div key={p.id} className="border-b border-pedra py-3 last:border-0">
                  <p className="mb-1 flex text-xs font-semibold text-grafite">
                    {new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    <span className="ml-auto">{STATUS[p.status] ?? p.status}</span>
                  </p>
                  {p.itens.map((i, k) => (
                    <p key={k} className="flex gap-2 text-sm">
                      <span className="font-bold tabular-nums">{i.quantidade}×</span>
                      <span className="flex-1">{i.nome}{i.observacao ? <span className="text-grafite"> ({i.observacao})</span> : null}</span>
                      <span className="tabular-nums">{preco(i.preco * i.quantidade)}</span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
            <footer className="space-y-2 border-t border-pedra p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <p className="flex items-baseline justify-between"><span className="font-semibold text-grafite">Total</span><span className="text-3xl font-extrabold tabular-nums">{preco(dados.total)}</span></p>
              {comPagamento && dados.pedidos.length > 0 && (
                <div className="rounded-xl bg-papel p-3 text-sm">
                  {dados.pagamentos.map((p) => (
                    <p key={p.id} className="flex items-center gap-2">
                      <span className="flex-1">{NOME_METODO[p.metodo]}{p.recebido ? ` (troco ${preco(p.recebido - p.valor)})` : ""}</span>
                      <span className="tabular-nums">{preco(p.valor)}</span>
                      <button onClick={() => estornar(p.id)} className="text-grafite" aria-label="Desfazer pagamento"><X className="h-3.5 w-3.5" /></button>
                    </p>
                  ))}
                  <p className={`mt-1 flex justify-between font-extrabold ${dados.falta > 0 ? "text-estado-vermelho" : "text-estado-verde"}`}>
                    <span>{dados.falta > 0 ? "Falta receber" : "Conta paga"}</span><span className="tabular-nums">{preco(dados.falta)}</span>
                  </p>
                </div>
              )}
              {erro && <p role="alert" className="text-sm font-semibold text-estado-vermelho">{erro}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={onNovoPedido} className="btn-secundario py-3"><Plus className="h-4 w-4" /> Novo pedido</button>
                {comPagamento && dados.falta > 0 ? (
                  <button onClick={() => setPagando(true)} className="btn-escuro py-3"><Wallet className="h-4 w-4" /> Receber</button>
                ) : !dados.pedidos.length && onLiberar ? (
                  <button
                    onClick={async () => { if (confirm(`Liberar a ${mesa.nome}? O cliente foi embora sem consumir.`)) await onLiberar(); }}
                    className="btn-escuro py-3"
                  >
                    Liberar mesa
                  </button>
                ) : (
                  <button onClick={fechar} disabled={fechando || !dados.pedidos.length} className="btn-escuro py-3">{fechando && <Loader2 className="h-4 w-4 animate-spin" />} Fechar conta</button>
                )}
              </div>
              {pagando && (
                <Pagamento
                  titulo={`Conta · ${mesa.nome}`}
                  falta={dados.falta}
                  pix={pix}
                  txid={mesa.nome.replace(/\D/g, "") ? `MESA${mesa.nome.replace(/\D/g, "")}` : "MESA"}
                  onFechar={() => setPagando(false)}
                  infinitepay={infinitepay ? { origem: "mesa", tableId: mesa.id } : null}
                  permiteDinheiro={permiteDinheiro}
                  onPago={() => { setPagando(false); carregar(); }}
                  onConfirmar={async (p) => {
                    await api(`/api/app/mesas/${mesa.id}/pagamentos`, "POST", { pagamentos: [p] });
                    setPagando(false);
                    await carregar();
                  }}
                />
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
