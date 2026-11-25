"use client";
import { useState, type CSSProperties } from "react";
import { Bell, Check, Loader2, Lock, Upload } from "lucide-react";
import { COR_PADRAO, temaVars } from "@/lib/color";
import { api, enviarMidia } from "./api";

type Config = {
  nome: string;
  logo_url: string | null;
  capa_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  instagram: string | null;
  whatsapp: string | null;
  endereco: string | null;
  horarios: string | null;
  google_review_url: string | null;
  alerta_minutos: number;
};

export function AdminConfig({ inicial, slug, recursos }: { inicial: Config; slug: string; recursos: { cores: boolean; avaliacao: boolean; alerta: boolean } }) {
  const [f, setF] = useState(inicial);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const txt = (k: keyof Config) => ({
    value: (f[k] as string | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value }),
  });

  async function upload(tipo: "logo" | "capa", file?: File) {
    if (!file) return;
    setErro(null);
    setEnviando(tipo);
    try {
      const r = await enviarMidia(file, tipo);
      setF((x) => ({ ...x, [tipo === "logo" ? "logo_url" : "capa_url"]: r.url }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no envio");
    } finally {
      setEnviando(null);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    setSalvando(true);
    const vazio = (s: string | null) => (s && s.trim() ? s.trim() : null);
    try {
      await api("/api/app/config", "PATCH", {
        nome: f.nome.trim(),
        logo_url: f.logo_url,
        instagram: vazio(f.instagram)?.replace(/^@/, "") ?? null,
        whatsapp: vazio(f.whatsapp)?.replace(/\D/g, "") ?? null,
        endereco: vazio(f.endereco),
        horarios: vazio(f.horarios),
        ...(recursos.cores ? { capa_url: f.capa_url, cor_primaria: f.cor_primaria, cor_secundaria: f.cor_secundaria } : {}),
        ...(recursos.avaliacao ? { google_review_url: vazio(f.google_review_url) } : {}),
        ...(recursos.alerta ? { alerta_minutos: f.alerta_minutos } : {}),
      });
      setOk(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  const bloqueado = (texto: string) => <p className="flex items-center gap-1.5 text-sm text-grafite"><Lock className="h-3.5 w-3.5" /> {texto}</p>;

  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Estabelecimento</h1>
      <p className="text-sm text-grafite">Endereço do cardápio: /{slug}</p>
      <form onSubmit={salvar} className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Identidade</h2>
            <div>
              <label className="rotulo" htmlFor="nome">Nome</label>
              <input id="nome" required minLength={2} maxLength={80} {...txt("nome")} className="campo" />
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="rotulo">Logo</p>
                <label className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-pedra bg-papel">
                  {f.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-5 w-5 text-grafite" />
                  )}
                  {enviando === "logo" && <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-5 w-5 animate-spin" /></span>}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload("logo", e.target.files?.[0])} />
                </label>
              </div>
              <div className="min-w-[200px] flex-1">
                <p className="rotulo">Foto de capa</p>
                {recursos.cores ? (
                  <label className="relative flex h-24 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-pedra bg-papel">
                    {f.capa_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.capa_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Upload className="h-5 w-5 text-grafite" />
                    )}
                    {enviando === "capa" && <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-5 w-5 animate-spin" /></span>}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload("capa", e.target.files?.[0])} />
                  </label>
                ) : (
                  bloqueado("Disponível a partir do plano Profissional.")
                )}
              </div>
            </div>
            <div>
              <p className="rotulo">Cores</p>
              {recursos.cores ? (
                <div className="flex flex-wrap gap-4">
                  {(["cor_primaria", "cor_secundaria"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm font-semibold">
                      <input type="color" value={f[k] ?? (k === "cor_primaria" ? COR_PADRAO : "#17181C")} onChange={(e) => setF({ ...f, [k]: e.target.value.toUpperCase() })} className="h-10 w-14 cursor-pointer rounded-lg border border-pedra" />
                      {k === "cor_primaria" ? "Principal (botões)" : "Secundária"}
                    </label>
                  ))}
                  <button type="button" onClick={() => setF({ ...f, cor_primaria: null, cor_secundaria: null })} className="text-xs font-semibold text-grafite">Usar padrão</button>
                </div>
              ) : (
                bloqueado("Cores próprias a partir do plano Profissional. No Essencial, só o logo.")
              )}
            </div>
          </section>

          <section className="card grid gap-4 p-5 sm:grid-cols-2">
            <h2 className="font-bold sm:col-span-2">Contato</h2>
            <div>
              <label className="rotulo" htmlFor="insta">Instagram</label>
              <input id="insta" maxLength={31} placeholder="seuperfil" {...txt("instagram")} className="campo" />
            </div>
            <div>
              <label className="rotulo" htmlFor="whats">WhatsApp (com DDD)</label>
              <input id="whats" maxLength={20} inputMode="tel" placeholder="11999999999" {...txt("whatsapp")} className="campo" />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor="end">Endereço</label>
              <input id="end" maxLength={200} {...txt("endereco")} className="campo" />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor="hor">Horários</label>
              <textarea id="hor" maxLength={500} rows={2} placeholder="Ter a Dom, 18h às 23h" {...txt("horarios")} className="campo" />
            </div>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Atendimento</h2>
            <div>
              <label className="rotulo" htmlFor="google">Link de avaliação do Google</label>
              {recursos.avaliacao ? (
                <input id="google" type="url" maxLength={500} placeholder="https://g.page/r/..." {...txt("google_review_url")} className="campo" />
              ) : (
                bloqueado("Pedido de avaliação no Google no plano Completo.")
              )}
            </div>
            <div>
              <label className="rotulo" htmlFor="alerta">Alerta de atraso para o gerente (minutos)</label>
              {recursos.alerta ? (
                <input id="alerta" type="number" min={1} max={60} value={f.alerta_minutos} onChange={(e) => setF({ ...f, alerta_minutos: Math.max(1, Math.min(60, Number(e.target.value) || 5)) })} className="campo w-28" />
              ) : (
                bloqueado("Alerta de atraso no plano Completo.")
              )}
            </div>
            <div>
              <p className="rotulo">Modo de atendimento</p>
              <p className="text-sm text-grafite">O cliente chama o garçom pela mesa. No plano Completo, o garçom anota o pedido no celular dele e o pedido cai na tela da Cozinha (tablet ou celular) e/ou na impressora.</p>
            </div>
          </section>

          {erro && <p role="alert" className="text-sm font-semibold text-estado-vermelho">{erro}</p>}
          <div className="flex items-center gap-3">
            <button disabled={salvando || !!enviando} className="btn-escuro">{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</button>
            {ok && <span className="flex items-center gap-1 text-sm font-semibold text-estado-verde"><Check className="h-4 w-4" /> Salvo</span>}
          </div>
        </div>

        {/* prévia white-label */}
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <p className="rotulo">Prévia do que o cliente vê</p>
          <div style={temaVars(recursos.cores ? f.cor_primaria : null, recursos.cores ? f.cor_secundaria : null) as CSSProperties} className="rounded-[28px] border-[6px] border-carvao bg-papel p-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-marca text-xl font-bold text-marca-texto ring-4 ring-white">
              {f.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                f.nome.charAt(0).toUpperCase()
              )}
            </div>
            <p className="mt-2 text-sm font-extrabold">{f.nome || "Seu restaurante"}</p>
            <span className="selo mt-1 bg-white text-carvao">Mesa 01</span>
            <p className="mt-4 font-extrabold">Como podemos ajudar?</p>
            <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-marca py-4 text-sm font-extrabold text-marca-texto"><Bell className="h-4 w-4" /> Chamar garçom</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold">
              <div className="rounded-xl bg-white py-3 shadow-suave">Ver cardápio</div>
              <div className="rounded-xl bg-white py-3 shadow-suave">Pedir a conta</div>
            </div>
          </div>
        </aside>
      </form>
    </main>
  );
}
