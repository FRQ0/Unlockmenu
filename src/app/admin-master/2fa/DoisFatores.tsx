"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";

export function DoisFatores({ factorId }: { factorId: string | null }) {
  const router = useRouter();
  const [fator, setFator] = useState(factorId);
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function post(body: unknown) {
    const r = await fetch("/api/admin/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Erro");
    return j;
  }

  async function cadastrar() {
    setErro(null);
    setCarregando(true);
    try {
      const j = await post({ acao: "cadastrar" });
      setFator(j.factorId);
      setQr({ qr: j.qr, secret: j.secret });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setCarregando(false);
    }
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await post({ acao: "verificar", factorId: fator, code });
      router.replace("/admin-master");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="card p-6">
      <ShieldCheck className="h-8 w-8 text-estado-verde" />
      <h1 className="mt-2 text-lg font-extrabold">Verificação em duas etapas</h1>
      {!fator ? (
        <>
          <p className="mt-1 text-sm text-grafite">O painel master exige um app autenticador (Google Authenticator, Authy, 1Password...).</p>
          <button onClick={cadastrar} disabled={carregando} className="btn-escuro mt-4 w-full">{carregando && <Loader2 className="h-4 w-4 animate-spin" />} Configurar agora</button>
        </>
      ) : (
        <form onSubmit={verificar} className="mt-3 space-y-3">
          {qr && (
            <div className="rounded-xl bg-papel p-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.qr} alt="QR code do 2FA" className="mx-auto h-44 w-44" />
              <p className="mt-2 break-all font-mono text-[11px] text-grafite">{qr.secret}</p>
            </div>
          )}
          <label className="rotulo" htmlFor="code">Código de 6 dígitos</label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" className="campo text-center text-2xl tracking-[.4em]" />
          <button disabled={carregando || code.length !== 6} className="btn-escuro w-full">{carregando && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar</button>
        </form>
      )}
      {erro && <p role="alert" className="mt-3 text-sm font-semibold text-estado-vermelho">{erro}</p>}
    </div>
  );
}
