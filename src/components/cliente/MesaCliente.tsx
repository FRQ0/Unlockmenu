"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BookOpen, Receipt, Footprints, Check, Star, Loader2 } from "lucide-react";
import { IconeInstagram, LogoTenant } from "./TenantTema";

type Estado =
  | { fase: "livre" }
  | { fase: "enviando"; tipo: "garcom" | "conta" }
  | { fase: "aberto"; id: string; tipo: "garcom" | "conta" }
  | { fase: "a_caminho"; id: string; tipo: "garcom" | "conta"; garcom: string | null }
  | { fase: "atendido"; tipo: "garcom" | "conta" };

type Props = {
  tenant: { nome: string; slug: string; logo_url: string | null; instagram: string | null; google_review_url: string | null };
  mesa: { nome: string; token: string };
};

const chave = (token: string) => `chamado:${token}`;
function lerSalvo(token: string): { id: string; tipo: "garcom" | "conta" } | null {
  try {
    const v = sessionStorage.getItem(chave(token));
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function salvar(token: string, v: { id: string; tipo: string } | null) {
  try {
    if (v) sessionStorage.setItem(chave(token), JSON.stringify(v));
    else sessionStorage.removeItem(chave(token));
  } catch {}
}

export function MesaCliente({ tenant, mesa }: Props) {
  const [estado, setEstado] = useState<Estado>({ fase: "livre" });
  const [erro, setErro] = useState<string | null>(null);
  const [avaliar, setAvaliar] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const consultar = useCallback(
    async (id: string, tipo: "garcom" | "conta") => {
      try {
        const r = await fetch(`/api/public/chamado?token=${mesa.token}&id=${id}`, { cache: "no-store" });
        if (r.status === 404) {
          salvar(mesa.token, null);
          setEstado({ fase: "livre" });
          return;
        }
        if (!r.ok) return;
        const s = (await r.json()) as { status: string; garcom: string | null };
        if (s.status === "aberto") setEstado({ fase: "aberto", id, tipo });
        else if (s.status === "a_caminho") setEstado({ fase: "a_caminho", id, tipo, garcom: s.garcom });
        else {
          salvar(mesa.token, null);
          if (s.status === "atendido") {
            setEstado({ fase: "atendido", tipo });
            if (tipo === "conta" && tenant.google_review_url) setAvaliar(true);
            timer.current = setTimeout(() => setEstado({ fase: "livre" }), 6000);
          } else setEstado({ fase: "livre" });
        }
      } catch {
        /* rede instável: tenta de novo no próximo ciclo */
      }
    },
    [mesa.token, tenant.google_review_url],
  );

  // retoma um chamado aberto (recarregou a página)
  useEffect(() => {
    const s = lerSalvo(mesa.token);
    if (s) {
      setEstado({ fase: "aberto", id: s.id, tipo: s.tipo });
      consultar(s.id, s.tipo);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [mesa.token, consultar]);

  // acompanha o chamado a cada 3 s (pausa com a tela apagada)
  useEffect(() => {
    if (estado.fase !== "aberto" && estado.fase !== "a_caminho") return;
    const { id, tipo } = estado;
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") consultar(id, tipo);
    }, 3000);
    const vis = () => document.visibilityState === "visible" && consultar(id, tipo);
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [estado, consultar]);

  async function chamar(tipo: "garcom" | "conta") {
    setErro(null);
    setEstado({ fase: "enviando", tipo });
    try {
      const r = await fetch("/api/public/chamado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: tenant.slug, token: mesa.token, tipo }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível chamar agora.");
      salvar(mesa.token, { id: j.id, tipo: j.tipo });
      if ("vibrate" in navigator) navigator.vibrate?.(60);
      setEstado(j.status === "a_caminho" ? { fase: "a_caminho", id: j.id, tipo: j.tipo, garcom: null } : { fase: "aberto", id: j.id, tipo: j.tipo });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível chamar agora.");
      setEstado({ fase: "livre" });
    }
  }

  async function cancelar() {
    if (estado.fase !== "aberto" && estado.fase !== "a_caminho") return;
    const id = estado.id;
    setEstado({ fase: "livre" });
    salvar(mesa.token, null);
    await fetch("/api/public/chamado", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: mesa.token, id }),
    }).catch(() => {});
  }

  const ocupado = estado.fase !== "livre" && estado.fase !== "atendido";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <header className="flex flex-col items-center text-center">
        <LogoTenant tenant={tenant} size={76} />
        <h1 className="mt-3 text-lg font-extrabold tracking-tight">{tenant.nome}</h1>
        <div className="mt-2 flex items-center gap-2">
          <span className="selo bg-white text-carvao shadow-suave">{mesa.nome}</span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-estado-verde">
            <span className="h-2 w-2 rounded-full bg-estado-verde" /> Presença confirmada
          </span>
        </div>
      </header>

      <section className="mt-8 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight">Como podemos ajudar?</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-grafite">Toque no botão abaixo para chamar nosso time diretamente até sua mesa.</p>
      </section>

      <section className="mt-6" aria-live="polite">
        {estado.fase === "aberto" || estado.fase === "a_caminho" ? (
          <div className="card overflow-hidden">
            <div className={`px-5 py-6 text-center ${estado.fase === "a_caminho" ? "bg-estado-verde text-white" : "bg-marca text-marca-texto"}`}>
              <p className="text-[11px] font-bold uppercase tracking-[.16em] opacity-80">
                {estado.fase === "a_caminho" ? "A caminho" : "Aguardando atendimento"}
              </p>
              <div className="mt-2 flex items-center justify-center gap-2 text-xl font-extrabold">
                {estado.fase === "a_caminho" ? <Footprints className="h-6 w-6" /> : <Bell className="h-6 w-6 animate-bounce" />}
                {estado.fase === "a_caminho"
                  ? `${estado.garcom ?? "Alguém da equipe"} está a caminho`
                  : estado.tipo === "conta"
                    ? "Conta solicitada!"
                    : "Garçom chamado!"}
              </div>
            </div>
            <div className="p-5 text-center">
              <p className="text-sm text-grafite">
                {estado.fase === "a_caminho"
                  ? "Só um instante, já estamos indo até a sua mesa."
                  : "Já notificamos a equipe. Assim que alguém estiver a caminho, avisamos aqui."}
              </p>
              <button onClick={cancelar} className="btn-secundario mt-4 w-full">Cancelar chamado</button>
            </div>
          </div>
        ) : estado.fase === "atendido" ? (
          <div className="card p-6 text-center">
            <Check className="mx-auto h-8 w-8 text-estado-verde" />
            <p className="mt-2 font-bold">Atendimento concluído</p>
            <p className="text-sm text-grafite">Se precisar de algo, é só chamar de novo.</p>
          </div>
        ) : (
          <button
            onClick={() => chamar("garcom")}
            disabled={ocupado}
            className="group relative flex w-full flex-col items-center justify-center rounded-[22px] bg-marca px-6 py-8 text-marca-texto shadow-suave transition active:scale-[.98]"
          >
            <span className="text-[10px] font-bold uppercase tracking-[.2em] opacity-75">Ação principal</span>
            <span className="mt-2 flex items-center gap-3 text-2xl font-extrabold">
              {estado.fase === "enviando" && estado.tipo === "garcom" ? <Loader2 className="h-7 w-7 animate-spin" /> : <Bell className="h-7 w-7" />}
              Chamar garçom
            </span>
          </button>
        )}
        {erro && <p role="alert" className="mt-3 text-center text-sm font-semibold text-estado-vermelho">{erro}</p>}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link href={`/${tenant.slug}/m/${mesa.token}/cardapio`} className="card flex flex-col items-start gap-3 p-4 transition active:scale-[.98]">
          <span className="rounded-xl bg-marca/15 p-2 text-carvao"><BookOpen className="h-5 w-5" /></span>
          <span className="text-sm font-bold">Ver cardápio</span>
        </Link>
        <button
          onClick={() => chamar("conta")}
          disabled={ocupado}
          className="card flex flex-col items-start gap-3 p-4 text-left transition active:scale-[.98] disabled:opacity-50"
        >
          <span className="rounded-xl bg-marca/15 p-2 text-carvao">
            {estado.fase === "enviando" && estado.tipo === "conta" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Receipt className="h-5 w-5" />}
          </span>
          <span className="text-sm font-bold">Pedir a conta</span>
        </button>
      </section>

      {avaliar && tenant.google_review_url && (
        <section className="card mt-4 p-5 text-center">
          <div className="flex justify-center gap-1 text-marca">{[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-5 w-5 fill-current" />)}</div>
          <p className="mt-2 font-bold">Gostou? Avalie a gente no Google</p>
          <p className="text-sm text-grafite">Leva menos de 1 minuto e ajuda muito.</p>
          <a
            href={tenant.google_review_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              fetch("/api/public/evento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: tenant.slug, token: mesa.token, tipo: "click_avaliacao" }) }).catch(() => {});
            }}
            className="btn mt-3 w-full bg-marca text-marca-texto"
          >
            Avaliar no Google
          </a>
          <button onClick={() => setAvaliar(false)} className="mt-2 text-xs font-semibold text-grafite">Agora não</button>
        </section>
      )}

      <footer className="mt-auto pt-10 text-center">
        {tenant.instagram && (
          <a href={`https://instagram.com/${tenant.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-grafite">
            <IconeInstagram /> @{tenant.instagram}
          </a>
        )}
      </footer>
    </main>
  );
}
