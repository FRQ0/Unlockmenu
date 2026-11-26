// Página que o cliente vê depois de pagar pelo link (sem a marca do SaaS).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { tenantPublico } from "@/lib/public-data";
import { LogoTenant, TenantTema } from "@/components/cliente/TenantTema";

export const metadata: Metadata = { title: "Pagamento recebido", robots: { index: false } };

export default async function Pago({ params }: { params: Promise<{ slug: string }> }) {
  const t = await tenantPublico((await params).slug);
  if (!t) notFound();
  return (
    <TenantTema tenant={t}>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <LogoTenant tenant={t} size={72} />
        <CheckCircle2 className="mt-6 h-14 w-14 text-estado-verde" />
        <h1 className="mt-3 text-2xl font-extrabold">Pagamento recebido!</h1>
        <p className="mt-2 text-grafite">Obrigado pela visita ao {t.nome}.</p>
      </main>
    </TenantTema>
  );
}
