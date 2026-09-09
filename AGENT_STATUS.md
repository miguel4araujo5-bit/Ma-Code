# MA-CODE — Estado operacional único dos agentes

Atualizado por: coordenação unificada A1–A6
Data: 2026-09-09
Fonte técnica: `main` confirmada em `77e8b2811dcc1f08829cd51789dd8bfc67d97d61`.

## Estado global

**Não existem neste momento trabalhos funcionais bloqueantes ou lotes ativos registados no GitHub.**

Estado confirmado:
- PRs abertos: **0**;
- issues abertos: **0**;
- `main` atual: `77e8b2811dcc1f08829cd51789dd8bfc67d97d61`;
- Build Check pós-merge #1697: **SUCCESS**;
- Conquistador: **PASS**;
- MA-Professor: **PASS**;
- MA-Quadro: **PASS**;
- build global: **PASS**.

## Trabalhos recentemente fechados

### PR #43 — MA-ADMIN — Cortar acesso sem apagar dados

Integrado em `main` no commit:

`ff7d2d4897be70ded18550154991b0545b0e5f88`

Contrato preservado:
- cortar acesso revoga a licença e invalida sessões ativas;
- conta, credencial/configuração e dados cifrados cloud são preservados;
- `Repor acesso` mantém a semântica própria;
- `Apagar utilizador` continua distinto e remove os dados cloud correspondentes.

### Issue #44 / PR #47 — avaliação em aula futura com aviso e saída segura

Resolvido e integrado em `main` no commit:

`77e8b2811dcc1f08829cd51789dd8bfc67d97d61`

Contrato validado:
- avaliações permitidas em aulas `planned`, incluindo futuras;
- avaliação futura não transforma a aula em `taught`;
- GIAE futuro continua bloqueado;
- assiduidade futura continua bloqueada;
- aulas `cancelled` continuam protegidas;
- guard stale/concurrency preservado;
- falha de save antes de navegar permite `Sair sem guardar` ou `Ficar e corrigir`;
- aviso `🚨` não bloqueante para aula futura;
- estados de aula ficam protegidos contra incoerência com evidência pedagógica persistida.

Prova pós-merge em `main`:
- workflow Build Check #1697 — `success`;
- Conquistador — PASS;
- MA-Professor — PASS;
- MA-Quadro — PASS;
- project build — PASS.

## Estado dos quadros antigos

`A1_BLOCKER_BOARD.md` permanece apenas como histórico e não representa trabalho atual.
`AGENT_MESSAGES.md` permanece append-only e histórico.
Este `AGENT_STATUS.md` é o resumo operacional atual.

## Seguimentos operacionais não bloqueantes

### 1. Política de deploy/preview de branches — por confirmar

Foi observado anteriormente um comentário automático da Cloudflare com `Deployment successful` numa branch/PR de trabalho.

O workflow GitHub atual `.github/workflows/deploy.yml` **não contém qualquer comando de deploy**: em PR e push para `main` limita-se a instalar dependências, correr testes e executar o build. Assim, qualquer preview/deployment automático de branches provém de integração externa à GitHub Action e não deste workflow.

Pendência: confirmar na configuração Cloudflare se branches/PRs criam apenas previews isolados ou se alguma configuração pode promover uma branch de trabalho para produção. Até essa confirmação, tratar esta matéria como risco operacional, não como bug funcional do código.

### 2. UX opcional — dados cloud vs dados deste dispositivo

Melhoria futura, não bloqueante: tornar ainda mais explícita na interface a diferença entre apagar o utilizador/dados cloud e apagar dados locais deste dispositivo. Não apagar IndexedDB local remotamente ou de forma silenciosa.

### 3. CryptoSetupGate — apenas se voltar a ser ativado

A investigação `NEXT-CRYPTO-RECOVERY-01` permanece arquivada. Existe um risco histórico num caminho atualmente inativo e sem consumidor produtivo confirmado. Se `CryptoSetupGate` voltar a ser montado no produto, corrigir/revalidar esse caminho antes da ativação.

## Regra operacional a partir de agora

1. `main` é a única base funcional autorizada.
2. O agente unificado assume internamente A1–A6.
3. Não retomar branches/SHAs antigos sem comparação contra a `main` atual.
4. Nova tarefa começa por diagnóstico verificável na `main` atual.
5. Alterações de risco elevado exigem branch isolada, testes proporcionais, revisão do SHA exato e gate global antes do merge.
6. Sem novo finding ou pedido do utilizador, o estado funcional atual é **fila vazia / verde**.
