"use client";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void };
  }
}

export function LoginForm({ nonce, next, siteKey }: { nonce?: string; next?: string; siteKey: string }) {
  const router = useRouter();
  const [aba, setAba] = useState<"email" | "pin">("email");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [token, setToken] = useState<string>("");
  const caixa = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  function renderTurnstile() {
    if (!siteKey || !caixa.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(caixa.current, { sitekey: siteKey, callback: (t: string) => setToken(t), "expired-callback": () => setToken("") });
  }
  useEffect(renderTurnstile);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const f = new FormData(e.currentTarget);
    const body =
      aba === "email"
        ? { email: f.get("email"), senha: f.get("senha"), site: f.get("site") || undefined, next, turnstile: token || undefined }
        : { slug: f.get("slug"), pin: f.get("pin"), turnstile: token || undefined };
    try {
      const r = await fetch(aba === "email" ? "/api/auth/login" : "/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível entrar.");
      router.replace(j.next || "/app");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
      if (widget.current) window.turnstile?.reset(widget.current);
      setToken("");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="card p-6">
      {siteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" nonce={nonce} onLoad={renderTurnstile} />}
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-papel p-1 text-sm font-semibold">
        {(["email", "pin"] as const).map((a) => (
          <button key={a} type="button" onClick={() => setAba(a)} className={`rounded-lg py-2 ${aba === a ? "bg-white shadow-suave" : "text-grafite"}`}>
            {a === "email" ? "E-mail e senha" : "PIN do salão"}
          </button>
        ))}
      </div>
      <form onSubmit={enviar} className="space-y-4" autoComplete="on">
        {aba === "email" ? (
          <>
            <div>
              <label className="rotulo" htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" required maxLength={120} autoComplete="username" className="campo" />
            </div>
            <div>
              <label className="rotulo" htmlFor="senha">Senha</label>
              <input id="senha" name="senha" type="password" required maxLength={72} autoComplete="current-password" className="campo" />
            </div>
            {/* honeypot: invisível para pessoas */}
            <input name="site" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          </>
        ) : (
          <>
            <div>
              <label className="rotulo" htmlFor="slug">Código do estabelecimento</label>
              <input id="slug" name="slug" required pattern="[a-z0-9-]{3,40}" placeholder="ex.: pizzaria-forno" className="campo" autoCapitalize="none" />
            </div>
            <div>
              <label className="rotulo" htmlFor="pin">PIN</label>
              <input id="pin" name="pin" required inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} autoComplete="off" className="campo text-center text-2xl tracking-[.5em]" />
            </div>
          </>
        )}
        <div ref={caixa} />
        {erro && <p role="alert" className="text-sm font-semibold text-estado-vermelho">{erro}</p>}
        <button disabled={carregando || (!!siteKey && !token)} className="btn-escuro w-full py-3">
          {carregando && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
        </button>
      </form>
    </div>
  );
}
