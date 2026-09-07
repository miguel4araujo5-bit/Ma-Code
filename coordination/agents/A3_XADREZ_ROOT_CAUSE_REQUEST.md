# A3-G2 — A3-HORARIO-XADREZ-01 — causa raiz e pedido A1

Data: 2026-09-08

Estado: diagnóstico concluído; sem alteração funcional.

Branch A3: `agent3-g2/schedule-pdf-xadrez-344841c`

BASE/HEAD atual: `344841c1fc402e813f9d8658d96fa20b0fefa779`

## Evidência

O PDF real do utilizador contém `Clube Xadrez` à terça-feira, 15:20–16:10, com sala `SP`. O ficheiro privado não é publicado no repositório.

No parser A3 (`src/components/ma-professor/setup/SchedulePdfImportStep.tsx`), `extractDutyName()` já aceita nomes iniciados por `Clube ` e `parsePages()` tenta `addDuty()` antes de `addLesson()`. Assim, o classificador A3 já cobre `Clube Xadrez` quando a célula chega ao parser.

A causa está antes do parser, no extrator partilhado `src/lib/maPdf/extractPdfText.ts`, reservado ao A1.

`discardTimetableRoomColumns()` classifica cada célula pela âncora de cabeçalho mais próxima usando `getCellColumnProbeX()`. Esse probe usa quase o bordo esquerdo da célula (`cell.x + min(5, max(1, width*0.12))`). No layout real, uma atividade longa colocada no início da coluna de terça-feira, como `Clube Xadrez`, pode ter esse probe mais próximo da âncora `Sala` imediatamente anterior do que do centro da própria coluna `Terça`. A célula é então tratada como `room` e descartada antes de `SchedulePdfImportStep` a receber.

Isto explica por que o classificador A3 aparenta suportar Xadrez mas a atividade desaparece no fluxo real.

## Pedido ao A1

Como a correção necessária é no ficheiro partilhado `src/lib/maPdf/extractPdfText.ts`, A3 para sem editar código e pede ao A1 que:

1. confirme a causa com uma fixture geométrica equivalente ao layout real;
2. corrija a associação célula→coluna no extrator partilhado;
3. prefira uma regra baseada no intervalo/overlap horizontal da célula com as colunas de cabeçalho, ou outra regra estrutural robusta, em vez de aumentar arbitrariamente o offset do probe;
4. prove pelo menos:
   - `Clube Xadrez` em terça 15:20–16:10 preservado como célula de terça;
   - `SP` descartado como sala;
   - `Eq Pedag` e `Eq PCE` continuam preservados nas colunas corretas;
   - aulas normais não mudam de dia;
   - códigos de sala não passam para a atividade;
5. entregar SHA exato + teste do extrator ao A3/A6.

Depois desse contrato A1, A3 deve apenas confirmar o consumo em `SchedulePdfImportStep.tsx` e adicionar regressão própria se necessária. Não é recomendada uma recuperação heurística em `line.text`, porque uma linha de horário pode conter atividades de vários dias e já perdeu a geometria segura depois do descarte.

Nenhum merge/main.
