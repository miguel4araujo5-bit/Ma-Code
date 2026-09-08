# SUBSTITUÍDO — PRESERVAR COMO HISTÓRICO

A partir da atualização A1-G2 de 2026-09-08, `AGENT_STATUS.md` é o único resumo operacional dos seis agentes. Este ficheiro deixa de ser quadro ativo e fica preservado apenas como histórico. Não apagar nem continuar a atualizar este conteúdo.

---

# A1-G2 — QUADRO ATIVO DE DESBLOQUEIO

Atualização: 2026-09-08T14:58+01:00

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

AÇÃO A3: manter este HEAD congelado.

## PRONTO PARA VALIDAÇÃO NO CANDIDATO — A3-G2 — CORES / CTA

Branch: `agent3-g2/setup-action-colors-344841c`
HEAD congelado: `64e3149336c6097c9777a8feb38209f9bfb37be9`
A6: finding de código anterior corrigido; nenhum novo finding de código. Falta prova executável no SHA isolado.

DECISÃO A1: não reabrir nem fazer push só para CI. Teste específico + suites/build ficam obrigatórios no candidato combinado.

### MICRO-TAREFA MECÂNICA A3 — OVERLAP CORES + PT-PT

Motivo: o candidato único tem uma única sobreposição material entre lotes independentes em `src/components/ma-professor/setup/SetupConfirmationStep.tsx`.

A1 comunicou diretamente no PR #23, comentário `5583926744`.

AÇÃO A3:
- partir exatamente de `64e3149336c6097c9777a8feb38209f9bfb37be9`;
- alterar apenas `SetupConfirmationStep.tsx`;
- aplicar exclusivamente as duas substituições PT-PT já aprovadas;
- zero reformat e zero outra alteração;
- branch temporária, sem PR/merge/main;
- entregar branch, HEAD e blob SHA;
- provar diff apenas 2 adições + 2 remoções.

CRITÉRIO DE SAÍDA: blob final = estado visual integral de Cores + exatamente as duas frases PT-PT. O A1 consumirá apenas esse blob no snapshot; o micro-HEAD não entra como histórico.

## NOVO LOTE PRIORITÁRIO ANTES DO CANDIDATO — CRITÉRIOS SIMPLES POR DISCIPLINA

Requisito do utilizador: o caso normal deve ser `definir critérios → aplicar a uma ou várias disciplinas/associações → todas as UFCD herdam`. A personalização por UFCD deve ser exceção secundária, não uma pergunta obrigatória no início.

Contrato A1: `A1_CRITERIA_SIMPLE_FLOW_20260908.md`.

Código atual confirmado:
- `scope: subject` já representa os critérios gerais da associação turma+disciplina;
- `resolveAssessmentScheme()` em `assessments/**` dá precedência a `scope: module` e depois usa `scope: subject`, logo uma personalização de UFCD pode funcionar como override seguro;
- `createAssessmentScheme()` é atómico apenas para uma associação, portanto seleção múltipla NÃO pode usar várias chamadas sequenciais com risco de write parcial.

AÇÃO A1 — FAZER AGORA:
1. fornecer contrato batch atómico para aplicar o mesmo conjunto a vários `teachingAssignmentId`;
2. pré-validar integralmente todas as seleções antes de qualquer write;
3. qualquer erro => zero writes;
4. preservar compatibilidade com schemes `subject`/`module` existentes e sem migração.

AÇÃO A3 — após a micro-tarefa Cores+PT-PT:
1. lote isolado em `AssessmentCriteriaSetupStep.tsx` + testes setup;
2. colocar nome/critérios/ponderações primeiro;
3. depois bloco `Aplicar a` com seleção explícita de uma ou várias associações;
4. texto: `Este conjunto será aplicado a todas as UFCD das disciplinas selecionadas.`;
5. retirar do percurso normal `Todas as UFCD` / `Apenas uma UFCD`;
6. ação secundária `Personalizar uma UFCD`, escolhendo associação + UFCD e deixando claro que substitui apenas nessa UFCD;
7. não alterar `repository.ts`, db ou types partilhados sem contrato A1.

AÇÃO A4 — revisão funcional apenas, sem código: confirmar ausência de ambiguidades/regressões no domínio de avaliações com `subject` geral + `module` override. Pedido publicado no PR #27, comentário `5586272926`.

AÇÃO A6 — aguardar HEAD A1 batch + HEAD A3 UX e rever o lote conjunto por SHA exato antes de entrar no candidato global. Pré-aviso publicado no PR #24, comentário `5586276145`.

CRITÉRIO DE SAÍDA: fluxo simples funcional, multi-seleção atómica, override explícito por UFCD, testes e parecer A6 sem finding bloqueante.

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

## PENDÊNCIA DE PLANEAMENTO NÃO BLOQUEANTE — A4-G2 — EXCEL AVALIAÇÃO FINAL

O planeamento futuro `A1_EXCEL_UFCD_FINAL_ASSESSMENT_PLANNING.md` já tem contributos A3 (UX/import/mapping) e A5 (privacidade/preservação). Falta o parecer funcional A4 sobre `assessments/**`.

A1 comunicou diretamente no PR #27, comentário `5583952182`.

AÇÃO A4 — apenas análise, sem código/branch funcional:
- identificar fonte de verdade atual para avaliações, critérios, ponderações, autoavaliação e classificação final;
- definir proposta calculada vs classificação final confirmada;
- regras de autoavaliação, arredondamento 0–20 e conflitos;
- stale entre preview e confirmação;
- zero writes antes de confirmação explícita;
- dados mínimos a expor ao exportador Excel sem segunda fonte de verdade;
- casos insuficientes/ambíguos e testes de aceitação.

CRITÉRIO DE SAÍDA: parecer funcional entregue ao A1, com ambiguidades do código marcadas como decisões pendentes. Depois A1 consolida A3+A4+A5 e envia desenho ao A6 antes de qualquer implementação Excel.

Esta pendência NÃO bloqueia nem entra no candidato combinado atual.

## PRIORIDADE ATIVA — A1-G2 — CANDIDATO ÚNICO

A1 continua proprietário da composição.

Pré-árvore Git não publicada já preparada, sem o único ficheiro sobreposto: `64faf2f77023c872e4bba73181aef10e20657c9c`.

DECISÃO A1: o commit candidato final fica temporariamente adiado até fechar o novo lote `CRITÉRIOS SIMPLES POR DISCIPLINA`, porque o utilizador pediu esta alteração antes do fecho e ela toca no setup que já integraremos. A pré-árvore permanece apenas como prova/inventário e não é publicada.

FAZER AGORA — A1:
1. manter o inventário BASE→HEAD e as relações de ancestralidade confirmadas;
2. fornecer o batch atómico dos critérios;
3. receber e validar o micro-blob Cores+PT-PT do A3;
4. receber e validar o novo HEAD UX de critérios do A3;
5. obter revisão A4 funcional e A6 do lote de critérios;
6. reconstruir/atualizar a árvore candidata com os estados finais;
7. verificar delta completo e ausência de ficheiros de coordenação;
8. executar suites MA-Professor + Conquistador + MA-Quadro, build e smokes proporcionais;
9. entregar SHA combinado ao A6 para revisão final independente;
10. só depois pedir autorização explícita do utilizador para qualquer merge em `main`.

## FILA A6 A PARTIR DE AGORA

- Não repetir revisões isoladas já fechadas.
- Cores e GIAE mantêm limitações executáveis para o candidato combinado.
- A micro-tarefa A3 de overlap é apenas mecânica e não requer parecer A6 isolado se o diff provar exatamente as duas substituições sobre o HEAD de Cores.
- Rever o novo lote de critérios quando A1 entregar contrato batch + A3 HEAD UX.
- Depois, próxima revisão material: SHA do candidato único, com suites/build/smokes completos e lista de limitações E2E não executadas.
- Para Excel: revisão de desenho apenas depois de A1 consolidar os pareceres A3+A4+A5; sem implementação autorizada.

## PROTEÇÕES

- `main` não é alterada sem autorização explícita do utilizador.
- nenhum merge é autorizado por este quadro.
- não criar PR/push apenas para obter CI.
- não rebasear/reconstruir HEADs fechados apenas por organização.
- qualquer finding novo volta ao proprietário técnico com causa concreta e critério de fecho.
