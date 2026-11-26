import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PODE_ATENDER, staffPage } from "@/lib/staff";
import { tenantHas } from "@/lib/plans";
import { resumoCaixa } from "@/lib/caixa";
import { CaixaFichas } from "@/components/painel/CaixaFichas";

export const metadata: Metadata = { title: "Caixa e fichas" };

export default async function CaixaPage() {
  const { supabase, tenant, membership } = await staffPage(PODE_ATENDER);
  if (!tenantHas(tenant, "fichas")) redirect("/app/garcom");
  const [{ data: cats }, { data: prods }, resumo] = await Promise.all([
    supabase.from("categories").select("id,nome").eq("tenant_id", tenant.id).eq("ativa", true).order("ordem"),
    supabase.from("products").select("id,nome,preco,categoria_id,disponivel").eq("tenant_id", tenant.id).order("ordem"),
    resumoCaixa(supabase, tenant.id),
  ]);
  return (
    <CaixaFichas
      nomeEstabelecimento={tenant.nome}
      categorias={cats ?? []}
      produtos={(prods ?? []).map((p) => ({ ...p, preco: Number(p.preco) }))}
      pix={tenant.pix_chave ? { chave: tenant.pix_chave, nome: tenant.pix_nome ?? tenant.nome, cidade: tenant.pix_cidade ?? "BRASIL" } : null}
      resumoInicial={resumo}
      podeCancelar={membership.papel === "dono" || membership.papel === "gerente"}
    />
  );
}
