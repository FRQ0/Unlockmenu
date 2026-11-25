// Estado do salão (fallback do tempo real e carga inicial do painel).
import { json } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { carregarSalao } from "@/lib/salao";

// "eu" permite à tela perceber que outra pessoa entrou neste aparelho (e recarregar)
export const GET = staffRoute(undefined, async ({ supabase, tenant, user }) => json({ ...(await carregarSalao(supabase, tenant.id)), eu: user.id }));
