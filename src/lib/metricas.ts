// Métricas do painel do dono. Só o que o sistema mede de verdade (sem inventar venda).
export type CallRow = { table_id: string; tipo: "garcom" | "conta"; status: string; criado_em: string; aceito_em: string | null; atendido_em: string | null; atendido_por: string | null; aceito_por: string | null };
export type EventRow = { tipo: string; product_id: string | null };

const OFFSET_SP = -3; // Brasília (sem horário de verão desde 2019)

export function inicioPeriodo(periodo: "hoje" | "7" | "30", agora = new Date()): Date {
  const sp = new Date(agora.getTime() + OFFSET_SP * 3600_000);
  const meiaNoiteSpUtc = Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate()) - OFFSET_SP * 3600_000;
  const dias = periodo === "hoje" ? 0 : Number(periodo) - 1;
  return new Date(meiaNoiteSpUtc - dias * 86_400_000);
}

export function horaSp(iso: string) {
  return (new Date(iso).getUTCHours() + 24 + OFFSET_SP) % 24;
}

export function calcularMetricas(calls: CallRow[], events: EventRow[]) {
  const validos = calls.filter((c) => c.status !== "cancelado");
  const respostas = validos.filter((c) => c.aceito_em).map((c) => (new Date(c.aceito_em!).getTime() - new Date(c.criado_em).getTime()) / 1000);
  const media = respostas.length ? respostas.reduce((a, b) => a + b, 0) / respostas.length : null;
  const porHora = Array.from({ length: 24 }, () => 0);
  validos.forEach((c) => porHora[horaSp(c.criado_em)]++);

  const ranking = new Map<string, { atendidos: number; soma: number; n: number }>();
  for (const c of validos) {
    const quem = c.atendido_por ?? c.aceito_por;
    if (!quem || c.status !== "atendido") continue;
    const r = ranking.get(quem) ?? { atendidos: 0, soma: 0, n: 0 };
    r.atendidos++;
    if (c.aceito_em) {
      r.soma += (new Date(c.aceito_em).getTime() - new Date(c.criado_em).getTime()) / 1000;
      r.n++;
    }
    ranking.set(quem, r);
  }

  const contar = (tipo: string) => {
    const m = new Map<string, number>();
    events.filter((e) => e.tipo === tipo && e.product_id).forEach((e) => m.set(e.product_id!, (m.get(e.product_id!) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  };

  return {
    chamados: validos.filter((c) => c.tipo === "garcom").length,
    contas: validos.filter((c) => c.tipo === "conta").length,
    mesasAtendidas: new Set(validos.filter((c) => c.status === "atendido").map((c) => c.table_id)).size,
    tempoMedioSeg: media,
    porHora,
    ranking: [...ranking.entries()].map(([userId, r]) => ({ userId, atendidos: r.atendidos, mediaSeg: r.n ? r.soma / r.n : null })).sort((a, b) => b.atendidos - a.atendidos),
    maisVistos: contar("view_produto"),
    maisAssistidos: contar("play_reels"),
    scans: events.filter((e) => e.tipo === "scan_mesa").length,
  };
}

export function duracao(seg: number | null) {
  if (seg === null) return "—";
  if (seg < 60) return `${Math.round(seg)} s`;
  return `${Math.floor(seg / 60)} min ${String(Math.round(seg % 60)).padStart(2, "0")} s`;
}

export type OrderRow = { total: number | string; status: string; session_id: string | null; criado_em: string };
export type OrderItemRow = { nome: string; quantidade: number; preco: number | string };

/** Faturamento real: soma dos pedidos não cancelados (comanda do garçom). */
export function calcularVendas(orders: OrderRow[], itens: OrderItemRow[]) {
  const validos = orders.filter((o) => o.status !== "cancelado");
  const faturamento = validos.reduce((s, o) => s + Number(o.total), 0);
  const mesas = new Set(validos.map((o) => o.session_id).filter(Boolean)).size;
  const porHora = Array.from({ length: 24 }, () => 0);
  validos.forEach((o) => (porHora[horaSp(o.criado_em)] += Number(o.total)));
  const pratos = new Map<string, { qtd: number; valor: number }>();
  for (const i of itens) {
    const p = pratos.get(i.nome) ?? { qtd: 0, valor: 0 };
    p.qtd += i.quantidade;
    p.valor += i.quantidade * Number(i.preco);
    pratos.set(i.nome, p);
  }
  return {
    faturamento: Math.round(faturamento * 100) / 100,
    pedidos: validos.length,
    mesas,
    ticketMedio: mesas ? Math.round((faturamento / mesas) * 100) / 100 : null,
    porHora,
    maisVendidos: [...pratos.entries()].sort((a, b) => b[1].qtd - a[1].qtd).slice(0, 8),
  };
}
