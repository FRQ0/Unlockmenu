import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCsp, SECURITY_HEADERS } from "@/lib/csp";
import { tipoReal, duracaoDoLog, caminhoValido } from "@/lib/media";

describe("cabeçalhos de segurança", () => {
  it("CSP de produção é restritiva", () => {
    const csp = buildCsp("abc", false);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("'nonce-abc'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
  it("HSTS, nosniff, anti-clickjacking", () => {
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toMatch(/max-age=\d{8}/);
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
  });
  it("next.config esconde tecnologia e source maps", () => {
    const cfg = readFileSync(path.join(__dirname, "../next.config.mjs"), "utf8");
    expect(cfg).toMatch(/poweredByHeader: false/);
    expect(cfg).toMatch(/productionBrowserSourceMaps: false/);
  });
  it(".env fica fora do git", () => {
    const gi = readFileSync(path.join(__dirname, "../.gitignore"), "utf8");
    expect(gi).toMatch(/^\.env$/m);
    expect(gi).toMatch(/^\.env\.\*$/m);
  });
  it("service role só no servidor", () => {
    const admin = readFileSync(path.join(__dirname, "../src/lib/supabase/admin.ts"), "utf8");
    expect(admin).toMatch(/import "server-only"/);
  });
});

describe("upload restrito", () => {
  it("reconhece o tipo real pelos bytes", () => {
    expect(tipoReal(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("jpeg");
    expect(tipoReal(Buffer.from("\x00\x00\x00\x18ftypmp42xxxx", "latin1"))).toBe("mp4");
    expect(tipoReal(Buffer.from("<?php system($_GET['c']); ?>"))).toBeNull();
    expect(tipoReal(Buffer.from("<svg onload=alert(1)></svg>"))).toBeNull();
  });
  it("lê a duração do vídeo", () => {
    expect(duracaoDoLog("  Duration: 00:00:12.48, start: 0")).toBeCloseTo(12.48);
  });
  it("caminho do upload preso à pasta do estabelecimento", () => {
    const t = "aaaaaaaa-0000-0000-0000-000000000000";
    const ok = `${t}/video-12345678-1234-1234-1234-123456789012.mp4`;
    expect(caminhoValido(t, ok, "video")).toBe(true);
    expect(caminhoValido(t, `../bbbbbbbb-0000-0000-0000-000000000000/video-12345678-1234-1234-1234-123456789012.mp4`, "video")).toBe(false);
    expect(caminhoValido(t, `bbbbbbbb-0000-0000-0000-000000000000/video-12345678-1234-1234-1234-123456789012.mp4`, "video")).toBe(false);
    expect(caminhoValido(t, ok, "foto")).toBe(false);
  });
});
