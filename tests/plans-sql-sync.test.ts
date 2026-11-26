// O plano é conferido em dois lugares (servidor Node e Postgres). Este teste garante que batem.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURES, LIMITES, PLANOS } from "@/lib/plans";

const dir = path.join(__dirname, "../supabase/migrations");
const sql = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");

describe("plans.ts × plan_features (SQL)", () => {
  const pares = new Set([...sql.matchAll(/\('(essencial|profissional|completo)', '([a-z_]+)'\)/g)].map((m) => `${m[1]}:${m[2]}`));
  it("cada recurso do TS existe no SQL e vice-versa", () => {
    const ts = new Set<string>();
    for (const [f, planos] of Object.entries(FEATURES)) for (const p of planos) ts.add(`${p}:${f}`);
    expect([...pares].sort()).toEqual([...ts].sort());
  });
  it("limites de mesas e vídeos batem", () => {
    for (const p of PLANOS) {
      const m = new RegExp(`\\('${p}', (null|\\d+), (\\d+)\\)`).exec(sql);
      expect(m, p).not.toBeNull();
      expect(m![1] === "null" ? null : Number(m![1])).toBe(LIMITES[p].maxMesas);
      expect(Number(m![2])).toBe(LIMITES[p].videosInclusos);
    }
  });
});
