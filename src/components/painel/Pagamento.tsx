"use client";
// Receber pagamento: cartão pelo app InfinitePay (aproximação), Pix (QR com o valor certo), link/QR InfinitePay e dinheiro.
// Dá para dividir: cada confirmação registra uma parte, até cobrir o total.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Banknote, Check, Copy, CreditCard, Link2, Loader2, QrCode, Smartphone, X } from "lucide-react";
import { preco } from "@/lib/format";
import { pixCopiaECola } from "@/lib/pix";
import { deeplinkTap } from "@/lib/infinitepay";
import { api } from "./api";

export type PixConfig = { chave: string; nome: string; cidade: string } | null;
export type PagamentoInput = { metodo: "pix" | "debito" | "credito" | "dinheiro"; valor: number; recebido?: number; cobranca_id?: string };
export type InfinitePayCfg = { origem: "mesa" | "fichas"; tableId?: string } | null;
// Abas: "cartao" cobra de verdade pelo app InfinitePay (ou, escondido, só anota um cartão de outra maquininha)
type Metodo = "cartao" | "pix" | "link" | "dinheiro";

function numero(s: string) {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function Pagamento({
  titulo,
  falta,
  pix,
  txid,
  onConfirmar,
  onFechar,
  infinitepay = null,
  onPago,
  onAntesDeSair,
}: {
  titulo: string;
  falta: number;
  pix: PixConfig;
  txid: string;
  onConfirmar: (p: PagamentoInput) => Promise<void>;
  onFechar: () => void;
  infinitepay?: InfinitePayCfg;
  /** mesa: a cobrança da InfinitePay já virou pagamento no servidor */
  onPago?: () => void;
  /** antes de abrir o app InfinitePay (ex.: o caixa guarda o carrinho) */
  onAntesDeSair?: (cobrancaId: string) => void;
}) {
  const [metodo, setMetodo] = useState<Metodo>(infinitepay ? "cartao" : "pix");
  const [cartaoManual, setCartaoManual] = useState(false);
  const [confirmoAprovado, setConfirmoAprovado] = useState(false);
  const [cartaoTap, setCartaoTap] = useState<"debito" | "credito">("credito");
  const [parcelas, setParcelas] = useState(1);
  const [cobranca, setCobranca] = useState<{ id: string; link_url: string } | null>(null);
  const [linkQr, setLinkQr] = useState("");
  const [valorTxt, setValorTxt] = useState(falta.toFixed(2).replace(".", ","));
  const [recebidoTxt, setRecebidoTxt] = useState("");
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setValorTxt(falta.toFixed(2).replace(".", ",")), [falta]);
  const valor = numero(valorTxt);
  const recebido = numero(recebidoTxt);
  const codigoPix = pix && valor > 0 ? pixCopiaECola({ ...pix, valor, txid }) : "";

  useEffect(() => {
    if (metodo !== "pix" || !codigoPix) return setQr("");
    QRCode.toDataURL(codigoPix, { margin: 1, width: 520, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(""));
  }, [metodo, codigoPix]);

  const troco = metodo === "dinheiro" && recebido > valor ? recebido - valor : 0;
  const cobraNoApp = metodo === "cartao" && !!infinitepay && !cartaoManual;
  const valido =
    valor > 0 &&
    (metodo !== "dinheiro" || !recebidoTxt || recebido >= valor) &&
    (metodo !== "pix" || !!pix) &&
    (metodo !== "link" || valor >= 1) &&
    (metodo !== "cartao" || (cartaoManual ? confirmoAprovado : !!infinitepay && valor >= 1));

  // link InfinitePay: acompanha até o servidor confirmar (aviso da InfinitePay conferido na API deles)
  useEffect(() => {
    if (!cobranca) return;
    QRCode.toDataURL(cobranca.link_url, { margin: 1, width: 520 }).then(setLinkQr).catch(() => {});
    const t = setInterval(async () => {
      try {
        const s = await api<{ status: string; metodo: "pix" | "credito" | "debito" | null }>(`/api/app/cobrancas/${cobranca.id}`, "GET");
        if (s.status === "usada" && infinitepay?.origem === "mesa") {
          clearInterval(t);
          onPago?.();
        } else if (s.status === "paga") {
          clearInterval(t);
          await onConfirmar({ metodo: s.metodo ?? "credito", valor, cobranca_id: cobranca.id });
        }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobranca]);

  async function fechar() {
    if (cobranca) api(`/api/app/cobrancas/${cobranca.id}`, "DELETE").catch(() => {});
    onFechar();
  }

  async function criarCobranca(tipo: "tap" | "link") {
    return api<{ id: string; link_url?: string; handle?: string; resultUrl?: string }>("/api/app/cobrancas", "POST", {
      origem: infinitepay!.origem,
      tipo,
      ...(infinitepay!.tableId ? { table_id: infinitepay!.tableId } : {}),
      valor,
      ...(tipo === "tap" ? { metodo: cartaoTap, parcelas: cartaoTap === "credito" ? parcelas : 1 } : {}),
    });
  }

  async function confirmar() {
    setErro(null);
    setSalvando(true);
    try {
      if (cobraNoApp) {
        const c = await criarCobranca("tap");
        const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
        try {
          sessionStorage.setItem("tap_volta", JSON.stringify({ id: c.id, origem: infinitepay!.origem, volta: location.pathname }));
        } catch {}
        onAntesDeSair?.(c.id);
        location.href = deeplinkTap({ centavos: Math.round(valor * 100), metodo: cartaoTap, parcelas: cartaoTap === "credito" ? parcelas : 1, orderId: c.id, resultUrl: c.resultUrl!, handle: c.handle!, ios });
        return;
      }
      if (metodo === "link") {
        const c = await criarCobranca("link");
        setCobranca({ id: c.id, link_url: c.link_url! });
        return;
      }
      if (metodo === "cartao") {
        // cartão já aprovado em outra maquininha: só anota
        await onConfirmar({ metodo: cartaoTap, valor });
        return;
      }
      await onConfirmar({ metodo: metodo === "pix" ? "pix" : "dinheiro", valor, ...(metodo === "dinheiro" && recebido > valor ? { recebido } : {}) });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="card max-h-[95dvh] w-full max-w-md rolagem rounded-b-none p-5 pb-seguro sm:rounded-b-[18px] sm:pb-5">
        <div className="flex items-center">
          <div>
            <p className="text-xs text-grafite">{titulo}</p>
            <p className="text-lg font-extrabold">Falta receber {preco(falta)}</p>
          </div>
          <button onClick={fechar} className="ml-auto p-2" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className={`mt-4 grid gap-2 ${infinitepay ? "grid-cols-4" : "grid-cols-3"}`} role="tablist">
          {[
            { id: "cartao" as const, nome: "Cartão", icone: CreditCard },
            { id: "pix" as const, nome: "Pix", icone: QrCode },
            ...(infinitepay ? [{ id: "link" as const, nome: "Link / QR", icone: Link2 }] : []),
            { id: "dinheiro" as const, nome: "Dinheiro", icone: Banknote },
          ].map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={metodo === m.id}
              onClick={() => { setMetodo(m.id); setCobranca(null); setCartaoManual(false); setConfirmoAprovado(false); }}
              className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-bold ${metodo === m.id ? "border-carvao bg-carvao text-papel" : "border-pedra bg-white"}`}
            >
              <m.icone className="h-5 w-5" /> {m.nome}
            </button>
          ))}
        </div>

        <label className="rotulo mt-4" htmlFor="valor">Valor desta parte (para dividir, diminua)</label>
        <input id="valor" inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} className="campo text-2xl font-extrabold" />

        {metodo === "pix" &&
          (pix ? (
            <div className="mt-4 rounded-2xl bg-papel p-4 text-center">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR code Pix" className="mx-auto h-56 w-56 rounded-xl bg-white p-2" />
              ) : (
                <div className="mx-auto h-56 w-56 animate-pulse rounded-xl bg-pedra" />
              )}
              <p className="mt-2 text-sm font-semibold">Cliente lê o QR no app do banco · {preco(valor)}</p>
              <button
                onClick={() => navigator.clipboard.writeText(codigoPix).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); })}
                className="btn-secundario mt-2 px-3 py-1.5 text-xs"
              >
                <Copy className="h-3.5 w-3.5" /> {copiado ? "Copiado!" : "Copiar Pix copia e cola"}
              </button>
              <p className="mt-2 text-xs font-semibold text-estado-laranja">Só confirme depois de ver o Pix no app do banco do estabelecimento.</p>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-estado-laranja/15 p-3 text-sm font-semibold text-estado-laranja">
              Cadastre a chave Pix em Estabelecimento → Pagamentos para gerar o QR.
            </p>
          ))}

        {metodo === "cartao" && (
          <div className="mt-4 space-y-3 rounded-2xl bg-papel p-4">
            {!cartaoManual && infinitepay && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(["debito", "credito"] as const).map((c) => (
                    <button key={c} onClick={() => setCartaoTap(c)} className={`rounded-xl py-2.5 text-sm font-bold ${cartaoTap === c ? "bg-carvao text-papel" : "bg-white"}`}>
                      {c === "debito" ? "Débito" : "Crédito"}
                    </button>
                  ))}
                </div>
                {cartaoTap === "credito" && (
                  <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="campo" aria-label="Parcelas">
                    {Array.from({ length: 12 }, (_, i) => i + 1).filter((n) => valor / n >= 1).map((n) => (
                      <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x de ${preco(valor / n)}`}</option>
                    ))}
                  </select>
                )}
                <ol className="list-decimal space-y-0.5 pl-5 text-xs text-grafite">
                  <li>Toque em <strong>Cobrar</strong>: o app InfinitePay abre neste celular já com o valor.</li>
                  <li>O cliente encosta o cartão atrás do celular.</li>
                  <li>Aprovou? O app volta para cá e a conta é paga.</li>
                </ol>
                <p className="text-xs text-grafite">Precisa do app InfinitePay instalado, logado na sua conta e com o NFC ligado.</p>
              </>
            )}
            {!cartaoManual && !infinitepay && (
              <p className="text-sm font-semibold text-estado-laranja">
                Para cobrar débito e crédito pelo celular, cadastre a sua InfiniteTag em <strong>Estabelecimento → Pagamentos</strong>.
              </p>
            )}
            {cartaoManual && (
              <>
                <p className="text-sm font-semibold">Anotar um cartão que JÁ foi aprovado em outra maquininha</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["debito", "credito"] as const).map((c) => (
                    <button key={c} onClick={() => setCartaoTap(c)} className={`rounded-xl py-2.5 text-sm font-bold ${cartaoTap === c ? "bg-carvao text-papel" : "bg-white"}`}>
                      {c === "debito" ? "Débito" : "Crédito"}
                    </button>
                  ))}
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={confirmoAprovado} onChange={(e) => setConfirmoAprovado(e.target.checked)} className="mt-1 h-5 w-5" />
                  <span>Confirmo que o cartão de {preco(valor)} foi <strong>aprovado</strong> na maquininha. Isto não cobra nada, só anota.</span>
                </label>
              </>
            )}
            <button onClick={() => { setCartaoManual(!cartaoManual); setConfirmoAprovado(false); }} className="text-xs font-semibold text-grafite underline">
              {cartaoManual ? "Voltar para cobrar pelo celular" : "Já passei o cartão em outra maquininha"}
            </button>
          </div>
        )}

        {metodo === "link" && (
          <div className="mt-4 rounded-2xl bg-papel p-4 text-center">
            {cobranca ? (
              <>
                {linkQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={linkQr} alt="QR do link de pagamento" className="mx-auto h-56 w-56 rounded-xl bg-white p-2" />
                ) : (
                  <div className="mx-auto h-56 w-56 animate-pulse rounded-xl bg-pedra" />
                )}
                <p className="mt-2 text-sm font-semibold">Cliente lê o QR e paga no celular dele (Pix ou cartão)</p>
                <p className="mt-1 flex items-center justify-center gap-2 text-xs text-grafite"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Aguardando a confirmação da InfinitePay...</p>
                <button
                  onClick={() => navigator.clipboard.writeText(cobranca.link_url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); })}
                  className="btn-secundario mt-2 px-3 py-1.5 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" /> {copiado ? "Copiado!" : "Copiar link (mandar no WhatsApp)"}
                </button>
              </>
            ) : (
              <p className="text-sm text-grafite">Gera um link de pagamento da InfinitePay com o valor. O pagamento dá baixa sozinho aqui quando for aprovado.</p>
            )}
          </div>
        )}

        {metodo === "dinheiro" && (
          <div className="mt-4">
            <label className="rotulo" htmlFor="recebido">Valor entregue pelo cliente (opcional, para troco)</label>
            <input id="recebido" inputMode="decimal" value={recebidoTxt} onChange={(e) => setRecebidoTxt(e.target.value)} placeholder="Ex.: 50,00" className="campo" />
            {troco > 0 && <p className="mt-2 text-lg font-extrabold text-estado-verde">Troco: {preco(troco)}</p>}
          </div>
        )}

        {erro && <p role="alert" className="mt-3 text-sm font-semibold text-estado-vermelho">{erro}</p>}
        {!(metodo === "link" && cobranca) && (
          <button onClick={confirmar} disabled={!valido || salvando} className="btn-escuro mt-5 w-full py-3.5 text-base">
            {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : cobraNoApp ? <Smartphone className="h-5 w-5" /> : metodo === "link" ? <QrCode className="h-5 w-5" /> : <Check className="h-5 w-5" />}
            {metodo === "cartao"
              ? cartaoManual
                ? `Anotar cartão de ${preco(valor)}`
                : `Cobrar ${preco(valor)} no ${cartaoTap === "debito" ? "débito" : "crédito"}`
              : metodo === "link"
                ? `Gerar QR de ${preco(valor)}`
                : metodo === "pix"
                  ? `Já vi no banco: confirmar ${preco(valor)}`
                  : `Recebi ${preco(valor)} em dinheiro`}
          </button>
        )}
      </div>
    </div>
  );
}
