"use client";
// O app InfinitePay volta para cá depois da aproximação do cartão.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { api } from "@/components/painel/api";

export function RetornoTap({ orderId, nsu, aut, bandeira, aviso }: { orderId: string; nsu: string; aut: string; bandeira: string; aviso: string }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const valido = /^[0-9a-f-]{36}$/.test(orderId) && nsu.length >= 4 && !aviso;

  function volta(origem?: string) {
    let destino = origem === "fichas" ? "/app/caixa" : "/app/garcom";
    try {
      const v = JSON.parse(sessionStorage.getItem("tap_volta") ?? "null") as { id: string; volta: string } | null;
      if (v?.id === orderId && v.volta?.startsWith("/app/")) destino = v.volta;
      sessionStorage.removeItem("tap_volta");
    } catch {}
    return origem === "fichas" ? `${destino}?cobranca=${orderId}` : destino;
  }

  async function confirmar() {
    setErro(null);
    setSalvando(true);
    try {
      const r = await api<{ status: string; origem: string }>(`/api/app/cobrancas/${orderId}/tap`, "POST", { nsu, ...(aut ? { aut } : {}), ...(bandeira ? { card_brand: bandeira } : {}) });
      router.replace(volta(r.origem));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
      setSalvando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md items-center p-4">
      <div className="card w-full p-6 text-center">
        {valido ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-estado-verde" />
            <h1 className="mt-2 text-xl font-extrabold">O InfinitePay retornou o pagamento</h1>
            <p className="mt-2 text-sm text-grafite">
              {bandeira ? `Cartão ${bandeira}` : "Cartão"}{aut ? ` · autorização ${aut}` : ""}<br />NSU {nsu}
            </p>
            <p className="mt-3 text-sm">Confira no app InfinitePay se aparece <strong>Aprovado</strong> e confirme:</p>
            {erro && <p role="alert" className="mt-3 text-sm font-semibold text-estado-vermelho">{erro}</p>}
            <button onClick={confirmar} disabled={salvando} className="btn-escuro mt-5 w-full py-3.5 text-base">
              {salvando && <Loader2 className="h-5 w-5 animate-spin" />} Pagamento aprovado
            </button>
            <button onClick={() => router.replace(volta())} className="btn mt-2 w-full text-grafite">Não aprovou, voltar</button>
          </>
        ) : (
          <>
            <TriangleAlert className="mx-auto h-12 w-12 text-estado-laranja" />
            <h1 className="mt-2 text-xl font-extrabold">Pagamento não concluído</h1>
            <p className="mt-2 text-sm text-grafite">{aviso || "O InfinitePay não devolveu a confirmação."} Tente cobrar de novo.</p>
            <button onClick={() => router.replace(volta())} className="btn-escuro mt-5 w-full py-3">Voltar</button>
          </>
        )}
      </div>
    </main>
  );
}
