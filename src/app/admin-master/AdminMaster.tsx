"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Plus, X } from "lucide-react";
import { PLANOS, PLANO_NOME, diasRestantesTeste, tenantAtivo, type Plano } from "@/lib/plans";

type T = { id: string; nome: string; slug: string; plano: Plano; status: "teste" | "ativo" | "suspenso"; trial_ends_at: string | null; pago_ate: string | null; dominio_custom: string | null; created_at: string };

async function chamar(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
}

export function AdminMaster({ tenants }: { tenants: T[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [carregando, setCarregando] = useState<string | null>(null);

  async function acao(t: T, body: Record<string, unknown>) {
    setErro(null);
    setCarregando(t.id);
    try {
      await chamar(`/api/admin/tenants/${t.id}`, "PATCH", body);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setCarregando(null);
    }
  }

  async function criar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErro(null);
    setCarregando("novo");
    try {
      await chamar("/api/admin/tenants", "POST", {
        nome: f.get("nome"),
        slug: f.get("slug"),
        plano: f.get("plano"),
        dono_nome: f.get("dono_nome"),
        dono_email: f.get("dono_email"),
        dono_senha: f.get("dono_senha"),
        iniciar_teste: f.get("teste") === "on",
      });
      setNovo(false);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setCarregando(null);
    }
  }

  const situacao = (t: T) => {
    if (t.status === "suspenso") return { txt: "Suspenso", cls: "bg-estado-vermelho text-white" };
    if (t.status === "ativo") return { txt: t.pago_ate ? `Pago até ${new Date(t.pago_ate + "T12:00:00").toLocaleDateString("pt-BR")}` : "Ativo", cls: "bg-estado-verde text-white" };
    if (!tenantAtivo(t)) return { txt: "Teste encerrado", cls: "bg-estado-vermelho/15 text-estado-vermelho" };
    const d = diasRestantesTeste(t);
    return { txt: `Teste · ${d} dia${d === 1 ? "" : "s"}`, cls: "bg-estado-laranja text-white" };
  };

  return (
    <>
      <div className="mt-8 flex items-center">
        <h1 className="text-2xl font-extrabold">Estabelecimentos ({tenants.length})</h1>
        <button onClick={() => setNovo(true)} className="btn-escuro ml-auto"><Plus className="h-4 w-4" /> Novo</button>
      </div>
      {erro && <p role="alert" className="mt-3 rounded-xl bg-estado-vermelho/10 p-3 text-sm font-semibold text-estado-vermelho">{erro}</p>}
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-xs text-grafite">
            <tr>
              <th className="p-3 font-semibold">Estabelecimento</th>
              <th className="p-3 font-semibold">Plano</th>
              <th className="p-3 font-semibold">Situação</th>
              <th className="p-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => {
              const s = situacao(t);
              return (
                <tr key={t.id} className="border-t border-pedra align-top">
                  <td className="p-3">
                    <p className="font-bold">{t.nome}</p>
                    <a href={`/${t.slug}/cardapio`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-grafite">/{t.slug} <ExternalLink className="h-3 w-3" /></a>
                    {t.dominio_custom && <p className="text-xs text-grafite">{t.dominio_custom}</p>}
                  </td>
                  <td className="p-3">
                    <select value={t.plano} disabled={carregando === t.id} onChange={(e) => acao(t, { acao: "plano", plano: e.target.value })} className="campo w-auto py-1.5">
                      {PLANOS.map((p) => <option key={p} value={p}>{PLANO_NOME[p]}</option>)}
                    </select>
                  </td>
                  <td className="p-3"><span className={`selo ${s.cls}`}>{s.txt}</span></td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button disabled={carregando === t.id} onClick={() => acao(t, { acao: "iniciar_teste" })} className="btn-secundario px-2.5 py-1 text-xs">Teste 7 dias</button>
                      <button
                        disabled={carregando === t.id}
                        onClick={() => {
                          const ate = prompt("Pago até (AAAA-MM-DD). Deixe vazio para sem data.", new Date(Date.now() + 31 * 86400000).toISOString().slice(0, 10));
                          if (ate === null) return;
                          acao(t, { acao: "ativar", ...(ate ? { pago_ate: ate } : {}) });
                        }}
                        className="btn-secundario px-2.5 py-1 text-xs"
                      >
                        Marcar pago
                      </button>
                      <button disabled={carregando === t.id} onClick={() => confirm(`Suspender ${t.nome}?`) && acao(t, { acao: "suspender" })} className="btn px-2.5 py-1 text-xs text-estado-vermelho">Suspender</button>
                      <button
                        disabled={carregando === t.id}
                        onClick={() => {
                          const d = prompt("Domínio próprio (ex.: cardapio.restaurante.com.br). Vazio remove.", t.dominio_custom ?? "");
                          if (d === null) return;
                          acao(t, { acao: "dominio", dominio_custom: d.trim() || null });
                        }}
                        className="btn px-2.5 py-1 text-xs text-grafite"
                      >
                        Domínio
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {novo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <form onSubmit={criar} className="card max-h-[95dvh] w-full max-w-lg space-y-3 overflow-y-auto rounded-b-none p-5 sm:rounded-b-[18px]" autoComplete="off">
            <div className="flex items-center">
              <h2 className="text-lg font-extrabold">Novo estabelecimento</h2>
              <button type="button" onClick={() => setNovo(false)} className="ml-auto p-2" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <div><label className="rotulo" htmlFor="nome">Nome</label><input id="nome" name="nome" required maxLength={80} className="campo" /></div>
            <div><label className="rotulo" htmlFor="slug">Endereço (slug)</label><input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={40} placeholder="pizzaria-forno" className="campo" /></div>
            <div>
              <label className="rotulo" htmlFor="plano">Plano</label>
              <select id="plano" name="plano" defaultValue="completo" className="campo">{PLANOS.map((p) => <option key={p} value={p}>{PLANO_NOME[p]}</option>)}</select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="rotulo" htmlFor="dn">Nome do dono</label><input id="dn" name="dono_nome" required maxLength={60} className="campo" /></div>
              <div><label className="rotulo" htmlFor="de">E-mail do dono</label><input id="de" name="dono_email" type="email" required maxLength={120} className="campo" /></div>
            </div>
            <div><label className="rotulo" htmlFor="ds">Senha inicial (mín. 10)</label><input id="ds" name="dono_senha" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className="campo" /></div>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="teste" defaultChecked /> Iniciar teste grátis de 7 dias</label>
            <button disabled={carregando === "novo"} className="btn-escuro w-full py-3">{carregando === "novo" && <Loader2 className="h-4 w-4 animate-spin" />} Criar</button>
          </form>
        </div>
      )}
    </>
  );
}
