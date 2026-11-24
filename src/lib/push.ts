// Web Push (plano Completo): avisa a equipe mesmo com o app em segundo plano.
import "server-only";
import webpush from "web-push";
import { adminClient } from "./supabase/admin";
import { serverEnv } from "./env";
import type { Papel } from "./types";

let configurado = false;
function configurar() {
  const v = serverEnv.vapid;
  if (!v.publicKey || !v.privateKey) return false;
  if (!configurado) {
    webpush.setVapidDetails(v.subject, v.publicKey, v.privateKey);
    configurado = true;
  }
  return true;
}

export async function enviarPush(tenantId: string, msg: { title: string; body: string; url?: string; tag?: string }, papeis?: Papel[]) {
  if (!configurar()) return;
  const db = adminClient();
  let userIds: string[] | null = null;
  if (papeis) {
    const { data } = await db.from("memberships").select("user_id").eq("tenant_id", tenantId).eq("ativo", true).in("papel", papeis);
    userIds = (data ?? []).map((m) => m.user_id);
    if (!userIds.length) return;
  }
  let q = db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("tenant_id", tenantId);
  if (userIds) q = q.in("user_id", userIds);
  const { data: subs } = await q;
  const payload = JSON.stringify(msg);
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 120, urgency: "high" });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      }
    }),
  );
}
