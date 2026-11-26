"use client";
// Painel do garçom: tempo real (Supabase Realtime + RLS), som, vibração, cronômetro,
// alerta de atraso e filtro por setor. Recursos ligados conforme o plano (definido no servidor).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, Check, ClipboardList, Footprints, Receipt, TriangleAlert, Volume2, Wifi, WifiOff } from "lucide-react";
import { autenticarRealtime, realtimeClient } from "@/lib/supabase/browser";
import { cronometro, minutosDesde } from "@/lib/format";
import { acompanharSom, audioPronto, liberarAudio, somFoiAtivadoAntes, tocar } from "./som";
import { Comanda, type CategoriaComanda, type ProdutoComanda } from "./Comanda";
import { ContaMesa } from "./ContaMesa";

type Mesa = { id: string; nome: string; area: string | null; ocupada: boolean };
type Chamado = { id: string; table_id: string; tipo: "garcom" | "conta"; status: "aberto" | "a_caminho"; criado_em: string; aceito_nome: string | null };
type Salao = { mesas: Mesa[]; chamados: Chamado[] };

type Props = {
  tenantId: string;
  inicial: Salao;
  recursos: { grade: boolean; som: boolean; setores: boolean; push: boolean; alertaGerente: boolean };
  alertaMinutos: number;
  gerente: boolean;
  podeAtender: boolean;
  meusSetores: string[];
  vapid: string;
  cardapio: { categorias: CategoriaComanda[]; produtos: ProdutoComanda[] } | null;
  eu: { id: string; nome: string; papel: string };
  pix?: { chave: string; nome: string; cidade: string } | null;
  comPagamento?: boolean;
  infinitepay?: boolean;
};

type PedidoPronto = { id: string; table_id: string; mesa: string; status: string; criado_em: string; itens: { nome: string; quantidade: number }[] };

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PainelGarcom({ tenantId, inicial, recursos, alertaMinutos, gerente, podeAtender, meusSetores, vapid, cardapio, eu, pix = null, comPagamento = false, infinitepay = false }: Props) {
  const [salao, setSalao] = useState<Salao>(inicial);
  const [agora, setAgora] = useState(() => Date.now());
  const [online, setOnline] = useState(true);
  const [somOn, setSomOn] = useState(false);
  const [somJaUsado, setSomJaUsado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pushOn, setPushOn] = useState<"nao" | "sim" | "negado" | "instalar">("nao");
  const [setor, setSetor] = useState<string>("__todos");
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [comanda, setComanda] = useState<{ id: string; nome: string } | null>(null);
  const [conta, setConta] = useState<{ id: string; nome: string } | null>(null);
  const [prontos, setProntos] = useState<PedidoPronto[]>([]);
  const prontosConhecidos = useRef<Set<string> | null>(null);
  const conhecidos = useRef<Set<string>>(new Set(inicial.chamados.map((c) => c.id)));
  const alertados = useRef<Set<string>>(new Set());

  useEffect(() => {
    setSomJaUsado(somFoiAtivadoAntes());
    return acompanharSom(setSomOn);
  }, []);

  // relógio do cronômetro
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // setor salvo / setores do funcionário
  useEffect(() => {
    if (!recursos.setores) return;
    try {
      const s = localStorage.getItem("setor");
      if (s) setSetor(s);
      else if (meusSetores.length === 1) setSetor(meusSetores[0]);
      else if (meusSetores.length > 1) setSetor("__meus");
    } catch {}
  }, [recursos.setores, meusSetores]);

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const instalado = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (ios && !instalado) {
      setPushOn("instalar"); // no iPhone a notificação só funciona com o app na Tela de Início
      return;
    }
    if (!("PushManager" in window)) return;
    if ("Notification" in window && Notification.permission === "denied") setPushOn("negado");
    navigator.serviceWorker?.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => s && setPushOn("sim"))
      .catch(() => {});
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const r = await fetch("/api/app/garcom/estado", { cache: "no-store" });
      if (r.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!r.ok) throw new Error();
      const novo = (await r.json()) as Salao & { eu?: string };
      // outra pessoa entrou neste aparelho (ex.: login em outra aba): recarrega com a conta certa
      if (novo.eu && novo.eu !== eu.id) {
        window.location.reload();
        return;
      }
      // novos chamados → som + vibração
      const novos = novo.chamados.filter((c) => c.status === "aberto" && !conhecidos.current.has(c.id));
      novo.chamados.forEach((c) => conhecidos.current.add(c.id));
      if (novos.length) {
        if (recursos.som && audioPronto()) tocar(novos.some((c) => c.tipo === "conta") ? "conta" : "chamado");
        navigator.vibrate?.([200, 100, 200]);
      }
      setSalao(novo);
      setOnline(true);
      if (cardapio) {
        const rp = await fetch("/api/app/pedidos", { cache: "no-store" });
        if (rp.ok) {
          const { pedidos } = (await rp.json()) as { pedidos: PedidoPronto[] };
          const lista = pedidos.filter((x) => x.status === "pronto");
          const vistos = prontosConhecidos.current;
          if (vistos && lista.some((x) => !vistos.has(x.id))) {
            if (recursos.som && audioPronto()) tocar("pedido");
            navigator.vibrate?.([150, 80, 150]);
          }
          prontosConhecidos.current = new Set(lista.map((x) => x.id));
          setProntos(lista);
        }
      }
    } catch {
      setOnline(false);
    }
  }, [recursos.som, cardapio]);

  // tempo real + rede de segurança (consulta a cada 15 s)
  useEffect(() => {
    let vivo = true;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const agendar = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(recarregar, 150);
    };
    const sb = realtimeClient();
    const canal = sb.channel(`salao-${tenantId}`);
    (async () => {
      await autenticarRealtime();
      if (!vivo) return;
      canal
        .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: `tenant_id=eq.${tenantId}` }, agendar)
        .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `tenant_id=eq.${tenantId}` }, agendar)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` }, agendar)
        .subscribe((st) => setOnline(st === "SUBSCRIBED"));
    })();
    recarregar();
    const poll = setInterval(recarregar, 15_000);
    const renovar = setInterval(autenticarRealtime, 45 * 60_000);
    const vis = () => document.visibilityState === "visible" && recarregar();
    document.addEventListener("visibilitychange", vis);
    return () => {
      vivo = false;
      clearInterval(poll);
      clearInterval(renovar);
      document.removeEventListener("visibilitychange", vis);
      sb.removeChannel(canal);
    };
  }, [tenantId, recarregar]);

  // alerta de atraso (gerente/dono, plano Completo)
  useEffect(() => {
    if (!recursos.alertaGerente || !gerente) return;
    for (const c of salao.chamados) {
      if (c.status === "aberto" && minutosDesde(c.criado_em, agora) >= alertaMinutos && !alertados.current.has(c.id)) {
        alertados.current.add(c.id);
        if (audioPronto()) tocar("atraso");
        navigator.vibrate?.([400, 150, 400]);
      }
    }
  }, [agora, salao.chamados, recursos.alertaGerente, gerente, alertaMinutos]);

  async function ativarSom() {
    if (await liberarAudio()) {
      setSomJaUsado(true);
      tocar("chamado");
    }
  }

  async function ativarPush() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushOn("negado");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapid) });
      const j = sub.toJSON();
      const r = await fetch("/api/app/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }),
      });
      if (r.ok) setPushOn("sim");
    } catch {
      setPushOn("negado");
    }
  }

  async function atualizar(id: string, status: "a_caminho" | "atendido") {
    setOcupado(id);
    setAviso(null);
    try {
      const r = await fetch(`/api/app/chamados/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!r.ok) setAviso(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Não foi possível atualizar.");
      await recarregar();
    } finally {
      setOcupado(null);
      setSelecionada(null);
    }
  }

  async function entregar(id: string) {
    setOcupado(id);
    setProntos((l) => l.filter((x) => x.id !== id));
    await fetch(`/api/app/pedidos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "entregue" }) });
    setOcupado(null);
    recarregar();
  }

  async function liberar(mesaId: string) {
    setOcupado(mesaId);
    await fetch(`/api/app/mesas/${mesaId}/liberar`, { method: "POST" });
    await recarregar();
    setOcupado(null);
    setSelecionada(null);
  }

  const areas = useMemo(() => Array.from(new Set(salao.mesas.map((m) => m.area).filter((a): a is string => !!a))).sort(), [salao.mesas]);
  const mesasVisiveis = useMemo(
    () =>
      salao.mesas.filter(
        (m) => !recursos.setores || setor === "__todos" || (setor === "__meus" ? !!m.area && meusSetores.includes(m.area) : m.area === setor),
      ),
    [salao.mesas, setor, recursos.setores, meusSetores],
  );
  const idsVisiveis = new Set(mesasVisiveis.map((m) => m.id));
  const nomeMesa = new Map(salao.mesas.map((m) => [m.id, m.nome]));
  const chamados = salao.chamados.filter((c) => idsVisiveis.has(c.table_id));
  const chamadoDaMesa = new Map(chamados.map((c) => [c.table_id, c]));
  const atrasados = chamados.filter((c) => c.status === "aberto" && minutosDesde(c.criado_em, agora) >= alertaMinutos);

  function escolherSetor(s: string) {
    setSetor(s);
    try {
      localStorage.setItem("setor", s);
    } catch {}
  }

  const sel = selecionada ? salao.mesas.find((m) => m.id === selecionada) : null;
  const selChamado = sel ? chamadoDaMesa.get(sel.id) : undefined;

  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Salão</h1>
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${online ? "text-estado-verde" : "text-estado-vermelho"}`}>
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />} {online ? "Ao vivo" : "Reconectando..."}
        </span>
        <span className="w-full text-xs text-grafite sm:w-auto">Conectado como <strong className="text-carvao">{eu.nome}</strong> ({eu.papel === "garcom" ? "garçom" : eu.papel})</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {recursos.som && !somOn && (
            <button onClick={ativarSom} className="btn-primario animate-pulsar"><Volume2 className="h-4 w-4" /> {somJaUsado ? "Toque para religar o som" : "Ativar som"}</button>
          )}
          {recursos.push && pushOn === "nao" && (
            <button onClick={ativarPush} className="btn-secundario"><BellRing className="h-4 w-4" /> Avisar com o app fechado</button>
          )}
          {recursos.push && pushOn === "negado" && <span className="text-xs text-grafite">Notificações bloqueadas nos ajustes do celular</span>}
        </div>
      </div>

      {recursos.push && pushOn === "instalar" && (
        <div className="mt-4 rounded-2xl bg-areia/20 p-4 text-sm">
          <p className="font-bold">iPhone: para tocar e vibrar mesmo com o celular bloqueado</p>
          <p className="mt-1 text-grafite">
            Abra este painel no <strong>Safari</strong>, toque em <strong>Compartilhar</strong> (quadrado com seta) → <strong>Adicionar à Tela de Início</strong>. Depois abra pelo ícone novo e toque em “Avisar com o app fechado”.
          </p>
        </div>
      )}
      {!podeAtender && (
        <p className="mt-4 rounded-2xl bg-estado-azul/10 p-4 text-sm font-semibold text-estado-azul">
          Você entrou com um acesso de <strong>cozinha</strong>: dá para acompanhar o salão, mas atender mesas, anotar pedidos e fechar conta é com garçom, gerente ou dono.
        </p>
      )}
      {aviso && <p role="alert" className="mt-4 rounded-2xl bg-estado-vermelho/10 p-4 text-sm font-semibold text-estado-vermelho">{aviso}</p>}

      {recursos.setores && areas.length > 0 && (
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
          {["__todos", ...(meusSetores.length > 1 ? ["__meus"] : []), ...areas].map((a) => (
            <button
              key={a}
              onClick={() => escolherSetor(a)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${setor === a ? "bg-carvao text-papel" : "bg-white shadow-suave"}`}
            >
              {a === "__todos" ? "Todos os setores" : a === "__meus" ? "Meus setores" : a}
            </button>
          ))}
        </div>
      )}

      {gerente && recursos.alertaGerente && atrasados.length > 0 && (
        <div role="alert" className="mt-4 flex items-center gap-3 rounded-2xl bg-estado-vermelho p-4 text-white">
          <TriangleAlert className="h-6 w-6 shrink-0" />
          <p className="text-sm font-semibold">
            {atrasados.map((c) => `${nomeMesa.get(c.table_id)} (${minutosDesde(c.criado_em, agora)} min)`).join(", ")} sem atendimento há mais de {alertaMinutos} min.
          </p>
        </div>
      )}

      {cardapio && prontos.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-estado-verde">Prontos para levar ({prontos.length})</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prontos.map((p) => (
              <li key={p.id} className="card flex min-w-0 items-center gap-3 p-3 ring-2 ring-estado-verde">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{p.mesa}</p>
                  <p className="truncate text-sm text-grafite">{p.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(", ")}</p>
                </div>
                <button disabled={ocupado === p.id} onClick={() => entregar(p.id)} className="btn bg-estado-verde text-white"><Check className="h-4 w-4" /> Entregue</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* chamados abertos */}
      <section className="mt-6">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-grafite">Chamados ({chamados.length})</h2>
        {chamados.length === 0 ? (
          <p className="card p-6 text-center text-sm text-grafite">Nenhuma mesa chamando agora.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chamados.map((c) => {
              const atrasado = minutosDesde(c.criado_em, agora) >= alertaMinutos && c.status === "aberto";
              return (
                <li key={c.id} className={`card min-w-0 overflow-hidden ${atrasado ? "ring-2 ring-estado-vermelho" : ""}`}>
                  <div className={`flex items-center gap-3 px-4 py-3 text-white ${atrasado ? "bg-estado-vermelho" : c.tipo === "conta" ? "bg-estado-azul" : "bg-estado-laranja"}`}>
                    {c.tipo === "conta" ? <Receipt className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-extrabold leading-tight">{nomeMesa.get(c.table_id)}</p>
                      <p className="text-xs font-semibold opacity-90">{c.tipo === "conta" ? "Pediu a conta" : "Chamando garçom"}</p>
                    </div>
                    <span className="font-mono text-lg font-bold tabular-nums">{cronometro(c.criado_em, agora)}</span>
                  </div>
                  <div className="flex items-center gap-2 p-3">
                    {c.status === "a_caminho" ? (
                      cardapio && podeAtender ? (
                        <button onClick={() => setComanda({ id: c.table_id, nome: nomeMesa.get(c.table_id) ?? "Mesa" })} className="btn-escuro flex-1">
                          <ClipboardList className="h-4 w-4" /> Anotar pedido
                        </button>
                      ) : (
                        <span className="flex flex-1 items-center gap-1.5 text-sm font-semibold text-estado-verde">
                          <Footprints className="h-4 w-4" /> {c.aceito_nome ?? "Alguém"} a caminho
                        </span>
                      )
                    ) : podeAtender ? (
                      <button disabled={ocupado === c.id} onClick={() => atualizar(c.id, "a_caminho")} className="btn-escuro flex-1">
                        <Footprints className="h-4 w-4" /> Estou indo
                      </button>
                    ) : (
                      <span className="flex-1 text-sm text-grafite">Aguardando</span>
                    )}
                    {podeAtender && (
                      <button disabled={ocupado === c.id} onClick={() => atualizar(c.id, "atendido")} className="btn-secundario flex-1">
                        <Check className="h-4 w-4" /> Atendido
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* grade de mesas (Profissional e Completo) */}
      {recursos.grade && (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-grafite">
            <h2 className="mr-auto font-bold uppercase tracking-wider">Mesas</h2>
            <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-pedra" /> Livre</span>
            <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-estado-verde" /> Ocupada</span>
            <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-estado-laranja" /> Chamando</span>
            <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-estado-azul" /> Conta</span>
            <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-estado-vermelho" /> Atraso</span>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {mesasVisiveis.map((m) => {
              const c = chamadoDaMesa.get(m.id);
              const atrasado = c && c.status === "aberto" && minutosDesde(c.criado_em, agora) >= alertaMinutos;
              const cor = atrasado
                ? "bg-estado-vermelho text-white"
                : c?.tipo === "conta"
                  ? "bg-estado-azul text-white"
                  : c
                    ? `bg-estado-laranja text-white ${c.status === "aberto" ? "animate-pulsar" : ""}`
                    : m.ocupada
                      ? "bg-estado-verde text-white"
                      : "bg-pedra text-carvao";
              return (
                <li key={m.id}>
                  <button onClick={() => setSelecionada(m.id)} className={`flex aspect-square w-full flex-col justify-between rounded-2xl p-3 text-left transition active:scale-95 ${cor}`}>
                    <span className="text-lg font-extrabold leading-none">{m.nome.replace(/^Mesa\s*/i, "")}</span>
                    <span className="text-[11px] font-semibold opacity-90">
                      {c ? (c.status === "a_caminho" ? "A caminho" : cronometro(c.criado_em, agora)) : m.ocupada ? "Ocupada" : "Livre"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ações da mesa */}
      {sel && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
          <button className="absolute inset-0 bg-black/40" onClick={() => setSelecionada(null)} aria-label="Fechar" />
          <div className="card relative w-full max-w-sm rounded-b-none p-5 pb-seguro sm:rounded-b-[18px] sm:pb-5">
            <p className="text-xl font-extrabold">{sel.nome}</p>
            <p className="text-sm text-grafite">
              {selChamado ? (selChamado.tipo === "conta" ? "Pediu a conta" : "Chamando garçom") : sel.ocupada ? "Ocupada" : "Livre"}
              {sel.area ? ` · ${sel.area}` : ""}
            </p>
            <div className="mt-4 grid gap-2">
              {selChamado && podeAtender && selChamado.status === "aberto" && (
                <button onClick={() => atualizar(selChamado.id, "a_caminho")} className="btn-escuro py-3"><Footprints className="h-4 w-4" /> Estou indo</button>
              )}
              {selChamado && podeAtender && (
                <button onClick={() => atualizar(selChamado.id, "atendido")} className="btn-secundario py-3"><Check className="h-4 w-4" /> Atendido</button>
              )}
              {cardapio && podeAtender && (
                <button onClick={() => { setComanda({ id: sel.id, nome: sel.nome }); setSelecionada(null); }} className="btn-escuro py-3"><ClipboardList className="h-4 w-4" /> Fazer pedido</button>
              )}
              {cardapio && podeAtender && sel.ocupada && (
                <button onClick={() => { setConta({ id: sel.id, nome: sel.nome }); setSelecionada(null); }} className="btn-secundario py-3"><Receipt className="h-4 w-4" /> Ver conta / fechar</button>
              )}
              {!cardapio && !selChamado && sel.ocupada && podeAtender && (
                <button onClick={() => liberar(sel.id)} className="btn-secundario py-3">Liberar mesa</button>
              )}
              <button onClick={() => setSelecionada(null)} className="btn py-3 text-grafite">Fechar</button>
            </div>
          </div>
        </div>
      )}
      {comanda && cardapio && (
        <Comanda mesa={comanda} categorias={cardapio.categorias} produtos={cardapio.produtos} onFechar={() => setComanda(null)} onEnviado={() => { setComanda(null); recarregar(); }} />
      )}
      {conta && (
        <ContaMesa
          mesa={conta}
          pix={pix}
          comPagamento={comPagamento}
          infinitepay={infinitepay}
          onFechar={() => setConta(null)}
          onNovoPedido={() => { setComanda(conta); setConta(null); }}
          onFechada={() => { setConta(null); recarregar(); }}
        />
      )}
    </main>
  );
}
