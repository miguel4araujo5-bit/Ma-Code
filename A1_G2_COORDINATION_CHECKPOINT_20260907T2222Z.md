# A1-G2 — Checkpoint de coordenação

Data: 2026-09-07T22:22+01:00

## Regra central

A1-G2 é o ponto central de coordenação. O utilizador não transporta mensagens entre agentes. A1 identifica a causa de cada bloqueio, pede solução ao responsável, aceita alternativas técnicas melhores, envolve outros âmbitos apenas quando necessário e usa A6 para revisão independente. `main`/integração/produção permanecem protegidas.

## Estado técnico real confirmado

### A2 — acesso/renovação
- Branch: `agent2-g2/access-session-contract-7ec8904`
- HEAD: `a3d07b8e8ed774fd88d23859d6b64e19ebff9f23`
- PR #28 draft
- Build Check #1648 / run `34117890604`: SUCCESS; MA-Professor 251/251; Conquistador e build passaram.
- Causa tratada em três passos: refresh após aprovação explícita; Base64 canónico com fallback hex legado; refresh após login para evitar cache stale no `/renew`.
- Estado A1: implementação candidata a fecho, aguardando revisão A6 do SHA exato. A2 deve ainda confirmar que não existe alternativa mais segura/simples e que fallback/refresh não alargam autenticação.

### A3 — setup
- Cores: branch `agent3-g2/setup-action-colors-344841c`, HEAD `f61bdb8724dcf95016e18813164a07149d45ec3e`, entregue/congelado; revisão A6 pedida; sem CI deste HEAD devido a `DEPLOY-PR-01`.
- Xadrez: branch `agent3-g2/schedule-pdf-xadrez-344841c` ainda em `344841c…`; não implementado.
- PT-PT: as frases `Revisei os dados apresentados.` e `Posso criar cópias cifradas online` ainda existem no HEAD de cores; branch separada criada `agent3-g2/setup-ptpt-copy-344841c` a partir da main para a correção textual isolada.
- Planificações PDF: PR #23 / `e4df193d…` permanece congelado/APTO e não deve ser alterado por estes lotes.

### A4 — GIAE
- Contrato central A1: `f314a8b6379d876cacacb96481cbf40effd2d5ce`, APTO para consumo controlado.
- Branch A4 de consumo: `agent4-g2/giae-explicit-resubmit-f314a8b`, ainda exatamente em `f314a8b…`; implementação A4 ainda não iniciada/entregue.
- Estado A1: A4 autorizado a consumir apenas em `giae/**` + testes, sem tocar em `lessonRepositoryBase.ts`.

### A5 — preservação
- PR #18 / `94fd528ac0a38d4eca7b56a83cd160a0616a84df` permanece congelado/APTO.
- A5 recebe apenas análise de preservação/privacidade da futura funcionalidade Excel; nenhuma implementação no lote aprovado.

### A6 — verificação
- Revisões prioritárias pedidas: A2 `a3d07b8e…`, A3 cores `f61bdb87…`; depois A4 GIAE quando existir novo HEAD.
- Parecer sempre por SHA exato; APTO não autoriza merge.

## Nova funcionalidade — Excel avaliação final UFCD/módulo

Planeamento registado em `A1_EXCEL_UFCD_FINAL_ASSESSMENT_PLANNING.md`.

A main já contém `src/components/ma-professor/assessments/assessmentWorkspaceRepository.ts` e `AssessmentWorkspaceView.tsx`, com suporte a `SaveModuleFinalGradeInput`/classificação final por módulo. A análise deve reutilizar esta fonte de verdade e evitar duplicar classificações finais. Não foi localizada uma implementação `.xlsx` existente para este fluxo.

A4 analisa domínio funcional/autoavaliação/nota final; A3 UX de upload/mapeamento; A5 retenção/privacidade/cópia do original; A1 contratos partilhados; A6 revisão de desenho. Sem implementação até decisão A1 posterior.

## Comunicação direta emitida

- PR #28: comentário A1 para A2 + pedido de revisão A6.
- PR #23: comentário A1 para A3 + pedido de revisão A6 das cores.
- PR #22: comentário A1 para A4 sobre consumo GIAE e análise Excel posterior.
- PR #18: comentário A1 para A5 sobre preservação/privacidade do Excel.
- PR #24: comentário A1 para A6 com fila de revisão.

## Limite técnico do AGENT_MESSAGES.md

O conector GitHub disponível nesta sessão não oferece append atómico. `AGENT_MESSAGES.md` tem ~118 KB e o único write disponível exige substituição integral do ficheiro. Como COMM-01/02/03 já demonstraram risco de corromper histórico ao fazer esse tipo de escrita, A1 não reescreveu o ficheiro. As instruções foram emitidas diretamente nos canais GitHub dos agentes e registadas nesta branch, sem usar o utilizador como intermediário. Quando existir um mecanismo de append seguro, o canal canónico pode ser sincronizado sem reescrever eventos anteriores.

## Próximo candidato

Ainda não preparar candidato combinado. Primeiro fechar/rever A2, A3 Xadrez/texto/cores e A4 GIAE. Depois A1 verifica sobreposições/dependências, combina uma única vez cada lote, corre suites/build/smokes proporcionais e entrega o SHA final ao A6. Só depois de parecer final e aprovação explícita do utilizador poderá haver autorização de merge para `main`.
