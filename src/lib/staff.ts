// Autenticação da equipe SEMPRE no servidor: getUser() valida o token no Supabase
// (não confia só no cookie). Papel e estabelecimento vêm do banco, nunca do cliente.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { serverClient } from "./supabase/server";
import { HttpError } from "./http";
import { TENANT_COLS, type Membership, type Papel, type Tenant } from "./types";

export const TENANT_COOKIE = "um_tenant";

export type StaffCtx = {
  supabase: Awaited<ReturnType<typeof serverClient>>;
  user: User;
  membership: Membership;
  memberships: (Membership & { tenant_nome: string })[];
  tenant: Tenant;
};

async function loadStaff(): Promise<StaffCtx | null> {
  const supabase = await serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ms } = await supabase
    .from("memberships")
    .select("id,tenant_id,user_id,papel,nome,setores,ativo,tenants(nome)")
    .eq("user_id", user.id)
    .eq("ativo", true);
  if (!ms?.length) return null;

  const store = await cookies();
  const escolhido = store.get(TENANT_COOKIE)?.value;
  const lista = ms.map((m) => {
    const { tenants, ...rest } = m as unknown as Membership & { tenants: { nome: string } | null };
    return { ...rest, tenant_nome: tenants?.nome ?? "" };
  });
  const membership = lista.find((m) => m.tenant_id === escolhido) ?? lista[0];

  const { data: tenant } = await supabase.from("tenants").select(TENANT_COLS).eq("id", membership.tenant_id).single();
  if (!tenant) return null;
  return { supabase, user, membership, memberships: lista, tenant: tenant as Tenant };
}

/** Para route handlers: 401/403 em vez de redirecionar. */
export async function requireStaff(papeis?: Papel[]): Promise<StaffCtx> {
  const ctx = await loadStaff();
  if (!ctx) throw new HttpError(401, "Faça login.");
  if (papeis && !papeis.includes(ctx.membership.papel)) throw new HttpError(403, "Sem permissão.");
  return ctx;
}

/** Para páginas: manda para o login se não tiver sessão. */
export async function staffPage(papeis?: Papel[]): Promise<StaffCtx> {
  const ctx = await loadStaff();
  if (!ctx) redirect("/login");
  if (papeis && !papeis.includes(ctx.membership.papel)) redirect("/app");
  return ctx;
}

export const PODE_GERIR: Papel[] = ["dono", "gerente"];
export const PODE_ATENDER: Papel[] = ["dono", "gerente", "garcom"];
