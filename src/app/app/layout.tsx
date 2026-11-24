import type { Metadata, Viewport } from "next";
import { staffPage } from "@/lib/staff";
import { tenantAtivo, diasRestantesTeste, PLANO_NOME } from "@/lib/plans";
import { PainelNav } from "@/components/painel/PainelNav";
import { RegistrarSW } from "@/components/painel/RegistrarSW";

export const metadata: Metadata = {
  title: { default: "Painel · Unlock Menu", template: "%s · Unlock Menu" },
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/icon.svg", apple: "/brand/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Unlock Menu", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#17181C" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { tenant, membership, memberships } = await staffPage();
  const ativo = tenantAtivo(tenant);
  const dias = diasRestantesTeste(tenant);
  const whats = process.env.NEXT_PUBLIC_WHATSAPP_VENDAS;

  return (
    <div className="min-h-dvh lg:flex">
      <RegistrarSW />
      <PainelNav
        tenant={{ id: tenant.id, nome: tenant.nome, plano: tenant.plano, status: tenant.status, trial_ends_at: tenant.trial_ends_at }}
        papel={membership.papel}
        nome={membership.nome}
        outros={memberships.map((m) => ({ id: m.tenant_id, nome: m.tenant_nome }))}
      />
      <div className="min-w-0 flex-1">
        {ativo && dias !== null && (
          <div className="bg-areia/25 px-4 py-2 text-center text-sm font-semibold text-carvao">
            Teste grátis do plano {PLANO_NOME[tenant.plano]}: {dias === 0 ? "termina hoje" : `${dias} dia${dias > 1 ? "s" : ""} restante${dias > 1 ? "s" : ""}`}.
          </div>
        )}
        {ativo ? (
          children
        ) : (
          <main className="flex min-h-[70dvh] items-center justify-center p-6">
            <div className="card max-w-md p-8 text-center">
              <h1 className="font-serif text-4xl">{tenant.status === "suspenso" ? "Conta suspensa" : "Período de teste encerrado"}</h1>
              <p className="mt-3 text-grafite">Fale com a gente para continuar usando. Seus dados, mesas e cardápio continuam guardados.</p>
              {whats && (
                <a href={`https://wa.me/${whats}?text=${encodeURIComponent(`Olá! Quero continuar usando o Unlock Menu (${tenant.nome}).`)}`} target="_blank" rel="noopener noreferrer" className="btn-primario mt-6">
                  Falar no WhatsApp
                </a>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
