# MA-Professor — gate de autenticação e proteção de pedidos

Data: 05/10/2026. Base: `9e6c884f6ac9d6672025ae52dbde16f832fe3ec9`, main. Classe C. Decisões aprovadas pelo utilizador em entrevista antes da implementação.

## Âmbito aprovado

- F-01: aceitar até **25 inícios de login OPAQUE em dois minutos por IP fornecido pela Cloudflare**. A tentativa seguinte recebe HTTP 429 e `Retry-After`; concluir um login já iniciado continua permitido. A janela não é de um minuto.
- Conservar o teto global existente de 64 logins pendentes. Quando estiver cheio, rejeitar novos inícios temporariamente, preservando os anteriores. Remover apenas pendências expiradas; nenhum login válido deve ser expulso para dar lugar a outro.
- F-02: um token não vazio não prova autenticação. A exceção à resposta pública genérica e ao limite público exige a verificação canónica de uma sessão válida, do dispositivo e do próprio email pedido. Tokens inventados, revogados, expirados, de outro dispositivo ou de outra conta não recebem essa exceção.
- Guardar sumários, faltas e avaliações fica fora destes limites de autenticação. Preservar pedidos de planos de uma conta autenticada, inscrição OPAQUE, aprovação e ativação por email.

Não inclui alterar chaves OPAQUE, parâmetros criptográficos, backups, retenção, organização dos wrappers ou recursos Cloudflare. F-03 a F-05 precisam de avaliação própria; não são resolvidos por estas duas correções.

## Contratos e persistência

Reutilizar o guard e a chave de armazenamento de login existentes. Contabilizar os inícios separadamente das falhas de conclusão, mantendo as regras de força bruta. Guardar apenas o hash da origem e contadores limitados pelo teto de 512 buckets já existente. Não guardar o IP legível.

Reutilizar `/api/ma-professor/access/account/verify` dentro da cadeia existente, incluindo o ciclo de vida das sessões. A licença não precisa de estar ativa para o professor escolher um plano com uma sessão de conta válida. Comparar o email da sessão verificada com o email do pedido. Na via pública, retirar o token não autorizado antes de delegar e conservar a resposta genérica existente.

Ao esgotar a capacidade global, devolver HTTP 429 e o tempo até à primeira pendência expirar. Não criar uma fila de espera, polling ou retries automáticos. O professor pode tentar novamente; uma conclusão liberta uma vaga imediatamente.

## Gate Cloudflare Free antes do código

Fontes oficiais consultadas em 05/10/2026:

- [Workers — limites](https://developers.cloudflare.com/workers/platform/limits/): 100 000 pedidos/dia e 10 ms de CPU por invocação Free.
- [Durable Objects — preços](https://developers.cloudflare.com/durable-objects/platform/pricing/): SQLite no Free; 100 000 pedidos/dia, 13 000 GB-s/dia, 5 milhões de linhas lidas/dia, 100 000 escritas/dia e 5 GB totais. As operações key-value também contam como operações SQLite.
- [Durable Objects — limites](https://developers.cloudflare.com/durable-objects/platform/limits/): chave e valor combinados até 2 MB.

O binding existente usa SQLite. A alteração não cria bindings, instâncias, D1, timers, jobs, pedidos externos ou migrations. A verificação de sessão é uma chamada interna à cadeia de handlers, não uma nova chamada de rede ao DO.

Cenário-base explícito: 20 professores ativos, com dez inícios de sessão por professor/dia, dá 200 inícios/dia. O novo contador acrescenta uma leitura e uma escrita da chave existente por início admitido: 200 leituras e 200 escritas/dia. Com margem de cinco vezes, são 1 000 de cada: 1% da quota de escritas e 0,02% das leituras. O pico de vinte inícios na mesma rede cabe nos 25 permitidos. A conclusão não consome esse contador.

A verificação de pedidos autenticados reutiliza leituras dos mapas existentes e pode atualizar a sessão, como a rota canónica já faz. É um percurso explícito e esporádico, sem frequência automática. Pedidos bloqueados não geram novas escritas do contador de login; também deixam de executar o início criptográfico e de regravar o estado OPAQUE. Os buckets permanecem limitados a 512, sem um registo por tentativa.

Um fluxo contínuo no limite de uma origem admitiria 25 × 720 = 18 000 inícios/dia. Isto não promete resistência ilimitada a ataques: pedidos rejeitados ainda consomem requests/leituras, e múltiplas origens podem atingir quotas partilhadas. O teto global passa a preservar os logins em curso. O consumo agregado e CPU reais continuam na validação V-03; estas estimativas não são medições de produção.

Decisão: há margem no cenário-base para esta alteração mínima, reutilizando recursos Free. Não aumentar arquitetura nem consumo automático. Validar os fluxos e a ausência de escritas repetidas na rejeição antes de integrar.

## Validação exigida

- 25 inícios admitidos e 26.º rejeitado, nova origem admitida, fim da janela permite novo início.
- Reiniciar o objeto não apaga o limite; IP em hash e estado limitado; rejeições não escrevem novamente.
- Saturar 64 pendências, rejeitar a seguinte e concluir a primeira; expiração liberta capacidade.
- Token inventado não revela estado nem contorna o limite público. Verificar também token revogado, expirado, dispositivo diferente e outra conta.
- Sessão válida do próprio professor conserva o percurso autenticado de escolha de plano.
- Percursos reais OPAQUE de inscrição/login/ativação, regras existentes de força bruta, suite MA-Professor e build.

Não declarar estas verificações concluídas antes da execução. Safari/iPhone e métricas reais Cloudflare não são substituídos pelos testes locais.

## Resultados locais

- `npm ci`: concluído sem alterar dependências ou lockfile.
- Testes dirigidos de guards, protocolo, sessão e cold start: 33 testes passaram.
- Três novos testes na cadeia completa de produção e OPAQUE vendorizado passaram: janela de 25/2 minutos e reinício; saturação global com conclusão da primeira prova; privacidade e limite público com tokens inválidos/estrangeiros/revogados/expirados e preservação do pedido autenticado próprio.
- `npm run build`: TypeScript da aplicação/Worker, Vite e geração das 16 rotas passaram. Os avisos de CSS, importação dinâmica e dimensão de chunks dizem respeito a código frontend não alterado.
- Execução da suite MA-Professor com concorrência quatro: 1 148 testes; 1 146 passaram e dois testes antigos tinham expectativas incompatíveis com a correção. Um simulava uma sessão sem devolver identidade verificada; o outro fixava o argumento literal de delegação e não aceitava retirar um token público. O primeiro passou a simular a verificação canónica do próprio email/dispositivo; o segundo conserva a verificação de delegação, sem fixar esse argumento.
- Nova execução dos dois ficheiros de teste ajustados: 14 testes, zero falhas. O código de produção e os percursos OPAQUE não mudaram depois da execução completa; não houve falhas pendentes nos testes executados. Não apresentar a execução inicial como uma suite com zero falhas.

Os testes reais adaptam armazenamento e carregamento de Wasm a Node; não substituem Safari/iPhone nem métricas Cloudflare de produção. A ausência de configurações de envio no ambiente de teste impediu notificações externas.
