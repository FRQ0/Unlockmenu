# Segurança do Unlock Menu

Este arquivo mostra onde cada ponto de segurança dos dois vídeos de referência está implementado
e como é testado. Ele cobre a lista "20 coisas para o Claude antes de lançar seu app" (os itens 1 a 19
aparecem na gravação; o 20º é cortado antes de aparecer) e as 5 perguntas do segundo vídeo.

## Como verificar

```bash
npm test            # 58 testes: planos, travas da API (403), validação, white-label, cabeçalhos, upload
npm run test:db     # 54 testes no Postgres: RLS entre estabelecimentos, permissões por coluna, travas de plano
npm run check:secrets
```

O CI (`.github/workflows/ci.yml`) roda tudo isso a cada push.

## Lista "20 coisas antes de lançar"

| # | Item | Como está feito | Onde |
|---|------|-----------------|------|
| 1 | Esconder API keys | A service role só existe no servidor. `import "server-only"` quebra o build se alguém importar o arquivo num componente de navegador. O navegador só recebe a anon key, que é pública por design e não vale nada sem RLS. | `src/lib/supabase/admin.ts`, `src/lib/env.ts` |
| 2 | Limpar secrets do git | `.env*` no `.gitignore` (só `.env.example` vazio é versionado). O script `check:secrets` procura JWT, chaves privadas, Stripe, Asaas, Mercado Pago, AWS e GitHub em todo arquivo versionado. Roda no CI. | `.gitignore`, `scripts/check-secrets.mjs` |
| 3 | Public key no DB | O cliente usa a anon key. Por padrão o Supabase libera tudo para `anon`/`authenticated`, e a migração revoga isso (`revoke all ... from anon, authenticated`). O teste confirma que o anônimo leva "permission denied" em tudo. | `supabase/migrations/0002_rls.sql` |
| 4 | Ativar RLS | RLS ligado em todas as 16 tabelas, isolando por `tenant_id`. Chaves estrangeiras compostas `(id, tenant_id)` impedem até o servidor de ligar um prato à categoria de outro estabelecimento. | `0002_rls.sql`, `supabase/tests/rls_test.sql` |
| 5 | Criptografia de dados | Senhas pelo Supabase Auth (bcrypt). PIN do funcionário em bcrypt (`crypt`/`gen_salt('bf')`), e a coluna `pin_hash` nem é legível pelo cliente. O IP do cliente final é guardado só como HMAC, nunca puro. Não coletamos dado pessoal do cliente final (captação de WhatsApp foi recusada). HTTPS obrigatório e disco criptografado no Supabase. | `0003_functions.sql`, `src/lib/security.ts` |
| 6 | Auth server side | Toda página e rota do painel chama `supabase.auth.getUser()` no servidor, que valida o token no Supabase (não confia só no cookie). Papel e estabelecimento vêm do banco, nunca do navegador. | `src/lib/staff.ts`, `src/lib/route.ts` |
| 7 | Restringir acessos | Papéis dono/gerente/garçom/cozinha conferidos na rota e no RLS. Plano conferido no servidor (`requireFeature`) e de novo no banco (gatilhos). Super-admin exige 2FA (aal2). Teste vencido no 8º dia bloqueia tudo. | `src/lib/plans.ts`, `tests/api-gating.test.ts` |
| 8 | Bloquear mass assignment | Duas camadas: (1) Zod `.strict()` recusa qualquer campo fora da lista; (2) no Postgres, `grant update (colunas...)` por coluna. O dono não consegue mudar `plano`, `status`, `trial_ends_at` nem `tenant_id`, mesmo chamando o banco direto. | `src/lib/schemas.ts`, `0002_rls.sql` |
| 9 | Proteger cookies | Cookies de sessão `httpOnly`, `secure` (em produção) e `SameSite=Lax`. O refresh token nunca fica acessível ao JavaScript. O tempo real recebe só um access token curto. | `src/lib/supabase/server.ts`, `src/middleware.ts` |
| 10 | Hash nas senhas | Supabase Auth (bcrypt). Senha mínima de 10 caracteres para a equipe. PIN em bcrypt. | `src/lib/schemas.ts` |
| 11 | Rate limit | Contador no Postgres (falha fechada). Login: 10/IP e 5/e-mail a cada 15 min. PIN: 5/IP e 20/estabelecimento. 2FA: 5 a cada 15 min. Chamado: 20/IP, 3/mesa e 6/aparelho a cada 5 min, e 1 chamado aberto por mesa. Upload: 60/hora. | `public.rate_limit_hit`, `criar_chamado` |
| 12 | Bot protection | Cloudflare Turnstile no login (liga quando as chaves estão configuradas) e campo honeypot invisível. O cliente final não precisa disso: sem o token da mesa (128 bits) não há como chamar. | `src/app/login`, `src/lib/security.ts` |
| 13 | Queries parametrizadas | Nenhum SQL montado com texto: supabase-js/PostgREST parametriza tudo, e as funções SQL usam parâmetros, sem `EXECUTE` dinâmico. | `supabase/migrations` |
| 14 | Validação dos inputs | Zod em toda rota: tipos, tamanhos, regex (token só hexadecimal, URL só `https://`), listas fechadas. `CHECK` no banco repete as regras. Corpo da requisição tem limite de tamanho. | `src/lib/schemas.ts`, `src/lib/http.ts` |
| 15 | Vazar conteúdo | Erros genéricos para o cliente (nada de stack ou SQL). `poweredByHeader: false`, sem source maps em produção, `X-Robots-Tag: noindex` nos painéis, `robots.txt` bloqueando `/app`, `/api` e as mesas. | `src/lib/http.ts`, `next.config.mjs` |
| 16 | Restringir uploads | O bucket tem limite de tamanho e tipo. O navegador só envia com URL assinada emitida depois de conferir papel e plano. O servidor checa os bytes reais (não confia na extensão), limita a duração do vídeo e RE-ENCODA tudo (imagem → webp sem EXIF/GPS, vídeo → mp4 720p sem metadados). Caminho preso à pasta do estabelecimento. | `src/lib/media.ts`, `0004_storage.sql` |
| 17 | Trim respostas de API | As rotas devolvem só os campos necessários (`select` explícito). O cliente final recebe o primeiro nome do garçom e nada mais. Recursos fora do plano já saem removidos no servidor (ex.: `video_url` some no Essencial). | `src/lib/public-data.ts`, `status_chamado` |
| 18 | Security headers | CSP com nonce por requisição (`strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`), HSTS com preload, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e `COOP`. | `src/lib/csp.ts`, `src/middleware.ts` |
| 19 | Forçar HTTPS | Redirecionamento 308 para HTTPS em produção, mais HSTS e `upgrade-insecure-requests`. | `src/middleware.ts` |
| 20 | (cortado no vídeo) | Também feitos: proteção CSRF (checagem de `Origin` nas rotas que alteram dados), redirecionamento só interno (sem open redirect), proteção contra SSRF no PDF das placas, log de auditoria das ações do super-admin e cron com comparação em tempo constante. | `src/lib/http.ts`, `src/lib/placas.ts`, `audit_log` |

## Perguntas do segundo vídeo

| Pergunta | Resposta |
|----------|----------|
| Protegeu as rotas de API com autenticação? | Sim. Rotas `/api/app/*` passam por `staffRoute` (login + papel + CSRF), e `/api/admin/*` exigem super-admin com 2FA. As rotas públicas (`/api/public/*`) exigem o token secreto da mesa e têm rate limit. |
| Criptografou as senhas dos usuários no banco? | Sim: bcrypt via Supabase Auth, e PIN também em bcrypt. |
| Validou a quantidade de tentativas de login? | Sim: 10 por IP e 5 por e-mail a cada 15 min. PIN: 5 por IP. 2FA: 5 tentativas. |
| Criou as políticas de RLS nas tabelas? | Sim, em todas, com 54 testes automatizados provando o isolamento. |
| Salvou os dados do usuário com criptografia? | Senhas e PINs em hash. IP só como HMAC. Nenhum dado pessoal do cliente final é coletado. Tudo trafega em HTTPS e fica em disco criptografado no Supabase. |

## O que fazer ao publicar

1. Gerar segredos fortes: `openssl rand -hex 32` para `IP_HASH_SECRET` e `CRON_SECRET`.
2. Configurar o Turnstile (grátis na Cloudflare) e preencher as duas chaves.
3. No Supabase: Authentication → ligar "Leaked password protection" e MFA (TOTP).
4. No Supabase: Authentication → Rate limits (padrão já protege; revisar).
5. Nunca colocar a `SUPABASE_SERVICE_ROLE_KEY` em variável `NEXT_PUBLIC_*`.
6. Se uma chave vazar: gerar outra no Supabase (Settings → API) e trocar na Vercel.
