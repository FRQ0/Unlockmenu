import { assertSameOrigin, handle, json } from "@/lib/http";
import { serverClient } from "@/lib/supabase/server";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const supabase = await serverClient();
  await supabase.auth.signOut();
  return json({ ok: true });
});
