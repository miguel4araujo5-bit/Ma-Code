# Nota de falta por critério e perfil

O campo global «Nota quando faltou» podia guardar um valor que o motor excluía das médias. A configuração passa a usar os critérios reais de cada disciplina/turma e perfil (Sem ACS / Com ACS), dentro de Definições → Perfil e regras → Notas quando o aluno falta — por critério, recolhida por defeito.

Um campo vazio significa «Não contar na média». Uma nota explícita de 0 a 20 aplica-se aos resultados `absent` desse critério, incluindo os já registados. Alterar ou remover o valor atualiza os cálculos na leitura seguinte: médias por critério, médias das aulas, sugestões finais, médias das atividades, grelha diária e exportação. Não existe um comando de recálculo nem se reescrevem os resultados originais para aplicar a regra. O registo de falta, a nota guardada anteriormente no resultado e as classificações finais confirmadas manualmente mantêm-se.

## Compatibilidade e preservação

- `AssessmentCriterion.absenceGrade` é opcional; ausência do campo e `null` mantêm o comportamento anterior. Um zero explícito é uma nota válida, não equivale a campo vazio.
- O valor global antigo continua no formato guardado para compatibilidade, mas nunca ativa implicitamente esta regra e deixou de ser apresentado como opção de contabilização.
- O perfil é o da grelha real do aluno na UFCD. Os critérios ACS têm identidades e valores independentes dos restantes. Critérios específicos de UFCD são apresentados com a identificação da unidade.
- A edição normal de nomes/pesos preserva a regra de falta do critério. Guardar definições relê o contexto e rejeita versões desatualizadas sem gravação parcial.
- Não há nova tabela, migração de schema, serviço cloud, cifra ou formato de cópia. O campo opcional é validado no restauro. Cópias anteriores continuam com a opção desativada. A mudança acrescenta apenas alguns bytes aos critérios quando o professor configura um valor.
- As notas finais manuais não são substituídas; os cálculos derivados e o aviso de alteração desde a emissão refletem as novas médias. As folhas já emitidas não são reescritas automaticamente.

## Ensaios com dados fictícios

- Duas disciplinas, dois perfis e dois conjuntos distintos de três critérios, com pesos diferentes, em duas UFCDs; aulas avaliadas e resultados de faltas já guardados.
- Valores gerais 9/8/7 produzem média 12,2 a partir de uma aula com 16 e outra com faltas. Mudar para 7/7/7 recalcula para 11,5. Uma nota final manual de 18 mantém-se.
- Valores ACS 4/6/8 produzem média 11,7 a partir de uma aula com 18 e outra com faltas, sem afetar o perfil geral. Zero explícito e desativação testados.
- Comparação de todas as tabelas: apenas os campos de configuração dos critérios são alterados; sumários, resultados, faltas e classificações finais permanecem iguais. Reabertura preserva a configuração.
- Gravação real no componente React das definições, mudança entre perfis, valores predefinidos vazios, callback de atualização e médias calculadas após gravar. Este ensaio usa JSDOM, não um Safari físico.
- Cópia/restauro integral com o campo novo, cópia antiga sem o campo e rejeição de valores inválidos. Isolamento entre perfis/disciplinas, versões desatualizadas, rollback e preservação após edição normal dos critérios.

As verificações finais e o estado de integração/publicação constam da PR. Nenhum ensaio usa contas, dados ou cópias reais do professor.
