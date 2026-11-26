"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BellRing, ChartColumn, ChefHat, LogOut, ScanLine, Ticket, Menu, QrCode, Settings, UtensilsCrossed, Users, X } from "lucide-react";
import { LogoMarca } from "@/components/ui/Marca";
import { PLANO_NOME, tenantHas, type TenantPlano } from "@/lib/plans";
import type { Papel } from "@/lib/types";

type Props = {
  tenant: TenantPlano & { id: string; nome: string };
  papel: Papel;
  nome: string;
  outros: { id: string; nome: string }[];
};

export function PainelNav({ tenant, papel, nome, outros }: Props) {
  const path = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const gere = papel === "dono" || papel === "gerente";

  const itens = [
    { href: "/app/garcom", nome: "Salão", icone: BellRing, mostra: papel !== "cozinha" || !tenantHas(tenant, "pedidos") },
    { href: "/app/cozinha", nome: "Cozinha", icone: ChefHat, mostra: tenantHas(tenant, "pedidos") && papel !== "garcom" },
    { href: "/app/caixa", nome: "Caixa e fichas", icone: Ticket, mostra: tenantHas(tenant, "fichas") && papel !== "cozinha" },
    { href: "/app/fichas", nome: "Validar fichas", icone: ScanLine, mostra: tenantHas(tenant, "fichas") },
    { href: "/app/dono", nome: "Painel do dono", icone: ChartColumn, mostra: gere && tenantHas(tenant, "painel_dono_basico") },
    { href: "/app/cardapio", nome: "Cardápio", icone: UtensilsCrossed, mostra: gere },
    { href: "/app/mesas", nome: "Mesas e QR", icone: QrCode, mostra: gere },
    { href: "/app/equipe", nome: "Equipe", icone: Users, mostra: papel === "dono" },
    { href: "/app/config", nome: "Estabelecimento", icone: Settings, mostra: gere },
  ].filter((i) => i.mostra);

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  async function trocar(id: string) {
    await fetch("/api/app/tenant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenant_id: id }) });
    router.refresh();
  }

  const conteudo = (
    <>
      <div className="px-5 py-5"><LogoMarca escuro size={28} /></div>
      <div className="mx-3 rounded-2xl bg-white/5 p-3">
        <p className="truncate text-sm font-bold text-papel">{tenant.nome}</p>
        <p className="text-xs text-papel/60">Plano {PLANO_NOME[tenant.plano]}{tenant.status === "teste" ? " · teste" : ""}</p>
        {outros.length > 1 && (
          <select
            aria-label="Trocar estabelecimento"
            value={tenant.id}
            onChange={(e) => trocar(e.target.value)}
            className="mt-2 w-full rounded-lg bg-white/10 px-2 py-1.5 text-xs text-papel"
          >
            {outros.map((o) => <option key={o.id} value={o.id} className="text-carvao">{o.nome}</option>)}
          </select>
        )}
      </div>
      <nav className="mt-4 flex-1 space-y-1 px-3">
        {itens.map((i) => {
          const on = path.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setAberto(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${on ? "bg-areia text-carvao" : "text-papel/75 hover:bg-white/5 hover:text-papel"}`}
            >
              <i.icone className="h-4 w-4" /> {i.nome}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-semibold text-papel">{nome}</p>
        <p className="text-xs capitalize text-papel/60">{papel}</p>
        <button onClick={sair} className="mt-3 flex items-center gap-2 text-xs font-semibold text-papel/70 hover:text-papel">
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>
    </>
  );

  return (
    <>
      <header className="pt-seguro sticky top-0 z-30 flex items-center justify-between bg-carvao px-4 pb-3 lg:hidden">
        <LogoMarca escuro size={24} />
        <button onClick={() => setAberto(true)} className="rounded-lg p-2 text-papel" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
      </header>
      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setAberto(false)} aria-label="Fechar menu" />
          <aside className="pt-seguro pb-seguro relative flex h-full w-72 flex-col rolagem bg-carvao">
            <button onClick={() => setAberto(false)} className="absolute right-3 top-4 p-2 text-papel" aria-label="Fechar"><X className="h-5 w-5" /></button>
            {conteudo}
          </aside>
        </div>
      )}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-carvao lg:flex">{conteudo}</aside>
    </>
  );
}
