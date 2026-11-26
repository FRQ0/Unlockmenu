"use client";
// Entrega no balcão/churrasqueira: lê o QR da ficha (câmera ou leitor) ou digita o código.
// Cada ficha só vale uma vez: a segunda leitura aparece em vermelho.
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, CircleX, ScanLine, TriangleAlert } from "lucide-react";
import { acompanharSom, liberarAudio, tocar } from "./som";
import { api } from "./api";

type Resultado = { resultado: "ok" | "ja_usada" | "nao_encontrada" | "cancelada"; nome: string | null; usada_em: string | null };
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export function ValidarFichas() {
  const [codigo, setCodigo] = useState("");
  const [res, setRes] = useState<(Resultado & { codigo: string }) | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [temCamera, setTemCamera] = useState(false);
  const [historico, setHistorico] = useState<{ codigo: string; nome: string | null; ok: boolean; hora: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const ocupado = useRef(false);

  useEffect(() => {
    setTemCamera("BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia);
    input.current?.focus();
    return acompanharSom(() => {});
  }, []);

  async function validar(c: string) {
    const cod = c.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cod.length < 4 || ocupado.current) return;
    ocupado.current = true;
    setErro(null);
    setCarregando(true);
    try {
      const r = await api<Resultado>("/api/app/fichas/usar", "POST", { codigo: cod });
      setRes({ ...r, codigo: cod });
      const ok = r.resultado === "ok";
      tocar(ok ? "pedido" : "atraso");
      navigator.vibrate?.(ok ? 120 : [300, 100, 300]);
      setHistorico((h) => [{ codigo: cod, nome: r.nome, ok, hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) }, ...h].slice(0, 15));
      setCodigo("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setCarregando(false);
      setTimeout(() => (ocupado.current = false), 1200);
      input.current?.focus();
    }
  }

  // leitura pela câmera (Android/Chrome). No iPhone, digite o código ou use um leitor.
  useEffect(() => {
    if (!camera) return;
    let parar = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const Det = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        const det = new Det({ formats: ["qr_code"] });
        const loop = async () => {
          if (parar || !video.current) return;
          try {
            const r = await det.detect(video.current);
            if (r[0]?.rawValue) await validar(r[0].rawValue);
          } catch {}
          setTimeout(loop, 350);
        };
        loop();
      } catch {
        setErro("Não foi possível abrir a câmera.");
        setCamera(false);
      }
    })();
    return () => {
      parar = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  const cor =
    res?.resultado === "ok" ? "bg-estado-verde" : res?.resultado === "ja_usada" ? "bg-estado-vermelho" : res ? "bg-grafite" : "bg-pedra";

  return (
    <main className="mx-auto max-w-xl p-4 lg:p-8" onClick={() => liberarAudio()}>
      <h1 className="text-2xl font-extrabold tracking-tight">Validar fichas</h1>
      <p className="text-sm text-grafite">Leia o QR ou digite o código de 6 letras. Cada ficha vale uma vez.</p>

      <form onSubmit={(e) => { e.preventDefault(); validar(codigo); }} className="mt-4 flex gap-2">
        <input
          ref={input}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="CÓDIGO"
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
          className="campo flex-1 text-center text-3xl font-extrabold tracking-[.3em]"
        />
        <button disabled={carregando || codigo.length < 4} className="btn-escuro px-5"><ScanLine className="h-5 w-5" /></button>
      </form>
      {temCamera && (
        <button onClick={() => setCamera((c) => !c)} className="btn-secundario mt-2 w-full"><Camera className="h-4 w-4" /> {camera ? "Fechar câmera" : "Ler QR com a câmera"}</button>
      )}
      {camera && <video ref={video} muted playsInline className="mt-3 aspect-square w-full rounded-2xl bg-black object-cover" />}
      {erro && <p role="alert" className="mt-3 text-sm font-semibold text-estado-vermelho">{erro}</p>}

      <div className={`mt-5 rounded-[22px] p-6 text-center text-white transition ${cor}`} aria-live="assertive">
        {!res ? (
          <p className="text-carvao/60">Aguardando ficha...</p>
        ) : res.resultado === "ok" ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12" />
            <p className="mt-2 text-sm font-bold uppercase tracking-widest opacity-90">Pode entregar</p>
            <p className="mt-1 text-3xl font-extrabold">{res.nome}</p>
          </>
        ) : res.resultado === "ja_usada" ? (
          <>
            <CircleX className="mx-auto h-12 w-12" />
            <p className="mt-2 text-sm font-bold uppercase tracking-widest">Ficha já usada</p>
            <p className="mt-1 text-2xl font-extrabold">{res.nome}</p>
            {res.usada_em && <p className="mt-1 text-sm">Trocada às {new Date(res.usada_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
          </>
        ) : (
          <>
            <TriangleAlert className="mx-auto h-12 w-12" />
            <p className="mt-2 text-xl font-extrabold">{res.resultado === "cancelada" ? "Ficha cancelada" : "Ficha não encontrada"}</p>
            <p className="text-sm opacity-90">Código {res.codigo}</p>
          </>
        )}
      </div>

      {historico.length > 0 && (
        <ul className="mt-5 divide-y divide-pedra text-sm">
          {historico.map((h, i) => (
            <li key={i} className="flex items-center gap-2 py-2">
              <span className="w-12 text-xs text-grafite">{h.hora}</span>
              <span className="font-mono font-bold">{h.codigo}</span>
              <span className="min-w-0 flex-1 truncate text-grafite">{h.nome ?? "—"}</span>
              <span className={h.ok ? "font-bold text-estado-verde" : "font-bold text-estado-vermelho"}>{h.ok ? "OK" : "Recusada"}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
