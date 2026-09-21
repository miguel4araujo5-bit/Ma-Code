# MA-Professor — estado da correção de privacidade das cópias

Referência: 20/09/2026. Este documento não declara a auditoria encerrada.

## Correções integradas

- Cópias automáticas desligadas até existir uma escolha explícita por conta e dispositivo. Falhas de leitura da preferência impedem o envio.
- Verificação da preferência durante a preparação da cópia e imediatamente antes do envio.
- Informação explícita de que a chave atual é gerida pelo servidor e permite à MA-CODE decifrar a cópia.
- Aviso inicial curto, dentro do layout do produto. A explicação completa e a ativação estão em Segurança e recuperação.
- Retenção de pedidos pendentes e rejeitados abandonados após 180 dias, com proteção de relações de acesso e comerciais. Ver limites em `MA_PROFESSOR_ACCESS_STORAGE_ARCHITECTURE.md`.

## OPAQUE integrado; backup v3 ainda pendente

A autenticação deixou de ser o bloqueio arquitetural inicial:

- o pedido público é email-only;
- a password pessoal é criada no browser apenas depois da aprovação;
- o enrollment e o login usam OPAQUE;
- a password pessoal não é enviada nos payloads públicos de pedido, ativação ou login;
- a senha MP continua separada e serve apenas para autorizar/ativar o período.

Isto **não torna por si só a cópia cloud ponta-a-ponta nem zero-knowledge**.

O backup ativo continua na versão 2: o servidor mantém material suficiente para recuperar a chave AES da cópia através de uma sessão autorizada. O aviso de privacidade atual deve continuar a descrever essa realidade até a promoção efetiva para v3.

O trabalho restante é do domínio do backup: usar a `exportKey` OPAQUE exclusivamente no cliente para derivar a wrapping key, criar uma master key v3 aleatória, cifrar a cópia localmente, validar o envelope e promover v2 -> v3 de forma atómica sem destruir a revisão anterior em caso de falha. O restauro noutro dispositivo com a mesma password pessoal também tem de ser validado antes de reforçar a promessa pública de privacidade.

## Contrato para implementar e validar a migração

- Manter a password pessoal, a senha MP, a licença e o tratamento administrativo como responsabilidades distintas.
- Manter OPAQUE conforme RFC 9807 como protocolo de autenticação estabelecido e usar derivação independente para o domínio do backup; não criar provas criptográficas próprias nem reutilizar a senha MP.
- Criar uma nova master key aleatória no cliente. Guardar no servidor apenas essa chave cifrada com uma wrapping key derivada localmente da `exportKey` OPAQUE, com salt/contexto e parâmetros versionados.
- Preservar o opt-in e as verificações de revisão. A migração não autoriza um novo envio de dados locais nem a substituição de uma cópia remota divergente.
- Migrar chave e conteúdo de forma atómica, mantendo a revisão anterior utilizável até a nova cópia ter sido preparada e verificada. Prever interrupções, concorrência entre dispositivos e clientes antigos.
- Permitir o restauro noutro dispositivo com a mesma password pessoal. Resolver explicitamente as sessões antigas e a ativação MP sem guardar a password em texto nem introduzir uma segunda password.
- Validar password incorreta, repetição de provas, expiração de desafios, isolamento entre contas, logout, perda de armazenamento local, migração interrompida, conflito de revisão e restauro completo num dispositivo novo.
- Informar corretamente sobre as consequências de perder a password e sobre cópias anteriores à migração. Não alterar o texto para uma promessa de cifragem ponta a ponta antes de estes percursos estarem implementados e testados.

## Limite desta revisão

O relatório completo dos alegados 12 achados abertos não foi disponibilizado. Não é possível atribuir-lhes estado de correção apenas a partir das referências parciais. Os achados retirados sobre enumeração e rate limiting de `/request` não justificam duplicar as proteções existentes.
