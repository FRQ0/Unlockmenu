// Estado do salão (fallback do tempo real e carga inicial do painel).
import { json } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { carregarSalao } from "@/lib/salao";

export const GET = staffRoute(undefined, async ({ supabase, tenant }) => json(await carregarSalao(supabase, tenant.id)));
