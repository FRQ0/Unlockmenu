// Procura segredos nos arquivos versionados (rode antes de cada push; o CI também roda).
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PADROES = [
  [/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, "JWT (chave do Supabase?)"],
  [/sb_secret_[A-Za-z0-9_-]{20,}/, "chave secreta do Supabase"],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, "chave privada"],
  [/sk_live_[A-Za-z0-9]{20,}/, "chave Stripe"],
  [/\$aact_[A-Za-z0-9]{20,}/, "chave Asaas"],
  [/APP_USR-[0-9a-f-]{20,}/, "chave Mercado Pago"],
  [/AKIA[0-9A-Z]{16}/, "chave AWS"],
  [/ghp_[A-Za-z0-9]{30,}/, "token GitHub"],
  [/(SERVICE_ROLE_KEY|VAPID_PRIVATE_KEY|TURNSTILE_SECRET_KEY|CRON_SECRET|IP_HASH_SECRET)[ \t]*=[ \t]*[^\s#]{12,}/, "variável secreta preenchida"],
];

const arquivos = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
let achou = 0;
for (const f of arquivos) {
  if (/\.(png|jpg|jpeg|webp|mp4|woff2?|ico|pdf)$/i.test(f)) continue;
  if (/^\.env(\..*)?$/.test(f.split("/").pop()) && !f.endsWith(".env.example")) {
    console.error(`✖ ${f}: arquivo .env versionado`);
    achou++;
    continue;
  }
  const txt = readFileSync(f, "utf8");
  for (const [re, nome] of PADROES) {
    if (re.test(txt)) {
      console.error(`✖ ${f}: possível ${nome}`);
      achou++;
    }
  }
}
if (achou) {
  console.error(`\n${achou} problema(s). Remova o segredo, troque a chave no provedor e limpe o histórico do git.`);
  process.exit(1);
}
console.log(`✔ nenhum segredo encontrado em ${arquivos.length} arquivos`);
