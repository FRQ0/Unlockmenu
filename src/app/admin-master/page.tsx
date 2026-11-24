import { superAdminPage } from "@/lib/superadmin";
import { adminClient } from "@/lib/supabase/admin";
import { AdminMaster } from "./AdminMaster";
import { LogoMarca } from "@/components/ui/Marca";
import type { Plano } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function AdminMasterPage() {
  await superAdminPage();
  const { data } = await adminClient()
    .from("tenants")
    .select("id,nome,slug,plano,status,trial_ends_at,pago_ate,dominio_custom,created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-8">
      <header className="flex items-center gap-3">
        <LogoMarca />
        <span className="selo bg-carvao text-papel">Master</span>
      </header>
      <AdminMaster
        tenants={(data ?? []) as {
          id: string; nome: string; slug: string; plano: Plano; status: "teste" | "ativo" | "suspenso";
          trial_ends_at: string | null; pago_ate: string | null; dominio_custom: string | null; created_at: string;
        }[]}
      />
    </main>
  );
}
