// Login da equipe. Proteções: honeypot + Turnstile (robôs), rate limit por IP e por
// e-mail (força bruta), mensagem genérica (não revela se o e-mail existe).
import { assertSameOrigin, handle, HttpError, json, readJson } from "@/lib/http";
import { caminhoInterno, login } from "@/lib/schemas";
import { clientIp, hashIp, requireRateLimit, verificarTurnstile } from "@/lib/security";
import { serverClient } from "@/lib/supabase/server";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const body = login.parse(await readJson(req, 4096));
  if (body.site) throw new HttpError(400, "E-mail ou senha inválidos.");

  const ip = await clientIp();
  const ipHash = hashIp(ip);
  await requireRateLimit(`login:ip:${ipHash}`, 10, 900);
  await requireRateLimit(`login:email:${hashIp(body.email)}`, 5, 900);
  if (!(await verificarTurnstile(body.turnstile, ip))) throw new HttpError(400, "Confirme que você não é um robô.");

  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.senha });
  if (error) throw new HttpError(401, "E-mail ou senha inválidos.");
  return json({ ok: true, next: caminhoInterno(body.next) });
});
