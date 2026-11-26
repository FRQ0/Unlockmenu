import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { staffPage } from "@/lib/staff";
import { tenantHas } from "@/lib/plans";
import { ValidarFichas } from "@/components/painel/ValidarFichas";

export const metadata: Metadata = { title: "Validar fichas" };

export default async function FichasPage() {
  const { tenant } = await staffPage();
  if (!tenantHas(tenant, "fichas")) redirect("/app/garcom");
  return <ValidarFichas />;
}
