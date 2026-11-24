import type { Metadata } from "next";
import { PODE_GERIR, staffPage } from "@/lib/staff";
import { tenantHas } from "@/lib/plans";
import { PRODUTO_COLS, type Categoria, type Produto } from "@/lib/types";
import { AdminCardapio } from "@/components/painel/AdminCardapio";

export const metadata: Metadata = { title: "Cardápio" };

export default async function CardapioAdminPage() {
  const { supabase, tenant } = await staffPage(PODE_GERIR);
  const [{ data: categorias }, { data: produtos }] = await Promise.all([
    supabase.from("categories").select("id,tenant_id,nome,ordem,ativa").eq("tenant_id", tenant.id).order("ordem"),
    supabase.from("products").select(PRODUTO_COLS).eq("tenant_id", tenant.id).order("ordem"),
  ]);
  return (
    <AdminCardapio
      categoriasIniciais={(categorias ?? []) as Categoria[]}
      produtosIniciais={((produtos ?? []) as Produto[]).map((p) => ({ ...p, preco: Number(p.preco), preco_antigo: p.preco_antigo === null ? null : Number(p.preco_antigo) }))}
      recursos={{ reels: tenantHas(tenant, "reels"), combinaCom: tenantHas(tenant, "combina_com") }}
      linkCardapio={`/${tenant.slug}/cardapio`}
    />
  );
}
