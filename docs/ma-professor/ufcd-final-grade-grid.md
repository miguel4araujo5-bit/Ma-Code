# MA-Professor — grelha final de UFCD

## Objetivo

Reproduzir no MA-Professor o fluxo da grelha de fecho de módulo/UFCD usada como referência, sem duplicar o motor de avaliação já existente.

## Decisões de implementação

- Os domínios da grelha são gerados a partir dos critérios ativos da UFCD e das respetivas ponderações (`weightPercent`). Não existem ponderações 60/20/20 fixas no componente.
- O nível automático é a média ponderada já calculada pelo `assessmentWorkspaceRepository` (`provisionalAverage`).
- O nível final continua a ser uma classificação inteira entre 0 e 20, confirmada pelo professor.
- A autoavaliação é guardada no registo final da combinação aluno + UFCD.
- ACS é uma marcação da combinação aluno + UFCD. Quando está ativa, a grelha oculta os valores dos domínios nessa linha e apresenta a média global na coluna ACS (100%). Não altera nem duplica as avaliações de origem.
- A grelha só permite fechar a avaliação quando todos os critérios ativos já possuem classificação para o aluno.
- Os campos novos de `ModuleFinalGrade` são opcionais e não indexados, pelo que dados, backups e snapshots anteriores continuam compatíveis e não é necessária migração Dexie.
- A exportação CSV de classificações inclui ACS e Autoavaliação.

## Exportação Excel

- A grelha final pode ser exportada para `.xlsx` com a estrutura funcional da referência: identificação da turma/curso/UFCD, domínios e ponderações, ACS, nível automático, autoavaliação, nível final, assinatura e resumo global.
- A exportação usa exclusivamente os valores já persistidos. Enquanto existir um rascunho de classificação, autoavaliação ou ACS por guardar, a exportação fica bloqueada.
- A coluna `Nº Processo` é incluída por compatibilidade com a grelha de referência, mas permanece vazia enquanto o modelo de aluno não guardar esse identificador. O número do aluno nunca é reutilizado como número de processo.
- As ponderações e o número de domínios são dinâmicos e seguem os critérios reais da UFCD selecionada.
- O ficheiro é gerado localmente no browser com a dependência `xlsx` já existente no projeto. Não envia dados de alunos para servidores.

## Segurança e infraestrutura

A implementação é local-first e usa a persistência Dexie já existente. Não adiciona pedidos de rede, polling, Workers, Durable Objects, D1, bindings ou consumo Cloudflare.

## Regressão

A vista detalhada de resultados por aluno mantém-se disponível. A nova grelha reutiliza o mesmo estado de rascunho, proteção contra saída com alterações por guardar e a mesma operação de persistência da nota final.
