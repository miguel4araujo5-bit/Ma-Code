# MA-Professor — arquitetura de armazenamento do acesso

Estado de referência: 13/09/2026.

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

A password pessoal da conta continua em `ma-professor-account-auth-v1`.

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

`createMAProfessorSessionLifecycleState` não cria armazenamento próprio. Opera sobre o `AccessState` já recomposto e aplica um limite absoluto server-side de 180 dias desde `createdAt`, mesmo que `lastSeenAt` continue a ser atualizado. Sessões já revogadas são também removidas quando passam por esta camada.

Os 180 dias preservam o valor de longa duração que já existia para limpeza por inatividade; esta fase apenas impede que atividade contínua transforme a sessão numa sessão sem limite absoluto.

A rotação de tokens do mesmo dispositivo fica fora desta alteração. Antes de a implementar, a emissão deve substituir a sessão do mesmo dispositivo antes de aplicar o limite global, para não terminar indevidamente a sessão de outro dispositivo.

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
