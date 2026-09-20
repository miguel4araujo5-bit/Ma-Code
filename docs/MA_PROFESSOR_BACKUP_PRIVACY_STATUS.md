# MA-Professor — estado da correção de privacidade das cópias

Referência: 20/09/2026. Este documento não declara a auditoria encerrada.

## Correções integradas

- Cópias automáticas desligadas até existir uma escolha explícita por conta e dispositivo. Falhas de leitura da preferência impedem o envio.
- Verificação da preferência durante a preparação da cópia e imediatamente antes do envio.
- Informação explícita de que a chave atual é gerida pelo servidor e permite à MA-CODE decifrar a cópia.
- Aviso inicial curto, dentro do layout do produto. A explicação completa e a ativação estão em Segurança e recuperação.
- Retenção de pedidos pendentes e rejeitados abandonados após 180 dias, com proteção de relações de acesso e comerciais. Ver limites em `MA_PROFESSOR_ACCESS_STORAGE_ARCHITECTURE.md`.

## Opção B: pendente

É possível usar a password pessoal de login para proteger as cópias sem exigir uma segunda password ou uma chave que o professor tenha de guardar separadamente. A ausência de uma chave separada **não exige** que o servidor consiga decifrar as cópias. Essa justificação anterior estava errada.

O código integrado ainda usa a versão 2: o servidor guarda a chave AES e fornece-a mediante uma sessão autorizada. O aviso de privacidade deve continuar a descrevê-lo até a migração estar efetivamente concluída.

Há duas dependências que têm de ser resolvidas em conjunto:

1. O registo (`/request`) e o login (`/login`) atuais enviam a password pessoal ao servidor por HTTPS. Derivar localmente uma chave dessa mesma password, mantendo estes pedidos, não elimina a capacidade técnica do servidor para obter a chave. A autenticação tem de passar a usar uma prova que não revele a password nem material que permita derivar a chave das cópias.
2. As cópias e sessões existentes têm de continuar utilizáveis durante a transição. A senha MP ativa o período de acesso e pode abrir uma sessão sem o professor voltar a escrever a password pessoal; não pode ser reutilizada como segredo das cópias.

## Contrato para implementar e validar a migração

- Manter a password pessoal, a senha MP, a licença e o tratamento administrativo como responsabilidades distintas.
- Utilizar um protocolo de autenticação estabelecido e derivação independente para autenticação e cifragem; não criar uma prova criptográfica improvisada. As especificações [SCRAM](https://www.rfc-editor.org/rfc/rfc5802.html) e [SCRAM-SHA-256](https://www.rfc-editor.org/rfc/rfc7677.html) são referências de avaliação, não uma implementação já escolhida ou integrada.
- Criar uma nova chave aleatória no cliente. Guardar no servidor apenas essa chave cifrada com uma chave derivada localmente da password, com salt e parâmetros versionados.
- Preservar o opt-in e as verificações de revisão. A migração não autoriza um novo envio de dados locais nem a substituição de uma cópia remota divergente.
- Migrar chave e conteúdo de forma atómica, mantendo a revisão anterior utilizável até a nova cópia ter sido preparada e verificada. Prever interrupções, concorrência entre dispositivos e clientes antigos.
- Permitir o restauro noutro dispositivo com a mesma password pessoal. Resolver explicitamente as sessões antigas e a ativação MP sem guardar a password em texto nem introduzir uma segunda password.
- Validar password incorreta, repetição de provas, expiração de desafios, isolamento entre contas, logout, perda de armazenamento local, migração interrompida, conflito de revisão e restauro completo num dispositivo novo.
- Informar corretamente sobre as consequências de perder a password e sobre cópias anteriores à migração. Não alterar o texto para uma promessa de cifragem ponta a ponta antes de estes percursos estarem implementados e testados.

## Limite desta revisão

O relatório completo dos alegados 12 achados abertos não foi disponibilizado. Não é possível atribuir-lhes estado de correção apenas a partir das referências parciais. Os achados retirados sobre enumeração e rate limiting de `/request` não justificam duplicar as proteções existentes.
