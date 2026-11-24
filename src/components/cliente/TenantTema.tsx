import type { CSSProperties } from "react";
import { temaVars } from "@/lib/color";
import type { TenantPublico } from "@/lib/public-data";

/** Pinta a interface do cliente com as cores do estabelecimento. */
export function TenantTema({ tenant, children, className = "" }: { tenant: TenantPublico; children: React.ReactNode; className?: string }) {
  return (
    <div style={temaVars(tenant.cor_primaria, tenant.cor_secundaria) as CSSProperties} className={className}>
      {children}
    </div>
  );
}

export function LogoTenant({ tenant, size = 64 }: { tenant: Pick<TenantPublico, "nome" | "logo_url">; size?: number }) {
  if (tenant.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={tenant.logo_url} alt={tenant.nome} width={size} height={size} className="rounded-full object-cover ring-4 ring-white shadow-suave" style={{ width: size, height: size }} />;
  }
  return (
    <div
      aria-hidden
      className="flex items-center justify-center rounded-full bg-marca font-bold text-marca-texto ring-4 ring-white shadow-suave"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {tenant.nome.trim().charAt(0).toUpperCase()}
    </div>
  );
}

export function IconeInstagram({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function Indisponivel({ nome }: { nome?: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="card w-full p-8">
        {nome && <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-grafite">{nome}</p>}
        <h1 className="text-xl font-bold">Cardápio indisponível no momento</h1>
        <p className="mt-2 text-sm text-grafite">Por favor, chame alguém da equipe.</p>
      </div>
    </main>
  );
}
