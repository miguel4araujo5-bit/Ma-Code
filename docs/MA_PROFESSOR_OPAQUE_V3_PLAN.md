# MA-Professor — OPAQUE / Backup v3

Estado: implementação em curso. Passos 7 a 12 concluídos; o backup ativo continua v2 até aos passos seguintes.

## Objetivo

Migrar o MA-Professor para uma arquitetura em que:

- a password pessoal não seja enviada ao servidor;
- a MA-CODE não possua material suficiente para decifrar uma cópia v3;
- a senha MP continue apenas a ativar/licenciar períodos;
- contas e cópias v2 continuem funcionais durante a migração;
- uma falha a meio nunca destrua a cópia v2 existente;
- o desenho continue compatível com o plano Free da Cloudflare para pelo menos 20 professores.

## Protocolo de autenticação

Usar OPAQUE conforme RFC 9807.

Não implementar primitivas criptográficas próprias.

Implementação de referência selecionada para o spike:
`opaque-ke` através do wrapper `@serenity-kit/opaque`, sujeito a adaptação exclusivamente do carregamento Wasm para o modelo suportado por Cloudflare Workers.

A build publicada do wrapper faz inline do Wasm. Cloudflare Workers não permite `WebAssembly.instantiate` com bytes/buffer; exige um `WebAssembly.Module` importado. A própria documentação Cloudflare descreve como adaptar saída `wasm-bindgen` para importar `.wasm` e criar `WebAssembly.Instance`.

Não instalar a dependência em produção antes de existir um spike de build/runtime verde no Worker.

## Separação de segredos

- Password pessoal: usada apenas no cliente para OPAQUE.
- Senha MP: apenas ativação/licença; nunca deriva chaves.
- OPAQUE export key: apenas cliente.
- Master key do backup: aleatória, 256 bits, criada no cliente.
- Wrapping key v3: derivada no cliente da OPAQUE export key com HKDF-SHA-256 e contexto versionado.
- Dados: continuam cifrados localmente com AES-256-GCM antes do envio.

O servidor nunca recebe:
- password pessoal;
- OPAQUE export key;
- master key v3;
- wrapping key v3.

## Separação formal de domínios — passo 12

A separação entre autenticação e backup fica explícita e protegida por testes:

- OPAQUE `session_key`: pertence apenas à sessão autenticada do protocolo. O adaptador cliente não a expõe à aplicação e o Worker verifica-a no `finishServerLogin` sem a devolver nem persistir como chave da aplicação.
- OPAQUE `export_key`: continua exclusivamente no cliente e só é disponibilizada ao MA-Professor depois de o login ou enrollment terminar no servidor.
- Wrapping key do backup: derivada da `export_key` com HKDF-SHA-256 e `info = MA-CODE/MA-Professor/cloud-backup/v3/wrapping-key`.
- Cifragem da master key: usa AAD `MA-CODE/MA-Professor/cloud-backup/v3/master-key-wrap`.
- Cifragem dos dados v3: fica reservado o domínio `MA-CODE/MA-Professor/cloud-backup/v3/data`; este domínio só passa a ser usado quando a cifragem manual v3 for implementada no passo 13.

Os três domínios são intencionalmente diferentes. A master key aleatória do backup não é a OPAQUE `session_key` nem a OPAQUE `export_key`.

O contrato `tests/ma-professor/crypto-domain-separation.test.mjs` impede regressões em que:
- a `exportKey` passe a aparecer no Worker;
- a OPAQUE `sessionKey` passe a escapar dos adaptadores;
- a aplicação receba a `exportKey` antes da conclusão do protocolo;
- os domínios de HKDF, wrapping e dados sejam reutilizados por engano.

## Estrutura v3 do backup

A tabela atual `ma_professor_sync_profiles` já contém os campos necessários:

- `crypto_version`
- `recovery_kdf_algorithm`
- `recovery_kdf_salt`
- `recovery_kdf_parameters`
- `recovery_key_wrap_algorithm`
- `recovery_wrapped_master_key`
- `recovery_wrapped_master_key_nonce`

A v3 deve dar semântica real a esses campos. Não é necessário alterar destrutivamente o schema para representar v3.

Proposta:

- `crypto_version = 3`
- `recovery_kdf_algorithm = 'OPAQUE-RFC9807-EXPORT-HKDF-SHA256'`
- `recovery_kdf_salt = <salt aleatório público em base64>`
- `recovery_kdf_parameters = <JSON com versão/contexto HKDF>`
- `recovery_key_wrap_algorithm = 'AES-256-GCM'`
- `recovery_wrapped_master_key = <master key cifrada>`
- `recovery_wrapped_master_key_nonce = <nonce base64>`

## Migração v2 -> v3 sem perda

Não sobrescrever a chave v2 no início.

Fluxo obrigatório:

1. autenticar a conta v2;
2. obter e validar a cópia v2 enquanto o mecanismo legado ainda está intacto;
3. desencriptar v2 no cliente;
4. concluir/enrolar a conta em OPAQUE;
5. obter a export key apenas no cliente;
6. criar master key v3 aleatória no cliente;
7. derivar wrapping key v3 por HKDF com domínio MA-Professor v3;
8. cifrar a master key v3;
9. cifrar a cópia com a master key v3;
10. validar localmente desencriptação, estrutura e assinatura/hash;
11. efetuar uma única operação atómica D1 que:
    - substitui o perfil v2 pelo perfil v3;
    - grava o ciphertext v3/revisões esperadas;
    - apenas avança se a revisão v2 esperada ainda for atual;
12. se qualquer condição falhar, a transação não avança e a v2 fica intacta.

Não é necessário persistir uma segunda chave v2 depois de uma promoção v3 bem sucedida. Assim que a transação v3 confirma, o servidor deixa de manter a chave v2 dessa conta.

## Migração da autenticação

O estado de credenciais no Durable Object passa a aceitar dois contratos durante a transição:

- v2: PBKDF2 atual;
- v3: OPAQUE registration record.

Contas novas:
- registam diretamente OPAQUE;
- não criam um novo verificador PBKDF2 v2.

Contas existentes:
- podem autenticar uma última vez pelo contrato v2;
- o browser, que ainda conhece a password, inicia o registo OPAQUE autenticado pela sessão v2;
- o servidor guarda apenas o OPAQUE registration record;
- após confirmação, a conta passa a `authVersion = 3`;
- o login seguinte usa OPAQUE e já não envia a password.

A senha MP e o contrato de licença não mudam.

## Rotas

Não substituir silenciosamente `/request`, `/login` e `/activate`.

Adicionar endpoints versionados/etapas OPAQUE dentro da mesma cadeia de bridges para preservar:

- rate limiting;
- anti-enumeração;
- privacidade de respostas;
- sessão/device binding;
- aprovação explícita;
- renovação e comércio;
- notificações administrativas.

A remoção dos campos plaintext-password dos endpoints legados só acontece quando a compatibilidade v2 puder ser retirada.

## Conflitos e restauro

Preservar sem alterações conceptuais:

- `serverRevision`;
- `recordRevision`;
- compare-and-swap;
- HTTP 409 em divergência;
- `cloudBackupTrust`;
- verificação de assinatura/hash;
- proteção contra alteração local durante restauro;
- opt-in explícito do backup automático.

A alteração criptográfica não autoriza simplificar estes mecanismos.

## Compatibilidade Cloudflare

A build publicada de `@serenity-kit/opaque` usa Wasm inline. No Worker deve ser testada uma adaptação baseada no padrão oficial Cloudflare para `wasm-bindgen`:

- importar `.wasm` como `WebAssembly.Module`;
- criar `WebAssembly.Instance`;
- ligar os exports ao glue `wasm-bindgen`;
- nunca chamar `WebAssembly.compile`, `instantiateStreaming` ou `instantiate` com buffer.

Só depois de um teste de Worker real/CI verde é permitido adicionar a dependência à aplicação.

## Orçamento Free para 20 professores

Limites relevantes verificados em setembro de 2026:

- Workers Free: 100 000 requests/dia;
- CPU Worker Free: 10 ms por request;
- memória: 128 MB;
- Durable Objects SQLite: disponíveis no Free;
- DO SQLite: 5 GB totais no Free;
- DO SQLite: 5 milhões row reads/dia e 100 000 row writes/dia.

Cenário conservador de autenticação:
- 20 professores;
- 10 autenticações/professor/dia;
- 4 requests Worker por autenticação OPAQUE;
- 800 requests/dia.

Isto é < 1% do limite de 100 000 requests/dia.

O risco principal é CPU por request, não volume. Argon2/key stretching deve permanecer no cliente. O spike deve medir/validar apenas as operações servidor OPAQUE no Worker antes de produção.

## Gates antes de ativar v3

1. package/runtime OPAQUE compila no browser e Worker;
2. spike Worker não usa APIs Wasm proibidas;
3. testes OPAQUE registration/login passam;
4. password não aparece no payload de login v3;
5. export key nunca aparece no backend;
6. backup v3 é restaurável noutro dispositivo com a password;
7. migração v2 -> v3 é atómica;
8. falha antes da promoção mantém v2 intacta;
9. conflito de revisão continua a produzir 409;
10. opt-in/opt-out do automático continua inalterado;
11. suite MA-Professor + browser paths + build global verdes;
12. só então atualizar textos de privacidade.

## Não fazer

- não implementar OPAQUE à mão;
- não reutilizar senha MP como segredo;
- não introduzir uma segunda password;
- não apagar v2 antes da promoção atómica;
- não migrar apenas por abrir a aplicação;
- não fazer upload sem consentimento;
- não remover 409/revisões;
- não alterar `wrangler.jsonc` ou `package.json` antes do spike compatível;
- não declarar cifragem ponta-a-ponta enquanto existir uma chave servidor capaz de abrir a cópia ativa.
