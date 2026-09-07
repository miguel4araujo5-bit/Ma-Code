# A1-G2 — QUADRO ATIVO DE DESBLOQUEIO

Atualização: 2026-09-08

Regra operacional: nenhum agente fica apenas “a aguardar”. Cada bloqueio tem uma ação executável agora. Se essa ação não puder ser feita, o agente comunica ao A1 a causa concreta, evidência e a decisão necessária. Não repetir mensagens genéricas.

## PRIORIDADE 1 — A2-G2 — ACESSO / RENOVAÇÃO

Estado técnico: FOLLOW-UP IMPLEMENTADO.
Branch: `agent2-g2/access-session-contract-7ec8904`
HEAD FINAL: `7038930471c80753b40ffde91eb023fc050f0030`
CI: Build Check #1649 / run `34169554049` = SUCCESS.

Causa do bloqueio anterior: `/logout` podia revogar a sessão no storage e deixar a cadeia interna com cache antiga; compatibilidade de sessão histórica hex também não estava fechada em `/account/verify` e `/logout`.

FAZER AGORA — A2:
- congelar `7038930471...`;
- não fazer mais alterações salvo finding novo do A6;
- responder apenas a perguntas técnicas do A6 sobre este SHA.

FAZER AGORA — A6:
- rever `7038930471...` contra `a3d07b8e...` e contra o contrato A2-NR-01;
- confirmar especificamente: logout -> verify 401 -> renew 401 sem renewal; Base64 canónico; fallback hex apenas para sessão realmente existente; isolamento por device/account; ausência de regressão piloto/fundador/licença;
- emitir `APTO` ou `BLOQUEADO` por SHA exato.

CONCLUÍDO QUANDO:
- A6 emitir parecer final sobre `7038930471...` e não existir finding bloqueante.

## PRIORIDADE 2 — A3-G2 — HORÁRIO / CLUBE XADREZ

Estado técnico: BLOQUEADO POR DEPENDÊNCIA PARTILHADA, causa identificada.
Branch A3: `agent3-g2/schedule-pdf-xadrez-344841c`
BASE atual: `344841c1fc402e813f9d8658d96fa20b0fefa779`

Causa real: `SchedulePdfImportStep.tsx` já reconhece atividades `Clube ...`; a perda ocorre antes, em `src/lib/maPdf/extractPdfText.ts`, onde `discardTimetableRoomColumns()` classifica a célula pela proximidade de um probe quase no bordo esquerdo. Uma célula larga de terça pode ser confundida com a coluna `Sala` imediatamente anterior e ser descartada.

DECISÃO A1 DE DESBLOQUEIO:
A1 transfere temporariamente ao A3-G2 ownership estritamente limitado de `src/lib/maPdf/extractPdfText.ts` para este finding, além de `SchedulePdfImportStep.tsx` + testes do lote. Não existe autorização para outras alterações no extrator.

FAZER AGORA — A3:
1. substituir a decisão baseada no probe do bordo esquerdo por classificação geométrica robusta;
2. preferência A1: fronteiras entre centros das âncoras de cabeçalho + escolha da coluna pelo maior overlap horizontal da célula; fallback apenas por distância ao centro quando não exista overlap útil;
3. não usar recuperação heurística em `line.text`;
4. provar numa fixture geométrica:
   - `Clube Xadrez` -> terça, 15:20–16:10;
   - `SP` continua descartado como sala;
   - `Eq Pedag` e `Eq PCE` continuam preservados;
   - aulas normais não mudam de dia;
   - códigos de sala não entram no texto da atividade;
5. entregar um único HEAD final da branch A3, sem commits intermédios desnecessários.

ESCALAR AO A1 SE:
- a correção exigir alterar outro ficheiro partilhado;
- a fixture mostrar que a causa geométrica não explica o PDF real;
- houver ambiguidade estrutural entre duas colunas com overlap equivalente.

CONCLUÍDO QUANDO:
- A3 entregar HEAD exato + testes;
- A6 rever o extrator e o consumo A3 e emitir parecer.

## PRIORIDADE 3 — A3-G2 — CORES / CTA

Estado técnico: código corrigido; validação executável ainda incompleta.
Branch: `agent3-g2/setup-action-colors-344841c`
HEAD: `64e3149336c6097c9777a8feb38209f9bfb37be9`

FAZER AGORA — A3:
- se o ambiente permitir, executar `node --test tests/ma-professor/setup-action-color-coding.test.mjs` e `npm run build` sem alterar o HEAD;
- se o ambiente não permitir, comunicar UMA VEZ a limitação concreta e não ficar parado: continuar o Xadrez.

FAZER AGORA — A6:
- manter o parecer de código associado a `64e31493...`;
- não bloquear a revisão de A2/A4 por falta desta prova executável.

CONCLUÍDO QUANDO:
- existir prova executável no SHA exato ou a limitação ficar formalmente aceite para o candidato combinado.

## PRIORIDADE 4 — A4-G2 — GIAE

Estado técnico: IMPLEMENTADO + PROVA LOCAL.
Branch: `agent4-g2/giae-explicit-resubmit-f314a8b`
HEAD: `ba87e69873a0277a63e84b98bf539038aba0151f`
Prova local isolada: 9/9 PASS.

FAZER AGORA — A4:
- congelar o HEAD;
- não fazer mais código salvo finding novo do A6;
- preparar apenas checklist E2E para o futuro candidato: single, bulk, stale, clipboard falhado, pending/falso sucesso, retry e multi-tab/IndexedDB.

FAZER AGORA — A6:
- rever imediatamente `ba87e698...` contra `f314a8b...`, incorporando a prova 9/9 e declarando separadamente o que continua sem CI/E2E;
- emitir `APTO`, `APTO COM LIMITAÇÕES` ou `BLOQUEADO` por SHA exato.

CONCLUÍDO QUANDO:
- A6 emitir parecer sobre `ba87e698...` sem finding bloqueante.

## A3-G2 — TEXTO PT-PT

Estado: simples, não bloqueia prioridades.
Branch: `agent3-g2/setup-ptpt-copy-344841c`

FAZER DEPOIS DO XADREZ:
- `Revisei os dados apresentados.` -> `Revi os dados apresentados.`
- `Posso criar cópias cifradas online` -> `Posso criar cópias de segurança cifradas online`
- lote separado; não misturar com cores nem PR #23.

## A5-G2

Sem bloqueio funcional prioritário. Backup permanece congelado/APTO. Na funcionalidade Excel continua apenas análise/planeamento; não iniciar implementação sem contrato A1.

## REGRA A6 DE FILA

A6 não deve ficar à espera de todos os lotes para começar. Ordem agora:
1. A2 `7038930471...` — revisão final;
2. A4 GIAE `ba87e698...` — revisão final de código + prova local;
3. A3 cores `64e31493...` — fechar quando houver prova executável;
4. A3 Xadrez — rever assim que chegar o novo HEAD.

## PROTEÇÕES

- `main` não é alterada sem autorização explícita do utilizador.
- nenhum merge é autorizado por este quadro.
- não criar PR/push apenas para obter CI.
- não rebasear/reconstruir HEADs já fechados apenas para organização.
- qualquer finding novo volta ao proprietário técnico com causa concreta e critério de fecho.
