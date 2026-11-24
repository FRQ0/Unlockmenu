"use client";
import { useState } from "react";
import { KeyRound, Loader2, Plus, X } from "lucide-react";
import type { Membership } from "@/lib/types";
import { api } from "./api";

const PAPEL: Record<string, string> = { dono: "Dono", gerente: "Gerente", garcom: "Garçom", cozinha: "Cozinha" };

export function AdminEquipe({ iniciais, eu, slug, setores }: { iniciais: Membership[]; eu: string; slug: string; setores: boolean }) {
  const [lista, setLista] = useState(iniciais);
  const [novo, setNovo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function tentar(fn: () => Promise<void>) {
    setErro(null);
    try {
      await fn();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    }
  }

  const editar = (m: Membership, campos: Partial<Membership>) =>
    tentar(async () => {
      await api(`/api/app/equipe/${m.id}`, "PATCH", campos);
      setLista((l) => l.map((x) => (x.id === m.id ? { ...x, ...campos } : x)));
    });

  const definirPin = (m: Membership) =>
    tentar(async () => {
      const pin = prompt(`PIN de ${m.nome} (4 a 6 números). Deixe vazio para remover.`);
      if (pin === null) return;
      if (pin && !/^[0-9]{4,6}$/.test(pin)) throw new Error("O PIN precisa ter de 4 a 6 números.");
      await api(`/api/app/equipe/${m.id}`, "PATCH", { pin: pin || null });
      alert(pin ? `PIN definido. Para entrar: código "${slug}" + PIN.` : "PIN removido.");
    });

  async function criar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSalvando(true);
    await tentar(async () => {
      const setoresTxt = String(f.get("setores") ?? "").trim();
      const m = await api<Membership>("/api/app/equipe", "POST", {
        nome: f.get("nome"),
        email: f.get("email"),
        senha: f.get("senha"),
        papel: f.get("papel"),
        ...(setores && setoresTxt ? { setores: setoresTxt.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
      });
      setLista((l) => [...l, m]);
      setNovo(false);
    });
    setSalvando(false);
  }

  return (
    <main className="mx-auto max-w-4xl p-4 lg:p-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Equipe</h1>
        <button onClick={() => setNovo(true)} className="btn-escuro ml-auto"><Plus className="h-4 w-4" /> Novo funcionário</button>
      </div>
      {erro && <p role="alert" className="mt-3 rounded-xl bg-estado-vermelho/10 p-3 text-sm font-semibold text-estado-vermelho">{erro}</p>}

      <ul className="mt-5 space-y-2">
        {lista.map((m) => (
          <li key={m.id} className={`card flex flex-wrap items-center gap-3 p-4 ${m.ativo ? "" : "opacity-60"}`}>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{m.nome}{m.user_id === eu ? " (você)" : ""}</p>
              <p className="text-sm text-grafite">{PAPEL[m.papel]}{m.setores.length ? ` · ${m.setores.join(", ")}` : ""}</p>
            </div>
            {m.user_id !== eu && m.papel !== "dono" && (
              <>
                <select value={m.papel} onChange={(e) => editar(m, { papel: e.target.value as Membership["papel"] })} className="campo w-auto py-1.5" aria-label="Papel">
                  <option value="gerente">Gerente</option>
                  <option value="garcom">Garçom</option>
                  <option value="cozinha">Cozinha</option>
                </select>
                <button onClick={() => definirPin(m)} className="btn-secundario px-3 py-1.5 text-xs"><KeyRound className="h-3.5 w-3.5" /> PIN</button>
                <button onClick={() => editar(m, { ativo: !m.ativo })} className="btn px-3 py-1.5 text-xs text-grafite">{m.ativo ? "Desativar" : "Reativar"}</button>
              </>
            )}
          </li>
        ))}
      </ul>

      {novo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <form onSubmit={criar} className="card w-full max-w-md space-y-4 rounded-b-none p-5 sm:rounded-b-[18px]" autoComplete="off">
            <div className="flex items-center">
              <h2 className="text-lg font-extrabold">Novo funcionário</h2>
              <button type="button" onClick={() => setNovo(false)} className="ml-auto p-2" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <div><label className="rotulo" htmlFor="n">Nome</label><input id="n" name="nome" required maxLength={60} className="campo" /></div>
            <div><label className="rotulo" htmlFor="e">E-mail</label><input id="e" name="email" type="email" required maxLength={120} className="campo" /></div>
            <div><label className="rotulo" htmlFor="s">Senha inicial (mín. 10 caracteres)</label><input id="s" name="senha" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className="campo" /></div>
            <div>
              <label className="rotulo" htmlFor="p">Papel</label>
              <select id="p" name="papel" className="campo" defaultValue="garcom">
                <option value="garcom">Garçom</option>
                <option value="gerente">Gerente</option>
                <option value="cozinha">Cozinha</option>
              </select>
            </div>
            {setores && <div><label className="rotulo" htmlFor="st">Setores (separados por vírgula)</label><input id="st" name="setores" maxLength={200} placeholder="Salão, Varanda" className="campo" /></div>}
            <button disabled={salvando} className="btn-escuro w-full py-3">{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Criar acesso</button>
          </form>
        </div>
      )}
    </main>
  );
}
