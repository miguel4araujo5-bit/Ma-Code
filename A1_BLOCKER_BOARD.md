# A1-G2 — QUADRO ATIVO DE DESBLOQUEIO

Atualização: 2026-09-08T08:52+01:00

Regra operacional: nenhum agente fica apenas “a aguardar”. Cada pendência tem proprietário, ação executável e critério de saída. Se houver impedimento técnico real, deve ser escalado ao A1 com causa e evidência concreta.

## FECHADO — A2-G2 — ACESSO / RENOVAÇÃO

Branch: `agent2-g2/access-session-contract-7ec8904`
HEAD FINAL: `7038930471c80753b40ffde91eb023fc050f0030`
CI: Build Check #1649 / run `34169554049` = SUCCESS.
A6-G2: **APTO** por SHA exato.

AÇÃO A2: manter congelado. Nenhum novo código salvo finding novo.

## FECHADO PARA FUTURA COMBINAÇÃO — A3-G2 — HORÁRIO / CLUBE XADREZ

Branch: `agent3-g2/schedule-pdf-xadrez-344841c`
BASE: `344841c1fc402e813f9d8658d96fa20b0fefa779`
HEAD FINAL: `800d91198d7f1b2c2193ebdd89a78425ceb8effd`
A6-G2: **APTO** para futura combinação controlada, com limitações executáveis diferidas para o candidato combinado.

Delta: 1 commit; apenas `src/lib/maPdf/extractPdfText.ts` + `tests/ma-professor/schedule-pdf-column-geometry.test.mjs`.
Evidência A3: smoke geométrico isolado 6/6 PASS.

AÇÃO A3: manter congelado.
AÇÃO A6: nenhuma revisão isolada adicional; voltar a validar no candidato combinado.

## FECHADO PARA FUTURA COMBINAÇÃO — A3-G2 — TEXTO PT-PT

Branch: `agent3-g2/setup-ptpt-copy-344841c`
BASE: `344841c1fc402e813f9d8658d96fa20b0fefa779`
HEAD FINAL: `b0e2928a0e80306503a38787f4a46a8acea7fee1`
A6-G2: **APTO** para futura combinação controlada.

Delta confirmado: 1 commit, 0 behind, 1 ficheiro, apenas 2 alterações:
- `Revisei os dados apresentados.` → `Revi os dados apresentados.`
- `Posso criar cópias cifradas online` → `Posso criar cópias de segurança cifradas online`

AÇÃO A3: manter congelado.

## PRONTO PARA VALIDAÇÃO NO CANDIDATO — A3-G2 — CORES / CTA

Branch: `agent3-g2/setup-action-colors-344841c`
HEAD congelado: `64e3149336c6097c9777a8feb38209f9bfb37be9`
A6: finding de código anterior corrigido; nenhum novo finding de código. Falta prova executável no SHA isolado.

DECISÃO A1: não reabrir nem fazer push só para CI. Teste específico + suites/build ficam obrigatórios no candidato combinado.

## PRONTO PARA VALIDAÇÃO NO CANDIDATO — A4-G2 — GIAE

Branch: `agent4-g2/giae-explicit-resubmit-f314a8b`
HEAD congelado: `ba87e69873a0277a63e84b98bf539038aba0151f`
Prova local isolada: 9/9 PASS.
A6: sem finding bloqueante de código; validação executável completa diferida para candidato combinado.

AÇÃO A4: manter congelado e conservar checklist E2E/smoke: single, bulk, stale, clipboard falhado, pending/falso sucesso, retry e multi-tab/IndexedDB.

## OUTROS LOTES JÁ ELEGÍVEIS / CONGELADOS

- PDF-IMPORT: `e4df193d78c5d9523cf7803af30241ab92e8ec6b` — APTO.
- BACKUP-ATOMIC: `94fd528ac0a38d4eca7b56a83cd160a0616a84df` — APTO.
- CI-ISOLATION: `745dab64e2355b1e14a36687d60a21e77b6e0f34` — APTO.
- A4-DAILY-NR-01: `df7098fe510aa79fc72bde035053389045a8d117` — APTO.

## PRIORIDADE ATIVA — A1-G2 — CANDIDATO ÚNICO

A1 é agora o proprietário da próxima ação.

FAZER AGORA — A1:
1. inventariar dependências e relações de ancestralidade entre todos os lotes elegíveis;
2. garantir que nenhum PR/lote histórico empilhado é integrado duas vezes;
3. definir ordem de combinação segura e identificar conflitos de ficheiro antes de criar candidato;
4. preparar branch de candidato apenas depois dessa verificação;
5. no candidato executar suites MA-Professor + Conquistador + MA-Quadro, build e smokes proporcionais aos lotes;
6. entregar SHA combinado ao A6 para revisão final independente;
7. só depois pedir autorização explícita do utilizador para qualquer merge em `main`.

## FILA A6 A PARTIR DE AGORA

- Não há revisão isolada pendente de A2, Xadrez ou PT-PT.
- Cores e GIAE mantêm limitações executáveis para o candidato combinado.
- Próxima revisão material A6: SHA do candidato único, com suites/build/smokes completos e lista de limitações E2E não executadas.

## PROTEÇÕES

- `main` não é alterada sem autorização explícita do utilizador.
- nenhum merge é autorizado por este quadro.
- não criar PR/push apenas para obter CI.
- não rebasear/reconstruir HEADs fechados apenas por organização.
- qualquer finding novo volta ao proprietário técnico com causa concreta e critério de fecho.
