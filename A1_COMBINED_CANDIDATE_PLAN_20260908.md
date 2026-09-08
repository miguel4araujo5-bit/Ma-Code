# A1-G2 — PLANO DO CANDIDATO COMBINADO — 2026-09-08

Estado: **PRÉ-INTEGRAÇÃO / NÃO PUBLICADO**
Base oficial protegida: `main = 344841c1fc402e813f9d8658d96fa20b0fefa779`

Este documento não autoriza merge nem publicação. Define a composição segura do próximo candidato único para validação.

## 1. Lotes elegíveis

### A2 — acesso/renovação
- HEAD: `7038930471c80753b40ffde91eb023fc050f0030`
- A6: APTO
- CI: Build Check #1649 SUCCESS
- Domínio final BASE→HEAD: `src/components/ma-professor/access/FounderAccessOffer.tsx`, `worker/maProfessorAccess.ts`, `worker/maProfessorAccountSessionBridge.ts`, `worker/maProfessorExplicitApprovalBridge.ts`, `worker/maProfessorPaidAccess.ts` + testes A2.

### A3 — Planificações PDF
- HEAD: `e4df193d78c5d9523cf7803af30241ab92e8ec6b`
- A6: APTO
- Inclui importação/persistência/preview/parser e alteração controlada de `src/components/ma-professor/types.ts`.

### A3 — Cores/CTA setup
- HEAD: `64e3149336c6097c9777a8feb38209f9bfb37be9`
- A6: finding de código corrigido; sem novo finding; prova executável diferida para candidato.
- 9 ficheiros setup + teste de codificação de cores.

### A3 — Horário / Clube Xadrez
- HEAD: `800d91198d7f1b2c2193ebdd89a78425ceb8effd`
- A6: APTO para futura combinação controlada.
- Delta: `src/lib/maPdf/extractPdfText.ts` + teste geométrico.

### A3 — texto PT-PT
- HEAD: `b0e2928a0e80306503a38787f4a46a8acea7fee1`
- A6: APTO.
- Delta: exclusivamente `SetupConfirmationStep.tsx`, duas substituições textuais.

### A4 — Daily
- HEAD: `df7098fe510aa79fc72bde035053389045a8d117`
- A6: APTO
- CI #1645 SUCCESS.
- IMPORTANTE: contém o trabalho histórico relevante do PR #17; **não integrar PR #17 separadamente**.

### A4 — GIAE
- HEAD final combinado: `ba87e69873a0277a63e84b98bf539038aba0151f`
- Prova local: 9/9 PASS.
- A6: sem finding bloqueante de código; prova completa diferida para candidato.
- IMPORTANTE: este HEAD já contém a cadeia histórica necessária (`efa7446...` + contrato A1 `f314a8b...` + consumo A4); **não integrar PR #22 nem `f314a8b...` separadamente**.

### A5 — Backup atomicidade
- HEAD: `94fd528ac0a38d4eca7b56a83cd160a0616a84df`
- A6: APTO.

### A1 — CI isolation
- HEAD: `745dab64e2355b1e14a36687d60a21e77b6e0f34`
- A6: APTO.
- Delta: apenas `.github/workflows/deploy.yml`.

## 2. Sobreposições de ficheiros confirmadas

A comparação BASE→HEAD dos lotes mostra uma única sobreposição material conhecida entre lotes independentes:

`src/components/ma-professor/setup/SetupConfirmationStep.tsx`
- Cores/CTA `64e31493...`
- PT-PT `b0e2928a...`

A resolução deve preservar **ambos**:
1. estado visual final do HEAD de Cores;
2. exatamente as duas substituições textuais do PT-PT.

Não usar “último ficheiro ganha” cegamente.

Restantes domínios observados são distintos:
- A2: access/worker;
- PDF: planifications + `types.ts`;
- Xadrez: `src/lib/maPdf/extractPdfText.ts`;
- Daily: `daily/**`;
- GIAE: `giae/**` + contrato explícito;
- Backup: `settings/backupRepository.ts`;
- CI: workflow.

## 3. Estratégia de composição A1

Preferência: construir um snapshot candidato a partir da árvore exata da `main` e sobrepor os **blobs finais** dos HEADs acima, em vez de mergear PRs históricos.

Vantagens:
- elimina risco de integrar duas vezes lotes empilhados;
- usa o estado final já revisto, não a sequência de tentativas intermédias;
- permite resolver explicitamente a única sobreposição conhecida Cores + PT-PT;
- produz um SHA único e auditável para A6.

O candidato deve ter `344841c...` como único parent técnico do snapshot de integração. Isto é apenas um candidato de validação, não publicação.

## 4. Verificações antes de materializar candidato

A1 deve:
- recolher árvore final de cada HEAD elegível;
- mapear todos os paths BASE→HEAD;
- confirmar ausência de novas sobreposições não identificadas;
- resolver `SetupConfirmationStep.tsx` combinando Cores + PT-PT;
- confirmar que ficheiros novos de testes são todos preservados;
- confirmar que nenhum ficheiro de coordenação entra no produto.

## 5. Prova obrigatória no candidato

### Suites automáticas
- Conquistador completa;
- MA-Professor completa;
- MA-Quadro completa;
- `npm run build`.

### Smokes direcionados mínimos
- acesso: pedido/aprovação/login/logout/verify/renew + compatibilidade legada;
- setup cores: teste específico de codificação + render/estrutura;
- horário Xadrez: fixture geométrica + `Clube Xadrez`, `SP`, `Eq Pedag`, `Eq PCE`, dias/salas;
- Planificações PDF: multi-UFCD, `0349`, ambiguidades, create/append/skip, reimport, persistência, atomicidade e ausência de efeitos colaterais;
- Daily: cenário de avaliação nula/concorrente coberto pelo lote aprovado;
- GIAE: single, bulk, stale, clipboard falhado, pending/falso sucesso, retry; registar como não executado o que exigir browser/multi-tab/IndexedDB real se o ambiente não o permitir;
- Backup: rollback/atomicidade e preservação.

## 6. Revisão A6

Depois da prova executável, A1 entrega ao A6:
- SHA exato do candidato;
- BASE exata `344841c...`;
- lista de lotes/HEADs incorporados;
- matriz de ficheiros e sobreposições;
- comandos/resultados das suites/build/smokes;
- limitações E2E reais não executadas.

A6 deve emitir parecer independente por SHA exato. APTO do candidato **não autoriza merge**.

## 7. Gate do utilizador

Só depois de:
1. candidato montado;
2. provas executáveis concluídas;
3. parecer A6 final;

A1 apresenta ao utilizador o SHA candidato, o que muda, o que foi testado e o que não foi testado. Só uma autorização explícita do utilizador permite qualquer merge para `main`.
