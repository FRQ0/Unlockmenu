import { describe, expect, it } from "vitest";
import { FEATURES, LIMITES, planHas, requireFeature, tenantAtivo, tenantHas, fimDoTeste, diasRestantesTeste } from "@/lib/plans";
import { HttpError } from "@/lib/http";

describe("matriz de planos (tabela do item 9.5)", () => {
  it("Essencial: chamar garçom, foto e só logo", () => {
    expect(planHas("essencial", "chamar_garcom")).toBe(true);
    expect(planHas("essencial", "logo")).toBe(true);
    for (const f of ["cores", "reels", "combina_com", "pedidos", "avaliacao_google", "alerta_gerente", "painel_dono_basico", "push"] as const)
      expect(planHas("essencial", f), f).toBe(false);
    expect(LIMITES.essencial.maxMesas).toBe(10);
  });
  it("Profissional: Reels, cores, grade com som, painel do dono básico", () => {
    for (const f of ["reels", "cores", "painel_garcom_grade", "painel_garcom_som", "painel_dono_basico"] as const) expect(planHas("profissional", f), f).toBe(true);
    for (const f of ["combina_com", "pedidos", "avaliacao_google", "alerta_gerente", "painel_dono_completo", "push", "painel_garcom_setores", "dominio_proprio"] as const)
      expect(planHas("profissional", f), f).toBe(false);
    expect(LIMITES.profissional.maxMesas).toBe(25);
  });
  it("Completo: tudo, mesas ilimitadas, 5 vídeos", () => {
    for (const f of Object.keys(FEATURES) as (keyof typeof FEATURES)[]) expect(planHas("completo", f), f).toBe(true);
    expect(LIMITES.completo.maxMesas).toBeNull();
    expect(LIMITES.completo.videosInclusos).toBe(5);
  });
});

describe("teste grátis de 7 dias", () => {
  const inicio = new Date("2026-11-01T12:00:00Z");
  const fim = fimDoTeste(inicio);
  it("termina 7 dias depois", () => expect(fim.toISOString()).toBe("2026-11-08T12:00:00.000Z"));
  it("libera durante o teste", () => {
    const t = { plano: "completo" as const, status: "teste" as const, trial_ends_at: fim.toISOString() };
    expect(tenantAtivo(t, new Date("2026-11-07T23:00:00Z"))).toBe(true);
    expect(diasRestantesTeste(t, new Date("2026-11-07T12:00:00Z"))).toBe(1);
    expect(tenantHas(t, "reels", new Date("2026-11-05T00:00:00Z"))).toBe(true);
  });
  it("bloqueia no 8º dia", () => {
    const t = { plano: "completo" as const, status: "teste" as const, trial_ends_at: fim.toISOString() };
    expect(tenantAtivo(t, new Date("2026-11-08T12:00:01Z"))).toBe(false);
    expect(tenantHas(t, "chamar_garcom", new Date("2026-11-09T00:00:00Z"))).toBe(false);
  });
  it("suspenso bloqueia mesmo no Completo", () => {
    expect(tenantAtivo({ status: "suspenso", trial_ends_at: null })).toBe(false);
  });
});

describe("requireFeature", () => {
  it("lança 403 fora do plano", () => {
    try {
      requireFeature({ plano: "essencial", status: "ativo", trial_ends_at: null }, "reels");
      throw new Error("deveria lançar");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(403);
    }
  });
  it("lança 403 com teste vencido", () => {
    expect(() => requireFeature({ plano: "completo", status: "teste", trial_ends_at: "2000-01-01T00:00:00Z" }, "chamar_garcom")).toThrow(HttpError);
  });
});
