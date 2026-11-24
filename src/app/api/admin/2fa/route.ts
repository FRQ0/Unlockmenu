// 2FA (TOTP) do super-admin: cadastrar o app autenticador e confirmar o código.
import { z } from "zod";
import { assertSameOrigin, handle, HttpError, json, readJson } from "@/lib/http";
import { serverClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireRateLimit } from "@/lib/security";

const schema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("cadastrar") }).strict(),
  z.object({ acao: z.literal("verificar"), factorId: z.string().uuid(), code: z.string().regex(/^[0-9]{6}$/) }).strict(),
]);

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const supabase = await serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, "Faça login.");
  const { data: admin } = await adminClient().from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) throw new HttpError(403, "Acesso restrito.");

  const body = schema.parse(await readJson(req));
  if (body.acao === "cadastrar") {
    const { data: fatores } = await supabase.auth.mfa.listFactors();
    // remove cadastros não confirmados para não acumular
    for (const f of fatores?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (fatores?.totp?.length) throw new HttpError(409, "2FA já cadastrado.");
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Unlock Menu" });
    if (error || !data) throw new HttpError(500, "Não foi possível iniciar o 2FA.");
    return json({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  await requireRateLimit(`2fa:${user.id}`, 5, 900);
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: body.factorId, code: body.code });
  if (error) throw new HttpError(401, "Código inválido.");
  return json({ ok: true });
});
