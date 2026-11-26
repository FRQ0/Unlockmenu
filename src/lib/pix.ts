// Pix "copia e cola" / QR com valor (padrão BR Code do Banco Central).
// Pix estático: não precisa de banco intermediário nem tem taxa. A confirmação é feita
// por quem recebe (olhando o app do banco). Para confirmação automática, ver integração com PSP.

function campo(id: string, valor: string) {
  return id + String(valor.length).padStart(2, "0") + valor;
}

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Remove acentos e caracteres fora do padrão (nome/cidade). */
function limpar(s: string, max: number) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .-]/g, "").trim().slice(0, max).toUpperCase();
}

export function pixCopiaECola(o: { chave: string; nome: string; cidade: string; valor: number; txid?: string; descricao?: string }): string {
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", o.chave.trim()) + (o.descricao ? campo("02", limpar(o.descricao, 40)) : "");
  const txid = (o.txid ?? "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const semCrc =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", o.valor.toFixed(2)) +
    campo("58", "BR") +
    campo("59", limpar(o.nome, 25) || "RECEBEDOR") +
    campo("60", limpar(o.cidade, 15) || "BRASIL") +
    campo("62", campo("05", txid)) +
    "6304";
  return semCrc + crc16(semCrc);
}
