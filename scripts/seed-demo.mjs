// Cria os 3 estabelecimentos demo (um por plano) no seu projeto Supabase.
// Uso: npm run seed:demo   (lê .env.local; precisa da SUPABASE_SERVICE_ROLE_KEY)
// Opcional: SUPERADMIN_EMAIL=voce@email.com para virar super-admin (o usuário precisa existir).
//
// As senhas são geradas na hora e mostradas UMA vez no terminal. Guarde-as.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const senha = () => randomBytes(9).toString("base64url");
const MIDIA = path.join(process.cwd(), "public/demo-media");
const contas = [];

async function subir(arquivo, tipo) {
  const corpo = await readFile(path.join(MIDIA, arquivo));
  const destino = `demo/${arquivo}`;
  const { error } = await db.storage.from("media").upload(destino, corpo, { contentType: tipo, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`upload ${arquivo}: ${error.message}`);
  return db.storage.from("media").getPublicUrl(destino).data.publicUrl;
}

async function usuario(email, nome) {
  const s = senha();
  const { data, error } = await db.auth.admin.createUser({ email, password: s, email_confirm: true, user_metadata: { nome } });
  if (error) {
    const { data: lista } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = lista?.users.find((x) => x.email === email);
    if (!u) throw error;
    contas.push({ email, senha: "(já existia, senha mantida)" });
    return u.id;
  }
  contas.push({ email, senha: s });
  return data.user.id;
}

async function tenant(slug, nome, plano, cor) {
  const { data: existe } = await db.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (existe) {
    console.log(`• ${slug} já existe, pulando`);
    return null;
  }
  const { data, error } = await db
    .from("tenants")
    .insert({ slug, nome, plano, status: "ativo", cor_primaria: cor, instagram: "seuperfil", horarios: "Ter a Dom · 18h às 23h30", endereco: "Rua Exemplo, 123 - Centro" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const PRATOS = [
  { nome: "Pizza Margherita", cat: "Pizzas", preco: 62, antigo: 69.9, img: "pizza", video: true, destaque: true, desc: "Massa de fermentação natural, molho de tomate italiano, muçarela de búfala e manjericão.", tags: ["vegetariano"] },
  { nome: "Picanha na chapa", cat: "Pratos", preco: 89.9, img: "picanha", video: true, destaque: true, desc: "400 g de picanha com farofa da casa, vinagrete e mandioca frita." },
  { nome: "Hambúrguer da casa", cat: "Pratos", preco: 38, img: "hamburguer", video: true, desc: "Blend de 180 g, queijo prato, bacon crocante e molho especial no pão brioche." },
  { nome: "Risoto de cogumelos", cat: "Pratos", preco: 54, img: "risoto", desc: "Arbóreo cremoso com mix de cogumelos frescos e parmesão.", disponivel: false },
  { nome: "Salada da horta", cat: "Pratos", preco: 32, img: "salada", desc: "Folhas, tomate cereja, pepino e molho de mostarda e mel.", tags: ["vegano", "sem_gluten"] },
  { nome: "Pão de queijo (6 un.)", cat: "Entradas", preco: 18, img: "pao-de-queijo", desc: "Feito na casa, sai quentinho." },
  { nome: "Cerveja artesanal", cat: "Bebidas", preco: 18, img: "cerveja", video: true, desc: "IPA local, 500 ml." },
  { nome: "Refrigerante lata", cat: "Bebidas", preco: 7, img: "refrigerante", desc: "350 ml." },
  { nome: "Tiramisù", cat: "Sobremesas", preco: 24, img: "tiramisu", video: true, destaque: true, desc: "Biscoito embebido em café, creme de mascarpone e cacau." },
  { nome: "Brownie com sorvete", cat: "Sobremesas", preco: 22, img: "brownie", desc: "Brownie quente com sorvete de creme." },
];
const COMBINA = { "Pizza Margherita": ["Cerveja artesanal", "Tiramisù"], "Picanha na chapa": ["Cerveja artesanal", "Refrigerante lata"], "Hambúrguer da casa": ["Refrigerante lata", "Brownie com sorvete"] };

async function cardapio(tenantId, { videos, combina, limite }) {
  const nomesCat = [...new Set(PRATOS.map((p) => p.cat))];
  const { data: cats, error } = await db.from("categories").insert(nomesCat.map((nome, ordem) => ({ tenant_id: tenantId, nome, ordem }))).select("id,nome");
  if (error) throw error;
  const catId = Object.fromEntries(cats.map((c) => [c.nome, c.id]));
  const linhas = [];
  for (const [ordem, p] of PRATOS.slice(0, limite).entries()) {
    const foto = await subir(`${p.img}.jpg`, "image/jpeg");
    const comVideo = videos && p.video;
    linhas.push({
      tenant_id: tenantId,
      categoria_id: catId[p.cat],
      nome: p.nome,
      descricao: p.desc,
      preco: p.preco,
      preco_antigo: p.antigo ?? null,
      foto_url: foto,
      video_url: comVideo ? await subir(`${p.img}.mp4`, "video/mp4") : null,
      poster_url: comVideo ? await subir(`${p.img}-poster.jpg`, "image/jpeg") : null,
      destaque: !!p.destaque,
      disponivel: p.disponivel !== false,
      tags: p.tags ?? [],
      ordem,
    });
  }
  const { data: prods, error: e2 } = await db.from("products").insert(linhas).select("id,nome");
  if (e2) throw e2;
  if (combina) {
    const id = Object.fromEntries(prods.map((p) => [p.nome, p.id]));
    for (const [prato, sugestoes] of Object.entries(COMBINA)) {
      await db.from("products").update({ combina_com: sugestoes.map((s) => id[s]).filter(Boolean) }).eq("id", id[prato]);
    }
  }
}

async function mesas(tenantId, qtd, comSetor) {
  const linhas = Array.from({ length: qtd }, (_, i) => ({
    tenant_id: tenantId,
    nome: `Mesa ${String(i + 1).padStart(2, "0")}`,
    area: comSetor ? (i < 5 ? "Salão" : "Varanda") : null,
    ordem: i,
  }));
  const { error } = await db.from("tables").insert(linhas);
  if (error) throw error;
}

async function membro(tenantId, email, nome, papel, setores = []) {
  const userId = await usuario(email, nome);
  const { error } = await db.from("memberships").insert({ tenant_id: tenantId, user_id: userId, papel, nome, setores });
  if (error && error.code !== "23505") throw error;
}

const dominio = process.env.SEED_EMAIL_DOMAIN || "example.com";

// Completo: 10 pratos (5 com vídeo), 8 mesas, 2 garçons
const c = await tenant("demo-completo", "Cantina Demo", "completo", "#B65A52");
if (c) {
  await cardapio(c, { videos: true, combina: true, limite: 10 });
  await mesas(c, 8, true);
  await db.from("tenants").update({ google_review_url: "https://g.page/r/exemplo/review" }).eq("id", c);
  await membro(c, `dono.completo@${dominio}`, "Dono Demo", "dono");
  await membro(c, `garcom1@${dominio}`, "Gui Garçom", "garcom", ["Salão"]);
  await membro(c, `garcom2@${dominio}`, "Lia Garçonete", "garcom", ["Varanda"]);
  console.log("✔ demo-completo");
}
const p = await tenant("demo-profissional", "Pizzaria Demo", "profissional", "#3F7A5F");
if (p) {
  await cardapio(p, { videos: true, combina: false, limite: 8 });
  await mesas(p, 6, false);
  await membro(p, `dono.profissional@${dominio}`, "Dono Pro", "dono");
  console.log("✔ demo-profissional");
}
const e = await tenant("demo-essencial", "Padaria Demo", "essencial", null);
if (e) {
  await cardapio(e, { videos: false, combina: false, limite: 6 });
  await mesas(e, 4, false);
  await membro(e, `dono.essencial@${dominio}`, "Dono Essencial", "dono");
  console.log("✔ demo-essencial");
}

if (process.env.SUPERADMIN_EMAIL) {
  const { data: lista } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = lista?.users.find((x) => x.email === process.env.SUPERADMIN_EMAIL);
  if (u) {
    await db.from("platform_admins").upsert({ user_id: u.id });
    console.log(`✔ ${u.email} agora é super-admin (vai pedir 2FA no primeiro acesso a /admin-master)`);
  } else {
    console.log("! SUPERADMIN_EMAIL não encontrado: crie o usuário em Authentication > Users e rode de novo");
  }
}

if (contas.length) {
  console.log("\nAcessos criados (guarde agora, não aparecem de novo):");
  console.table(contas);
}
