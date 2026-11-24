import { fromDbError, HttpError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { funcionarioEditar, uuid } from "@/lib/schemas";
import { adminClient } from "@/lib/supabase/admin";
import { requireFeature } from "@/lib/plans";

export const PATCH = staffRoute<{ id: string }>(["dono"], async ({ supabase, tenant, user }, req, { id }) => {
  const membershipId = uuid.parse(id);
  const { pin, ...campos } = funcionarioEditar.parse(await readJson(req));
  if (campos.setores?.length) requireFeature(tenant, "painel_garcom_setores");

  // confirma (com RLS) que a pessoa é deste estabelecimento e não é o próprio dono
  const { data: alvo } = await supabase.from("memberships").select("id,user_id").eq("id", membershipId).eq("tenant_id", tenant.id).maybeSingle();
  if (!alvo) throw new HttpError(404, "Funcionário não encontrado.");
  if (alvo.user_id === user.id && (campos.papel || campos.ativo === false)) throw new HttpError(400, "Você não pode alterar o próprio acesso.");

  if (Object.keys(campos).length) {
    const { error } = await supabase.from("memberships").update(campos).eq("id", membershipId).eq("tenant_id", tenant.id);
    if (error) throw fromDbError(error);
  }
  if (pin !== undefined) {
    const admin = adminClient();
    if (pin) {
      const { data: dono } = await admin.rpc("conferir_pin", { p_slug: tenant.slug, p_pin: pin });
      if (dono && dono !== alvo.user_id) throw new HttpError(409, "Este PIN já é usado por outra pessoa da equipe.");
    }
    const { error } = await admin.rpc("definir_pin", { p_membership: membershipId, p_pin: pin });
    if (error) throw fromDbError(error);
  }
  return json({ ok: true });
});
