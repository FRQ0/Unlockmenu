// Super-admin (dono do SaaS). Exige: login + estar em platform_admins + 2FA (aal2).
import "server-only";
import { redirect } from "next/navigation";
import { serverClient } from "./supabase/server";
import { adminClient } from "./supabase/admin";
import { HttpError } from "./http";

export type SuperAdminEstado =
  | { ok: true; userId: string }
  | { ok: false; motivo: "sem_login" | "nao_admin" | "precisa_cadastrar_2fa" | "precisa_codigo_2fa" };

export async function estadoSuperAdmin(): Promise<SuperAdminEstado> {
  const supabase = await serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "sem_login" };

  const { data: admin } = await adminClient().from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return { ok: false, motivo: "nao_admin" };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") return { ok: true, userId: user.id };
  return { ok: false, motivo: aal?.nextLevel === "aal2" ? "precisa_codigo_2fa" : "precisa_cadastrar_2fa" };
}

export async function requireSuperAdmin(): Promise<string> {
  const e = await estadoSuperAdmin();
  if (!e.ok) throw new HttpError(e.motivo === "sem_login" ? 401 : 403, "Acesso restrito.");
  return e.userId;
}

export async function superAdminPage(): Promise<string> {
  const e = await estadoSuperAdmin();
  if (e.ok) return e.userId;
  if (e.motivo === "sem_login") redirect("/login?next=/admin-master");
  if (e.motivo === "nao_admin") redirect("/app");
  redirect("/admin-master/2fa");
}

export async function auditar(actor: string, acao: string, tenantId: string | null, detalhes: Record<string, unknown> = {}) {
  await adminClient().from("audit_log").insert({ actor, acao, tenant_id: tenantId, detalhes });
}
