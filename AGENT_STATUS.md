# MA-CODE — Estado consolidado dos agentes

Atualizado por: AGENTE 1 — SEGUNDA GERAÇÃO (A1-G2)
Sessão: A1-G2
Data da verificação: 2026-09-07T13:22:00+01:00
Último evento processado no canal ativo: `A4-20260907T120048Z-cfdep`
Evidência externa mais recente processada: parecer A6-G2 no PR #29, 2026-09-07T12:21:13Z, HEAD `df7098fe510aa79fc72bde035053389045a8d117` — **APTO**.
Fonte técnica: `main` confirmada em `344841c1fc402e813f9d8658d96fa20b0fefa779`; este ficheiro é coordenação e não substitui a `main`.

## Regra obrigatória de comunicação direta

A instrução do utilizador de 2026-09-07 elimina o utilizador como intermediário normal entre agentes. O AGENTE 1 formalizou a regra em `AGENT_PROTOCOL_V1_1.md`, commit `492cbd1423f962612089a4bf1eb4f93472f12b64`.

- pedidos de coordenação, dependências, bloqueios, ownership, entregas, testes/revisões e handoffs devem ser publicados diretamente em `AGENT_MESSAGES.md`;
- nenhum agente com acesso ao canal pede ao utilizador para copiar ou encaminhar mensagens;
- antes de repetir um pedido, verificar a referência existente;
- publicar não significa que o destinatário leu ou executou;
- perguntas exclusivamente dependentes do utilizador são centralizadas pelo A1-G2;
- apenas A1-G2 altera `AGENT_STATUS.md` e as regras do protocolo;
- a conversa de cada agente resume apenas o que concluiu, o que efetivamente publicou e o que falta.

Nada nesta regra altera ownership, revisões, branches APTO ou a proibição de publicar na `main` sem aprovação explícita do utilizador.

## Transição G2 e exclusividade

- A1-G2 substitui o A1 anterior e é o único orquestrador ativo.
- A passagem de responsabilidade para A2-G2, A3-G2, A4-G2, A5-G2 e A6-G2 está reconhecida; os antecessores não ficam autorizados a novos writes funcionais.
- Persistência central, tipos centrais, composição, navegação, `lessonRepositoryBase.ts`, contratos partilhados, Worker entrypoints, configurações e migrações permanecem reservados ao A1-G2 salvo transferência explícita.
- Um lote APTO fica congelado no SHA exato indicado; qualquer alteração perde o parecer anterior.
- Lotes empilhados/contidos não são integrados duas vezes.
- Qualquer HEAD candidato combinado exige diff controlado, suites aplicáveis, build, smokes proporcionais ao risco e nova revisão A6 no SHA combinado.
- Nada é integrado/publicado em `main` sem aprovação explícita do utilizador para o lote concreto.

## Incidentes do canal e publicação automática

`COMM-01` — histórico imutável violado por atualização anterior. O commit `5f4ace3b3282eb8a22c63c680eac3f6a6770a36b` publicou `A5-20260907T102830Z-g2r5`; o commit descendente `e623cb6fd05eb7eb59f0765f1bfbf9f2b26ceb5b` retirou essa mensagem do conteúdo ativo. A evidência permanece na história Git. Não usar reset/force-push; eventual reposição deve ser por novo evento/append verificável.

`COMM-02` — o commit `02cb96ddbe03a66903379ad02c3c717c8fcf0888`, ao acrescentar `A4-20260907T113222Z-daily01`, também alterou texto de um evento histórico. Qualquer retificação futura deve ser feita por novo evento; nunca editar mensagens antigas.

`COMM-03` — após o alerta Cloudflare do A4, o commit `b340a930e94822e4c42ebf93f0da1eb941b6d1a5` acrescentou o evento correto, mas também alterou duas mensagens históricas. O commit seguinte `0b4d9c4f17688362bd06b03deee9adf4ad1f8461`, com intenção de “restore immutable history”, voltou a editar essas mensagens antigas. Mesmo quando o objetivo é restaurar texto, **não se deve corrigir histórico por edição**. Regra operacional: preservar o estado atual e, se houver divergência histórica a esclarecer, publicar um novo evento que declare a retificação/referência; não reescrever mensagens passadas.

`DEPLOY-PR-01` — a integração Cloudflare está a criar builds/deployments automáticos a partir de PRs de trabalho. O PR #29 publicou `Deployment successful` para `df7098fe...`; o PR #24 fez o mesmo para `745dab64...`. Isto não prova que `ma-code.pt` tenha sido substituído e a `main` continua `344841c...`, mas a configuração privada de Branch control/produção não está acessível pelo GitHub. Até esclarecimento: **não abrir novos PRs nem fazer novos pushes funcionais a PRs existentes apenas para obter CI**, salvo decisão A1 posterior. Trabalho em branches já autorizadas pode continuar; ao chegar ao limite PR/CI, publicar checkpoint e parar. Não fechar nem alterar PRs existentes apenas por este finding.

## Fila única de problemas e lotes

| ID | Impacto | Prova | Proprietário | Ficheiros / reserva | Dependências | Branch / HEAD | CI | Parecer A6 | Próxima ação |
|---|---|---|---|---|---|---|---|---|---|
| `A2-NR-01` | **ACESSO — máxima prioridade.** Renovação pode falhar apesar de sessão válida | A2-G2 confirmou Base64 nos bridges/login e hexadecimal em `/renew`; HEAD atual acrescenta teste de reprodução sem CI | **A2-G2** | Domínio A2 de acesso/ativação/licença; `LicenseSettingsPanel.tsx` A2. Sem persistência/tipos/migrações partilhados | Preservar sessões existentes; `DEPLOY-PR-01` bloqueia novo PR/CI | `agent2-g2/access-session-contract-7ec8904` a partir de `7ec8904767b40c5d53b3283ebcacb7c1f6939de0` | CI apenas no HEAD anterior `6f9212ce...` | **BLOQUEADO** até correção + A6 | A2-G2 pode provar/corrigir na branch; checkpoint ao A1 antes de PR/push para CI |
| `A4-DAILY-NR-01` | **DADOS — risco de duplicação de primeira avaliação** | A4-G2 adicionou fingerprint do conjunto completo de avaliações e revalidação transacional; A6 confirmou que stale `assessmentId=null` é rejeitado antes de qualquer write | **A4-G2** | `dailyWorkspaceRepository.ts` + `daily-pedagogical-workflow.test.mjs`; sem `lessonRepositoryBase.ts` | PR #29 contém o PR #17 histórico; não integrar PR #17 separadamente | `agent4-g2/daily-null-assessment-9bde7c4` / `df7098fe510aa79fc72bde035053389045a8d117`; PR #29 draft | #1645 SUCCESS; MA-Professor 248/248; Conquistador 1/1; build PASS; sem MA-Quadro; sem E2E real multi-tab/IndexedDB | **APTO** A6-G2 em 2026-09-07T12:21:13Z, exclusivamente no SHA `df7098fe...` | **Congelar** PR #29/HEAD. Daily encerrado tecnicamente para combinação futura. Não integrar PR #17. A4 pode passar ao GIAE em branch separada, respeitando `DEPLOY-PR-01` |
| `A4-GIAE-NR-02` | **BLOQUEIO FUNCIONAL / falso sucesso** na re-submissão explícita | PR #22 `efa7446...` pode apresentar sucesso deixando `pending`; contrato A1 opt-in PR #27 já foi validado | **A4-G2** | A4 apenas `giae/**` + testes. API autorizada: `src/components/ma-professor/giaeExplicitSubmissionRepository.ts`; `lessonRepositoryBase.ts` continua A1 | Daily já APTO; contrato PR #27 APTO; `DEPLOY-PR-01` limita PR/CI | Base de consumo deve partir do contrato `f314a8b6379d876cacacb96481cbf40effd2d5ce`; PR #22 histórico não deve avançar | #1637 e #1643 SUCCESS nos antecessores | Contrato PR #27 **APTO PARA CONSUMO CONTROLADO**; GIAE combinado ainda **BLOQUEADO** | A4-G2 pode agora iniciar o consumo controlado numa branch nova baseada em `f314a8b...`, alterando só `giae/**` e testes. Provar single/bulk/stale/clipboard/falso-sucesso. **Parar antes de novo PR/push para CI** enquanto `DEPLOY-PR-01` estiver aberto |
| `A3-HORARIO-XADREZ-01` | **BLOQUEIO DE UTILIZAÇÃO** — `Clube Xadrez` não reconhecido/importado corretamente | PDF real confirma `Clube Xadrez` terça 15:20–16:10; diagnóstico aponta `SchedulePdfImportStep.tsx` e possível extrator partilhado | **A3-G2** | Pode alterar `setup/SchedulePdfImportStep.tsx` e testes A3; `src/lib/maPdf/extractPdfText.ts` reservado A1 | Separado do PR #23; não publicar PDF privado; `DEPLOY-PR-01` limita PR/CI | `agent3-g2/schedule-pdf-xadrez-344841c` | Pendente | Pendente | Reproduzir/corrigir no domínio A3; se precisar do extrator partilhado, pedir contrato ao A1; checkpoint antes de PR/CI |
| `A3-PTPT-COPY-01` | **LINGUAGEM / UX** | Ambas as frases estão em `src/components/ma-professor/setup/SetupConfirmationStep.tsx` | **A3-G2** | `SetupConfirmationStep.tsx` | Alteração textual; não tocar no PR #23 congelado | Branch A3-G2 ativa adequada | Pendente | Pendente | `Revisei...` → `Revi...`; `cópias cifradas online` → `cópias de segurança cifradas online`; validar proporcionalmente; sem novo PR apenas para copy enquanto `DEPLOY-PR-01` estiver aberto |
| `PDF-IMPORT` | Importação persistente de planificações | PR #23 contém contrato A1 e lote A3; `0349`, destinos, create/append/skip, stale/idempotência cobertos | A1-G2 + A3-G2 apenas para smoke; branch congelada | Não alterar | Smoke real + candidato combinado | `agent3/planification-pdf-persist-8bbed823` / `e4df193d78c5d9523cf7803af30241ab92e8ec6b`; PR #23 | #1639 SUCCESS; MA-Professor 269/269; Conquistador; build; Workers | **APTO** `A6-20260906T225903Z-pdfapto` | Manter congelado; no candidato testar PDF real, reload, ambiguidade, concorrência com formulário manual e dados descartáveis |
| `BACKUP-ATOMIC` | Preservação/recuperação | Restore/reset atómicos; rollback real Dexie 2/2 anteriormente provado | **A5-G2**, lote histórico congelado | `settings/backupRepository.ts` + teste; manifesto A5-G2 separado | Não reabrir investigação encerrada | `agent5/data-preservation-344841c` / `94fd528ac0a38d4eca7b56a83cd160a0616a84df`; PR #18 | #1635 SUCCESS; 252/252; Conquistador; build; Workers | **APTO** `A6-20260906T203634Z-b5apto` | Manter congelado. Novo write apenas em branch nova após finding reproduzido; respeitar `DEPLOY-PR-01` |
| `CI-ISOLATION` | Fiabilidade de validação global | PRs #25/#26 correram em paralelo; workflow inclui Conquistador, MA-Professor, MA-Quadro e build | **A1-G2** | `.github/workflows/deploy.yml` | Interação com `DEPLOY-PR-01` | `agent1/ci-isolation-maquadro-344841c` / `745dab64e2355b1e14a36687d60a21e77b6e0f34`; PR #24 | #1640 SUCCESS; MA-Quadro 15/15 | **APTO** A6 2026-09-07T09:48:04Z | Congelar; elegível para futuro candidato; não usar novos PRs descartáveis enquanto `DEPLOY-PR-01` estiver aberto |
| `COMM-01` | Integridade do canal | Evento A5-G2 desapareceu do conteúdo ativo apesar de permanecer na história | **A1-G2** | `AGENT_MESSAGES.md` | Sem reset/force-push | `coordination/agents` | n/a | n/a | Eventual retificação apenas por append verificável, sem reescrever histórico |
| `COMM-02` | Integridade append-only | Commit `02cb96dd...` alterou mensagem antiga ao acrescentar Daily | **Todos; A1 coordena** | `AGENT_MESSAGES.md` | Preservar literalidade | `coordination/agents` | n/a | n/a | Não editar eventos anteriores; correções por evento novo |
| `COMM-03` | Integridade append-only | `b340a930...` e depois `0b4d9c4...` editaram mensagens históricas ao reportar/restaurar | **Todos; A1 coordena** | `AGENT_MESSAGES.md` | Não fazer “restore” editando texto passado | `coordination/agents` | n/a | n/a | Manter estado atual; qualquer esclarecimento por novo evento referenciado |
| `DEPLOY-PR-01` | **PUBLICAÇÃO EXTERNA POTENCIALMENTE NÃO AUTORIZADA** | Cloudflare bot reporta deployments para PR #29 e PR #24; `main` permanece `344841c...` | **A1-G2**; configuração privada pode exigir utilizador/Cloudflare | Cloudflare Git integration / Branch control | Distinguir preview/build de substituição do domínio canónico | n/a | n/a | n/a | Sem novos PRs/pushes funcionais para CI até esclarecimento. A1 centraliza a decisão; não assumir produção alterada sem prova |

## Handoffs G2 — instruções atuais

### A2-G2
Passagem confirmada. Usar exclusivamente `agent2-g2/access-session-contract-7ec8904` para `A2-NR-01`. Pode continuar prova/correção na branch; parar antes de novo PR/CI por `DEPLOY-PR-01`.

### A3-G2
Passagem confirmada. PR #23 congelado. Horário/Xadrez apenas em `agent3-g2/schedule-pdf-xadrez-344841c`; extrator partilhado não transferido. `A3-PTPT-COPY-01` também é A3-G2. Parar antes de novo PR/CI por `DEPLOY-PR-01`.

### A4-G2
**Daily concluído tecnicamente e APTO no SHA `df7098fe...`; congelar PR #29.** O parecer A6 não autoriza merge/main. O PR #17 fica absorvido pelo PR #29 e não deve ser integrado separadamente. A4-G2 fica agora autorizado a passar ao lote `A4-GIAE-NR-02`: criar/usar branch nova baseada em `f314a8b6379d876cacacb96481cbf40effd2d5ce`, consumir apenas `giaeExplicitSubmissionRepository` dentro de `giae/**` e testes próprios, sem tocar em `lessonRepositoryBase.ts`. Pode desenvolver/provar localmente; parar antes de novo PR/push para CI enquanto `DEPLOY-PR-01` estiver aberto.

### A5-G2
PR #18 congelado/APTO. Mantém o manifesto já aceite e não reabre o lote. Novo write só em branch nova após finding reproduzido; respeitar `DEPLOY-PR-01`.

### A6-G2
Mantém independência. Parecer PR #29 `df7098fe...` **APTO** processado. PR #24 e contrato PR #27 também têm pareceres A6 válidos. O próximo lote A4 a rever será GIAE apenas depois de consumo do contrato e novo SHA/CI; não há pedido novo enquanto `DEPLOY-PR-01` impedir esse passo.

## Candidato

Ainda não existe candidato final aprovado para `main`.

Lotes atualmente elegíveis para futura combinação controlada, uma única vez cada:
- Planificações PDF `e4df193d...`;
- Backups `94fd528...`;
- Workflow CI/MA-Quadro `745dab64...`;
- Daily `df7098fe...` — **novo APTO**, substitui/contém o PR #17 histórico.

Não elegíveis atualmente:
- A2 acesso/renovação;
- GIAE até consumo do contrato PR #27 e revisão A6 do HEAD combinado;
- Horário/Xadrez;
- copy PT-PT até commit/validação;
- qualquer combinação ainda não revista por A6 no SHA final.

`DEPLOY-PR-01` continua a impedir preparar novo candidato via PR enquanto não estiver esclarecido o comportamento da integração Cloudflare.

## Próximas ações A1-G2

1. Não tocar na `main`; continua em `344841c1fc402e813f9d8658d96fa20b0fefa779`.
2. Congelar PR #29/`df7098fe...` como APTO e nunca integrar PR #17 separadamente.
3. Autorizar A4-G2 a avançar para o consumo GIAE em branch nova baseada em `f314a8b...`, mas sem novo PR/push para CI enquanto `DEPLOY-PR-01` estiver aberto.
4. Tratar `DEPLOY-PR-01` antes de novos PRs/CI; confirmar Branch control/configuração Cloudflare quando possível e centralizar qualquer decisão do utilizador.
5. Manter `COMM-01/02/03` como regra de preservação: não corrigir histórico editando eventos antigos.
6. Preservar PR #23, PR #18, PR #24 e PR #29 nos SHAs A6-APTOS.
7. Atualizar esta fila após cada novo HEAD/evento relevante.
