import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PedidoStatus = "novo" | "preparando" | "pronto" | "entregue" | "cancelado";
export type PedidoItem = { nome: string; quantidade: number; preco: number; observacao: string | null };
export type Pedido = {
  id: string;
  table_id: string;
  mesa: string;
  status: PedidoStatus;
  total: number;
  observacao: string | null;
  criado_em: string;
  garcom: string | null;
  itens: PedidoItem[];
};

const COLS = "id,table_id,status,total,observacao,criado_em,criado_por,tables(nome),order_items(nome,quantidade,preco,observacao)";

type Linha = {
  id: string; table_id: string; status: PedidoStatus; total: number | string; observacao: string | null; criado_em: string; criado_por: string | null;
  tables: { nome: string } | null; order_items: { nome: string; quantidade: number; preco: number | string; observacao: string | null }[];
};

function montar(l: Linha, nomes: Map<string, string>): Pedido {
  return {
    id: l.id,
    table_id: l.table_id,
    mesa: l.tables?.nome ?? "Mesa",
    status: l.status,
    total: Number(l.total),
    observacao: l.observacao,
    criado_em: l.criado_em,
    garcom: l.criado_por ? (nomes.get(l.criado_por)?.split(" ")[0] ?? null) : null,
    itens: (l.order_items ?? []).map((i) => ({ nome: i.nome, quantidade: i.quantidade, preco: Number(i.preco), observacao: i.observacao })),
  };
}

async function nomesEquipe(supabase: SupabaseClient, tenantId: string) {
  const { data } = await supabase.from("memberships").select("user_id,nome").eq("tenant_id", tenantId);
  return new Map((data ?? []).map((m) => [m.user_id as string, m.nome as string]));
}

/** Pedidos em andamento (cozinha e garçom). Lido com o cliente do usuário: o RLS isola o estabelecimento. */
export async function pedidosAtivos(supabase: SupabaseClient, tenantId: string): Promise<Pedido[]> {
  const desde = new Date(Date.now() - 12 * 3600_000).toISOString();
  const [{ data }, nomes] = await Promise.all([
    supabase.from("orders").select(COLS).eq("tenant_id", tenantId).in("status", ["novo", "preparando", "pronto"]).is("pago_em", null).gte("criado_em", desde).order("criado_em"),
    nomesEquipe(supabase, tenantId),
  ]);
  return ((data ?? []) as unknown as Linha[]).map((l) => montar(l, nomes));
}

/** Conta aberta da mesa: todos os pedidos da sessão atual. */
export async function contaDaMesa(supabase: SupabaseClient, tenantId: string, tableId: string) {
  const { data: sessao } = await supabase
    .from("sessions").select("id,iniciada_em").eq("tenant_id", tenantId).eq("table_id", tableId).is("encerrada_em", null)
    .order("iniciada_em", { ascending: false }).limit(1).maybeSingle();
  if (!sessao) return { pedidos: [] as Pedido[], total: 0 };
  const [{ data }, nomes] = await Promise.all([
    supabase.from("orders").select(COLS).eq("tenant_id", tenantId).eq("session_id", sessao.id).neq("status", "cancelado").order("criado_em"),
    nomesEquipe(supabase, tenantId),
  ]);
  const pedidos = ((data ?? []) as unknown as Linha[]).map((l) => montar(l, nomes));
  return { pedidos, total: Math.round(pedidos.reduce((s, p) => s + p.total, 0) * 100) / 100 };
}
