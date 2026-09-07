# A1-G2 — QUADRO ATIVO DE DESBLOQUEIO

Atualização: 2026-09-08T00:27+01:00

Regra operacional: nenhum agente fica apenas “a aguardar”. Cada bloqueio tem uma ação executável agora. Se essa ação não puder ser feita, o agente comunica ao A1 a causa concreta, evidência e a decisão necessária. Não repetir mensagens genéricas.

## FECHADO — A2-G2 — ACESSO / RENOVAÇÃO

Branch: `agent2-g2/access-session-contract-7ec8904`
HEAD FINAL: `7038930471c80753b40ffde91eb023fc050f0030`
CI: Build Check #1649 / run `34169554049` = SUCCESS.
A6-G2: **APTO** no SHA exato para futura combinação controlada.

A correção fecha o stale-cache pós-logout e preserva o contrato Base64 canónico + compatibilidade hex legada. As limitações E2E/multi-dispositivo ficam para o candidato global.

AÇÃO A2: manter o HEAD congelado. Nenhum novo código salvo finding novo do A6.

## PRIORIDADE ATIVA 1 — A3-G2 — HORÁRIO / CLUBE XADREZ

Estado técnico: **DESBLOQUEADO PELO A1; IMPLEMENTAÇÃO AGORA É RESPONSABILIDADE A3**.
Branch: `agent3-g2/schedule-pdf-xadrez-344841c`
HEAD atual: `344841c1fc402e813f9d8658d96fa20b0fefa779`.

Causa confirmada no código: `SchedulePdfImportStep.tsx` já reconhece atividades `Clube ...`; a perda ocorre antes, em `src/lib/maPdf/extractPdfText.ts`. `discardTimetableRoomColumns()` usa um probe quase no bordo esquerdo da célula para escolher a âncora mais próxima; uma célula larga de terça pode assim ser confundida com a coluna `Sala` anterior e descartada.

DECISÃO A1 DE OWNERSHIP:
A3-G2 tem autorização temporária e estritamente limitada para alterar `src/lib/maPdf/extractPdfText.ts` apenas para este finding, além de `src/components/ma-professor/setup/SchedulePdfImportStep.tsx` e testes próprios.

FAZER AGORA — A3:
1. corrigir a associação geométrica célula→coluna sem heurística textual;
2. preferência: maior overlap horizontal da célula com os intervalos de coluna derivados dos centros dos cabeçalhos; fallback apenas por distância ao centro quando não houver overlap útil;
3. provar numa fixture geométrica equivalente ao PDF real:
   - `Clube Xadrez` preservado em terça 15:20–16:10;
   - `SP` descartado como sala;
   - `Eq Pedag` e `Eq PCE` preservados;
   - aulas normais não mudam de dia;
   - códigos de sala não entram no texto da atividade;
4. executar testes proporcionais localmente se possível;
5. entregar um único HEAD final e SHA exato.

ESCALAR AO A1 IMEDIATAMENTE SE:
- for necessário outro ficheiro partilhado;
- a fixture contrariar esta causa;
- duas colunas tiverem overlap estruturalmente indistinguível.

CONCLUÍDO QUANDO:
- A3 entregar HEAD + prova;
- A6 rever esse SHA e não identificar finding bloqueante.

## PRONTO PARA VALIDAÇÃO NO CANDIDATO — A3-G2 — CORES / CTA

Branch: `agent3-g2/setup-action-colors-344841c`
HEAD congelado: `64e3149336c6097c9777a8feb38209f9bfb37be9`.

A6 confirmou que `A6-SETUP-COLORS-NR-01` está corrigido e não encontrou novo finding de código. Falta apenas prova executável no SHA, indisponível nos ambientes A3/A6 por falta de checkout/rede.

DECISÃO A1: esta lacuna **não bloqueia mais o trabalho A3**. O HEAD permanece congelado e entra no candidato combinado apenas se o candidato executar teste específico + suite/build e o A6 rever o SHA combinado final.

AÇÃO A3: não voltar a este lote agora; continuar Xadrez.
AÇÃO A6: manter a limitação registada e voltar a validar no candidato combinado.

## PRONTO PARA VALIDAÇÃO NO CANDIDATO — A4-G2 — GIAE

Branch: `agent4-g2/giae-explicit-resubmit-f314a8b`
HEAD congelado: `ba87e69873a0277a63e84b98bf539038aba0151f`.
Prova local isolada: **9/9 PASS**.
A6: revisão de código sem finding bloqueante; parecer atual `VERIFICAÇÃO INCOMPLETA` apenas por ausência de suite/build no SHA exato.

DECISÃO A1: A4 não deve fazer novo código nem novo push só para satisfazer CI. Este HEAD fica **pronto para inclusão controlada no candidato**, onde serão obrigatórios suite MA-Professor, Conquistador, MA-Quadro, build e smokes GIAE proporcionais antes do parecer final A6.

AÇÃO A4: congelar HEAD e preparar apenas checklist E2E/smoke para o candidato: single, bulk, stale, clipboard falhado, pending/falso sucesso, retry e multi-tab/IndexedDB.
AÇÃO A6: manter a limitação registada; o fecho definitivo é no SHA combinado com prova executável.

## A3-G2 — TEXTO PT-PT

Branch: `agent3-g2/setup-ptpt-copy-344841c`

FAZER IMEDIATAMENTE DEPOIS DO XADREZ, em lote separado:
- `Revisei os dados apresentados.` → `Revi os dados apresentados.`
- `Posso criar cópias cifradas online` → `Posso criar cópias de segurança cifradas online`

Não misturar com cores, Xadrez ou PR #23.

## A5-G2

Backup/restore permanece congelado/APTO. Na funcionalidade Excel continua apenas análise/planeamento; não iniciar implementação sem contrato A1.

## FILA A6 A PARTIR DE AGORA

1. Não há ação adicional em A2: `7038930471...` já está APTO.
2. Aguardar o novo HEAD Xadrez e revê-lo imediatamente quando chegar.
3. Cores `64e31493...` e GIAE `ba87e698...` mantêm limitações executáveis registadas; não exigir novo push apenas para CI.
4. Quando A1 montar o candidato único, rever o SHA combinado e exigir suites/build/smokes completos antes de qualquer autorização de integração.

## PROTEÇÕES

- `main` não é alterada sem autorização explícita do utilizador.
- nenhum merge é autorizado por este quadro.
- não criar PR/push apenas para obter CI.
- não rebasear/reconstruir HEADs já fechados apenas para organização.
- qualquer finding novo volta ao proprietário técnico com causa concreta e critério de fecho.
