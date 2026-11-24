// Inscrição em notificações push (plano Completo).
import { z } from "zod";
import { fromDbError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { pushInscrever } from "@/lib/schemas";
import { requireFeature } from "@/lib/plans";
import { adminClient } from "@/lib/supabase/admin";

export const POST = staffRoute(undefined, async ({ tenant, user }, req) => {
  requireFeature(tenant, "push");
  const s = pushInscrever.parse(await readJson(req, 4096));
  const { error } = await adminClient()
    .from("push_subscriptions")
    .upsert({ tenant_id: tenant.id, user_id: user.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }, { onConflict: "endpoint" });
  if (error) throw fromDbError(error);
  return json({ ok: true });
});

export const DELETE = staffRoute(undefined, async ({ supabase }, req) => {
  const { endpoint } = z.object({ endpoint: z.string().url().max(500) }).strict().parse(await readJson(req, 4096));
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return json({ ok: true });
});
