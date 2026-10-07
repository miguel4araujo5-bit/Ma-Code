# MA-Professor — revisão da alteração de 2026-10-07

## Objetivo funcional fechado
1. "Aula extra" passa a ser tratada como **antecipação**, nunca como aumento da carga letiva.
2. Uma disciplina só pode consumir o total de tempos definido na planificação.
3. Ao antecipar, é reutilizada a **última aula futura planeada** da disciplina; não é criada uma aula adicional.
4. Se a antecipação atravessar limites de UFCD, os limites futuros são ajustados preservando a quantidade de tempos de cada UFCD.
5. Aulas futuras com sumário, atividade, notas, planificação, faltas, avaliações ou sugestões associadas não podem ser deslocadas silenciosamente.
6. Planificação no editor: botões **− / + / Adicionar**. Navegar não consome o item. Só "Adicionar" associa o item à aula.
7. A sugestão da planificação aparece em tom fantasma dentro da área do Sumário e é acrescentada ao texto existente.
8. "Copiar aula anterior" copia **apenas o sumário**.

## Ficheiros centrais
- `src/components/ma-professor/calendar/extraLessonRepository.ts`
- `src/components/ma-professor/calendar/ExtraLessonDialogBase.tsx`
- `src/components/ma-professor/calendar/PlanificationSummaryTextarea.tsx`
- `src/components/ma-professor/lessons/lessonRepository.ts`

## Commits desta implementação
- `1d3983734029f0e85489cdb1a27eb87b13f687bf`
- `dcec817ca6419b63196c87efb684a5143a76a1da`
- `ab9f9690dccaa3de1fda0dce8efdba0a025433ec`
- `3472c64d3e17b7ac220235ee784086a1c1050505`

## Checklist para auditoria por outra IA
- Confirmar que uma antecipação mantém invariável o total de tempos da disciplina.
- Confirmar que cada UFCD mantém os seus tempos planeados quando há deslocação entre UFCDs.
- Testar antecipação dentro da mesma UFCD e atravessando 1+ limites de UFCD.
- Testar bloqueios quando a última aula ou uma aula de fronteira já tem dados associados.
- Confirmar que −/+ apenas navegam e que Adicionar é a única ação que reserva o item.
- Confirmar que o item adicionado fica indisponível para outra aula planeada.
- Confirmar que "Copiar aula anterior" não copia atividade nem notas.
- Confirmar que não houve regressões em GIAE, faltas, avaliações, backups ou geração do horário.

## Estado de validação
Alterações gravadas diretamente na `main`. No momento deste registo, o GitHub não expunha checks automáticos para o HEAD; por isso uma auditoria posterior deve executar build/typecheck/testes do projeto antes de considerar a alteração totalmente validada.
