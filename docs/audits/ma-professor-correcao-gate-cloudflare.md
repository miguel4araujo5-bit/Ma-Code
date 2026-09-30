# MA-Professor — gate de segurança e consumo das correções

Data: 29/09/2026. Base: `0343436c3473cf811ee1491c41a8aee7ac7f4fda`.

Âmbito: correções AUD-01 a AUD-12 da [lista de auditoria](ma-professor-pendencias.md). Classe C para backup/restauro/eliminação/Worker; B para CSV; A para atualização documental. Intervenções canónicas, sem alterar parâmetros OPAQUE, chaves, schema escolar, migrations, bindings, dependências ou workflows.

## Decisões de segurança

- Alterações durante um upload conservam o marcador persistente de trabalho pendente. Uma conclusão depois de desativar a cópia não volta a estabelecer confiança.
- O reset explícito suspende a preferência automática antes de limpar os dados e elimina os rascunhos da IndexedDB separada. A cópia remota é conservada. Uma falha ao suspender impede o reset.
- O restauro JSON compara a assinatura local esperada e verifica o resultado dentro da transação que substitui os dados. A edição posterior à pré-visualização impede a substituição.
- A eliminação de conta limpa e verifica os tickets, incluindo as mensagens. A ausência completa do schema opcional de apoio não bloqueia a eliminação de contas; um schema parcial/falha de leitura impede anunciar sucesso.
- Depois de uma escrita de apoio, a sessão é confirmada novamente. Se foi revogada entretanto, os novos registos dessa operação são retirados. Isto fecha a janela de uma criação autenticada antes da eliminação mas executada depois da limpeza D1. Uma falha de limpeza é apresentada como falha, sem anunciar conclusão.
- Quotas de tickets/mensagens são aplicadas no SQL de inserção. A mensagem inicial só é inserida se o ticket correspondente tiver sido criado. Atualizações de estado dependem da existência da nova mensagem.
- A conversa é devolvida em páginas de 30 mensagens, com cursor composto por data e identificador. Professor e admin podem carregar páginas anteriores sem perder o histórico.
- O apoio permite até dez tickets abertos, 40 mensagens do professor por janela móvel de 24 horas, 200 mensagens por conversa e 500 mensagens no histórico da conta, contando professor e admin. Dados anteriores aos novos limites não são truncados. Os limites são comunicados na rejeição, com alternativa de apoio por email quando o histórico estiver completo.
- CSV neutraliza prefixos de fórmula em texto, preservando números. A média e sugestão exportadas são identificadas como valores à data da confirmação; a nota final confirmada é preservada.
- Erros permanentes de envio suspendem a cópia automática; falhas transitórias têm até três tentativas consecutivas. O bloqueio é persistido e visível em Segurança e recuperação. Nova alteração ou cópia manual permite retomar; não existe polling novo.

## Gate Cloudflare Free

Limites oficiais consultados em 29/09/2026: [Workers](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) e [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Workers Free: 100 000 pedidos/dia e 10 ms de CPU/pedido. D1 Free: 5 milhões de linhas lidas/dia, 100 000 escritas/dia, 500 MB por base e 5 GB totais. Índices e eliminações contam nas escritas. DO SQLite Free: 100 000 pedidos/dia, quotas de armazenamento SQL próprias e 13 000 GB-s/dia. Valores e unidades efetivamente faturados devem ser confirmados no dashboard agregado da conta.

Não são criados serviços, tabelas, índices, DO, polling, jobs ou recursos pagos. O apoio reutiliza os índices de conta/data e ticket/data já existentes. A confirmação adicional reutiliza o DO de acesso; `handleVerify` chama `save`, portanto esta proteção acrescenta pedidos e chamadas pontuais de `storage.put`, e não deve ser descrita como consumo zero.

### Estimativa para vinte professores

Os valores seguintes são reservas conservadoras para dimensionamento, não medições de produção. O intervalo de dez minutos dos backups mantém-se.

| Dimensão | Cenário/estimativa | Efeito das correções |
| --- | --- | --- |
| Backups em oito horas de alterações contínuas | 20 × 48 = 960 ciclos/dia; reservar seis pedidos/ciclo e vinte escritas D1/ciclo: 5 760 pedidos e 19 200 escritas. | Frequência de sucesso preservada; elimina-se o ciclo infinito de erros permanentes. |
| Stress de backups durante 24 horas | 20 × 144 = 2 880 ciclos/dia: reserva de 17 280 pedidos e 57 600 escritas D1. | Mesmo intervalo; cenário extremo separado de um dia letivo normal. |
| Escritas de apoio do professor | Máximo admitido 20 × 40 = 800 mensagens/dia. Reserva de oito linhas escritas/operação, incluindo índices: 6 400/dia. | Volume admitido limitado; criação/reply continuam num batch de duas instruções. |
| Apoio humano igualmente intenso | Reservar mais 800 respostas admin e 6 400 escritas/dia. | Também limitado pelo histórico da conta/conversa; não há reenvio automático. |
| Confirmação pós-escrita | Até 800 pedidos adicionais/dia ao DO para os envios admitidos do professor, com até 800 chamadas adicionais a `save`. | Custo deliberado para impedir resíduo após revogação/eliminação; sem novo DO. |
| Leituras de apoio | Quotas percorrem, no máximo, o histórico limitado da conta; páginas devolvem até 31 linhas para detetar continuação. Reservar alguns milhares de linhas por envio dá poucos milhões/dia no pico de 800 envios, abaixo de 5 milhões para este subsistema isolado. | Sem leitura integral da conversa a cada resposta; versões antigas já acima da quota precisam de medição específica. |
| Armazenamento de apoio | 20 × 500 × 5 000 unidades UTF-16. Reservar até três bytes UTF-8/unidade: 150 MB de texto, mais metadados, páginas e índices. | Limite permanente de crescimento admitido, sem apagar histórico existente. |
| Cópias escolares | Vinte contas × três gerações × limite de 1 MB de ciphertext binário; cerca de 80 MB em base64, antes de índices/metadados. | Mantém-se cópia atual e duas gerações anteriores. |

No cenário normal de oito horas, a reserva de backup e apoio intenso soma cerca de 32 000 escritas D1/dia; no stress contínuo de 24 horas, cerca de 70 400. Há margem no subsistema para as correções, mas estes números **não certificam o consumo agregado** de MA-CODE. Uma eliminação administrativa em massa é uma carga excecional adicional e deve ser contabilizada no dia em que ocorre; não se mistura silenciosamente com a reserva de atividade corrente.

O limite de 500 mensagens foi escolhido para manter margem também com texto UTF-8 de três bytes, metadados e três gerações de backup; estimar apenas caracteres ASCII subestimaria o armazenamento. Não se impõe uma migração ou truncagem a contas antigas que já excedam os novos limites.

## Validação e limites da conclusão

As reproduções passam a testes portáveis no repositório: `audit-data-safety-regression.test.mjs` e `support-pagination-ui.test.mjs`. Cobrem guardas de restauro, limpeza de rascunhos, reset durante upload, marcador após reload, erro permanente e retoma, CSV, igualdade de conteúdo, quota concorrente, paginação, limites da conversa/conta, isolamento e revogação de sessão após escrita. A interface professor/admin é renderizada com React para confirmar o cursor e a conservação da ordem das mensagens.

Os testes de Worker usam SQL real em SQLite local, com sessões/rede controladas. Isto não substitui D1 de produção. Permanecem V-01 (Safari/iPhone), V-02 (deployment/schema/perfis reais) e V-03 (CPU, duração DO e quotas agregadas). Não foi executado um ensaio de carga em produção nem alterado um dado real de professor. A arquitetura não exige um plano pago; a margem efetiva da conta continua dependente dessas medições.
