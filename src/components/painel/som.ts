"use client";
// Sons dos painéis.
// iPhone: o Safari só deixa tocar som depois de um toque na tela e silencia o Web Audio
// quando o botão lateral está no modo silencioso. Por isso usamos <audio> com arquivos
// (que tocam mesmo no silencioso), pedimos a sessão de áudio "playback" (Safari 17+)
// e destravamos de novo automaticamente no próximo toque em qualquer lugar da tela
// (ex.: depois de trocar de aba).

export type Som = "chamado" | "conta" | "atraso" | "pedido";
const SONS: Som[] = ["chamado", "conta", "atraso", "pedido"];
const PREF = "som_ativado";

let elementos: Partial<Record<Som, HTMLAudioElement>> = {};
let destravado = false;
const ouvintes = new Set<(ok: boolean) => void>();
let instalado = false;

function avisar() {
  ouvintes.forEach((f) => f(destravado));
}

function pref(): boolean {
  try {
    return localStorage.getItem(PREF) === "1";
  } catch {
    return false;
  }
}

function criar() {
  if (typeof window === "undefined") return;
  for (const s of SONS) {
    if (!elementos[s]) {
      const a = new Audio(`/sons/${s}.mp3`);
      a.preload = "auto";
      a.volume = 1;
      elementos[s] = a;
    }
  }
}

export function audioPronto() {
  return destravado;
}

/** Chame dentro de um toque (onClick). Toca cada som mudo uma vez para o navegador liberar. */
export async function liberarAudio(): Promise<boolean> {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch {}
  criar();
  try {
    await Promise.all(
      SONS.map(async (s) => {
        const a = elementos[s]!;
        a.muted = true;
        await a.play();
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      }),
    );
    destravado = true;
    try {
      localStorage.setItem(PREF, "1");
    } catch {}
  } catch {
    destravado = false;
  }
  avisar();
  return destravado;
}

export function tocar(tipo: Som) {
  const a = elementos[tipo];
  if (!a || !destravado) return;
  a.currentTime = 0;
  a.play().catch(() => {
    // o navegador travou de novo (ex.: voltou de outra aba): o próximo toque destrava
    destravado = false;
    avisar();
  });
}

/** Avisa a tela quando o som trava/destrava e destrava sozinho no próximo toque. */
export function acompanharSom(f: (ok: boolean) => void): () => void {
  ouvintes.add(f);
  f(destravado);
  if (!instalado && typeof document !== "undefined") {
    instalado = true;
    const tentar = () => {
      if (!destravado && pref()) liberarAudio();
    };
    document.addEventListener("pointerdown", tentar, true);
    document.addEventListener("touchend", tentar, true);
  }
  return () => {
    ouvintes.delete(f);
  };
}

export function somFoiAtivadoAntes() {
  return pref();
}

export function limparSons() {
  elementos = {};
}
