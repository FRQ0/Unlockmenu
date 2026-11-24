// Critério de aceite: nenhuma tela do cliente final mostra a marca Unlock Menu.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}

const raiz = path.join(__dirname, "../src");
const telasCliente = [...arquivos(path.join(raiz, "app/[slug]")), ...arquivos(path.join(raiz, "components/cliente")), path.join(raiz, "lib/placas.ts"), path.join(raiz, "app/layout.tsx")];

describe("white-label", () => {
  it.each(telasCliente.map((f) => [path.relative(raiz, f), f]))("%s não cita a marca", (_n, f) => {
    const txt = readFileSync(f as string, "utf8");
    expect(txt).not.toMatch(/unlock/i);
    expect(txt).not.toMatch(/components\/ui\/Marca/);
  });
  it("o manifest do PWA só é ligado no layout dos painéis", () => {
    expect(readFileSync(path.join(raiz, "app/layout.tsx"), "utf8")).not.toMatch(/manifest/);
    expect(readFileSync(path.join(raiz, "app/app/layout.tsx"), "utf8")).toMatch(/manifest/);
  });
});
