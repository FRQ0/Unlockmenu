"use client";
// Tela da cozinha: funciona num tablet/celular barato (tela grande, som) e/ou imprime
// a comanda numa impressora térmica. Tempo real via Supabase (RLS) + consulta a cada 10 s.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChefHat, Check, CircleHelp, Printer, Volume2, Wifi, WifiOff, X } from "lucide-react";
import { autenticarRealtime, realtimeClient } from "@/lib/supabase/browser";
import { cronometro, minutosDesde } from "@/lib/format";
import { acompanharSom, audioPronto, liberarAudio, somFoiAtivadoAntes, tocar } from "./som";
import { api } from "./api";

type Item = { nome: string; quantidade: number; preco: number; observacao: string | null };
type Pedido = { id: string; table_id: string; mesa: string; status: "novo" | "preparando" | "pronto" | "entregue" | "cancelado"; total: number; observacao: string | null; criado_em: string; garcom: string | null; itens: Item[] };

function ler(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function gravar(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}

export function PainelCozinha({ tenantId, nomeEstabelecimento, inicial }: { tenantId: string; nomeEstabelecimento: string; inicial: Pedido[] }) {
  const [pedidos, setPedidos] = useState<Pedido[]>(inicial);
  const [agora, setAgora] = useState(() => Date.now());
  const [online, setOnline] = useState(true);
  const [somOn, setSomOn] = useState(false);
  const [somJaUsado, setSomJaUsado] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [imprimindo, setImprimindo] = useState<Pedido | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [guia, setGuia] = useState(false);
  const [papel, setPapel] = useState<58 | 80>(80);
  const conhecidos = useRef(new Set(inicial.map((p) => p.id)));
  const fila = useRef<Pedido[]>([]);
  const autoRef = useRef(false);

  useEffect(() => {
    setSomJaUsado(somFoiAtivadoAntes());
    const parar = acompanharSom(setSomOn);
    setPapel(ler("cozinha_papel") === "58" ? 58 : 80);
    const v = ler("cozinha_autoprint") === "1";
    setAutoPrint(v);
    autoRef.current = v;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => {
      clearInterval(t);
      parar();
    };
  }, []);

  // impressão: um ticket por vez
  const imprimirProximo = useCallback(() => {
    const p = fila.current.shift();
    if (p) setImprimindo(p);
  }, []);
  useEffect(() => {
    if (!imprimindo) return;
    const t = setTimeout(() => {
      window.print();
      setImprimindo(null);
      setTimeout(imprimirProximo, 300);
    }, 150);
    return () => clearTimeout(t);
  }, [imprimindo, imprimirProximo]);
  const imprimir = useCallback((p: Pedido) => {
    fila.current.push(p);
    setImprimindo((atual) => {
      if (atual) return atual;
      return fila.current.shift() ?? null;
    });
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const r = await fetch("/api/app/pedidos", { cache: "no-store" });
      if (r.status === 401) return void (window.location.href = "/login");
      if (!r.ok) throw new Error();
      const { pedidos: lista } = (await r.json()) as { pedidos: Pedido[] };
      const novos = lista.filter((p) => p.status === "novo" && !conhecidos.current.has(p.id));
      lista.forEach((p) => conhecidos.current.add(p.id));
      if (novos.length) {
        if (audioPronto()) tocar("pedido");
        navigator.vibrate?.([300, 120, 300]);
        if (autoRef.current) novos.forEach(imprimir);
      }
      setPedidos(lista);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [imprimir]);

  useEffect(() => {
    let vivo = true;
    let deb: ReturnType<typeof setTimeout> | null = null;
    const agendar = () => {
      if (deb) clearTimeout(deb);
      deb = setTimeout(recarregar, 150);
    };
    const sb = realtimeClient();
    const canal = sb.channel(`cozinha-${tenantId}`);
    (async () => {
      await autenticarRealtime();
      if (!vivo) return;
      canal.on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` }, agendar).subscribe((s) => setOnline(s === "SUBSCRIBED"));
    })();
    const poll = setInterval(recarregar, 10_000);
    const renovar = setInterval(autenticarRealtime, 45 * 60_000);
    return () => {
      vivo = false;
      clearInterval(poll);
      clearInterval(renovar);
      sb.removeChannel(canal);
    };
  }, [tenantId, recarregar]);

  async function mudar(p: Pedido, status: "preparando" | "pronto") {
    setErro(null);
    setPedidos((l) => l.map((x) => (x.id === p.id ? { ...x, status } : x)));
    try {
      await api(`/api/app/pedidos/${p.id}`, "PATCH", { status });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    }
    recarregar();
  }

  const colunas = [
    { status: "novo" as const, titulo: "Novos", cor: "bg-estado-laranja" },
    { status: "preparando" as const, titulo: "Em preparo", cor: "bg-estado-azul" },
    { status: "pronto" as const, titulo: "Prontos", cor: "bg-estado-verde" },
  ];

  return (
    <main className="p-3 lg:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight"><ChefHat className="h-6 w-6" /> Cozinha</h1>
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${online ? "text-estado-verde" : "text-estado-vermelho"}`}>
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />} {online ? "Ao vivo" : "Reconectando..."}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {!somOn && (
            <button onClick={async () => { if (await liberarAudio()) { setSomJaUsado(true); tocar("pedido"); } }} className="btn-primario animate-pulsar">
              <Volume2 className="h-4 w-4" /> {somJaUsado ? "Toque para religar o som" : "Ativar som"}
            </button>
          )}
          <label className="btn-secundario cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => { setAutoPrint(e.target.checked); autoRef.current = e.target.checked; gravar("cozinha_autoprint", e.target.checked ? "1" : "0"); }}
            />
            <Printer className="h-4 w-4" /> Imprimir automático
          </label>
          <button onClick={() => setGuia(true)} className="btn-secundario"><CircleHelp className="h-4 w-4" /> Impressora</button>
        </div>
      </div>
      {erro && <p role="alert" className="mt-3 rounded-xl bg-estado-vermelho/10 p-3 text-sm font-semibold text-estado-vermelho">{erro}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {colunas.map((c) => {
          const lista = pedidos.filter((p) => p.status === c.status);
          return (
            <section key={c.status}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-grafite">
                <span className={`h-3 w-3 rounded-full ${c.cor}`} /> {c.titulo} ({lista.length})
              </h2>
              <ul className="space-y-3">
                {lista.map((p) => {
                  const atraso = minutosDesde(p.criado_em, agora) >= 15 && p.status !== "pronto";
                  return (
                    <li key={p.id} className={`card overflow-hidden ${atraso ? "ring-2 ring-estado-vermelho" : ""}`}>
                      <div className={`flex items-center gap-2 px-4 py-2.5 text-white ${atraso ? "bg-estado-vermelho" : c.cor}`}>
                        <span className="text-xl font-extrabold">{p.mesa}</span>
                        <span className="text-xs opacity-90">{p.garcom ? `· ${p.garcom}` : ""}</span>
                        <span className="ml-auto font-mono text-lg font-bold tabular-nums">{cronometro(p.criado_em, agora)}</span>
                      </div>
                      <ul className="space-y-1.5 px-4 py-3">
                        {p.itens.map((i, k) => (
                          <li key={k} className="text-lg leading-snug">
                            <strong className="font-extrabold">{i.quantidade}×</strong> {i.nome}
                            {i.observacao && <span className="block text-sm font-bold text-estado-vermelho">→ {i.observacao}</span>}
                          </li>
                        ))}
                        {p.observacao && <li className="rounded-lg bg-areia/20 px-2 py-1 text-sm font-semibold">Obs.: {p.observacao}</li>}
                      </ul>
                      <div className="flex gap-2 border-t border-pedra p-3">
                        {p.status === "novo" && <button onClick={() => mudar(p, "preparando")} className="btn-escuro flex-1 py-3 text-base">Começar</button>}
                        {(p.status === "novo" || p.status === "preparando") && (
                          <button onClick={() => mudar(p, "pronto")} className="btn flex-1 bg-estado-verde py-3 text-base text-white"><Check className="h-5 w-5" /> Pronto</button>
                        )}
                        {p.status === "pronto" && <p className="flex-1 py-2 text-sm font-semibold text-estado-verde">Aguardando o garçom levar</p>}
                        <button onClick={() => imprimir(p)} className="btn-secundario px-3" aria-label="Imprimir comanda"><Printer className="h-5 w-5" /></button>
                      </div>
                    </li>
                  );
                })}
                {!lista.length && <li className="rounded-2xl border-2 border-dashed border-pedra p-6 text-center text-sm text-grafite">Nada aqui</li>}
              </ul>
            </section>
          );
        })}
      </div>

      {guia && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-b-[18px]">
            <div className="flex items-center">
              <h2 className="text-lg font-extrabold">Como ligar a impressora</h2>
              <button onClick={() => setGuia(false)} className="ml-auto p-2" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="font-semibold">Largura do papel:</span>
              {([58, 80] as const).map((w) => (
                <button key={w} onClick={() => { setPapel(w); gravar("cozinha_papel", String(w)); }} className={`rounded-full px-3 py-1 font-semibold ${papel === w ? "bg-carvao text-papel" : "bg-papel"}`}>{w} mm</button>
              ))}
              <button
                onClick={() => imprimir({ id: "teste", table_id: "", mesa: "TESTE", status: "novo", total: 0, observacao: "Se saiu certinho, está tudo pronto!", criado_em: new Date().toISOString(), garcom: null, itens: [{ nome: "Pizza Margherita", quantidade: 2, preco: 0, observacao: "sem cebola" }] })}
                className="btn-escuro ml-auto px-3 py-1.5 text-xs"
              >
                <Printer className="h-3.5 w-3.5" /> Imprimir teste
              </button>
            </div>
            <div className="mt-4 space-y-4 text-sm leading-relaxed">
              <section className="rounded-xl bg-papel p-4">
                <p className="font-bold">Opção 1 · Sem impressora (mais simples)</p>
                <p className="text-grafite">Deixe um tablet ou celular na cozinha com esta tela aberta, o som ligado e a tela sempre acesa (Ajustes → Tela → Bloqueio automático: Nunca).</p>
              </section>
              <section className="rounded-xl bg-papel p-4">
                <p className="font-bold">Opção 2 · Computador + impressora térmica USB (imprime sozinho)</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-grafite">
                  <li>Ligue a impressora no USB e instale o driver do fabricante (Elgin, Epson, Bematech, Knup...).</li>
                  <li>Nas configurações da impressora, escolha o papel de 80 mm (ou 58 mm).</li>
                  <li>Deixe ela como <strong>impressora padrão</strong> do computador.</li>
                  <li>Crie um atalho do Google Chrome e, em “Destino”, coloque no final: <code className="rounded bg-white px-1">--kiosk-printing</code></li>
                  <li>Abra o Chrome por esse atalho, entre nesta tela e marque <strong>Imprimir automático</strong>. Cada pedido novo sai sozinho, sem perguntar.</li>
                </ol>
              </section>
              <section className="rounded-xl bg-papel p-4">
                <p className="font-bold">Opção 3 · Celular/tablet Android + impressora Bluetooth</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-grafite">
                  <li>Pareie a impressora no Bluetooth do aparelho.</li>
                  <li>Instale o app gratuito <strong>RawBT</strong> e escolha a impressora nele.</li>
                  <li>Nesta tela, toque no ícone de impressora do pedido → escolha <strong>RawBT</strong> como impressora → Imprimir.</li>
                </ol>
                <p className="mt-1 text-xs text-grafite">No Android o celular sempre pergunta antes de imprimir (1 toque por pedido). Para sair 100% sozinho, use a opção 2.</p>
              </section>
              <p className="text-xs text-grafite">iPhone e iPad só imprimem em impressoras com AirPrint, e quase nenhuma impressora térmica tem. Para cozinha, prefira Android ou computador.</p>
            </div>
          </div>
        </div>
      )}

      {/* Ticket para a impressora térmica (só aparece na impressão) */}
      {imprimindo && (
        <div className="ticket" style={{ width: papel === 58 ? "48mm" : "72mm" }}>
          <style>{`@media print { @page { size: ${papel}mm auto; margin: 2mm; } }`}</style>
          <p style={{ textAlign: "center", fontWeight: 700 }}>{nomeEstabelecimento}</p>
          <p style={{ textAlign: "center", fontSize: 22, fontWeight: 800, margin: "4px 0" }}>{imprimindo.mesa}</p>
          <p style={{ textAlign: "center" }}>
            {new Date(imprimindo.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {imprimindo.garcom ? ` · ${imprimindo.garcom}` : ""}
          </p>
          <p>--------------------------------</p>
          {imprimindo.itens.map((i, k) => (
            <div key={k} style={{ margin: "4px 0" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{i.quantidade}x {i.nome}</div>
              {i.observacao && <div>  &gt; {i.observacao}</div>}
            </div>
          ))}
          {imprimindo.observacao && <p>OBS: {imprimindo.observacao}</p>}
          <p>--------------------------------</p>
        </div>
      )}
    </main>
  );
}
