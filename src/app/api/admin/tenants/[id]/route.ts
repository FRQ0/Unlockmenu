// Super-admin: muda plano, inicia teste de 7 dias, ativa (pago), suspende, domínio próprio.
import { assertSameOrigin, fromDbError, handle, HttpError, json, readJson } from "@/lib/http";
import { tenantAdmin, uuid } from "@/lib/schemas";
import { auditar, requireSuperAdmin } from "@/lib/superadmin";
import { adminClient } from "@/lib/supabase/admin";
import { fimDoTeste } from "@/lib/plans";

export const PATCH = handle<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  const actor = await requireSuperAdmin();
  const id = uuid.parse((await params).id);
  const b = tenantAdmin.parse(await readJson(req));

  let mudanca: Record<string, unknown>;
  switch (b.acao) {
    case "plano":
      if (!b.plano) throw new HttpError(400, "Informe o plano.");
      mudanca = { plano: b.plano };
      break;
    case "iniciar_teste":
      mudanca = { status: "teste", trial_ends_at: fimDoTeste().toISOString() };
      break;
    case "ativar":
      mudanca = { status: "ativo", pago_ate: b.pago_ate ?? null };
      break;
    case "suspender":
      mudanca = { status: "suspenso" };
      break;
    case "dominio":
      mudanca = { dominio_custom: b.dominio_custom ?? null };
      break;
  }
  const { data, error } = await adminClient().from("tenants").update(mudanca).eq("id", id).select("id").maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, "Estabelecimento não encontrado.");
  await auditar(actor, `tenant.${b.acao}`, id, mudanca);
  return json({ ok: true });
});
