# MA-Professor — estado da privacidade das cópias

Referência do código: 29/09/2026. Baseline atual: v3-only.

## Contrato atualmente implementado

- A password pessoal é usada no cliente pelo OPAQUE; não é enviada nem guardada pela MA-CODE.
- A senha MP serve para ativação/licenciamento e não deriva chaves de backup nem substitui uma credencial OPAQUE existente.
- A cópia automática exige escolha explícita por conta e dispositivo. A preferência é verificada durante a preparação e antes do envio; falha de leitura não autoriza upload.
- O cliente cifra os dados escolares com AES-256-GCM. A OPAQUE export key, a master key e a wrapping key permanecem no cliente; o Worker/D1 recebem ciphertext, envelope público, hashes e metadados/revisões.
- O contrato público de backup é v3-only: `/status`, `/get`, `/initialize-v3` e `/push-v3`. O endpoint `/key` e a promoção pública de backups v2 não estão ativos nesta baseline.
- Uma primeira cópia é criada diretamente em v3, com perfil e ciphertext na mesma operação atómica. Os envios seguintes preservam o controlo por revisão/CAS e a rejeição de conflitos HTTP 409.
- Password e export key não são persistidas em localStorage, sessionStorage, D1 ou Durable Objects. Depois de reload, uma sessão válida pode precisar de novo login OPAQUE para voltar a abrir/enviar uma cópia.
- O servidor não conserva material suficiente para decifrar uma cópia v3. Esta garantia refere-se à arquitetura v3, não é uma certificação independente nem uma conclusão sobre eventuais registos históricos ainda presentes no D1 de produção.
- A cópia online atual pode conservar duas gerações cifradas anteriores para recuperação técnica.

A eliminação local explícita desativa a cópia automática neste dispositivo, elimina dados escolares e rascunhos locais e conserva a cópia online. A futura ativação automática continua sujeita à reconciliação da confiança. A eliminação administrativa de conta inclui as cópias cloud e os pedidos/mensagens de apoio; não é uma operação de recuperação da password pessoal.

## Limites e recuperação

Perder a password pessoal impede um novo login protegido e o acesso à export key necessária à cópia existente. Uma reposição administrativa não recupera a password nem deve prometer acesso à cópia cifrada anterior. Os dados que permaneçam localmente não são apagados por perder a password.

As cópias JSON descarregadas continuam sem cifração própria. O professor deve guardá-las num local seguro. Os campos de texto de CSV são protegidos contra interpretação como fórmulas; CSV não substitui uma cópia completa de segurança.

Os tickets de apoio são uma conversa explícita com suporte humano: o texto enviado é legível pelo apoio, não usa a cifração do backup e não inclui automaticamente dados escolares, passwords ou chaves. O histórico é conservado enquanto a conta existir e removido pela eliminação administrativa de conta. A informação pública correspondente encontra-se na página de privacidade do MA-Professor.

## Validação e histórico

A confirmação do deployment, das migrations e das versões reais dos perfis no D1 está pendente em V-02 da [lista de auditoria](audits/ma-professor-pendencias.md). WebKit/iPhone e medições efetivas de consumo estão em V-01 e V-03. Os testes de código e Chromium não substituem essas evidências.

O [plano OPAQUE/v3](MA_PROFESSOR_OPAQUE_V3_PLAN.md) conserva o histórico de migração de 22/09/2026. As descrições históricas de compatibilidade v2, promoção manual e `/key` não representam o contrato atual. Esta atualização documental não autoriza remover colunas `recovery_*`, alterar parâmetros OPAQUE ou executar migrations destrutivas.
