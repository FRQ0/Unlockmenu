// Validação de entrada. Todos os objetos são .strict(): campo que não está na lista
// (ex.: "plano", "tenant_id", "status") faz a requisição ser recusada → sem mass assignment.
import { z } from "zod";
import { PLANOS } from "./plans";

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);
const urlHttps = z.string().trim().url().max(500).refine((u) => u.startsWith("https://"), "Use https");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const preco = z.coerce.number().min(0).max(99999.99).transform((n) => Math.round(n * 100) / 100);

export const uuid = z.string().uuid();

export const categoriaCriar = z.object({ nome: texto(1, 40) }).strict();
export const categoriaEditar = z.object({ nome: texto(1, 40).optional(), ativa: z.boolean().optional() }).strict();

export const TAGS = ["vegano", "vegetariano", "sem_gluten", "sem_lactose", "picante"] as const;

export const produtoBase = z
  .object({
    categoria_id: uuid.nullable(),
    nome: texto(1, 80),
    descricao: z.string().trim().max(500).nullable(),
    preco,
    preco_antigo: preco.nullable(),
    foto_url: urlHttps.nullable(),
    video_url: urlHttps.nullable(),
    poster_url: urlHttps.nullable(),
    destaque: z.boolean(),
    disponivel: z.boolean(),
    tags: z.array(z.enum(TAGS)).max(5),
    combina_com: z.array(uuid).max(2),
  })
  .strict();
export const produtoCriar = produtoBase.partial().required({ nome: true, preco: true }).strict();
export const produtoEditar = produtoBase.partial().strict();

export const reordenar = z.object({ ids: z.array(uuid).min(1).max(500) }).strict();

export const mesaCriar = z
  .object({
    nome: texto(1, 30).optional(),
    area: z.string().trim().max(30).nullable().optional(),
    quantidade: z.number().int().min(1).max(50).optional(),
  })
  .strict();
export const mesaEditar = z
  .object({ nome: texto(1, 30).optional(), area: z.string().trim().max(30).nullable().optional(), ativa: z.boolean().optional() })
  .strict();

export const configTenant = z
  .object({
    nome: texto(2, 80),
    logo_url: urlHttps.nullable(),
    capa_url: urlHttps.nullable(),
    cor_primaria: hex.nullable(),
    cor_secundaria: hex.nullable(),
    instagram: z.string().trim().regex(/^[A-Za-z0-9._]{1,30}$/).nullable(),
    whatsapp: z.string().trim().regex(/^[0-9]{10,15}$/).nullable(),
    endereco: z.string().trim().max(200).nullable(),
    horarios: z.string().trim().max(500).nullable(),
    google_review_url: urlHttps.nullable(),
    modo_atendimento: z.enum(["chamar", "chamar_pedir"]),
    alerta_minutos: z.number().int().min(1).max(60),
    pix_chave: z.string().trim().min(3).max(77).nullable(),
    pix_nome: z.string().trim().min(1).max(25).nullable(),
    pix_cidade: z.string().trim().min(1).max(15).nullable(),
  })
  .partial()
  .strict();

export const chamadoAtualizar = z.object({ status: z.enum(["a_caminho", "atendido", "cancelado"]) }).strict();

export const chamadoPublico = z
  .object({ slug: z.string().regex(/^[a-z0-9-]{3,40}$/), token: z.string().regex(/^[a-f0-9]{16,64}$/), tipo: z.enum(["garcom", "conta"]) })
  .strict();
export const chamadoPublicoRef = z
  .object({ token: z.string().regex(/^[a-f0-9]{16,64}$/), id: uuid })
  .strict();

export const eventoPublico = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
    token: z.string().regex(/^[a-f0-9]{16,64}$/).nullable().optional(),
    tipo: z.enum(["view_cardapio", "view_produto", "play_reels", "click_combina", "click_avaliacao"]),
    product_id: uuid.nullable().optional(),
  })
  .strict();

const senha = z.string().min(10, "Mínimo de 10 caracteres").max(72);
export const PAPEIS = ["dono", "gerente", "garcom", "cozinha"] as const;

export const funcionarioCriar = z
  .object({
    nome: texto(1, 60),
    email: z.string().trim().toLowerCase().email().max(120),
    senha,
    papel: z.enum(["gerente", "garcom", "cozinha"]),
    setores: z.array(texto(1, 30)).max(10).optional(),
  })
  .strict();
export const funcionarioEditar = z
  .object({
    nome: texto(1, 60).optional(),
    papel: z.enum(["gerente", "garcom", "cozinha"]).optional(),
    setores: z.array(texto(1, 30)).max(10).optional(),
    ativo: z.boolean().optional(),
    pin: z.string().regex(/^[0-9]{4,6}$/).nullable().optional(),
  })
  .strict();

export const login = z
  .object({
    email: z.string().trim().toLowerCase().email().max(120),
    senha: z.string().min(1).max(72),
    turnstile: z.string().max(2048).optional(),
    site: z.string().max(0).optional(), // honeypot: robô preenche, humano não vê
    next: z.string().max(200).optional(),
  })
  .strict();
export const loginPin = z
  .object({ slug: z.string().regex(/^[a-z0-9-]{3,40}$/), pin: z.string().regex(/^[0-9]{4,6}$/), turnstile: z.string().max(2048).optional() })
  .strict();

export const tenantCriar = z
  .object({
    nome: texto(2, 80),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(40),
    plano: z.enum(PLANOS),
    dono_nome: texto(1, 60),
    dono_email: z.string().trim().toLowerCase().email().max(120),
    dono_senha: senha,
    iniciar_teste: z.boolean(),
  })
  .strict();
export const tenantAdmin = z
  .object({
    acao: z.enum(["plano", "iniciar_teste", "ativar", "suspender", "dominio"]),
    plano: z.enum(PLANOS).optional(),
    pago_ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dominio_custom: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/).max(120).nullable().optional(),
  })
  .strict();

export const pushInscrever = z
  .object({ endpoint: urlHttps, keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }).strict() })
  .strict();

export const midiaPedirUpload = z
  .object({ tipo: z.enum(["foto", "video", "logo", "capa"]), mime: z.string().max(40), tamanho: z.number().int().positive() })
  .strict();
export const midiaProcessar = z
  .object({ tipo: z.enum(["foto", "video", "logo", "capa"]), caminho: z.string().max(200) })
  .strict();

/** Redirecionamento só para caminhos internos (evita open redirect). */
export function caminhoInterno(next: string | undefined | null, padrao = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return padrao;
  return next;
}

export const pedidoCriar = z
  .object({
    table_id: uuid,
    itens: z
      .array(z.object({ product_id: uuid, quantidade: z.number().int().min(1).max(50), observacao: z.string().trim().max(200).optional() }).strict())
      .min(1)
      .max(50),
    observacao: z.string().trim().max(200).optional(),
  })
  .strict();
export const pedidoStatus = z.object({ status: z.enum(["preparando", "pronto", "entregue", "cancelado"]) }).strict();

const pagamento = z
  .object({
    metodo: z.enum(["pix", "debito", "credito", "dinheiro"]),
    valor: z.number().positive().max(99999.99).transform((n) => Math.round(n * 100) / 100),
    recebido: z.number().positive().max(99999.99).optional(),
  })
  .strict();
export const vendaFichas = z
  .object({
    itens: z.array(z.object({ product_id: uuid, quantidade: z.number().int().min(1).max(50) }).strict()).min(1).max(50),
    pagamentos: z.array(pagamento).min(1).max(10),
  })
  .strict();
export const pagamentoMesa = z.object({ pagamentos: z.array(pagamento).min(1).max(10) }).strict();
export const usarFicha = z.object({ codigo: z.string().trim().min(4).max(20) }).strict();
