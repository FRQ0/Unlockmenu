# Unlock Menu

SaaS multi-estabelecimento para restaurantes, bares, padarias, pizzarias, sorveterias e lanchonetes.
O cliente aproxima o celular da placa da mesa (QR + NFC), chama o garçom, pede a conta e vê os pratos
em vídeo ("Reels do prato"). A equipe recebe tudo em tempo real no painel.

**White-label:** o cliente final só vê o logo, o nome e as cores do estabelecimento. A marca Unlock Menu
aparece apenas no site de vendas, no login e nos painéis internos (há um teste automatizado que garante isso).

Segurança: veja **[SEGURANCA.md](SEGURANCA.md)**.

## Stack

Next.js 15 (App Router) + TypeScript + Tailwind · Supabase (Postgres, Auth, Realtime, Storage) · Vercel.

## O que já está pronto (Fase 1)

| Área | Rota |
|------|------|
| Tela da mesa: chamar garçom, pedir a conta, status em tempo real, avaliação no Google | `/{slug}/m/{token}` |
| Cardápio com busca, categorias, destaques, "Indisponível" | `/{slug}/m/{token}/cardapio` e `/{slug}/cardapio` |
| Reels do prato: tela cheia, deslizar, modo foto, som, "Combina com" | dentro do cardápio |
| Painel do garçom (PWA): grade de mesas, som, vibração, cronômetro, setores, push, alerta de atraso | `/app/garcom` |
| Painel do dono: chamados, tempo médio, pico por hora, ranking de garçons, pratos mais vistos | `/app/dono` |
| Admin do cardápio: arrastar e soltar, Disponível/Esgotado em 1 toque, upload com compressão | `/app/cardapio` |
| Mesas + PDF das placas com QR + link para NFC | `/app/mesas` |
| Identidade (logo, cores, capa), contato, Google, alerta | `/app/config` |
| Equipe (convidar, papel, PIN, desativar) | `/app/equipe` |
| Super-admin com 2FA: criar, plano, teste de 7 dias, pago, suspender, domínio | `/admin-master` |
| Site de vendas com demo ao vivo | `/` |
| Planos (fora do menu, só por link) | `/planos` |
| Site do estabelecimento (plano Completo) | `/{slug}` |
| Domínio próprio e subdomínio `{slug}.dominio` | middleware |

**Ainda não feito (fases 2 e 3):** pedido pelo celular com tela da cozinha e impressora (o banco e a segurança
já estão prontos: tabelas `orders`/`order_items` com RLS), fechamento de conta com valor, "Nossa história"
e galeria no site do estabelecimento, cobrança recorrente automática. Inglês/espanhol e happy hour aguardam aprovação.

## Planos

Um único sistema. Cada estabelecimento tem um `plano` (essencial | profissional | completo), e cada recurso é
liberado no **servidor** (rotas + gatilhos no Postgres), não só escondendo botão. A matriz fica em
`src/lib/plans.ts` e em `public.plan_features`, e um teste garante que as duas batem.

## Como colocar no ar

1. **Supabase:** crie um projeto. Em SQL Editor, rode na ordem os arquivos de `supabase/migrations/`
   (ou use `supabase db push` com a CLI). Em Authentication → Providers, deixe E-mail ligado e
   "Confirm email" desligado (a equipe é criada pelo dono). Ligue MFA (TOTP).
2. **Variáveis:** copie `.env.example` para `.env.local` e preencha.
   Na Vercel, cadastre as mesmas em Settings → Environment Variables.
3. **Demo:** `npm install && npm run seed:demo` cria os 3 estabelecimentos demo (um por plano) e mostra as senhas.
   Com `SUPERADMIN_EMAIL=seu@email` (usuário já criado no Supabase), você vira super-admin.
4. **Vercel:** importe o repositório. O `vercel.json` agenda o alerta de atraso a cada minuto
   (cron por minuto exige o plano Pro da Vercel; no Hobby, o alerta continua aparecendo no painel aberto).
5. **Domínio do cliente:** no `/admin-master`, informe o domínio. O cliente aponta um CNAME para a Vercel,
   e você adiciona o domínio no projeto da Vercel.
6. **Web Push:** `npx web-push generate-vapid-keys` e preencha `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.

## Desenvolvimento

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # testes de unidade e das travas da API
npm run test:db      # testes de RLS/planos num Postgres local (precisa do postgresql instalado)
npm run typecheck
npm run check:secrets
```

As imagens e vídeos em `public/demo-media/` são ilustrações provisórias para a demo.
Troque pelas fotos reais e pelos vídeos gerados por IA de cada prato.
