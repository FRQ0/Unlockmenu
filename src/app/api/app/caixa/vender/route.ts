// Caixa: vende fichas (preço do banco) e registra o pagamento. Devolve as fichas para imprimir.
import { fromDbError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { vendaFichas } from "@/lib/schemas";
import { PODE_ATENDER } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";

export const POST = staffRoute(PODE_ATENDER, async ({ supabase, tenant }, req) => {
  requireFeature(tenant, "fichas");
  const b = vendaFichas.parse(await readJson(req, 16 * 1024));
  const { data, error } = await supabase.rpc("vender_fichas", { p_itens: b.itens, p_pagamentos: b.pagamentos });
  if (error) throw fromDbError(error);
  const linhas = (data ?? []) as { venda_id: string; total: number; codigo: string; nome: string; preco: number }[];
  return json({
    venda_id: linhas[0]?.venda_id,
    total: Number(linhas[0]?.total ?? 0),
    fichas: linhas.map((l) => ({ codigo: l.codigo, nome: l.nome, preco: Number(l.preco) })),
  }, 201);
});
