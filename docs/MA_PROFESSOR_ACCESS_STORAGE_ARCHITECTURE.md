# MA-Professor — arquitetura de armazenamento do acesso

Estado de referência: 13/09/2026.

## Objetivo

O MA-Professor mantém um contrato lógico único (`AccessState`) para o código de autenticação, administração, ativação, renovação e sessões, mas os agregados que antes viviam todos dentro de `ma-professor-access-state-v1` estão fisicamente separados dentro do mesmo Durable Object SQLite-backed.

Esta separação foi feita para reduzir amplificação de escrita e o risco de um único blob crescer com dados que têm ritmos de mutação diferentes, sem alterar endpoints, regras de autorização, contratos do frontend ou recursos Cloudflare.

## Chaves físicas atuais

| Responsabilidade | Chave física |
| --- | --- |
| Âncora mínima / compatibilidade | `ma-professor-access-state-v1` |
| Sessões | `ma-professor-access-sessions-v1` |
| Pedidos de acesso | `ma-professor-access-requests-v1` |
| Renovações | `ma-professor-access-renewals-v1` |
| Credenciais de ativação/comerciais | `ma-professor-access-credentials-v1` |
| Licenças | `ma-professor-access-licenses-v1` |

A password pessoal da conta não pertence ao agregado `credentials` acima; continua no estado de autenticação da conta (`ma-professor-account-auth-v1`).

## Ordem obrigatória da composição

A cadeia de adaptação do estado é deliberada e deve permanecer:

1. `createMAProfessorAccessSessionSplitState`
2. `createMAProfessorAccessRequestSplitState`
3. `createMAProfessorAccessRenewalSplitState`
4. `createMAProfessorAccessCredentialSplitState`
5. `createMAProfessorAccessLicenseSplitState`
6. `createMAProfessorSessionLifecycleState`
7. `createRetentionGuardedState`

O entrypoint de produção continua a expor `MaProfessorAccessDurableObject` através de `maProfessorAccessRetentionBridge.ts`.

O lifecycle guard não cria armazenamento próprio. Opera sobre o `AccessState` lógico já recomposto e aplica duas invariantes server-side às sessões antes de o restante código as consumir ou persistir:

- uma conta só mantém um token ativo por `deviceId`; quando é emitido um token mais recente no mesmo dispositivo, o anterior deixa de permanecer no estado persistido;
- nenhuma sessão pode permanecer ativa por mais de 180 dias desde `createdAt`, mesmo que `lastSeenAt` continue a ser atualizado.

A janela de 180 dias mantém o valor de longa duração que já existia para a limpeza de sessões, mas passa também a funcionar como limite absoluto. Não foi reduzida nesta fase para evitar uma mudança desnecessária de experiência de utilização.

## Invariantes de segurança e compatibilidade

- O restante código continua a ler e escrever o mesmo `AccessState` lógico.
- Cada bridge é o único dono da sua chave física dedicada.
- Se existir simultaneamente estado legado embebido no core e um store dedicado válido, o store dedicado é canónico. Isto impede a ressurreição de dados antigos.
- Na primeira leitura de um estado legado, o campo correspondente é removido do core e migrado para a chave dedicada.
- Writes apenas de um agregado não devem reescrever os restantes agregados.
- Writes que alteram vários agregados continuam a ser encaminhados num `put({...})` multi-key, preservando a atomicidade oferecida pelo Durable Object Storage API.
- A limpeza/rotação de sessões acontece dentro do mesmo write lógico; não acrescenta polling, cron, alarm ou um segundo Durable Object.
- A limpeza muta também o objeto lógico que o código inferior acabou de escrever, para impedir que uma cache em memória continue a aceitar um token que já foi substituído.
- A eliminação do último elemento de um store que já existe deve persistir um estado canónico vazio quando necessário para impedir que dados legado reapareçam.
- Não são necessários novos bindings, namespaces, Durable Objects, D1, migrations Wrangler, cron, alarms ou polling para estas chaves internas.
- Retenção de pedidos rejeitados recebe o estado lógico já recomposto e já sujeito à política de ciclo de vida das sessões, continuando a proteger registos associados a licenças ou credenciais.

Os testes `tests/ma-professor/access-storage-architecture-contract.test.mjs` e `tests/ma-professor/access-session-lifecycle-state.test.mjs` bloqueiam regressões acidentais nestes pontos estruturais e de ciclo de vida.

## Limite que esta arquitetura NÃO elimina

A separação por agregado reduz muito a amplificação de escrita, mas cada store dedicado continua a ser um valor agregado global. Em Durable Objects SQLite-backed, a Cloudflare limita a combinação key + value a 2 MB. Assim, `sessions`, `accessRequests`, `credentials` ou `licenses` podem, com crescimento suficiente do número de contas, aproximar-se individualmente desse limite.

Isto significa que a arquitetura atual é adequada enquanto estes agregados permanecem confortavelmente abaixo do limite, mas não deve ser tratada como uma solução de escala ilimitada.

Referências oficiais verificadas em 13/09/2026:

- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/durable-objects/platform/pricing/

Antes de qualquer futura migração, voltar a confirmar os limites e o plano efetivamente usado.

## Próximo passo quando o crescimento o justificar

Não criar mais blobs globais nem continuar a dividir apenas por categoria.

Quando a capacidade real justificar nova migração, a direção preferencial é armazenamento granular por conta — por exemplo, chaves por utilizador ou linhas SQLite — com uma migração faseada e compatível. Essa fase deve ser desenhada antes de ser implementada, porque a lógica atual depende de operações que atravessam licença, sessão, credencial, pedido e histórico comercial.

Uma futura arquitetura granular deve, no mínimo:

- manter autorização e revogação fortemente consistentes;
- evitar reconstruir todos os utilizadores num único read para os caminhos quentes de login/verify;
- preservar operações atómicas que hoje atravessam mais de um agregado;
- fornecer paginação/índice explícito para vistas administrativas;
- permitir migração idempotente e rollback seguro;
- manter compatibilidade com contas existentes durante a transição;
- estimar o impacto agregado em row reads/writes do plano Free antes do deploy.

## Decisão de fecho desta fase

Não migrar agora para SQL por utilizador nem para múltiplos Durable Objects apenas por antecipação. A alteração seria significativamente maior e tocaria diretamente na autorização, enquanto a arquitetura atual está funcionalmente validada e já elimina a principal amplificação de escrita do blob monolítico.

A partir deste ponto, novas alterações ao armazenamento de acesso devem começar por medir/estimar capacidade e confirmar se o limite por valor está realmente a tornar-se relevante. A próxima migração, se necessária, deve ser tratada como uma nova fase arquitetural protegida, não como mais um split incremental.
