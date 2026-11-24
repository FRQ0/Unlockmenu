import { redirect } from "next/navigation";
import { estadoSuperAdmin } from "@/lib/superadmin";
import { serverClient } from "@/lib/supabase/server";
import { DoisFatores } from "./DoisFatores";
import { LogoMarca } from "@/components/ui/Marca";

export default async function Page() {
  const e = await estadoSuperAdmin();
  if (e.ok) redirect("/admin-master");
  if (e.motivo === "sem_login") redirect("/login?next=/admin-master");
  if (e.motivo === "nao_admin") redirect("/app");
  const supabase = await serverClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const fator = data?.totp?.[0];
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><LogoMarca /></div>
        <DoisFatores factorId={fator?.id ?? null} />
      </div>
    </main>
  );
}
