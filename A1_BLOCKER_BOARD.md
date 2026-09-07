# A1-G2 — QUADRO ATIVO DE DESBLOQUEIO

Atualização: 2026-09-08

Regra operacional: nenhum agente fica apenas “a aguardar”. Cada bloqueio tem uma ação executável agora. Se essa ação não puder ser feita, o agente comunica ao A1 a causa concreta, evidência e a decisão necessária. Não repetir mensagens genéricas.

## FECHADO — A2-G2 — ACESSO / RENOVAÇÃO

Branch: `agent2-g2/access-session-contract-7ec8904`
HEAD FINAL: `7038930471c80753b40ffde91eb023fc050f0030`
CI: Build Check #1649 / run `34169554049` = SUCCESS.
A6-G2: **APTO** no SHA exato para futura combinação controlada.

A correção fecha o stale-cache pós-logout e preserva o contrato Base64 canónico + compatibilidade hex legada. As limitações E2E/multi-dispositivo ficam para o candidato global.

AÇÃO A2: manter o HEAD congelado. Nenhum novo código salvo finding novo do A6.

## EM REVISÃO A6 — A3-G2 — HORÁRIO / CLUBE XADREZ

Branch: `agent3-g2/schedule-pdf-xadrez-344841c`
BASE: `344841c1fc402e813f9d8658d96fa20b0fefa779`
HEAD ENTREGUE: `800d91198d7f1b2c2193ebdd89a78425ceb8effd`

Estado técnico: **IMPLEMENTADO E CONGELADO; AGUARDA REVISÃO A6**.

Delta confirmado: 1 commit, exatamente 2 ficheiros:
- `src/lib/maPdf/extractPdfText.ts`
- `tests/ma-professor/schedule-pdf-column-geometry.test.mjs`

A solução remove o probe junto ao bordo esquerdo e classifica célula→coluna por maior overlap horizontal entre a célula e os intervalos derivados dos centros dos cabeçalhos. O fallback por distância ao centro só é usado quando não existe overlap útil. Empates reais de overlap não são escolhidos silenciosamente.

Evidência A3 disponível: fixture no próprio commit + smoke geométrico isolado **6/6 PASS** para `Clube Xadrez`, `SP`, `Eq Pedag`, `Eq PCE` e aula normal. Não existe ainda suite/build completa/status check no SHA exato.

AÇÃO AGORA — A3:
- manter `800d9119...` congelado;
- não fazer mais alterações neste lote salvo finding novo do A6;
- avançar para o lote PT-PT separado.

AÇÃO AGORA — A6:
- rever `800d9119...` por SHA exato;
- verificar algoritmo de overlap/fallback/empates, preservação de `Clube Xadrez` na terça 15:20–16:10, descarte de salas/SP e ausência de regressão noutros PDFs/tabelas;
- emitir `APTO DE CÓDIGO`, `APTO COM LIMITAÇÕES` ou `BLOQUEADO`;
- se não houver finding de código, a lacuna de suite/build pode ser validada no candidato combinado, sem novo push apenas para CI.

CONCLUÍDO QUANDO:
- A6 não identificar finding bloqueante no SHA exato;
- prova executável proporcional existir no candidato combinado antes de integração.

## PRIORIDADE ATIVA 1 — A3-G2 — TEXTO PT-PT

Branch: `agent3-g2/setup-ptpt-copy-344841c`
BASE inicial: `344841c1fc402e813f9d8658d96fa20b0fefa779`

Estado: **AÇÃO A3 AGORA**.

Alterar exclusivamente `src/components/ma-professor/setup/SetupConfirmationStep.tsx`:
- `Revisei os dados apresentados.` → `Revi os dados apresentados.`
- `Posso criar cópias cifradas online` → `Posso criar cópias de segurança cifradas online`

Não alterar qualquer outro texto, comportamento, layout, lógica, cores ou ficheiro. Não misturar com Xadrez, cores ou PR #23 funcional.

CONCLUÍDO QUANDO:
- A3 entregar um único HEAD exato com apenas estas duas correções;
- A1 confirmar delta limpo.

## PRONTO PARA VALIDAÇÃO NO CANDIDATO — A3-G2 — CORES / CTA

Branch: `agent3-g2/setup-action-colors-344841c`
HEAD congelado: `64e3149336c6097c9777a8feb38209f9bfb37be9`.

A6 confirmou que `A6-SETUP-COLORS-NR-01` está corrigido e não encontrou novo finding de código. Falta apenas prova executável no SHA, indisponível nos ambientes A3/A6 por falta de checkout/rede.

DECISÃO A1: esta lacuna não bloqueia mais o trabalho A3. O HEAD permanece congelado e entra no candidato combinado apenas se o candidato executar teste específico + suite/build e o A6 rever o SHA combinado final.

AÇÃO A3: não voltar a este lote salvo finding novo.
AÇÃO A6: manter a limitação registada e voltar a validar no candidato combinado.

## PRONTO PARA VALIDAÇÃO NO CANDIDATO — A4-G2 — GIAE

Branch: `agent4-g2/giae-explicit-resubmit-f314a8b`
HEAD congelado: `ba87e69873a0277a63e84b98bf539038aba0151f`.
Prova local isolada: **9/9 PASS**.
A6: revisão de código sem finding bloqueante; parecer atual `VERIFICAÇÃO INCOMPLETA` apenas por ausência de suite/build no SHA exato.

DECISÃO A1: A4 não deve fazer novo código nem novo push só para satisfazer CI. Este HEAD fica pronto para inclusão controlada no candidato, onde serão obrigatórios suite MA-Professor, Conquistador, MA-Quadro, build e smokes GIAE proporcionais antes do parecer final A6.

AÇÃO A4: congelar HEAD e preparar apenas checklist E2E/smoke para o candidato: single, bulk, stale, clipboard falhado, pending/falso sucesso, retry e multi-tab/IndexedDB.
AÇÃO A6: manter a limitação registada; o fecho definitivo é no SHA combinado com prova executável.

## A5-G2

Backup/restore permanece congelado/APTO. Na funcionalidade Excel continua apenas análise/planeamento; não iniciar implementação sem contrato A1.

## PRÓXIMO MARCO A1

Quando existirem:
- parecer A6 sobre Xadrez `800d9119...` sem finding bloqueante;
- HEAD final limpo do PT-PT;

A1 deve inventariar todos os lotes elegíveis, verificar dependências/sobreposições e preparar o plano de um único candidato combinado. Não integrar duas vezes lotes empilhados. O candidato terá de executar suites/build/smokes completos e regressar ao A6 por SHA exato antes de qualquer pedido de autorização ao utilizador.

## FILA A6 A PARTIR DE AGORA

1. Xadrez `800d9119...` — revisão imediata de código por SHA exato.
2. Cores `64e31493...` e GIAE `ba87e698...` — limitações executáveis mantidas para o candidato combinado.
3. A2 `7038930471...` — fechado/APTO; nenhuma ação.
4. Candidato único — revisão final completa quando A1 o montar.

## PROTEÇÕES

- `main` não é alterada sem autorização explícita do utilizador.
- nenhum merge é autorizado por este quadro.
- não criar PR/push apenas para obter CI.
- não rebasear/reconstruir HEADs já fechados apenas para organização.
- qualquer finding novo volta ao proprietário técnico com causa concreta e critério de fecho.
