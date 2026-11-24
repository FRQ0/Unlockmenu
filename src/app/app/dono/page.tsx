import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { PODE_GERIR, staffPage } from "@/lib/staff";
import { tenantHas } from "@/lib/plans";
import { calcularMetricas, duracao, inicioPeriodo, type CallRow, type EventRow } from "@/lib/metricas";
import { GraficoHoras } from "@/components/painel/GraficoHoras";

export const metadata: Metadata = { title: "Painel do dono" };

const PERIODOS = [
  { id: "hoje", nome: "Hoje" },
  { id: "7", nome: "7 dias" },
  { id: "30", nome: "30 dias" },
] as const;

export default async function DonoPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { supabase, tenant } = await staffPage(PODE_GERIR);
  if (!tenantHas(tenant, "painel_dono_basico")) redirect("/app/garcom");
  const completo = tenantHas(tenant, "painel_dono_completo");
  const p = (await searchParams).p;
  const periodo = p === "7" || p === "30" ? p : "hoje";
  const desde = inicioPeriodo(periodo).toISOString();

  const [{ data: calls }, { data: events }, { data: equipe }, { data: produtos }] = await Promise.all([
    supabase.from("calls").select("table_id,tipo,status,criado_em,aceito_em,atendido_em,atendido_por,aceito_por").eq("tenant_id", tenant.id).gte("criado_em", desde).limit(10000),
    completo
      ? supabase.from("events").select("tipo,product_id").eq("tenant_id", tenant.id).gte("criado_em", desde).limit(50000)
      : Promise.resolve({ data: [] as EventRow[] }),
    supabase.from("memberships").select("user_id,nome").eq("tenant_id", tenant.id),
    supabase.from("products").select("id,nome").eq("tenant_id", tenant.id),
  ]);
  const m = calcularMetricas((calls ?? []) as CallRow[], (events ?? []) as EventRow[]);
  const nome = new Map((equipe ?? []).map((e) => [e.user_id, e.nome]));
  const prato = new Map((produtos ?? []).map((x) => [x.id, x.nome]));

  const tiles = [
    { rotulo: "Chamados de garçom", valor: String(m.chamados) },
    { rotulo: "Tempo médio de resposta", valor: duracao(m.tempoMedioSeg) },
    { rotulo: "Mesas atendidas", valor: String(m.mesasAtendidas) },
    { rotulo: "Pedidos de conta", valor: String(m.contas) },
  ];

  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Painel do dono</h1>
        <nav className="ml-auto flex rounded-xl bg-white p-1 shadow-suave" aria-label="Período">
          {PERIODOS.map((x) => (
            <Link key={x.id} href={`/app/dono?p=${x.id}`} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${periodo === x.id ? "bg-carvao text-papel" : "text-grafite"}`}>
              {x.nome}
            </Link>
          ))}
        </nav>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.rotulo} className="card p-4">
            <p className="text-xs font-semibold text-grafite">{t.rotulo}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">{t.valor}</p>
          </div>
        ))}
      </section>

      {completo ? (
        <>
          <section className="card mt-6 p-5">
            <h2 className="font-bold">Chamados por hora</h2>
            <p className="text-sm text-grafite">Horários de pico no período (horário de Brasília)</p>
            <GraficoHoras porHora={m.porHora} />
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <section className="card p-5">
              <h2 className="font-bold">Ranking de garçons</h2>
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs text-grafite">
                  <tr><th className="py-1 font-semibold">Nome</th><th className="py-1 text-right font-semibold">Atendidos</th><th className="py-1 text-right font-semibold">Resposta</th></tr>
                </thead>
                <tbody>
                  {m.ranking.map((r) => (
                    <tr key={r.userId} className="border-t border-pedra">
                      <td className="py-2 font-semibold">{nome.get(r.userId) ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums">{r.atendidos}</td>
                      <td className="py-2 text-right tabular-nums">{duracao(r.mediaSeg)}</td>
                    </tr>
                  ))}
                  {!m.ranking.length && <tr><td colSpan={3} className="py-4 text-center text-grafite">Sem atendimentos no período.</td></tr>}
                </tbody>
              </table>
            </section>
            {[
              { titulo: "Pratos mais vistos", dados: m.maisVistos },
              { titulo: "Mais assistidos nos Reels", dados: m.maisAssistidos },
            ].map((b) => (
              <section key={b.titulo} className="card p-5">
                <h2 className="font-bold">{b.titulo}</h2>
                <ol className="mt-3 space-y-2 text-sm">
                  {b.dados.map(([id, n], i) => (
                    <li key={id} className="flex items-center gap-2 border-t border-pedra pt-2 first:border-0 first:pt-0">
                      <span className="w-5 text-xs font-bold text-grafite">{i + 1}</span>
                      <span className="flex-1 truncate font-semibold">{prato.get(id) ?? "Prato removido"}</span>
                      <span className="tabular-nums text-grafite">{n}</span>
                    </li>
                  ))}
                  {!b.dados.length && <li className="py-4 text-center text-grafite">Sem dados no período.</li>}
                </ol>
              </section>
            ))}
          </div>
          <p className="mt-6 text-xs text-grafite">
            {m.scans} leituras de QR/NFC no período. Faturamento entra quando o pedido pelo celular ou o fechamento de conta com valor estiver ativo.
          </p>
        </>
      ) : (
        <section className="card mt-6 flex items-center gap-3 p-5 text-sm text-grafite">
          <Lock className="h-4 w-4 shrink-0" /> Horários de pico, ranking de garçons e pratos mais vistos estão no plano Completo.
        </section>
      )}
    </main>
  );
}
