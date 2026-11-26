import type { Plano } from "./plans";

export type Papel = "dono" | "gerente" | "garcom" | "cozinha";
export type ChamadoStatus = "aberto" | "a_caminho" | "atendido" | "cancelado";
export type ChamadoTipo = "garcom" | "conta";

export type Tenant = {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  capa_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  instagram: string | null;
  whatsapp: string | null;
  endereco: string | null;
  horarios: string | null;
  google_review_url: string | null;
  modo_atendimento: "chamar" | "chamar_pedir";
  alerta_minutos: number;
  plano: Plano;
  status: "teste" | "ativo" | "suspenso";
  trial_ends_at: string | null;
  pago_ate: string | null;
  dominio_custom: string | null;
  pix_chave: string | null;
  pix_nome: string | null;
  pix_cidade: string | null;
  infinitepay_handle: string | null;
  created_at: string;
};

export type Membership = {
  id: string;
  tenant_id: string;
  user_id: string;
  papel: Papel;
  nome: string;
  setores: string[];
  ativo: boolean;
};

export type Mesa = { id: string; tenant_id: string; nome: string; token_publico: string; area: string | null; ordem: number; ativa: boolean };
export type Categoria = { id: string; tenant_id: string; nome: string; ordem: number; ativa: boolean };
export type Produto = {
  id: string;
  tenant_id: string;
  categoria_id: string | null;
  nome: string;
  descricao: string | null;
  preco: number;
  preco_antigo: number | null;
  foto_url: string | null;
  video_url: string | null;
  poster_url: string | null;
  destaque: boolean;
  disponivel: boolean;
  ordem: number;
  tags: string[];
  combina_com: string[];
};
export type Chamado = {
  id: string;
  tenant_id: string;
  table_id: string;
  tipo: ChamadoTipo;
  status: ChamadoStatus;
  criado_em: string;
  aceito_em: string | null;
  aceito_por: string | null;
  atendido_em: string | null;
  atendido_por: string | null;
};

export const TENANT_COLS =
  "id,nome,slug,logo_url,capa_url,cor_primaria,cor_secundaria,instagram,whatsapp,endereco,horarios,google_review_url,modo_atendimento,alerta_minutos,plano,status,trial_ends_at,pago_ate,dominio_custom,pix_chave,pix_nome,pix_cidade,infinitepay_handle,created_at";
export const PRODUTO_COLS =
  "id,tenant_id,categoria_id,nome,descricao,preco,preco_antigo,foto_url,video_url,poster_url,destaque,disponivel,ordem,tags,combina_com";
