# MA-CODE — Estado consolidado dos agentes

Atualizado por: AGENTE 1 — SEGUNDA GERAÇÃO (A1-G2)
Data da verificação: 2026-09-08T08:52:00+01:00
Fonte técnica oficial: `main` confirmada em `344841c1fc402e813f9d8658d96fa20b0fefa779`.

## Regra central de coordenação

A1-G2 é o ponto central. O utilizador não transporta mensagens entre agentes. A1 identifica causas, distribui trabalho, resolve dependências e pede revisão A6 quando aplicável.

`AGENT_MESSAGES.md` mantém-se append-only. Como o conector desta sessão não oferece append atómico e substituições completas já originaram incidentes `COMM-01/02/03`, A1 não reescreve o histórico. Instruções urgentes são publicadas diretamente nos PRs/canais GitHub dos agentes e refletidas neste ficheiro e em `A1_BLOCKER_BOARD.md`.

Nada é integrado ou publicado em `main` sem aprovação explícita do utilizador para o candidato concreto.

## Proteção operacional — SAFE-VALIDATION-01 / DEPLOY-PR-01

Protocolo: `A1_SAFE_VALIDATION_PROTOCOL.md`.

- Não abrir PR nem fazer push apenas para obter CI.
- Para HEADs finais existentes, preferir `Build Check` via `workflow_dispatch` na branch exata quando necessário.
- Um run só conta para A6 se `head_sha` coincidir exatamente com o SHA revisto.
- Commits funcionais novos apenas quando necessários ao próprio lote.
- `main` permanece protegida.

## Estado atual por agente/lote

### A2-G2 — acesso/renovação — FECHADO/APTO

- Branch: `agent2-g2/access-session-contract-7ec8904`
- HEAD FINAL: `7038930471c80753b40ffde91eb023fc050f0030`
- Build Check #1649 / run `34169554049`: SUCCESS.
- A6-G2: **APTO** por SHA exato.
- Corrige stale-cache pós-logout e preserva Base64 canónico + compatibilidade hex legada.
- Limitações E2E/multi-dispositivo ficam para candidato global.
- A2 deve manter o HEAD congelado.

### A3-G2 — setup

#### A3-SETUP-ACTION-COLORS-01 — PRONTO PARA CANDIDATO
- Branch: `agent3-g2/setup-action-colors-344841c`
- HEAD: `64e3149336c6097c9777a8feb38209f9bfb37be9`
- Finding de código anterior corrigido; A6 não encontrou novo finding de código.
- Falta apenas prova executável isolada; por decisão A1, essa prova será fechada no candidato combinado.
- Manter congelado.

#### A3-HORARIO-XADREZ-01 — FECHADO/APTO
- Branch: `agent3-g2/schedule-pdf-xadrez-344841c`
- BASE: `344841c1fc402e813f9d8658d96fa20b0fefa779`
- HEAD FINAL: `800d91198d7f1b2c2193ebdd89a78425ceb8effd`
- Delta: 1 commit; apenas `src/lib/maPdf/extractPdfText.ts` + `tests/ma-professor/schedule-pdf-column-geometry.test.mjs`.
- A3: smoke geométrico isolado 6/6 PASS.
- A6-G2: **APTO** para futura combinação controlada, com limitações executáveis a fechar no candidato combinado.
- Manter congelado.

#### A3-PTPT-COPY-01 — FECHADO/APTO
- Branch: `agent3-g2/setup-ptpt-copy-344841c`
- BASE: `344841c1fc402e813f9d8658d96fa20b0fefa779`
- HEAD FINAL: `b0e2928a0e80306503a38787f4a46a8acea7fee1`
- Delta: 1 commit, 0 behind, 1 ficheiro, apenas 2 substituições textuais autorizadas.
- A6-G2: **APTO** para futura combinação controlada.
- Manter congelado.

#### PDF-IMPORT — FECHADO/APTO
- PR #23 / HEAD `e4df193d78c5d9523cf7803af30241ab92e8ec6b`.
- Preservar congelado; smokes reais ficam para candidato combinado.

### A4-G2 — Daily e GIAE

#### A4-DAILY-NR-01 — FECHADO/APTO
- Branch: `agent4-g2/daily-null-assessment-9bde7c4`
- HEAD: `df7098fe510aa79fc72bde035053389045a8d117`
- A6: **APTO**; CI #1645 SUCCESS.
- PR #29 contém o trabalho histórico do PR #17; não integrar PR #17 separadamente.

#### A4-GIAE-NR-02 — PRONTO PARA CANDIDATO
- Contrato base A1/A6: `f314a8b6379d876cacacb96481cbf40effd2d5ce`.
- Branch canónica: `agent4-g2/giae-explicit-resubmit-f314a8b`.
- HEAD: `ba87e69873a0277a63e84b98bf539038aba0151f`.
- Prova local isolada: **9/9 PASS**.
- A6: sem finding bloqueante de código; validação completa de suite/build/E2E diferida para candidato combinado.
- Manter congelado.

### A5-G2 — preservação

- BACKUP-ATOMIC / PR #18 / HEAD `94fd528ac0a38d4eca7b56a83cd160a0616a84df`: **APTO** e congelado.
- Excel final UFCD/módulo continua apenas em análise/planeamento; nenhuma implementação autorizada.

### A6-G2 — revisão independente

- A2 `7038930471...`: APTO.
- Xadrez `800d9119...`: APTO.
- PT-PT `b0e2928a...`: APTO.
- Cores `64e31493...`: sem finding de código; prova executável diferida.
- GIAE `ba87e698...`: sem finding de código; prova completa diferida.
- Próxima revisão material: SHA do candidato combinado, com suites/build/smokes e limitações E2E explicitadas.

## Outros lotes fechados/APTO para futura combinação

- `PDF-IMPORT`: `e4df193d78c5d9523cf7803af30241ab92e8ec6b`
- `BACKUP-ATOMIC`: `94fd528ac0a38d4eca7b56a83cd160a0616a84df`
- `CI-ISOLATION`: `745dab64e2355b1e14a36687d60a21e77b6e0f34`
- `A4-DAILY-NR-01`: `df7098fe510aa79fc72bde035053389045a8d117`
- `A2-NR-01`: `7038930471c80753b40ffde91eb023fc050f0030`
- `A3-HORARIO-XADREZ-01`: `800d91198d7f1b2c2193ebdd89a78425ceb8effd`
- `A3-PTPT-COPY-01`: `b0e2928a0e80306503a38787f4a46a8acea7fee1`

Lotes elegíveis mas com prova executável a fechar no candidato:
- `A3-SETUP-ACTION-COLORS-01`: `64e3149336c6097c9777a8feb38209f9bfb37be9`
- `A4-GIAE-NR-02`: `ba87e69873a0277a63e84b98bf539038aba0151f`

## Nova funcionalidade — avaliação final UFCD/módulo em Excel

Planeamento: `A1_EXCEL_UFCD_FINAL_ASSESSMENT_PLANNING.md`.

Princípios já definidos:
- `assessments/**` / `moduleFinalGrades` continuam fonte de verdade;
- Excel é camada de importação/mapeamento/exportação, não segunda base de classificações;
- original nunca alterado; gerar nova cópia `.xlsx`;
- template efémero por defeito e output fora de backup/sync por defeito;
- ambiguidades de alunos/colunas exigem confirmação explícita;
- critérios, autoavaliação e cálculo respeitam configuração real, não regras universais inventadas;
- preservar fórmulas/folhas/formatação tanto quanto tecnicamente possível;
- nenhuma implementação antes do contrato A1.

## Prioridade atual — A1-G2

A1 deve agora preparar o candidato combinado com máxima cautela:
1. inventariar dependências/ancestralidade entre lotes;
2. evitar integração duplicada de PRs/lotes empilhados;
3. determinar ordem segura e conflitos de ficheiro;
4. só depois criar branch de candidato;
5. executar suites Conquistador + MA-Professor + MA-Quadro, build e smokes proporcionais;
6. pedir revisão final A6 do SHA exato;
7. apenas após parecer A6 apresentar o candidato ao utilizador e pedir autorização explícita antes de qualquer merge em `main`.

## Integridade do canal

- `COMM-01/02/03` permanecem registados.
- Nunca corrigir histórico de `AGENT_MESSAGES.md` por edição; qualquer retificação futura apenas por novo evento append-only quando existir mecanismo seguro.
