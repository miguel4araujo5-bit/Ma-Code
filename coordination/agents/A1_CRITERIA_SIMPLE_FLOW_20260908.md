# A1-G2 — CRITÉRIOS DE AVALIAÇÃO: FLUXO SIMPLES POR DISCIPLINA

Data: 2026-09-08
Estado: desenho/contrato aprovado para implementação isolada; não autoriza merge/main.

## Problema observado

O passo atual de critérios começa por selecionar uma `Turma e disciplina` e depois pergunta `Todas as UFCD` vs `Apenas uma UFCD`. Embora o modelo suporte corretamente `scope: subject` e `scope: module`, este fluxo expõe primeiro a exceção e obriga o professor a pensar em UFCD antes de definir o conjunto normal de critérios.

## Comportamento pretendido

O percurso normal deve ser:

1. Definir primeiro o conjunto de critérios: nome, critérios, descrições e ponderações (100%).
2. Depois escolher **Aplicar a**.
3. Permitir selecionar uma ou várias associações turma+disciplina explícitas (por exemplo `AE · 10.º E`, `AS · 10.º E`).
4. Por defeito, cada seleção cria um esquema `scope: subject`; isto aplica o mesmo conjunto a todas as UFCD dessa associação sem duplicar esquemas por UFCD.
5. Não perguntar no fluxo normal `Todas as UFCD` vs `Apenas uma UFCD`.
6. A personalização por UFCD deve existir como ação secundária/avançada, por exemplo `Personalizar uma UFCD`.
7. Nessa exceção, escolher associação + UFCD e criar `scope: module`. O módulo de avaliações já resolve `module` antes de `subject`, portanto a UFCD personalizada substitui o conjunto geral apenas nessa UFCD.

## Segurança / persistência

O método atual `maProfessorRepository.createAssessmentScheme()` é atómico apenas para uma associação. Não usar duas ou mais chamadas sequenciais para a seleção múltipla, porque uma poderia persistir e outra falhar.

A1 deve fornecer uma operação batch atómica para vários `teachingAssignmentId`, com pré-validação integral antes de qualquer write. Critérios mínimos:
- todos os assignments pertencem ao mesmo ano letivo;
- nenhum assignment selecionado tem já um `subject` scheme ativo incompatível;
- critérios válidos, nomes não repetidos e total 100%;
- criar um scheme distinto por assignment e os respetivos criteria numa única transação Dexie;
- qualquer erro => zero writes do lote;
- sem seleção silenciosa entre turmas/disciplinas semelhantes.

## UX recomendada

### Bloco 1 — Critérios
- Nome do conjunto
- linhas de critério + peso + descrição
- total 100%
- adicionar/remover/distribuir igualmente

### Bloco 2 — Aplicar a
- lista de checkboxes/cartões das associações turma+disciplina
- permitir uma ou várias seleções
- texto explícito: `Este conjunto será aplicado a todas as UFCD das disciplinas selecionadas.`
- botão principal: `Guardar e aplicar critérios`

### Bloco 3 — Exceções (secundário)
- ação discreta `Personalizar uma UFCD`
- só aparece/é usada quando necessário
- escolher associação e UFCD concreta
- texto explícito: `Estes critérios substituem os critérios gerais apenas nesta UFCD.`

## Critérios de aceitação

1. Um conjunto pode ser aplicado a 1 disciplina/associação.
2. O mesmo conjunto pode ser aplicado a 2 ou mais associações numa única confirmação.
3. Falha/precondição numa seleção múltipla => zero writes em todas.
4. O fluxo normal não pergunta ao professor se quer critérios diferentes por UFCD.
5. Subject scheme cobre todas as UFCD sem criar cópias por módulo.
6. Module scheme, quando criado explicitamente, tem precedência apenas na UFCD escolhida.
7. Associações homónimas/similares nunca são escolhidas silenciosamente.
8. Rascunho não é perdido ao alterar seleções sem confirmação.
9. Estado `uncoveredAssignments` continua correto: subject cobre toda a associação; na ausência de subject, só fica coberta quando todas as UFCD têm scheme module.
10. Compatibilidade com dados existentes: schemes `subject`/`module` já guardados continuam válidos sem migração.

## Ownership

- A1: contrato batch/persistência central e testes de atomicidade.
- A3: UX `AssessmentCriteriaSetupStep.tsx` + testes setup, consumindo o contrato A1.
- A4: apenas revisão funcional do impacto em `assessments/**`; não alterar código sem finding.
- A6: revisão independente do lote combinado por SHA exato.

Esta melhoria deve entrar antes do candidato final atual ser fechado, mas em lote/branch isolado. Não reabrir os HEADs já aprovados de Cores, PT-PT, Xadrez ou PDF.
