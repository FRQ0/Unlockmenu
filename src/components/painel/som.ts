"use client";
// Som de chamado gerado na hora (sem arquivo): funciona offline e não pesa.
let ctx: AudioContext | null = null;

export function audioPronto() {
  return !!ctx && ctx.state === "running";
}

export async function liberarAudio() {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  ctx = ctx ?? new AC();
  if (ctx.state !== "running") await ctx.resume().catch(() => {});
  return ctx.state === "running";
}

export function tocar(tipo: "chamado" | "conta" | "atraso") {
  if (!ctx || ctx.state !== "running") return;
  const notas = tipo === "atraso" ? [880, 660, 880, 660] : tipo === "conta" ? [660, 990] : [784, 1046, 784, 1046];
  const t0 = ctx.currentTime;
  notas.forEach((f, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + i * 0.18);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.18 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.18 + 0.16);
    o.connect(g).connect(ctx!.destination);
    o.start(t0 + i * 0.18);
    o.stop(t0 + i * 0.18 + 0.17);
  });
}
