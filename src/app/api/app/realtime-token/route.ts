// Entrega um access token curto (1h) para o tempo real do painel.
// O refresh token continua só no cookie httpOnly.
import { json } from "@/lib/http";
import { staffRoute } from "@/lib/route";

export const GET = staffRoute(undefined, async ({ supabase }) => {
  const { data } = await supabase.auth.getSession();
  return json({ token: data.session?.access_token ?? null });
});
