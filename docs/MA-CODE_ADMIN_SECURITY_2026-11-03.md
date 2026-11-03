# MA-ADMIN — revogação e pausa temporária

Autorização de 03/11/2026: corrigir e publicar. Cinco falhas por origem numa janela de 15 minutos iniciam uma pausa fixa de cinco minutos. As tentativas durante a pausa não a prolongam nem escrevem estado. Não há bloqueio global/permanente, contagem decrescente na interface ou mudança de credenciais. A pausa expirada começa com contador limpo; um login correto fora da pausa limpa apenas o contador da origem correspondente. Sessões já abertas e outras origens mantêm-se utilizáveis.

## Implementação e fronteiras

- Verificação e atualização atómicas numa fila administrativa independente do Durable Object existente `ma-professor-access-global`. Sem novo binding, instância dedicada, tabela D1, migration, alarm, polling ou tarefa agendada.
- Chaves individuais com prefixo exclusivo `ma-code-admin-security:`. O IP recebido da Cloudflare é normalizado e derivado por HMAC; não é persistido em claro nem aceite do corpo ou de X-Forwarded-For. IPv6 equivalente é normalizado; CF-Connecting-IPv6 só substitui o endereço principal na gama Class E reservada a Pseudo IPv4, impedindo substituição arbitrária por um cabeçalho suplementar. Sem metadados válidos, o pedido falha temporariamente sem criar contador global.
- Logout guarda a revogação do identificador HMAC do token até à expiração original. Todas as verificações administrativas centrais a consultam, incluindo os consumidores de contas, suporte e relatórios. Não há cache que volte a aceitar um token revogado, nem remoção de revogações válidas por capacidade. O formato e duração dos cookies existentes são preservados.
- Falha ao guardar a revogação devolve 503 sem apagar o cookie ou comunicar logout concluído. A interface existente conserva a sessão e permite repetir. Indisponibilidade do armazenamento não autoriza pedidos administrativos. A fila recupera depois da falha.
- Limpeza acionada por pedidos, no máximo uma vez por minuto por instância, com lotes de 32 chaves e cursor persistente. Só remove registos expirados. Pedidos já pausados não executam a limpeza. Falha na limpeza não desfaz uma revogação durável.
- Nenhuma mudança nas sessões, contadores, dados, credenciais ou cópias V3 dos professores.

## Gate Cloudflare — antes da implementação

Limites oficiais confirmados em 03/11/2026: Workers Free 100 000 pedidos/dia e 10 ms CPU/pedido; DO SQLite Free 100 000 pedidos/dia, 13 000 GB-s/dia, 5 milhões de linhas lidas/dia, 100 000 escritas/dia e 5 GB de armazenamento total. Referências: https://developers.cloudflare.com/workers/platform/limits/ e https://developers.cloudflare.com/durable-objects/platform/pricing/ .

Vinte professores simultâneos acrescentam zero operações administrativas por professor. Modelo administrativo conservador: 10 logins, 10 logouts, 200 verificações e 50 falhas/dia: 270 chamadas DO. Com margem de 10×, 2 700 chamadas, até cerca de 92 000 leituras lógicas incluindo limpeza de 32 registos por chamada; as escritas de cursor, contadores e remoções ficam na ordem de milhares, pois só se pode remover estado anteriormente criado. Não confundir estas operações lógicas com medição faturada/índices.

Somado ao cenário intensivo anterior de 20 professores (8 200 pedidos/dia, 32 800 escritas DO/dia como orçamento), o acréscimo modelado cabe no Free. Sem novo DO, timers ou pedidos de duração prolongada. A CPU real e o consumo agregado dos outros produtos na conta não foram medidos; não é certificação de toda a conta. Uma carga distribuída de 100 000 pedidos pode esgotar quotas partilhadas; esta pausa não promete resistência a esse volume. Nenhum recurso/plano pago ativado.

## Evidência e recuperação

Baseline `7f1e1db7cc61a57167b7d804af6f596365a04b5f`, Node 24.22.1: login/logout 200, mesmo cookie ainda aceite com 200; 20 erros simultâneos deram 20 respostas 401, sem 429. Ensaios novos usam apenas segredos, contas, endereços e armazenamento fictícios, com API real e composição real do DO, incluindo reinício e falhas injetadas. Não equivalem a teste autenticado em produção ou Safari físico.

A pausa termina automaticamente, sem intervenção. Em caso de regressão de código existe a base recuperável acima; reverter para código sem a consulta de revogações pode voltar a aceitar cookies revogados ainda não expirados. Uma reversão desse tipo requer avaliar a rotação do segredo administrativo para preservar a invalidação, sem alterar credenciais dos professores. Não foi feita qualquer rotação nem intervenção na conta real.
