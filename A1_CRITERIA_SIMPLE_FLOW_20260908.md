# A1 — Contrato do fluxo simples de critérios

Estado: FECHADO PARA IMPLEMENTAÇÃO A3, sujeito a revisão A6 no SHA final.

## Objetivo funcional

O percurso normal é:

`definir critérios -> escolher uma ou várias associações turma+disciplina -> aplicar a todas as UFCD dessas associações`

A personalização por UFCD é uma exceção secundária e cria `scope: module`; o domínio existente resolve `module` antes de `subject`, pelo que a exceção substitui o conjunto geral apenas nessa UFCD.

## Contrato partilhado A1 — aplicação multi-disciplina atómica

Branch A1: `agent1/criteria-batch-344841c`
HEAD: `2bfc028dc4ff4b93bc2a0350a7a51e54ebc43d80`
Base: `344841c1fc402e813f9d8658d96fa20b0fefa779`

Ficheiro novo partilhado:
`src/components/ma-professor/assessmentCriteriaBatchRepository.ts`

API:
`assessmentCriteriaBatchRepository.createSubjectSchemes(input)`

Input:
- `academicYearId`
- `teachingAssignmentIds[]`
- `name`
- `criteria[]`
- `active?`

Garantias obrigatórias:
1. pelo menos uma associação explícita;
2. IDs repetidos são erro, nunca deduplicação silenciosa;
3. critérios ativos válidos e total 100%;
4. todas as associações existem e pertencem ao ano letivo;
5. nenhuma associação selecionada pode já ter `scope: subject` ativo, preservando a regra atual do setup e evitando múltiplos schemes gerais ambíguos;
6. pré-validação ocorre antes de qualquer write;
7. associações e schemes existentes são revalidados dentro da mesma transação imediatamente antes dos writes;
8. `assessmentSchemes` e `assessmentCriteria` são gravados numa única transação; qualquer erro implica rollback integral;
9. cada associação recebe o seu próprio `AssessmentScheme` `scope: subject`, `moduleId: null`, e uma cópia própria dos critérios;
10. não há migração, alteração de schema, `db.ts`, `types.ts` ou dados existentes.

Teste A1:
`tests/ma-professor/assessment-criteria-batch-contract.test.mjs`

O teste estrutural confirma pré-validação, revalidação transacional, writes apenas dentro da transação, `scope: subject`, ausência de `moduleId`, rejeição de seleção duplicada e de scheme geral já existente. A prova executável completa fica obrigatória no candidato e na revisão A6.

## Contrato UX A3

A3 altera apenas o lote próprio de setup/testes, preservando os HEADs já congelados.

Percurso normal:
1. nome do conjunto;
2. critérios, descrições e ponderações;
3. bloco `Aplicar a` com seleção explícita de uma ou várias associações turma+disciplina;
4. texto: `Este conjunto será aplicado a todas as UFCD das disciplinas selecionadas.`;
5. guardar usando exclusivamente o contrato batch A1 quando houver aplicação geral;
6. sucesso apenas depois da transação concluir integralmente.

Exceção avançada:
- ação `Personalizar uma UFCD`;
- selecionar uma associação e uma UFCD concreta;
- usar `scope: module` através do caminho existente de uma única associação;
- explicar que estes critérios substituem os gerais apenas nessa UFCD;
- nunca escolher silenciosamente uma associação/UFCD ambígua.

## Não-regressão

Obrigatório no candidato:
- uma associação: comportamento equivalente ao atual;
- duas ou mais associações: ou todas gravam ou zero gravam;
- uma associação inválida/stale: zero writes;
- uma associação já com scheme geral: zero writes em todas;
- pesos inválidos: zero writes;
- module override continua prioritário sobre subject geral;
- schemes e critérios existentes permanecem inalterados;
- proteção de rascunho não guardado continua ativa;
- refresh/reabertura mostra os schemes persistidos corretamente.

Nenhum merge/main é autorizado por este documento.
