// Dono cadastra funcionário (garçom, gerente, cozinha) com senha inicial.
import { fromDbError, HttpError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { funcionarioCriar } from "@/lib/schemas";
import { adminClient } from "@/lib/supabase/admin";
import { requireFeature, tenantAtivo } from "@/lib/plans";
import { requireRateLimit } from "@/lib/security";

export const POST = staffRoute(["dono"], async ({ tenant, user }, req) => {
  if (!tenantAtivo(tenant)) throw new HttpError(403, "Período de teste encerrado ou conta suspensa. Fale com a gente.");
  const body = funcionarioCriar.parse(await readJson(req));
  if (body.setores?.length) requireFeature(tenant, "painel_garcom_setores");
  await requireRateLimit(`equipe:${user.id}`, 30, 3600);

  const admin = adminClient();
  const { data: criado, error } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.senha,
    email_confirm: true,
    user_metadata: { nome: body.nome },
  });
  if (error || !criado.user) {
    if (error?.message?.toLowerCase().includes("already")) throw new HttpError(409, "Este e-mail já tem cadastro. Fale com o suporte para vincular.");
    throw new HttpError(400, "Não foi possível criar o acesso. Confira os dados.");
  }
  const { data, error: e2 } = await admin
    .from("memberships")
    .insert({ tenant_id: tenant.id, user_id: criado.user.id, papel: body.papel, nome: body.nome, setores: body.setores ?? [] })
    .select("id,tenant_id,user_id,papel,nome,setores,ativo")
    .single();
  if (e2) {
    await admin.auth.admin.deleteUser(criado.user.id);
    throw fromDbError(e2);
  }
  return json(data, 201);
});
