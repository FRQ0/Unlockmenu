// Super-admin cria estabelecimento + acesso do dono. Exige 2FA (aal2).
import { assertSameOrigin, fromDbError, handle, HttpError, json, readJson } from "@/lib/http";
import { tenantCriar } from "@/lib/schemas";
import { auditar, requireSuperAdmin } from "@/lib/superadmin";
import { adminClient } from "@/lib/supabase/admin";
import { fimDoTeste } from "@/lib/plans";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const actor = await requireSuperAdmin();
  const b = tenantCriar.parse(await readJson(req));
  const admin = adminClient();

  const { data: tenant, error } = await admin
    .from("tenants")
    .insert({
      nome: b.nome,
      slug: b.slug,
      plano: b.plano,
      status: b.iniciar_teste ? "teste" : "suspenso",
      trial_ends_at: b.iniciar_teste ? fimDoTeste().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw error.code === "23505" ? new HttpError(409, "Esse endereço (slug) já existe.") : fromDbError(error);

  const { data: u, error: e2 } = await admin.auth.admin.createUser({ email: b.dono_email, password: b.dono_senha, email_confirm: true });
  let userId = u?.user?.id;
  if (e2 || !userId) {
    // e-mail já existe: vincula o usuário existente
    const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = lista?.users.find((x) => x.email?.toLowerCase() === b.dono_email)?.id;
    if (!userId) {
      await admin.from("tenants").delete().eq("id", tenant.id);
      throw new HttpError(400, "Não foi possível criar o acesso do dono.");
    }
  }
  const { error: e3 } = await admin.from("memberships").insert({ tenant_id: tenant.id, user_id: userId, papel: "dono", nome: b.dono_nome });
  if (e3) throw fromDbError(e3);

  await auditar(actor, "tenant.criar", tenant.id, { slug: b.slug, plano: b.plano, teste: b.iniciar_teste });
  return json({ id: tenant.id }, 201);
});
