"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Plus, Trash2 } from "lucide-react";
import { api } from "./api";

type Mesa = { id: string; nome: string; area: string | null; ativa: boolean; url: string };

function QR({ url }: { url: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#17181C", light: "#FFFFFF" } }).then(setSrc).catch(() => {});
  }, [url]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="QR code da mesa" className="h-24 w-24 rounded-lg" /> : <div className="h-24 w-24 rounded-lg bg-papel" />;
}

export function AdminMesas({ iniciais, max, setores }: { iniciais: Mesa[]; max: number | null; setores: boolean }) {
  const [mesas, setMesas] = useState(iniciais);
  const [qtd, setQtd] = useState(1);
  const [area, setArea] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function tentar(fn: () => Promise<void>) {
    setErro(null);
    try {
      await fn();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    }
  }

  const criar = () =>
    tentar(async () => {
      const novas = await api<{ id: string; nome: string; area: string | null; ativa: boolean; token_publico: string }[]>("/api/app/mesas", "POST", {
        quantidade: qtd,
        ...(setores && area.trim() ? { area: area.trim() } : {}),
      });
      // recarrega para obter as URLs públicas calculadas no servidor
      window.location.reload();
      return void novas;
    });

  const editar = (m: Mesa, campos: Partial<Pick<Mesa, "nome" | "area" | "ativa">>) =>
    tentar(async () => {
      await api(`/api/app/mesas/${m.id}`, "PATCH", campos);
      setMesas((ms) => ms.map((x) => (x.id === m.id ? { ...x, ...campos } : x)));
    });

  const apagar = (m: Mesa) =>
    tentar(async () => {
      if (!confirm(`Apagar ${m.nome}? O QR impresso dela deixa de funcionar.`)) return;
      await api(`/api/app/mesas/${m.id}`, "DELETE");
      setMesas((ms) => ms.filter((x) => x.id !== m.id));
    });

  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Mesas e QR</h1>
        <span className="text-sm text-grafite">{mesas.length}{max ? ` de ${max}` : ""} mesas</span>
        <a href="/api/app/mesas/pdf" className="btn-escuro ml-auto"><Download className="h-4 w-4" /> Baixar placas (PDF)</a>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); criar(); }} className="card mt-5 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="rotulo" htmlFor="qtd">Quantas mesas</label>
          <input id="qtd" type="number" min={1} max={50} value={qtd} onChange={(e) => setQtd(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className="campo w-28" />
        </div>
        {setores && (
          <div>
            <label className="rotulo" htmlFor="area">Setor (opcional)</label>
            <input id="area" maxLength={30} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Salão, Varanda..." className="campo w-48" />
          </div>
        )}
        <button className="btn-primario" disabled={max !== null && mesas.length >= max}><Plus className="h-4 w-4" /> Criar mesas</button>
        {max !== null && mesas.length >= max && <p className="text-sm text-grafite">Limite do plano atingido.</p>}
      </form>
      {erro && <p role="alert" className="mt-3 rounded-xl bg-estado-vermelho/10 p-3 text-sm font-semibold text-estado-vermelho">{erro}</p>}

      <p className="mt-4 text-sm text-grafite">Grave o mesmo link na tag NFC da placa (app gratuito “NFC Tools”, opção “Gravar → URL”).</p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mesas.map((m) => (
          <li key={m.id} className={`card flex gap-3 p-3 ${m.ativa ? "" : "opacity-60"}`}>
            <QR url={m.url} />
            <div className="min-w-0 flex-1 space-y-2">
              <input
                defaultValue={m.nome}
                maxLength={30}
                onBlur={(e) => e.target.value.trim() && e.target.value !== m.nome && editar(m, { nome: e.target.value.trim() })}
                className="w-full rounded-lg bg-transparent px-1 font-bold outline-none focus:bg-papel"
                aria-label="Nome da mesa"
              />
              {setores && (
                <input
                  defaultValue={m.area ?? ""}
                  maxLength={30}
                  placeholder="Setor"
                  onBlur={(e) => e.target.value !== (m.area ?? "") && editar(m, { area: e.target.value.trim() || null })}
                  className="w-full rounded-lg bg-transparent px-1 text-sm text-grafite outline-none focus:bg-papel"
                  aria-label="Setor"
                />
              )}
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => navigator.clipboard.writeText(m.url).then(() => { setCopiado(m.id); setTimeout(() => setCopiado(null), 1500); })}
                  className="btn-secundario px-2 py-1 text-xs"
                >
                  <Copy className="h-3 w-3" /> {copiado === m.id ? "Copiado!" : "Link NFC"}
                </button>
                <a href={`/api/app/mesas/pdf?ids=${m.id}`} className="btn-secundario px-2 py-1 text-xs"><Download className="h-3 w-3" /> PDF</a>
                <button onClick={() => editar(m, { ativa: !m.ativa })} className="btn px-2 py-1 text-xs text-grafite">{m.ativa ? "Desativar" : "Ativar"}</button>
                <button onClick={() => apagar(m)} className="p-1 text-estado-vermelho" aria-label="Apagar mesa"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
