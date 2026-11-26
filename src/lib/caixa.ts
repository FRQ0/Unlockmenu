import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inicioPeriodo } from "./metricas";

export type ResumoCaixa = {
  porMetodo: Record<"pix" | "debito" | "credito" | "dinheiro", number>;
  total: number;
  fichas: { vendidas: number; usadas: number; pendentes: number; canceladas: number };
  vendas: { id: string; total: number; criado_em: string; cancelada: boolean; itens: string }[];
};

/** Resumo do dia (desde 0h de Brasília): pagamentos de mesas + vendas de fichas. */
export async function resumoCaixa(supabase: SupabaseClient, tenantId: string): Promise<ResumoCaixa> {
  const desde = inicioPeriodo("hoje").toISOString();
  const [{ data: pags }, { data: fichas }, { data: vendas }] = await Promise.all([
    supabase.from("pagamentos").select("metodo,valor").eq("tenant_id", tenantId).eq("status", "confirmado").gte("criado_em", desde).limit(20000),
    supabase.from("fichas").select("status").eq("tenant_id", tenantId).gte("criado_em", desde).limit(50000),
    supabase.from("vendas").select("id,total,criado_em,cancelada_em,fichas(nome)").eq("tenant_id", tenantId).gte("criado_em", desde).order("criado_em", { ascending: false }).limit(200),
  ]);
  const porMetodo = { pix: 0, debito: 0, credito: 0, dinheiro: 0 };
  for (const p of pags ?? []) porMetodo[p.metodo as keyof typeof porMetodo] += Number(p.valor);
  const f = { vendidas: 0, usadas: 0, pendentes: 0, canceladas: 0 };
  for (const x of fichas ?? []) {
    if (x.status === "cancelada") f.canceladas++;
    else {
      f.vendidas++;
      if (x.status === "usada") f.usadas++;
      else f.pendentes++;
    }
  }
  return {
    porMetodo,
    total: Object.values(porMetodo).reduce((a, b) => a + b, 0),
    fichas: f,
    vendas: (vendas ?? []).map((v) => {
      const cont = new Map<string, number>();
      for (const it of (v.fichas as unknown as { nome: string }[]) ?? []) cont.set(it.nome, (cont.get(it.nome) ?? 0) + 1);
      return {
        id: v.id,
        total: Number(v.total),
        criado_em: v.criado_em,
        cancelada: !!v.cancelada_em,
        itens: [...cont.entries()].map(([n, q]) => `${q}× ${n}`).join(", "),
      };
    }),
  };
}
