import { redirect } from "next/navigation";
import { staffPage } from "@/lib/staff";
import { tenantHas } from "@/lib/plans";

export default async function AppHome() {
  const { membership, tenant } = await staffPage();
  if (membership.papel === "dono" || membership.papel === "gerente") {
    redirect(tenantHas(tenant, "painel_dono_basico") ? "/app/dono" : "/app/garcom");
  }
  redirect("/app/garcom");
}
