// Chamados do cliente final (sem login). Proteções: token da mesa (impossível de
// adivinhar), validação estrita, rate limit por IP, 1 chamado aberto por mesa,
// limite por mesa/IP no banco e resposta mínima.
import { after } from "next/server";
import { assertSameOrigin, fromDbError, handle, HttpError, json, readJson } from "@/lib/http";
import { chamadoPublico, chamadoPublicoRef } from "@/lib/schemas";
import { adminClient } from "@/lib/supabase/admin";
import { clientIp, hashIp, requireRateLimit } from "@/lib/security";
import { mesaPublica, tenantPublico } from "@/lib/public-data";
import { enviarPush } from "@/lib/push";
import { adminTenantPlano } from "@/lib/tenant-server";
import { tenantHas } from "@/lib/plans";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const body = chamadoPublico.parse(await readJson(req, 2048));
  const ipHash = hashIp(await clientIp());
  const [, tenant] = await Promise.all([requireRateLimit(`chamado:ip:${ipHash}`, 20, 300), tenantPublico(body.slug)]);
  if (!tenant || !tenant.ativo) throw new HttpError(404, "Atendimento indisponível.");
  const mesa = await mesaPublica(tenant.id, body.token);
  if (!mesa) throw new HttpError(404, "Mesa não encontrada.");

  const { data, error } = await adminClient().rpc("criar_chamado", { p_token: body.token, p_tipo: body.tipo, p_ip_hash: ipHash });
  if (error) throw fromDbError(error);
  const c = (Array.isArray(data) ? data[0] : data) as { id: string; status: string; tipo: string; criado_em: string };

  after(async () => {
    const plano = await adminTenantPlano(tenant.id);
    if (plano && tenantHas(plano, "push")) {
      await enviarPush(tenant.id, {
        title: c.tipo === "conta" ? `${mesa.nome} pediu a conta` : `${mesa.nome} está chamando`,
        body: "Toque para abrir o painel",
        url: "/app/garcom",
        tag: `chamado-${c.id}`,
      }, ["dono", "gerente", "garcom"]);
    }
  });

  return json({ id: c.id, status: c.status, tipo: c.tipo });
});

export const GET = handle(async (req) => {
  const u = new URL(req.url);
  const ref = chamadoPublicoRef.parse({ token: u.searchParams.get("token"), id: u.searchParams.get("id") });
  const ipHash = hashIp(await clientIp());
  await requireRateLimit(`status:ip:${ipHash}`, 240, 300);
  const { data, error } = await adminClient().rpc("status_chamado", { p_token: ref.token, p_call_id: ref.id });
  if (error) throw fromDbError(error);
  const s = (Array.isArray(data) ? data[0] : data) as { status: string; tipo: string; garcom: string | null } | undefined;
  if (!s) throw new HttpError(404, "Chamado não encontrado.");
  return json({ status: s.status, tipo: s.tipo, garcom: s.status === "a_caminho" ? s.garcom : null });
});

export const DELETE = handle(async (req) => {
  assertSameOrigin(req);
  const ref = chamadoPublicoRef.parse(await readJson(req, 1024));
  const ipHash = hashIp(await clientIp());
  await requireRateLimit(`cancelar:ip:${ipHash}`, 20, 300);
  const { error } = await adminClient().rpc("cancelar_chamado", { p_token: ref.token, p_call_id: ref.id });
  if (error) throw fromDbError(error);
  return json({ ok: true });
});
