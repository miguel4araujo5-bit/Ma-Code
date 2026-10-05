# MA-Professor — arquitetura de armazenamento do acesso

Estado de referência: 20/09/2026.

## Objetivo

O MA-Professor mantém um contrato lógico único (`AccessState`) para autenticação, administração, ativação, renovação e sessões. Os agregados que antes viviam todos em `ma-professor-access-state-v1` estão fisicamente separados dentro do mesmo Durable Object SQLite-backed.

## Chaves físicas atuais

| Responsabilidade | Chave física |
| --- | --- |
| Âncora mínima / compatibilidade | `ma-professor-access-state-v1` |
| Sessões | `ma-professor-access-sessions-v1` |
| Pedidos de acesso | `ma-professor-access-requests-v1` |
| Renovações | `ma-professor-access-renewals-v1` |
| Credenciais de ativação/comerciais | `ma-professor-access-credentials-v1` |
| Licenças | `ma-professor-access-licenses-v1` |
| Autenticação OPAQUE | `ma-professor-opaque-auth-v1` |

A password pessoal não é armazenada pelo servidor. O Durable Object guarda apenas o material servidor necessário ao protocolo OPAQUE — nomeadamente o `serverSetup`, os `registrationRecord` e desafios temporários. O store legado `ma-professor-account-auth-v1` deixou de ser fonte de autenticação pública e é mantido apenas enquanto for necessário para limpeza/compatibilidade interna durante este corte.

## Ordem obrigatória da composição

1. `createMAProfessorAccessSessionSplitState`
2. `createMAProfessorAccessRequestSplitState`
3. `createMAProfessorAccessRenewalSplitState`
4. `createMAProfessorAccessCredentialSplitState`
5. `createMAProfessorAccessLicenseSplitState`
6. `createMAProfessorSessionLifecycleState`
7. `createRetentionGuardedState`

O entrypoint de produção continua a expor `MaProfessorAccessDurableObject` através de `maProfessorAccessRetentionBridge.ts`.

## Ciclo de vida das sessões

`createMAProfessorSessionLifecycleState` não cria armazenamento próprio. Opera sobre o `AccessState` já recomposto. Desde a alteração aprovada em 05/10/2026, novas sessões recebem `absoluteMaxAgeDays = 29`, em todos os próximos logins de contas existentes ou futuras. O prazo conta desde `createdAt`; a atividade não o prolonga. Sessões já revogadas são também removidas quando passam por esta camada.

Sessões já abertas, sem a marca de 29 dias, conservam o limite absoluto anterior de 180 dias desde `createdAt` e a limpeza por inatividade existente. Não há corte retroativo. A camada distingue novas identidades das persistidas antes de escrever, inclusive na primeira escrita após reinício, e conserva o prazo atribuído ao atualizar uma sessão. O prazo é aplicado nas verificações server-side existentes; não acrescenta timers nem altera a política local/offline, licenças, confirmação mensal, OPAQUE, Web3Forms ou notificações.

Gate Free (05/10/2026, antes do código): reaproveita a chave de sessões e as escritas existentes, sem novos recursos ou chamadas externas. Apenas uma primeira escrita sem leitura prévia exige ler o estado persistido; o login normal já lê esse estado. Com vinte professores e quatro sessões por conta, são até oitenta campos numéricos adicionais (cerca de 2,1 KB de JSON). A renovação de oitenta sessões a cada 29 dias equivale, em média, a 2,76 logins/dia, contra 0,44 no prazo anterior; a distribuição real depende da utilização. Mesmo com margem de cinco vezes, permanece muito abaixo dos 100 000 pedidos/escritas e cinco milhões de leituras diários do DO Free, verificados na [documentação oficial](https://developers.cloudflare.com/durable-objects/platform/pricing/). O limite por IP existente continua a reger os picos. Isto é uma estimativa desta alteração, não uma medição do consumo agregado de produção.

A rotação de tokens do mesmo dispositivo fica fora desta alteração. Antes de a implementar, a emissão deve substituir a sessão do mesmo dispositivo antes de aplicar o limite global, para não terminar indevidamente a sessão de outro dispositivo.

Validação local desta alteração: build TypeScript/Worker/Vite concluído; 19 testes de ciclo de vida, substituição, armazenamento e revogação de sessões, três percursos OPAQUE reais para contas pendentes/ativadas e 1 116 testes restantes passaram, sem falhas. Os testes de fronteira confirmam validade até ao último milissegundo e expiração aos 29 dias, persistência após reinício, prazo antigo das sessões já abertas e preservação de licenças e escritas atómicas.

## Retenção dos pedidos de acesso

A limpeza existente abrange pedidos rejeitados e pendentes com mais de 180 dias sem atualização. O prazo é contado a partir da data mais recente do pedido, rejeição ou atualização. Registos sem datas válidas são preservados.

Não são removidos pedidos associados a uma licença, credencial de ativação, sessão, renovação ou autorização comercial, nem pedidos com aprovação ou ativação registada. Um estado comercial ilegível também impede a limpeza. Isto preserva o tratamento administrativo e os pagamentos manuais.

A limpeza remove apenas o pedido abandonado. Não elimina contas, registos de autenticação OPAQUE, licenças, dados escolares, cópias ou registos comerciais. A retenção das credenciais pessoais e dos registos comerciais é uma política distinta; esta alteração não encerra uma auditoria geral de retenção. A execução aproveita a primeira leitura do estado na cadeia existente, sem cron, polling ou novos recursos.

## Invariantes

- O restante código continua a ler e escrever o mesmo `AccessState` lógico.
- Cada bridge é o único dono da sua chave física dedicada.
- Se coexistirem dados legado e store dedicado válido, o store dedicado é canónico.
- Writes apenas de um agregado não reescrevem os restantes.
- Writes multi-key continuam num único `put({...})`, preservando atomicidade.
- A limpeza de sessões expiradas não acrescenta polling, cron, alarm, novo Durable Object, D1, binding ou migration Wrangler.
- A limpeza altera também o objeto lógico que acabou de ser escrito, para uma cache em memória não continuar a aceitar uma sessão já expirada.
- A retenção recebe o estado lógico já recomposto e sujeito ao lifecycle guard.

Os testes `tests/ma-professor/access-storage-architecture-contract.test.mjs` e `tests/ma-professor/access-session-lifecycle-state.test.mjs` protegem estas invariantes.

## Limite estrutural restante

Cada store dedicado continua a ser um valor agregado global. Em Durable Objects SQLite-backed, a combinação key + value tem limite de 2 MB. Se o crescimento real justificar nova migração, a direção preferencial é armazenamento granular por conta, por chaves próprias ou linhas SQLite, e não novos blobs globais.

Referências oficiais verificadas em 13/09/2026:

- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/durable-objects/platform/pricing/

Antes de qualquer migração futura, confirmar novamente limites e plano, preservar autorização/revogação, atomicidade, paginação administrativa, migração idempotente e compatibilidade com contas existentes.
