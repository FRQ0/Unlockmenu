// Matriz de planos. Espelha public.plan_features / plan_limits no banco
// (tests/plans-sql-sync.test.ts garante que os dois lados batem).
// Esconder botão no front é só conforto: quem decide é o servidor (requireFeature + RLS).
import { HttpError } from "./http";

export const PLANOS = ["essencial", "profissional", "completo"] as const;
export type Plano = (typeof PLANOS)[number];

export const PLANO_NOME: Record<Plano, string> = {
  essencial: "Essencial",
  profissional: "Profissional",
  completo: "Completo",
};

export const FEATURES = {
  chamar_garcom: ["essencial", "profissional", "completo"],
  cardapio_foto: ["essencial", "profissional", "completo"],
  logo: ["essencial", "profissional", "completo"],
  cores: ["profissional", "completo"],
  reels: ["profissional", "completo"],
  painel_garcom_grade: ["profissional", "completo"],
  painel_garcom_som: ["profissional", "completo"],
  painel_garcom_setores: ["completo"],
  push: ["completo"],
  combina_com: ["completo"],
  pedidos: ["completo"],
  avaliacao_google: ["completo"],
  alerta_gerente: ["completo"],
  painel_dono_basico: ["profissional", "completo"],
  painel_dono_completo: ["completo"],
  site_institucional: ["completo"],
  dominio_proprio: ["completo"],
} as const satisfies Record<string, readonly Plano[]>;
export type Feature = keyof typeof FEATURES;

export const LIMITES: Record<Plano, { maxMesas: number | null; videosInclusos: number; suporte: string }> = {
  essencial: { maxMesas: 10, videosInclusos: 0, suporte: "E-mail" },
  profissional: { maxMesas: 25, videosInclusos: 0, suporte: "WhatsApp" },
  completo: { maxMesas: null, videosInclusos: 5, suporte: "WhatsApp prioritário + atualização do cardápio feita por nós" },
};

export const DIAS_TESTE = 7;

export type TenantPlano = {
  plano: Plano;
  status: "teste" | "ativo" | "suspenso";
  trial_ends_at: string | null;
};

export function planHas(plano: Plano, feature: Feature): boolean {
  return (FEATURES[feature] as readonly Plano[]).includes(plano);
}

/** Mesmo critério do app.tenant_active() no banco. */
export function tenantAtivo(t: Pick<TenantPlano, "status" | "trial_ends_at">, agora = new Date()): boolean {
  if (t.status === "ativo") return true;
  if (t.status === "teste") return !!t.trial_ends_at && new Date(t.trial_ends_at).getTime() > agora.getTime();
  return false;
}

export function tenantHas(t: TenantPlano, feature: Feature, agora = new Date()): boolean {
  return tenantAtivo(t, agora) && planHas(t.plano, feature);
}

/** Lança 403 se o estabelecimento não tem o recurso. Use em TODA rota/ação que mexe num recurso pago. */
export function requireFeature(t: TenantPlano, feature: Feature): void {
  if (!tenantAtivo(t)) throw new HttpError(403, "Período de teste encerrado ou conta suspensa. Fale com a gente.");
  if (!planHas(t.plano, feature)) throw new HttpError(403, "Recurso não disponível no seu plano.");
}

export function fimDoTeste(inicio = new Date()): Date {
  return new Date(inicio.getTime() + DIAS_TESTE * 24 * 60 * 60 * 1000);
}

export function diasRestantesTeste(t: Pick<TenantPlano, "status" | "trial_ends_at">, agora = new Date()): number | null {
  if (t.status !== "teste" || !t.trial_ends_at) return null;
  const ms = new Date(t.trial_ends_at).getTime() - agora.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
