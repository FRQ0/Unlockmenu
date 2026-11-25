import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { staffPage } from "@/lib/staff";
import { tenantHas } from "@/lib/plans";
import { pedidosAtivos } from "@/lib/pedidos";
import { PainelCozinha } from "@/components/painel/PainelCozinha";

export const metadata: Metadata = { title: "Cozinha" };

export default async function CozinhaPage() {
  const { supabase, tenant } = await staffPage();
  if (!tenantHas(tenant, "pedidos")) redirect("/app/garcom");
  return <PainelCozinha tenantId={tenant.id} nomeEstabelecimento={tenant.nome} inicial={await pedidosAtivos(supabase, tenant.id)} />;
}
