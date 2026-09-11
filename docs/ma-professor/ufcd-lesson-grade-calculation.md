# Cálculo da classificação da UFCD por aula

## Regra funcional

A classificação automática da UFCD segue a cadeia definida para o DPR:

1. Em cada aula avaliada, cada aluno recebe classificações nos critérios ativos dessa UFCD/disciplina.
2. A classificação da aula é calculada aplicando as ponderações configuradas aos critérios dessa aula.
3. Se existir mais do que um registo do mesmo critério na mesma aula, esses registos são primeiro reduzidos à média desse critério na aula.
4. Uma aula só fica completa para o cálculo quando o aluno possui classificação em todos os critérios ativos.
5. A média provisória da UFCD é a média aritmética das classificações das aulas completas.
6. Se existir uma aula já iniciada para avaliação mas ainda sem todos os critérios, a média provisória das aulas completas pode ser mostrada, mas o sistema não propõe nem permite confirmar automaticamente a classificação final até essa aula ficar completa.

As ponderações são sempre lidas dos critérios ativos (`weightPercent`). Não existe qualquer regra fixa 60/20/20 no motor; 60/20/20 é apenas a configuração atualmente usada quando esses forem os pesos definidos.

## Compatibilidade

A alteração não muda o esquema Dexie, não cria tabelas, não altera Worker/D1/Cloudflare e não muda os registos já existentes de avaliações. O cálculo agrupa os `LessonAssessment` já persistidos por `lessonId` e por `criterionId`.

A persistência da classificação final continua a usar o mesmo fluxo e o mesmo registo `ModuleFinalGrade`. O repositório público passa a recalcular a média por aula antes de devolver o workspace; o código anterior foi preservado em `assessmentWorkspaceRepositoryBase.ts` para manter o restante comportamento sem regressões.

## Nota sobre o DPR

Este ajuste corrige o motor de cálculo da UFCD. A interface DPR atualmente ainda guarda cada `LessonAssessment` associado a um critério. O modelo de dados permite ter vários critérios na mesma aula, que passam agora a ser agregados corretamente. Uma eventual grelha única no DPR com D1/D2/D3 lado a lado é uma melhoria de interface separada e não foi simulada silenciosamente nesta alteração.
