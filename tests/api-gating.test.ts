// Critério do item 9.5: "Se alguém do plano Essencial chamar a API de Reels ou de pedidos
// direto, o servidor responde 403." Aqui chamamos os route handlers de verdade, com um
// usuário logado simulado, e conferimos que o banco nem chega a ser tocado.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Plano } from "@/lib/plans";

const db = { chamadas: [] as string[] };
function fakeSupabase() {
  const q: Record<string, unknown> = {};
  const chain = new Proxy(q, {
    get: (_t, prop: string) => {
      if (prop === "then") return (res: (v: unknown) => void) => res({ data: { id: "x", preco: 1, preco_antigo: null }, error: null, count: 0 });
      return (..._a: unknown[]) => {
        db.chamadas.push(prop);
        return chain;
      };
    },
  });
  return { from: (t: string) => { db.chamadas.push(`from:${t}`); return chain; } };
}

let plano: Plano = "essencial";
let status: "teste" | "ativo" | "suspenso" = "ativo";
let trial: string | null = null;
let papel = "dono";

vi.mock("@/lib/staff", async () => {
  const { HttpError } = await import("@/lib/http");
  return {
    PODE_GERIR: ["dono", "gerente"],
    PODE_ATENDER: ["dono", "gerente", "garcom"],
    TENANT_COOKIE: "um_tenant",
    requireStaff: async (papeis?: string[]) => {
      if (papeis && !papeis.includes(papel)) throw new HttpError(403, "Sem permissão.");
      return {
        supabase: fakeSupabase(),
        user: { id: "u1" },
        membership: { papel, tenant_id: "t1" },
        memberships: [],
        tenant: { id: "t1", slug: "rest", nome: "Rest", plano, status, trial_ends_at: trial, cor_primaria: null, cor_secundaria: null, capa_url: null, google_review_url: null, modo_atendimento: "chamar", alerta_minutos: 5, logo_url: null },
      };
    },
  };
});
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => { throw new Error("admin não deveria ser usado"); } }));
vi.mock("@/lib/security", () => ({ requireRateLimit: async () => {}, rateLimit: async () => true }));
vi.mock("@/lib/media", async (orig) => {
  const real = await orig<typeof import("@/lib/media")>();
  return { ...real, urlDeUpload: async () => ({ caminho: "c", url: "https://x" }) };
});

const req = (method: string, body?: unknown) =>
  new Request("https://app.test/api", { method, headers: { "content-type": "application/json", host: "app.test", origin: "https://app.test" }, body: body ? JSON.stringify(body) : undefined });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) as any });
const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  db.chamadas = [];
  plano = "essencial";
  status = "ativo";
  trial = null;
  papel = "dono";
});

describe("plano Essencial chamando recursos pagos direto na API", () => {
  it("pedir upload de vídeo (Reels) → 403", async () => {
    const { POST } = await import("@/app/api/app/midia/upload-url/route");
    const r = await POST(req("POST", { tipo: "video", mime: "video/mp4", tamanho: 1000 }), ctx());
    expect(r.status).toBe(403);
  });
  it("processar vídeo → 403", async () => {
    const { POST } = await import("@/app/api/app/midia/processar/route");
    const r = await POST(req("POST", { tipo: "video", caminho: "t1/video-x.mp4" }), ctx());
    expect(r.status).toBe(403);
  });
  it("gravar video_url num produto → 403 e não toca no banco", async () => {
    const { PATCH } = await import("@/app/api/app/produtos/[id]/route");
    const r = await PATCH(req("PATCH", { video_url: "https://x.supabase.co/v.mp4" }), ctx({ id: ID }));
    expect(r.status).toBe(403);
    expect(db.chamadas).toEqual([]);
  });
  it("criar produto já com vídeo → 403", async () => {
    const { POST } = await import("@/app/api/app/produtos/route");
    const r = await POST(req("POST", { nome: "X", preco: 10, video_url: "https://x.supabase.co/v.mp4" }), ctx());
    expect(r.status).toBe(403);
  });
  it("mudar cores → 403", async () => {
    const { PATCH } = await import("@/app/api/app/config/route");
    const r = await PATCH(req("PATCH", { cor_primaria: "#000000" }), ctx());
    expect(r.status).toBe(403);
  });
  it("ligar pedido pelo celular → 403", async () => {
    const { PATCH } = await import("@/app/api/app/config/route");
    const r = await PATCH(req("PATCH", { modo_atendimento: "chamar_pedir" }), ctx());
    expect(r.status).toBe(403);
  });
  it("inscrever push → 403", async () => {
    const { POST } = await import("@/app/api/app/push/route");
    const r = await POST(req("POST", { endpoint: "https://push.example.com/x", keys: { p256dh: "a", auth: "b" } }), ctx());
    expect(r.status).toBe(403);
  });
  it("passar de 10 mesas → 403", async () => {
    const { POST } = await import("@/app/api/app/mesas/route");
    const r = await POST(req("POST", { quantidade: 11 }), ctx());
    expect(r.status).toBe(403);
  });
});

describe("plano Profissional", () => {
  it("Reels liberado (upload de vídeo → 200)", async () => {
    plano = "profissional";
    const { POST } = await import("@/app/api/app/midia/upload-url/route");
    const r = await POST(req("POST", { tipo: "video", mime: "video/mp4", tamanho: 1000 }), ctx());
    expect(r.status).toBe(200);
  });
  it("“Combina com” → 403", async () => {
    plano = "profissional";
    const { PATCH } = await import("@/app/api/app/produtos/[id]/route");
    const r = await PATCH(req("PATCH", { combina_com: [ID] }), ctx({ id: ID }));
    expect(r.status).toBe(403);
  });
  it("avaliação no Google → 403", async () => {
    plano = "profissional";
    const { PATCH } = await import("@/app/api/app/config/route");
    const r = await PATCH(req("PATCH", { google_review_url: "https://g.page/r/abc" }), ctx());
    expect(r.status).toBe(403);
  });
});

describe("teste vencido e papéis", () => {
  it("Completo com teste vencido → 403 até no cardápio", async () => {
    plano = "completo";
    status = "teste";
    trial = "2000-01-01T00:00:00Z";
    const { POST } = await import("@/app/api/app/produtos/route");
    const r = await POST(req("POST", { nome: "X", preco: 10 }), ctx());
    expect(r.status).toBe(403);
  });
  it("garçom não edita cardápio → 403", async () => {
    plano = "completo";
    papel = "garcom";
    const { POST } = await import("@/app/api/app/produtos/route");
    const r = await POST(req("POST", { nome: "X", preco: 10 }), ctx());
    expect(r.status).toBe(403);
  });
  it("campo extra (mass assignment) → 400", async () => {
    plano = "completo";
    const { PATCH } = await import("@/app/api/app/config/route");
    const r = await PATCH(req("PATCH", { plano: "completo" }), ctx());
    expect(r.status).toBe(400);
  });
  it("requisição de outro site (CSRF) → 403", async () => {
    plano = "completo";
    const { POST } = await import("@/app/api/app/produtos/route");
    const r = await POST(
      new Request("https://app.test/api", { method: "POST", headers: { "content-type": "application/json", host: "app.test", origin: "https://malicioso.com" }, body: "{}" }),
      ctx(),
    );
    expect(r.status).toBe(403);
  });
});
