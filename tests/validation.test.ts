import { describe, expect, it } from "vitest";
import { caminhoInterno, chamadoPublico, configTenant, funcionarioCriar, produtoCriar, produtoEditar, tenantAdmin } from "@/lib/schemas";

describe("validação de entrada (mass assignment, injeção)", () => {
  it("recusa campos fora da lista no produto (tenant_id)", () => {
    expect(produtoCriar.safeParse({ nome: "X", preco: 10, tenant_id: "00000000-0000-0000-0000-000000000000" }).success).toBe(false);
  });
  it("recusa mudar plano/status pela configuração do dono", () => {
    expect(configTenant.safeParse({ plano: "completo" }).success).toBe(false);
    expect(configTenant.safeParse({ status: "ativo" }).success).toBe(false);
    expect(configTenant.safeParse({ trial_ends_at: "2099-01-01" }).success).toBe(false);
  });
  it("recusa criar funcionário com papel dono", () => {
    expect(funcionarioCriar.safeParse({ nome: "A", email: "a@a.com", senha: "1234567890", papel: "dono" }).success).toBe(false);
  });
  it("aceita produto válido e arredonda preço", () => {
    const r = produtoEditar.parse({ preco: "12.345" });
    expect(r.preco).toBe(12.35);
  });
  it("só aceita URLs https", () => {
    expect(produtoEditar.safeParse({ foto_url: "javascript:alert(1)" }).success).toBe(false);
    expect(produtoEditar.safeParse({ foto_url: "http://x.com/a.jpg" }).success).toBe(false);
  });
  it("limita Combina com a 2 itens", () => {
    const ids = ["a", "b", "c"].map((c) => `${c.repeat(8)}-0000-4000-8000-000000000000`);
    expect(produtoEditar.safeParse({ combina_com: ids }).success).toBe(false);
  });
  it("token da mesa só hexadecimal (nada de SQL/HTML)", () => {
    expect(chamadoPublico.safeParse({ slug: "rest-a", token: "' or 1=1 --", tipo: "garcom" }).success).toBe(false);
    expect(chamadoPublico.safeParse({ slug: "rest-a", token: "a".repeat(32), tipo: "garcom" }).success).toBe(true);
  });
  it("ação do super-admin é uma lista fechada", () => {
    expect(tenantAdmin.safeParse({ acao: "apagar_tudo" }).success).toBe(false);
  });
  it("redirecionamento só interno (sem open redirect)", () => {
    expect(caminhoInterno("https://malicioso.com")).toBe("/app");
    expect(caminhoInterno("//malicioso.com")).toBe("/app");
    expect(caminhoInterno("/app/garcom")).toBe("/app/garcom");
  });
});
