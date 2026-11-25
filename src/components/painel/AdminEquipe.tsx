"use client";
import { useState } from "react";
import { Check, KeyRound, Loader2, Pencil, Plus, X } from "lucide-react";
import type { Membership } from "@/lib/types";
import { api } from "./api";

const PAPEL: Record<string, { nome: string; faz: string }> = {
  dono: { nome: "Dono", faz: "Tudo, inclusive equipe e planos" },
  gerente: { nome: "Gerente", faz: "Atende mesas, anota pedidos, fecha conta, edita cardápio e mesas" },
  garcom: { nome: "Garçom", faz: "Atende mesas, anota pedidos, entrega e fecha conta" },
  cozinha: { nome: "Cozinha", faz: "Só a tela da cozinha: recebe pedidos e marca pronto" },
};

type Props = { iniciais: Membership[]; eu: string; slug: string; setores: boolean; areas: string[]; temCozinha: boolean };

export function AdminEquipe({ iniciais, eu, slug, setores, areas, temCozinha }: Props) {
  const [lista, setLista] = useState(iniciais);
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<Membership | null>(null);
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

  const salvarEdicao = (m: Membership, campos: Partial<Membership>) =>
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
      const escolhidos = f.getAll("setores").map(String);
      const m = await api<Membership>("/api/app/equipe", "POST", {
        nome: f.get("nome"),
        email: f.get("email"),
        senha: f.get("senha"),
        papel: f.get("papel"),
        ...(setores && escolhidos.length ? { setores: escolhidos } : {}),
      });
      setLista((l) => [...l, m]);
      setNovo(false);
    });
    setSalvando(false);
  }

  const papeisDisponiveis = (["garcom", "gerente", ...(temCozinha ? ["cozinha"] : [])] as const);

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
              <p className="font-bold">{m.nome}{m.user_id === eu ? " (você)" : ""}{!m.ativo ? " · desativado" : ""}</p>
              <p className="text-sm text-grafite">
                {PAPEL[m.papel]?.nome}
                {m.papel === "garcom" || m.papel === "gerente" ? ` · ${m.setores.length ? m.setores.join(", ") : "todos os setores"}` : ""}
              </p>
              <p className="text-xs text-grafite/80">{PAPEL[m.papel]?.faz}</p>
            </div>
            {m.user_id !== eu && m.papel !== "dono" && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditando(m)} className="btn-secundario px-3 py-1.5 text-xs"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                <button onClick={() => definirPin(m)} className="btn-secundario px-3 py-1.5 text-xs"><KeyRound className="h-3.5 w-3.5" /> PIN</button>
                <button onClick={() => salvarEdicao(m, { ativo: !m.ativo })} className="btn px-3 py-1.5 text-xs text-grafite">{m.ativo ? "Desativar" : "Reativar"}</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {editando && (
        <EditarFuncionario
          m={editando}
          setores={setores}
          areas={areas}
          papeis={[...papeisDisponiveis]}
          onFechar={() => setEditando(null)}
          onSalvar={async (campos) => {
            await salvarEdicao(editando, campos);
            setEditando(null);
          }}
        />
      )}

      {novo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <form onSubmit={criar} className="card max-h-[95dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-b-none p-5 sm:rounded-b-[18px]" autoComplete="off">
            <div className="flex items-center">
              <h2 className="text-lg font-extrabold">Novo funcionário</h2>
              <button type="button" onClick={() => setNovo(false)} className="ml-auto p-2" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <div><label className="rotulo" htmlFor="n">Nome</label><input id="n" name="nome" required maxLength={60} className="campo" /></div>
            <div><label className="rotulo" htmlFor="e">E-mail</label><input id="e" name="email" type="email" required maxLength={120} className="campo" /></div>
            <div><label className="rotulo" htmlFor="s">Senha inicial (mín. 10 caracteres)</label><input id="s" name="senha" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className="campo" /></div>
            <fieldset>
              <legend className="rotulo">Papel</legend>
              <div className="space-y-2">
                {papeisDisponiveis.map((p, i) => (
                  <label key={p} className="flex cursor-pointer gap-3 rounded-xl border border-pedra p-3 has-[:checked]:border-carvao has-[:checked]:bg-papel">
                    <input type="radio" name="papel" value={p} defaultChecked={i === 0} className="mt-1" />
                    <span><span className="block text-sm font-bold">{PAPEL[p].nome}</span><span className="text-xs text-grafite">{PAPEL[p].faz}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            {setores && areas.length > 0 && (
              <fieldset>
                <legend className="rotulo">Setores (deixe tudo desmarcado para todos)</legend>
                <div className="flex flex-wrap gap-2">
                  {areas.map((a) => (
                    <label key={a} className="cursor-pointer rounded-full bg-papel px-3 py-1.5 text-sm font-semibold has-[:checked]:bg-carvao has-[:checked]:text-papel">
                      <input type="checkbox" name="setores" value={a} className="sr-only" /> {a}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <button disabled={salvando} className="btn-escuro w-full py-3">{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Criar acesso</button>
          </form>
        </div>
      )}
    </main>
  );
}

function EditarFuncionario({
  m,
  setores,
  areas,
  papeis,
  onFechar,
  onSalvar,
}: {
  m: Membership;
  setores: boolean;
  areas: string[];
  papeis: string[];
  onFechar: () => void;
  onSalvar: (campos: Partial<Membership>) => Promise<void>;
}) {
  const [nome, setNome] = useState(m.nome);
  const [papel, setPapel] = useState(m.papel);
  const [sel, setSel] = useState<string[]>(m.setores);
  const [salvando, setSalvando] = useState(false);
  const todos = sel.length === 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    await onSalvar({
      ...(nome.trim() !== m.nome ? { nome: nome.trim() } : {}),
      ...(papel !== m.papel ? { papel } : {}),
      ...(setores ? { setores: sel } : {}),
    });
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <form onSubmit={salvar} className="card max-h-[95dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-b-none p-5 sm:rounded-b-[18px]">
        <div className="flex items-center">
          <h2 className="text-lg font-extrabold">Editar {m.nome}</h2>
          <button type="button" onClick={onFechar} className="ml-auto p-2" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <div>
          <label className="rotulo" htmlFor="en">Nome</label>
          <input id="en" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={60} className="campo" />
        </div>
        <fieldset>
          <legend className="rotulo">Papel</legend>
          <div className="space-y-2">
            {papeis.map((p) => (
              <label key={p} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${papel === p ? "border-carvao bg-papel" : "border-pedra"}`}>
                <input type="radio" checked={papel === p} onChange={() => setPapel(p as Membership["papel"])} className="mt-1" />
                <span><span className="block text-sm font-bold">{PAPEL[p].nome}</span><span className="text-xs text-grafite">{PAPEL[p].faz}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        {setores && (papel === "garcom" || papel === "gerente") && (
          <fieldset>
            <legend className="rotulo">Setores que aparecem primeiro no painel</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSel([])} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${todos ? "bg-carvao text-papel" : "bg-papel"}`}>
                {todos && <Check className="h-3.5 w-3.5" />} Todos os setores
              </button>
              {areas.map((a) => {
                const on = sel.includes(a);
                return (
                  <button
                    type="button"
                    key={a}
                    onClick={() => setSel((s) => (on ? s.filter((x) => x !== a) : [...s, a]))}
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${on ? "bg-carvao text-papel" : "bg-papel"}`}
                  >
                    {on && <Check className="h-3.5 w-3.5" />} {a}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-grafite">O garçom atende qualquer mesa. O setor só define o que ele vê primeiro.</p>
          </fieldset>
        )}
        <button disabled={salvando || !nome.trim()} className="btn-escuro w-full py-3">{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</button>
      </form>
    </div>
  );
}
