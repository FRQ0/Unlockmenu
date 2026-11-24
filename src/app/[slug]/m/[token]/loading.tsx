// Esqueleto neutro (sem marca nenhuma) enquanto a tela da mesa carrega.
export default function Carregando() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md animate-pulse flex-col items-center px-5 pt-8" aria-busy="true" aria-label="Carregando">
      <div className="h-[76px] w-[76px] rounded-full bg-pedra" />
      <div className="mt-3 h-5 w-40 rounded-lg bg-pedra" />
      <div className="mt-10 h-7 w-56 rounded-lg bg-pedra" />
      <div className="mt-6 h-32 w-full rounded-[22px] bg-pedra" />
      <div className="mt-4 grid w-full grid-cols-2 gap-3">
        <div className="h-24 rounded-[18px] bg-white" />
        <div className="h-24 rounded-[18px] bg-white" />
      </div>
    </main>
  );
}
