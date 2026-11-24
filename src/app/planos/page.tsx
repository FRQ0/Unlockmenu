// /planos: página de vendas dos planos (fora do menu, enviada por link).
// Ver preço aqui não libera nada: o acesso só existe quando o super-admin ativa o plano.
// Opcional: ?para=Nome do Restaurante e ?implantacao=R$ 300
import type { Metadata } from "next";
import { PaginaPlanos } from "@/components/vendas/PaginaPlanos";

export const metadata: Metadata = {
  title: "Planos · Unlock Menu",
  description: "Chamar garçom pelo celular, cardápio com vídeos dos pratos e painel em tempo real. Teste 7 dias grátis.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/icon.svg", apple: "/brand/apple-touch-icon.png" },
};
export const dynamic = "force-dynamic";

/** Aceita o texto mesmo que o link chegue codificado duas vezes (ex.: "Pizzaria%20do%20Z%C3%A9"). */
function limpar(v: string | undefined, max: number): string | null {
  let s = (v ?? "").replace(/\+/g, " ");
  for (let i = 0; i < 2 && /%[0-9a-f]{2}/i.test(s); i++) {
    try {
      s = decodeURIComponent(s);
    } catch {
      break;
    }
  }
  s = s.replace(/[<>"]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  return s || null;
}

export default async function Planos({ searchParams }: { searchParams: Promise<{ para?: string; implantacao?: string }> }) {
  const sp = await searchParams;
  return (
    <PaginaPlanos
      restaurante={limpar(sp.para, 60)}
      implantacao={limpar(sp.implantacao, 30)}
      whatsapp={(process.env.NEXT_PUBLIC_WHATSAPP_VENDAS ?? "").replace(/\D/g, "")}
    />
  );
}
