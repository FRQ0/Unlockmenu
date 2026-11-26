import type { Metadata } from "next";
import { RetornoTap } from "./RetornoTap";

export const metadata: Metadata = { title: "Pagamento" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const limpo = (v: string | undefined, max = 80) => (v ?? "").replace(/[^A-Za-z0-9 ._:/-]/g, "").slice(0, max);
  return (
    <RetornoTap
      orderId={limpo(q.order_id, 36)}
      nsu={limpo(q.nsu)}
      aut={limpo(q.aut, 40)}
      bandeira={limpo(q.card_brand, 30)}
      aviso={limpo(q.warning, 120)}
    />
  );
}
