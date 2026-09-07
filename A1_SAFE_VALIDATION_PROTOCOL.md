# A1 — Protocolo de validação segura sem promoção Cloudflare

Data: 2026-09-08
Owner: A1-G2
Estado: ATIVO

## Problema

`DEPLOY-PR-01` surgiu porque a integração Cloudflare Workers Builds cria checks/comentários a partir de branches/PRs de trabalho. O GitHub Actions do repositório, por outro lado, é um workflow de validação (`Build Check`) e não contém `wrangler deploy`.

O objetivo é permitir desenvolvimento e validação dos HEADs existentes sem desfazer branches, rebasear lotes, repetir trabalho ou arriscar uma promoção de produção apenas para obter CI.

## Evidência técnica consolidada

- O repositório tem `default_branch = main`.
- `.github/workflows/deploy.yml` contém `workflow_dispatch` e executa testes/build; não executa `wrangler deploy`.
- GitHub suporta execução manual de um workflow com `ref` de uma branch existente.
- O GitHub App Cloudflare observado neste repositório subscreve `push` e `pull_request`; `workflow_dispatch` não é um desses eventos.
- O repositório não contém um comando `wrangler deploy` no workflow GitHub nem no `package.json`.
- A documentação Cloudflare Workers Builds indica que branches não-production usam por defeito `npx wrangler versions upload`, que cria uma versão sem a promover imediatamente para produção. A configuração privada pode, contudo, personalizar esse comando.
- O MA-CODE usa Durable Objects, pelo que a ausência de preview URL numa branch não prova promoção de produção.

## Política A1 obrigatória

1. **Preservar HEADs existentes.** Não rebasear, não fazer force-push, não reconstruir lotes já produzidos apenas para obter CI.
2. **Não abrir PR nem fazer push só para validar.** Para HEADs já existentes, usar preferencialmente `workflow_dispatch` no workflow `Build Check`, selecionando a branch exata.
3. **O run só vale para A6 se o `head_sha` for exatamente o SHA revisto.**
4. **Commits funcionais novos continuam permitidos apenas quando necessários ao próprio finding/lote**, depois de teste local proporcional e evitando commits/pushes intermédios sem valor técnico.
5. **Nenhum commit em `main` é autorizado por este protocolo.** A `main` só muda após candidato combinado, revisão A6 e aprovação explícita do utilizador.
6. **Não usar Cloudflare Workers Builds como mecanismo de CI.** Cloudflare é deployment/versioning; GitHub Actions é a prova de build/teste.

## Configuração Cloudflare recomendada para fechar definitivamente `DEPLOY-PR-01`

Configuração mais segura e simples no Worker `ma-code`:

- Production branch: `main`.
- `Builds for non-production branches`: **OFF** durante esta fase de desenvolvimento.
- Manter o deploy de produção reservado à `main`.

Com isto, pushes para branches de agentes deixam de iniciar Workers Builds. A validação passa a ser feita por GitHub Actions via `workflow_dispatch`.

Alternativa, se for necessário manter Workers Builds em branches não-production:

- non-production branch deploy command = `npx wrangler versions upload`.

Fallback de emergência, se se quiser impedir qualquer promoção automática temporariamente, inclusive em produção:

- deploy command = `npx wrangler versions upload` até ao candidato final;
- restaurar `npx wrangler deploy` apenas no checkpoint de publicação aprovado pelo utilizador.

A1 não altera estas definições privadas sem acesso/autorização ao Cloudflare.

## Ações por agente

### A2-G2

- Manter `a3d07b8e...` como evidência intermédia.
- Executar o follow-up stale-cache/hex já autorizado.
- Testar localmente antes de produzir novo HEAD.
- Evitar pushes intermédios; entregar um HEAD final isolado.
- CI final: `workflow_dispatch` na branch exata; A6 revê o novo SHA.

### A3-G2

- Cores `64e31493...`: congelado; não alterar. Prova executável via teste local + `workflow_dispatch`.
- Xadrez: desenvolver na branch separada; não tocar no extrator partilhado sem A1.
- PT-PT: branch separada depois do Xadrez.
- Não misturar lotes nem alterar PR #23 congelado.

### A4-G2

- GIAE `ba87e698...`: congelado.
- Executar testes locais e entregar resultados.
- CI final por `workflow_dispatch` na branch exata.
- Não misturar com Daily nem tocar em `lessonRepositoryBase.ts`.

### A5-G2

- Nenhuma reabertura do lote Backup APTO.
- Continua apenas análise de preservação/privacidade do Excel quando solicitada pelo A1.

### A6-G2

- Aceitar `Build Check` por `workflow_dispatch` como evidência executável quando `head_sha` = SHA revisto.
- Manter parecer por SHA exato e limitações explícitas.
- Não criar PR/push para obter CI e não autorizar merge/main.

## Regra de publicação

Fluxo final permanece:

HEADs fechados → candidato único A1 → suites/build/smokes → revisão final A6 no SHA combinado → aprovação explícita do utilizador → só então merge/publicação em `main`.
