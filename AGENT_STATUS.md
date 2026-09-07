# MA-CODE — Estado consolidado dos agentes

Atualizado por: AGENTE 1 — SEGUNDA GERAÇÃO (A1-G2)
Sessão: A1-G2
Data da verificação: 2026-09-07T12:56:00+01:00
Último evento processado no canal ativo: `A4-20260907T113222Z-daily01`
Fonte técnica: `main` em `344841c1fc402e813f9d8658d96fa20b0fefa779`; este ficheiro é coordenação e não substitui a `main`.

## Regra obrigatória de comunicação direta

A instrução do utilizador de 2026-09-07T12:20+01:00 elimina o utilizador como intermediário normal entre agentes. O AGENTE 1 formalizou a regra em `AGENT_PROTOCOL_V1_1.md`, commit `492cbd1423f962612089a4bf1eb4f93472f12b64`.

A partir desta atualização:

- pedidos de coordenação, dependências, bloqueios, ownership, entregas, testes/revisões e handoffs são publicados diretamente em `AGENT_MESSAGES.md`;
- nenhum agente com acesso ao canal pede ao utilizador para copiar ou encaminhar mensagens a outro agente;
- antes de repetir um pedido, deve verificar a referência existente e continuar a mesma sequência;
- publicar não significa que o destinatário leu ou executou; não há polling contínuo;
- perguntas exclusivamente dependentes do utilizador são centralizadas pelo A1-G2;
- apenas A1-G2 altera `AGENT_STATUS.md` e as regras do protocolo;
- a conversa de cada agente deve resumir apenas o que concluiu, o que efetivamente publicou e o que falta.

Esta regra não altera ownership, revisões, segurança, branches APTO nem autorização de `main`.

## Transição G2 e exclusividade

- A conversa A1-G2 substitui o A1 anterior; não existe segundo orquestrador ativo.
- A passagem de responsabilidade para A2-G2, A3-G2, A4-G2, A5-G2 e A6-G2 fica reconhecida pelo A1-G2 com base na substituição explícita das conversas pelo utilizador. Os antecessores não ficam autorizados a novos writes funcionais.
- Escrita de `AGENT_STATUS.md`: exclusivamente A1-G2.
- Persistência central, tipos centrais, composição, navegação, `lessonRepositoryBase.ts`, contratos partilhados, Worker entrypoints, configurações e migrações permanecem reservados ao A1-G2 salvo transferência explícita por caminho.
- Um lote APTO fica congelado no SHA exato indicado. Um HEAD alterado perde o parecer anterior.
- Lotes empilhados/contidos noutros não são integrados duas vezes.
- Qualquer HEAD candidato combinado exige diff controlado, suites aplicáveis, build e nova revisão A6 no SHA combinado.
- Nada é integrado/publicado em `main` sem aprovação explícita do utilizador para o lote concreto.

## Incidentes do canal e publicação automática

`COMM-01` — histórico imutável violado por uma atualização de coordenação. O commit `5f4ace3b3282eb8a22c63c680eac3f6a6770a36b` publicou `A5-20260907T102830Z-g2r5`; o commit descendente `e623cb6fd05eb7eb59f0765f1bfbf9f2b26ceb5b` (`restore immutable history before A5-G2 append`) alterou `AGENT_MESSAGES.md` com **1 adição e 20 eliminações**, removendo do conteúdo ativo a mensagem A5-G2. O commit A5 continua na história Git, portanto a evidência não se perdeu do repositório, mas o registo ativo ficou incompleto. Não fazer force-push/reset. Até reposição segura no ficheiro ativo, este status preserva o handoff A5-G2 e referencia o commit histórico.

`COMM-02` — o commit de comunicação A4 `02cb96ddbe03a66903379ad02c3c717c8fcf0888`, além de acrescentar o evento `A4-20260907T113222Z-daily01`, alterou uma frase de um evento histórico `EXT-20260907T082132Z-a3pdf` (`não voltes a alterar essa branch para trabalho independente` → `não voltes a alterar essa branch para esta verificação funcional`). Mesmo sendo uma alteração pequena e semanticamente próxima, viola a regra append-only. Não reverter nem reescrever o histórico por reset; qualquer correção futura a mensagem antiga deve ser feita por novo evento. A4-G2 e restantes agentes devem preservar literalmente os eventos existentes nas escritas futuras.

`DEPLOY-PR-01` — a integração Cloudflare está a criar builds/deployments automáticos a partir de PRs de trabalho. O PR #29 publicou comentário automático `Deployment successful` para `df7098fe...` e o PR #24 fez o mesmo para `745dab64...`, ambos apontando para `workers/services/view/ma-code/production/builds/...`. Isto **não prova** que o domínio canónico `ma-code.pt` tenha sido substituído e a `main` continua em `344841c...`, mas prova que commits de PR estão a ser enviados para um fluxo Cloudflare denominado `production builds`. Até esclarecer/configurar isto, **não abrir novos PRs nem fazer novos pushes funcionais a PRs existentes apenas para obter CI**, salvo autorização A1 posterior. Trabalho local/branch já autorizado pode continuar; ao chegar ao ponto em que precise de PR/CI, publicar checkpoint ao A1 e parar nesse limite. Não fechar nem alterar PRs existentes apenas por este finding sem decisão específica.

## Fila única de problemas e lotes

| ID | Impacto | Prova | Proprietário | Ficheiros / reserva | Dependências | Branch / HEAD | CI | Parecer A6 | Próxima ação |
|---|---|---|---|---|---|---|---|---|---|
| `A2-NR-01` | **ACESSO — máxima prioridade.** Renovação pode falhar apesar de sessão válida | A2-G2 confirmou contrato divergente: bridges/login/verificação usam SHA-256 Base64, enquanto `/renew` em `worker/maProfessorAccess.ts` autentica com SHA-256 hexadecimal. HEAD atual acrescenta teste de reprodução mas não tem CI | **A2-G2** | Domínio A2 de acesso/ativação/licença e testes; `LicenseSettingsPanel.tsx` mantém-se A2. Não tocar em persistência/tipos/migrações partilhados sem A1 | Handoff A1-G2 concluído; provar antes de corrigir; preservar sessões existentes; `DEPLOY-PR-01` bloqueia criação de novo PR/CI até decisão A1 | `agent2-g2/access-session-contract-7ec8904` criada a partir de `7ec8904767b40c5d53b3283ebcacb7c1f6939de0`. Branch histórica `agent2/access-activation-344841c` fica como evidência | CI apenas no HEAD anterior `6f9212ce...`; novo HEAD sem run | **BLOQUEADO** pelo finding até correção + revisão | A2-G2 pode provar/corrigir na branch G2; antes de abrir PR ou provocar deploy/CI, checkpoint ao A1 |
| `A4-DAILY-NR-01` | **DADOS — risco de duplicação/incoerência de avaliação** | A4-G2 corrigiu `null → primeira avaliação criada por outro contexto`: fingerprint inclui conjunto completo de avaliações e é revalidado dentro da transação antes de qualquer write. Comparação G2 confirma apenas 2 ficheiros | **A4-G2** | `src/components/ma-professor/daily/dailyWorkspaceRepository.ts`; `tests/ma-professor/daily-pedagogical-workflow.test.mjs`. Não alterar `lessonRepositoryBase.ts`/persistência central | Revisão A6 do SHA exato; PR #29 contém o trabalho histórico do PR #17 e substitui-o se vier a ser aprovado | `agent4-g2/daily-null-assessment-9bde7c4` / `df7098fe510aa79fc72bde035053389045a8d117`; PR #29 draft | Build Check #1645/run `34116640241` **SUCCESS**; MA-Professor 248/248, Conquistador 1/1, build PASS; sem MA-Quadro; sem E2E real multi-tab/IndexedDB | **PENDENTE A6** — nenhuma review/resposta A6 encontrada no PR #29 até esta verificação | Congelar HEAD `df7098fe...`; não fazer novos pushes. A4 já endereçou A6 diretamente, portanto não duplicar pedido. Aguardar parecer A6; depois A1 atualiza APTO/BLOQUEADO. GIAE continua em fila |
| `A4-GIAE-NR-02` | **BLOQUEIO FUNCIONAL / falso sucesso** na re-submissão explícita | PR #22 `efa7446...` pode apresentar sucesso deixando estado persistido `pending`; contrato A1 opt-in foi depois validado | **A4-G2**, após concluir/estacionar o lote Daily | A4 apenas `giae/**` + testes. `lessonRepositoryBase.ts` continua reservado A1. API autorizada: `src/components/ma-professor/giaeExplicitSubmissionRepository.ts` | Contrato A1 no PR #27 já APTO; máximo um lote de implementação ativo por A4; aguardar parecer Daily e respeitar `DEPLOY-PR-01` | PR #22 `efa7446be88c9c12f684032acc9480a0f414d974`; contrato PR #27 `f314a8b6379d876cacacb96481cbf40effd2d5ce` | #1637 e #1643 SUCCESS | Contrato PR #27 **APTO PARA CONSUMO CONTROLADO**; GIAE combinado continua **BLOQUEADO** | Depois do lote Daily ficar concluído/estacionado, A4 pode preparar consumo na branch correta, mas não abrir novo PR/push para CI enquanto `DEPLOY-PR-01` estiver aberto |
| `A3-HORARIO-XADREZ-01` | **BLOQUEIO DE UTILIZAÇÃO** — atividade real `Clube Xadrez` não é reconhecida/importada corretamente | A3-G2 recuperou o PDF real e confirmou `Clube Xadrez` terça 15:20–16:10; diagnóstico aponta `SchedulePdfImportStep.tsx` e possível dependência no extrator partilhado | **A3-G2** | Pode alterar `src/components/ma-professor/setup/SchedulePdfImportStep.tsx` e testes A3. `src/lib/maPdf/extractPdfText.ts` fica reservado A1 até pedido/prova concreta | Lote separado do PR #23 APTO; não publicar PDF privado; `DEPLOY-PR-01` limita PR/CI | `agent3-g2/schedule-pdf-xadrez-344841c` criada a partir da `main` `344841c...` | Ainda não executado | Pendente | A3-G2 pode reproduzir/corrigir no domínio A3; se precisar do extrator partilhado, pedir contrato ao A1; antes de PR/CI, checkpoint ao A1 |
| `A3-PTPT-COPY-01` | **LINGUAGEM / UX** — duas frases do setup não usam a formulação PT-PT pretendida | Pesquisa na `main` localizou ambas em `src/components/ma-professor/setup/SetupConfirmationStep.tsx` | **A3-G2** | `src/components/ma-professor/setup/SetupConfirmationStep.tsx` | Nenhuma dependência partilhada; alteração textual apenas; pode ser incorporada na branch A3-G2 ativa sem tocar no PR #23 congelado | Usar a branch A3-G2 ativa adequada | Pendente | Pendente | Substituir exatamente `Revisei os dados apresentados.` por `Revi os dados apresentados.` e `Posso criar cópias cifradas online` por `Posso criar cópias de segurança cifradas online`; validar proporcionalmente; não abrir novo PR apenas para este copy enquanto `DEPLOY-PR-01` estiver aberto |
| `PDF-IMPORT` | Importação persistente de planificações | PR #23 contém contrato A1 do PR #21 e lote A3 final; `0349`, destinos, create/append/skip, stale/idempotência cobertos | A1-G2 + A3-G2 apenas para smoke; **branch congelada** | Não alterar | Smoke real + candidato combinado | `agent3/planification-pdf-persist-8bbed823` / `e4df193d78c5d9523cf7803af30241ab92e8ec6b`; PR #23 | #1639 SUCCESS; MA-Professor 269/269, Conquistador, build; Workers SUCCESS | **APTO** `A6-20260906T225903Z-pdfapto` | Manter congelado; no candidato testar PDF real, reload, ambiguidade, concorrência com formulário manual e dados descartáveis |
| `BACKUP-ATOMIC` | Preservação/recuperação | Restore/reset atómicos; rollback real Dexie 2/2 previamente provado | **A5-G2**, lote histórico congelado | `settings/backupRepository.ts` + teste aprovado; manifesto A5-G2 mantém `sync/**`, `settings/**` exceto `LicenseSettingsPanel.tsx`/`SettingsWorkspaceView.tsx`, e workers `maProfessorRecovery.ts`, `maProfessorSnapshot.ts`, `maProfessorSync.ts` | Não reabrir investigação encerrada | `agent5/data-preservation-344841c` / `94fd528ac0a38d4eca7b56a83cd160a0616a84df`; PR #18 | #1635 SUCCESS; 252/252, Conquistador, build, Workers | **APTO** `A6-20260906T203634Z-b5apto` | Manter branch congelada. A5-G2 pode continuar diagnóstico independente; novo write só após finding reproduzido e em branch nova; respeitar `DEPLOY-PR-01` antes de novo PR |
| `CI-ISOLATION` | Fiabilidade de validação global | PRs #25/#26 correram em paralelo sem cancelamento cruzado; workflow inclui Conquistador, MA-Professor, MA-Quadro e build | **A1-G2** | `.github/workflows/deploy.yml` | Nenhuma para lote isolado; interação agora conhecida com `DEPLOY-PR-01` | `agent1/ci-isolation-maquadro-344841c` / `745dab64e2355b1e14a36687d60a21e77b6e0f34`; PR #24 draft | #1640 SUCCESS; Conquistador 1/1, MA-Professor 246/246, MA-Quadro 15/15, build PASS | **APTO** A6 em 2026-09-07T09:48:04Z | Congelar. Elegível uma vez no futuro candidato; não integrar sem aprovação do utilizador. Não usar novos PRs descartáveis enquanto `DEPLOY-PR-01` estiver aberto |
| `COMM-01` | Integridade da coordenação / risco de decisões perdidas | `5f4ace... → e623cb6...`: 1 adição / 20 eliminações em `AGENT_MESSAGES.md`; evento A5-G2 desapareceu do conteúdo ativo embora permaneça na história | **A1-G2** | `coordination/agents/AGENT_MESSAGES.md` e este status | Evitar nova substituição concorrente; não reescrever eventos existentes | `coordination/agents`; protocolo direto formalizado em `492cbd1423f962612089a4bf1eb4f93472f12b64` | n/a | n/a | Restaurar por append verificável o evento A5-G2 e publicar a adoção A1-G2 no canal ativo sem apagar eventos atuais; confirmar por leitura |
| `COMM-02` | Integridade append-only | Commit `02cb96dd...` alterou um evento antigo ao mesmo tempo que acrescentou `A4-...daily01` | **A1-G2 / regra aplicada a todos** | `AGENT_MESSAGES.md` | Não tentar “corrigir” histórico reescrevendo-o | `coordination/agents` | n/a | n/a | A partir de agora qualquer retificação é novo evento; A4-G2 e restantes não alteram literalmente eventos anteriores |
| `DEPLOY-PR-01` | **PUBLICAÇÃO EXTERNA POTENCIALMENTE NÃO AUTORIZADA** | Cloudflare bot reporta `Deployment successful` para PR #29/`df7098fe...` e PR #24/`745dab64...`, com links para `ma-code/production/builds/...`; `main` continua `344841c...` | **A1-G2**, decisão/configuração externa pode exigir utilizador/Cloudflare | Configuração Cloudflare Git integration / política de PRs; não alterar por suposição | Precisamos distinguir preview/branch build de efetiva substituição do domínio canónico e impedir produção automática de branches | n/a | n/a | n/a | Não abrir novos PRs nem provocar novos pushes de PR até esclarecimento. A1 centraliza decisão do utilizador/configuração necessária; não assumir que site público mudou sem prova |

## Handoffs G2 — instruções atuais

### A2-G2
Passagem confirmada. O antecessor fica parado para novos writes. Usar exclusivamente `agent2-g2/access-session-contract-7ec8904` para o lote `A2-NR-01`; a branch histórica não deve avançar. Prioridade máxima por ser acesso. Comunicar resultados/bloqueios diretamente pelo canal; não usar o utilizador como mensageiro. Pode continuar branch/testes locais; parar antes de novo PR/CI enquanto `DEPLOY-PR-01` estiver aberto.

### A3-G2
Passagem confirmada. O PR #23 permanece congelado. Para Horário/Xadrez usar exclusivamente `agent3-g2/schedule-pdf-xadrez-344841c`. `src/lib/maPdf/extractPdfText.ts` **não** é transferido; A3-G2 deve pedir autorização ao A1 pelo canal se provar que precisa de o alterar. O lote `A3-PTPT-COPY-01` está igualmente atribuído ao A3-G2 por incidir em `SetupConfirmationStep.tsx`; deve ser tratado sem alterar a branch congelada do PR #23. Pode continuar na branch A3-G2; parar antes de novo PR/CI por `DEPLOY-PR-01`.

### A4-G2
Passagem de função reconhecida. O lote Daily foi entregue no HEAD `df7098fe510aa79fc72bde035053389045a8d117`, PR #29, CI #1645 verde, e fica **congelado a aguardar A6**. Não fazer novos pushes. O próprio evento já foi dirigido a A6, portanto não duplicar o pedido. O consumo GIAE continua em fila. `lessonRepositoryBase.ts` permanece A1. Em futuras escritas no canal, acrescentar apenas eventos novos e nunca editar mensagens anteriores (`COMM-02`).

### A5-G2
Passagem confirmada. O PR #18 fica congelado e não é reaberto. O manifesto indicado na mensagem histórica `A5-20260907T102830Z-g2r5` é aceite: `sync/**`, `settings/**` exceto `LicenseSettingsPanel.tsx` e `SettingsWorkspaceView.tsx`, mais `worker/maProfessorRecovery.ts`, `worker/maProfessorSnapshot.ts`, `worker/maProfessorSync.ts`. Persistência central, tipos, migrações, composição e partilhados continuam A1. Hipóteses ainda não reproduzidas não autorizam correção funcional. Respeitar `DEPLOY-PR-01` antes de abrir novo PR.

### A6-G2
Passagem de função reconhecida. Mantém independência: não altera código funcional, não integra e não publica. Pareceres são sempre por SHA exato. PR #24 e contrato PR #27 já têm pareceres A6 válidos. A revisão atual pendente é PR #29 / `df7098fe...`; o pedido já foi feito diretamente por A4, por isso não precisa de nova mensagem A1. Publicar parecer diretamente no canal quando estiver em execução.

## Candidato

Ainda não existe candidato final aprovado para `main`.

Lotes atualmente elegíveis para futura combinação controlada, **uma única vez cada**:
- Planificações PDF `e4df193d...`;
- Backups `94fd528...`;
- Workflow CI/MA-Quadro `745dab64...`.

Não elegíveis atualmente:
- A2 acesso/renovação;
- Daily `df7098fe...` até parecer A6;
- GIAE até consumo do contrato PR #27 pelo A4-G2 e revisão do HEAD combinado;
- Horário/Xadrez até correção/CI/A6;
- copy PT-PT até commit/validação;
- qualquer combinação ainda não revista por A6 no SHA final.

Além disso, `DEPLOY-PR-01` impede preparar novo candidato via PR enquanto não estiver esclarecido se a integração Cloudflare está a publicar branches de trabalho num fluxo de produção.

## Próximas ações A1-G2

1. Não tocar na `main`; continua em `344841c1fc402e813f9d8658d96fa20b0fefa779`.
2. Aguardar parecer A6 sobre PR #29/`df7098fe...`; não duplicar o pedido já enviado por A4.
3. Tratar `DEPLOY-PR-01` como prioridade de coordenação antes de novos PRs/CI: confirmar comportamento/configuração Cloudflare e centralizar qualquer decisão que dependa do utilizador.
4. Reparar `COMM-01` por append verificável quando houver forma segura de preservar integralmente o ficheiro; não usar reset/force-push. `COMM-02` fica documentado e não exige reescrita retroativa.
5. Preservar PR #23, PR #18 e PR #24 nos SHAs A6-APTOS.
6. Após cada novo HEAD/evento relevante, atualizar esta fila com CI, parecer A6, limitações e próxima ação.
