"use client";
import { useEffect, useState } from "react";
import { Bell, Footprints, Receipt } from "lucide-react";
import { cronometro } from "@/lib/format";

type C = { id: string; tipo: "garcom" | "conta"; status: string; criado_em: string; mesa: string };

/** Painel de garçom demo: chame no celular e veja aparecer aqui. */
export function DemoPainel() {
  const [lista, setLista] = useState<C[]>([]);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    let vivo = true;
    const buscar = () =>
      fetch("/api/demo/painel", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => vivo && setLista(j.chamados ?? []))
        .catch(() => {});
    buscar();
    const a = setInterval(() => document.visibilityState === "visible" && buscar(), 2000);
    const b = setInterval(() => setAgora(Date.now()), 1000);
    return () => {
      vivo = false;
      clearInterval(a);
      clearInterval(b);
    };
  }, []);
  return (
    <div className="rounded-[22px] bg-carvao p-4 text-papel shadow-2xl">
      <div className="flex items-center gap-2 text-sm font-bold">
        <span className="h-2 w-2 animate-pulse rounded-full bg-estado-verde" /> Painel do garçom · ao vivo
      </div>
      <ul className="mt-3 min-h-[180px] space-y-2">
        {lista.length === 0 && <li className="rounded-xl border border-white/10 p-6 text-center text-sm text-papel/60">Toque em “Chamar garçom” no seu celular.</li>}
        {lista.map((c) => (
          <li key={c.id} className={`flex items-center gap-3 rounded-xl p-3 ${c.status === "a_caminho" ? "bg-estado-verde" : c.tipo === "conta" ? "bg-estado-azul" : "bg-estado-laranja"}`}>
            {c.status === "a_caminho" ? <Footprints className="h-5 w-5" /> : c.tipo === "conta" ? <Receipt className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            <div className="flex-1">
              <p className="font-extrabold">{c.mesa}</p>
              <p className="text-xs opacity-90">{c.status === "a_caminho" ? "Garçom a caminho" : c.tipo === "conta" ? "Pediu a conta" : "Chamando garçom"}</p>
            </div>
            <span className="font-mono font-bold tabular-nums">{cronometro(c.criado_em, agora)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
