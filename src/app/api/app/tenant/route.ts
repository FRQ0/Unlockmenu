// Trocar de estabelecimento (quem trabalha em mais de um).
import { cookies } from "next/headers";
import { z } from "zod";
import { HttpError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { TENANT_COOKIE } from "@/lib/staff";

export const POST = staffRoute(undefined, async ({ memberships }, req) => {
  const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).strict().parse(await readJson(req));
  if (!memberships.some((m) => m.tenant_id === tenant_id)) throw new HttpError(403, "Sem permissão.");
  (await cookies()).set(TENANT_COOKIE, tenant_id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
  return json({ ok: true });
});
