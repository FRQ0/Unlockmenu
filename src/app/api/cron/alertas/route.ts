// Cron (a cada minuto): chamado aberto há mais de X min → push para gerente/dono.
import { timingSafeEqual } from "node:crypto";
import { handle, HttpError, json } from "@/lib/http";
import { adminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push";
import { serverEnv } from "@/lib/env";

function autorizado(req: Request) {
  const secret = serverEnv.cronSecret;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return !!secret && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export const GET = handle(async (req) => {
  if (!autorizado(req)) throw new HttpError(401, "Não autorizado.");
  const admin = adminClient();
  const { data } = await admin.rpc("chamados_atrasados");
  const lista = (data ?? []) as { id: string; tenant_id: string; mesa: string; tipo: string; minutos: number }[];
  await Promise.all(
    lista.map((c) =>
      enviarPush(c.tenant_id, {
        title: `Atraso: ${c.mesa} espera há ${c.minutos} min`,
        body: c.tipo === "conta" ? "Pedido de conta sem atendimento" : "Chamado de garçom sem atendimento",
        url: "/app/garcom",
        tag: `atraso-${c.id}`,
      }, ["dono", "gerente"]),
    ),
  );
  await admin.rpc("rate_limit_limpar");
  return json({ alertas: lista.length });
});
