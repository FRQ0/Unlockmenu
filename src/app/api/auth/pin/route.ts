// Login rápido por PIN (tablet/celular do salão). PIN curto exige rate limit forte:
// 5 tentativas por IP e 20 por estabelecimento a cada 15 min.
import { assertSameOrigin, handle, HttpError, json, readJson } from "@/lib/http";
import { loginPin } from "@/lib/schemas";
import { clientIp, hashIp, requireRateLimit, verificarTurnstile } from "@/lib/security";
import { adminClient } from "@/lib/supabase/admin";
import { serverClient } from "@/lib/supabase/server";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const body = loginPin.parse(await readJson(req, 4096));
  const ip = await clientIp();
  await requireRateLimit(`pin:ip:${hashIp(ip)}`, 5, 900);
  await requireRateLimit(`pin:slug:${body.slug}`, 20, 900);
  if (!(await verificarTurnstile(body.turnstile, ip))) throw new HttpError(400, "Confirme que você não é um robô.");

  const admin = adminClient();
  const { data: userId } = await admin.rpc("conferir_pin", { p_slug: body.slug, p_pin: body.pin });
  if (!userId) throw new HttpError(401, "PIN inválido.");

  const { data: u } = await admin.auth.admin.getUserById(userId as string);
  const email = u?.user?.email;
  if (!email) throw new HttpError(401, "PIN inválido.");
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !link?.properties?.hashed_token) throw new HttpError(500, "Não foi possível entrar agora.");

  const supabase = await serverClient();
  const { error: e2 } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (e2) throw new HttpError(500, "Não foi possível entrar agora.");
  return json({ ok: true, next: "/app/garcom" });
});
