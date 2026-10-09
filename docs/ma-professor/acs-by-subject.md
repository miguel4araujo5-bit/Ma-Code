# ACS por disciplina — 09/10/2026

A escolha pertence ao aluno e à associação disciplina/turma do ano letivo. O assistente e a ficha do aluno apresentam uma opção por disciplina. A grelha diária, as médias, as recuperações e as exportações consultam a mesma escolha.

Ativar **ou retirar** ACS exige confirmação. O aviso identifica o aluno, a disciplina e a UFCD/UC/módulo em curso, escolhido pela regra canónica de progresso. Só são eliminados os resultados, a classificação final e os valores de avaliação de recuperações desse aluno nessa unidade. Sumários, faltas, vistos do programa oficial e histórico de faltas recuperadas são preservados.

As unidades concluídas conservam o perfil anterior. Avaliações já introduzidas noutra unidade futura também conservam os dados e o perfil; unidades novas ou ainda sem avaliações usam a escolha da disciplina. Uma importação de alunos sem escolha explícita não altera os critérios existentes. Os registos antigos com ACS global conservam o comportamento anterior até o professor alterar cada disciplina.

A confirmação é verificada novamente dentro da transação local: alterações concorrentes invalidam-na. Uma falha de gravação repõe a escolha e as avaliações. Rascunhos e grelhas abertos antes da mudança não podem voltar a introduzir automaticamente as avaliações apagadas.

## Persistência e consumo

Campos opcionais do aluno, sem nova tabela, índice, migração, dependência, endpoint, polling ou serviço Cloudflare. Os formatos de cópia existentes conservam esses campos.

Por alteração e para vinte professores: zero pedidos Worker/D1/DO adicionais. A próxima cópia manual inclui apenas alguns identificadores e valores de perfil/data adicionais; continua sujeita aos limites de tamanho e à confirmação já existentes. Não há mudança dos parâmetros OPAQUE, cifração, autenticação ou publicação.

## Validação

Testes com dados fictícios: isolamento entre alunos/disciplinas, ambos os sentidos, cancelamento, estado concorrente, rollback, unidades concluídas/futuras, novas unidades, recuperações, registos antigos, reimportação, reabertura e ambos os formatos de cópia. O percurso Chromium existente cobre a escolha por disciplina, o aviso, a grelha mista e a retirada de ACS.
