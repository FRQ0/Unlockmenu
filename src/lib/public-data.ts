// Dados das telas do cliente final. Lidos no servidor e "aparados": só vai para o
// navegador o que a tela precisa, e recursos fora do plano já saem removidos aqui.
import "server-only";
import { cache } from "react";
import { adminClient } from "./supabase/admin";
import { tenantAtivo, tenantHas, type TenantPlano } from "./plans";
import type { Plano } from "./plans";

export type TenantPublico = {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  capa_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  instagram: string | null;
  whatsapp: string | null;
  endereco: string | null;
  horarios: string | null;
  google_review_url: string | null;
  ativo: boolean;
  recursos: { reels: boolean; combinaCom: boolean; avaliacao: boolean; pedidos: boolean };
};

export type ProdutoPublico = {
  id: string;
  categoria_id: string | null;
  nome: string;
  descricao: string | null;
  preco: number;
  preco_antigo: number | null;
  foto_url: string | null;
  video_url: string | null;
  poster_url: string | null;
  destaque: boolean;
  disponivel: boolean;
  tags: string[];
  combina_com: string[];
};

export type CategoriaPublica = { id: string; nome: string };
export type MesaPublica = { id: string; nome: string; token: string };

type TenantRow = TenantPlano & Omit<TenantPublico, "ativo" | "recursos"> & { modo_atendimento: string; plano: Plano };

export const tenantPublico = cache(async (slug: string): Promise<TenantPublico | null> => {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const { data } = await adminClient()
    .from("tenants")
    .select("id,nome,slug,logo_url,capa_url,cor_primaria,cor_secundaria,instagram,whatsapp,endereco,horarios,google_review_url,modo_atendimento,plano,status,trial_ends_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const t = data as TenantRow;
  const cores = tenantHas(t, "cores");
  const avaliacao = tenantHas(t, "avaliacao_google");
  return {
    id: t.id,
    nome: t.nome,
    slug: t.slug,
    logo_url: t.logo_url,
    capa_url: t.capa_url,
    cor_primaria: cores ? t.cor_primaria : null,
    cor_secundaria: cores ? t.cor_secundaria : null,
    instagram: t.instagram,
    whatsapp: t.whatsapp,
    endereco: t.endereco,
    horarios: t.horarios,
    google_review_url: avaliacao ? t.google_review_url : null,
    ativo: tenantAtivo(t),
    recursos: {
      reels: tenantHas(t, "reels"),
      combinaCom: tenantHas(t, "combina_com"),
      avaliacao: avaliacao && !!t.google_review_url,
      pedidos: tenantHas(t, "pedidos") && t.modo_atendimento === "chamar_pedir",
    },
  };
});

export const mesaPublica = cache(async (tenantId: string, token: string): Promise<MesaPublica | null> => {
  if (!/^[a-f0-9]{16,64}$/.test(token)) return null;
  const { data } = await adminClient()
    .from("tables")
    .select("id,nome,token_publico")
    .eq("tenant_id", tenantId)
    .eq("token_publico", token)
    .eq("ativa", true)
    .maybeSingle();
  return data ? { id: data.id, nome: data.nome, token: data.token_publico } : null;
});

export const cardapioPublico = cache(async (t: TenantPublico) => {
  const db = adminClient();
  const [{ data: cats }, { data: prods }] = await Promise.all([
    db.from("categories").select("id,nome").eq("tenant_id", t.id).eq("ativa", true).order("ordem").order("nome"),
    db
      .from("products")
      .select("id,categoria_id,nome,descricao,preco,preco_antigo,foto_url,video_url,poster_url,destaque,disponivel,tags,combina_com,ordem")
      .eq("tenant_id", t.id)
      .order("ordem")
      .order("nome"),
  ]);
  const categorias: CategoriaPublica[] = cats ?? [];
  const ativas = new Set(categorias.map((c) => c.id));
  const produtos: ProdutoPublico[] = (prods ?? [])
    .filter((p) => !p.categoria_id || ativas.has(p.categoria_id))
    .map((p) => ({
      id: p.id,
      categoria_id: p.categoria_id,
      nome: p.nome,
      descricao: p.descricao,
      preco: Number(p.preco),
      preco_antigo: p.preco_antigo === null ? null : Number(p.preco_antigo),
      foto_url: p.foto_url,
      video_url: t.recursos.reels ? p.video_url : null,
      poster_url: p.poster_url,
      destaque: p.destaque,
      disponivel: p.disponivel,
      tags: p.tags ?? [],
      combina_com: t.recursos.combinaCom ? (p.combina_com ?? []) : [],
    }));
  return { categorias, produtos };
});

export async function registrarEvento(tenantId: string, tipo: string, extra: { table_id?: string | null; product_id?: string | null } = {}) {
  await adminClient().from("events").insert({ tenant_id: tenantId, tipo, table_id: extra.table_id ?? null, product_id: extra.product_id ?? null });
}

export async function registrarPresenca(token: string) {
  await adminClient().rpc("registrar_presenca", { p_token: token });
}
