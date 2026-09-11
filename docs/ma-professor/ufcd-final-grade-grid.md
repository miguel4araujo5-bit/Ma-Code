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

## Segurança e infraestrutura

A implementação é local-first e usa a persistência Dexie já existente. Não adiciona pedidos de rede, polling, Workers, Durable Objects, D1, bindings ou consumo Cloudflare.

## Regressão

A vista detalhada de resultados por aluno mantém-se disponível. A nova grelha reutiliza o mesmo estado de rascunho, proteção contra saída com alterações por guardar e a mesma operação de persistência da nota final.
