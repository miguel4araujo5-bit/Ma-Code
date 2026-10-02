# MA-Professor — aplicação do handoff funcional de 02/10/2026

## Base e âmbito

Auditoria inicial sobre `c6eb1d3b`. Durante o trabalho, foram integrados por fast-forward os commits da `main` até `73efeedc`, relativos ao extrator de tabelas PDF, sem sobreposição de alterações. Foram consultados os três documentos de contexto fornecidos pelo utilizador e as implementações canónicas.

O handoff passa a exigir submissão explícita para todas as datas: um sumário passado guardado, por si só, deixa de alimentar contagens reais. Mantêm-se o estado persistido `giaeStatus`, os handlers existentes de copiar/submeter e a possibilidade de retirar o visto. A alteração de rótulo não modifica esses automatismos.

## Mapeamento das decisões

| Bloco | Situação inicial | Intervenção |
|---|---|---|
| Planeado versus dado | Precisava de correção: aulas passadas registadas também contavam | Regra canónica baseada em submissão; consumidores de progresso, assiduidade, médias, calendário e painel alinhados |
| Texto de submissão | Parcial | Rótulos visíveis e explicações passam a programa oficial |
| Previsão cronológica | Parcial: limite do ano e desperdício de tempos ao mudar de UFCD | Projeção cumulativa; continuidade do último horário; feriados/interrupções respeitados; painel usa a mesma projeção; nenhuma aula extrapolada é persistida |
| Numeração das lições | Nova | Sequência derivada das submissões e aviso discreto de lacunas |
| Proposta de UFCD | Precisava de correção na prioridade de módulos iniciados | Primeira UFCD incompleta na ordem; tempos antecipados mantidos; escolha guardada não é sobrescrita ao reabrir |
| Proteções de aulas | Parcial | Submissão bloqueia data/hora/UFCD; faltas/avaliações bloqueiam mudança incompatível; só sumário pode acompanhar |
| Movimento e permuta | Em falta no percurso de edição | Colisão explícita, troca transacional, controlo de versões e preservação da ocorrência original para evitar regeneração |
| Reordenação | Nova e local à arquitetura existente | Botões em Planificações; módulos com submissões ficam fixos |
| Assiduidade global | Carga oficial por disciplina já existia; estados precisavam de correção | Dois/um tempos antes, limite exato, ultrapassagem; retirar faltas recalcula; limite atingido também integra o total de avisos |
| Média e faltas simultâneas | Já existia | Preservado |
| Recuperação | Parcial; modelo anterior de tentativas | Data, nota, seleção explícita e remoção transacional; registo das faltas removidas; nota final derivada; compatibilidade com histórico anterior |
| Recuperação manual | Já existia parcialmente | Reutilizada; exceção sem faltas permite concluir com data e nota, conforme confirmação do utilizador |
| Recuperação pendente | Precisava de correção | Não é eliminada automaticamente quando muda a percentagem; classificação final fica em branco |
| Emissão normal/individual | Modelo XLSM/PDF já existia | Aviso não bloqueante de pendências; emissão individual; XLSM completo e PDF de uma folha; fórmula da nota pendente é removida no XLSM |
| Alterações posteriores à emissão | Nova | Impressão digital local sem versões de ficheiros; aviso e reemissão no Diário e na área de emissão; nomes/números não desencadeiam esse aviso |
| Edição de aluno | Já existia | Preservada; documentos posteriores usam os dados atuais |
| Eliminação de aluno | Nova | Confirmação ELIMINAR; elimina assiduidade, resultados, classificações finais, recuperações e a presença em rascunhos; preserva aulas, instrumentos e colegas |
| Aluno a meio do ano | Matrícula/membership já existia | Preservado, sem atribuir faltas ou notas anteriores |
| Persistência e backup | Estrutura existente reutilizável | Campos opcionais; sem nova tabela, migração, endpoint ou pedido cloud |

## Validação

Resultado: os 220 ficheiros da bateria MA-Professor passaram, incluindo os 18 casos novos de integração. Build de produção concluído. O aviso já existente sobre dimensão dos bundles mantém-se.

- Testes existentes atualizados apenas quando a expectativa era a regra substituída pelo handoff, o texto alterado ou uma operação Dexie em falta no mock.
- Teste de integração com repositórios reais e IndexedDB: submissão/retirada do visto; conservação das avaliações/faltas guardadas; UFCD antecipada; numeração; previsão cumulativa e além do ano; calendário; estados de assiduidade; conclusão/seleção de recuperações; recuperação manual; movimento e rollback; eliminação isolada; reordenação; backup JSON/restauro; rascunhos; reabertura; painel/planificação coerentes.
- Preparação para publicação: os três percursos Chromium do CI passaram (critical-path, unified-navigation e integrated-regression); o teste integrado foi alinhado com o limite estrito, a exclusão de aulas por submeter e a nota explícita de recuperação. O diretório temporário do novo teste é criado também em instalações limpas.
- Exportações reais verificadas: livro XLSM conserva VBA e várias folhas; classificação pendente fica sem fórmula; emissão individual contém nota/data; PDF tem uma página e foi revisto visualmente.
- Verificada a conservação da contagem de classificações qualitativas do 1.º ciclo, que não deve depender de notas numéricas.
- Sem alterações a autenticação, integrações cloud, contratos remotos, dependências ou configuração de publicação.

## Limites deliberados

- A permuta exige células com o mesmo número de tempos e o intervalo completo da célula de destino. Colisões parciais ou durações incompatíveis pedem outra hora, sem reinterpretar tempos ou apagar aulas.
- A projeção além do período configurado prolonga o último horário ativo. É uma previsão e não cria aulas reais fora do ano.
- A validação de persistência foi automatizada com IndexedDB; a revisão visual realizada foi a do PDF gerado. Não foi feita uma sessão manual completa no navegador.
- Nenhum push ou deploy foi executado.
