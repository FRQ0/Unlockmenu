import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SalaoMesa = { id: string; nome: string; area: string | null; ocupada: boolean };
export type SalaoChamado = {
  id: string;
  table_id: string;
  tipo: "garcom" | "conta";
  status: "aberto" | "a_caminho";
  criado_em: string;
  aceito_por: string | null;
  aceito_nome: string | null;
};
export type Salao = { mesas: SalaoMesa[]; chamados: SalaoChamado[] };

/** Lê com o cliente do usuário: o RLS garante que só vem o estabelecimento dele. */
export async function carregarSalao(supabase: SupabaseClient, tenantId: string): Promise<Salao> {
  const desde = new Date(Date.now() - 3 * 3600_000).toISOString();
  const [{ data: mesas }, { data: sessoes }, { data: chamados }, { data: equipe }] = await Promise.all([
    supabase.from("tables").select("id,nome,area,ordem").eq("tenant_id", tenantId).eq("ativa", true).order("ordem").order("nome"),
    supabase.from("sessions").select("table_id").eq("tenant_id", tenantId).is("encerrada_em", null).gte("ultima_atividade", desde),
    supabase
      .from("calls")
      .select("id,table_id,tipo,status,criado_em,aceito_por")
      .eq("tenant_id", tenantId)
      .in("status", ["aberto", "a_caminho"])
      .order("criado_em"),
    supabase.from("memberships").select("user_id,nome").eq("tenant_id", tenantId),
  ]);
  const ocupadas = new Set((sessoes ?? []).map((s) => s.table_id));
  const nomes = new Map((equipe ?? []).map((m) => [m.user_id, m.nome]));
  return {
    mesas: (mesas ?? []).map((m) => ({ id: m.id, nome: m.nome, area: m.area, ocupada: ocupadas.has(m.id) })),
    chamados: (chamados ?? []).map((c) => ({ ...c, aceito_nome: c.aceito_por ? (nomes.get(c.aceito_por) ?? null) : null })) as SalaoChamado[],
  };
}
