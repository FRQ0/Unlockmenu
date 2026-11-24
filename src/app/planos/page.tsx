// /planos: fora do menu, aberta só por link, para o dono escolher o plano na apresentação.
// Ver preço aqui não libera nada: o acesso só existe quando o super-admin ativa o plano.
// Use ?para=Nome%20do%20Restaurante para personalizar e ?implantacao=R$%20300 para o valor da implantação.
import type { Metadata } from "next";
import { TabelaPlanos } from "@/components/vendas/TabelaPlanos";
import { PLANOS, type Plano } from "@/lib/plans";

export const metadata: Metadata = { title: "Planos · Unlock Menu", robots: { index: false, follow: false }, icons: { icon: "/brand/icon.svg" } };
export const dynamic = "force-dynamic";

export default async function Planos({ searchParams }: { searchParams: Promise<{ para?: string; plano?: string; implantacao?: string }> }) {
  const sp = await searchParams;
  const limpar = (s: string | undefined, max: number) => (s ?? "").replace(/[<>]/g, "").trim().slice(0, max) || null;
  const plano = (PLANOS as readonly string[]).includes(sp.plano ?? "") ? (sp.plano as Plano) : "completo";
  return (
    <TabelaPlanos
      restaurante={limpar(sp.para, 60)}
      implantacao={limpar(sp.implantacao, 30)}
      inicial={plano}
      whatsapp={process.env.NEXT_PUBLIC_WHATSAPP_VENDAS ?? ""}
    />
  );
}
