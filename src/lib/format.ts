const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const preco = (n: number) => brl.format(n);

export function minutosDesde(iso: string, agora = Date.now()) {
  return Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000));
}

export function cronometro(iso: string, agora = Date.now()) {
  const s = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export const TAG_NOME: Record<string, string> = {
  vegano: "Vegano",
  vegetariano: "Vegetariano",
  sem_gluten: "Sem glúten",
  sem_lactose: "Sem lactose",
  picante: "Picante",
};
