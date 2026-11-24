import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fromDbError } from "./http";

/** Grava a nova ordem. O RLS + filtro por tenant impedem mexer em itens de outro estabelecimento. */
export async function reordenar(supabase: SupabaseClient, tabela: "categories" | "products" | "tables", tenantId: string, ids: string[]) {
  const results = await Promise.all(
    ids.map((id, i) => supabase.from(tabela).update({ ordem: i }).eq("id", id).eq("tenant_id", tenantId)),
  );
  const erro = results.find((r) => r.error)?.error;
  if (erro) throw fromDbError(erro);
}
