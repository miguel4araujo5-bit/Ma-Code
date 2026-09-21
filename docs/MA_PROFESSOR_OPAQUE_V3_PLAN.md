# MA-Professor — OPAQUE / Backup v3

Estado: passo 13 implementado na `main`. O gate final exige uma execução integral do workflow (não apenas um run documental com passos condicionais ignorados). A autenticação OPAQUE e o corte 12B estão integrados; cópias v2 existentes são promovidas para v3 apenas quando o professor inicia explicitamente uma cópia manual. Leitura, restauro e escrita suportam v2/v3; após promoção, a escrita usa exclusivamente o caminho v3 sem `/key`.

## Objetivo

Migrar o MA-Professor para uma arquitetura em que:

- a password pessoal não seja enviada ao servidor;
- a MA-CODE não possua material suficiente para decifrar uma cópia v3;
- a senha MP continue apenas a ativar/licenciar períodos;
- as cópias v2 continuem funcionais até à promoção atómica para backup v3;
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

- Password pessoal: é usada apenas no cliente pelo protocolo OPAQUE e não faz parte dos payloads públicos de pedido, ativação ou login.
- O pedido inicial é email-only. A password pessoal só é criada no dispositivo depois da aprovação, durante a ativação protegida por senha MP.
- Os caminhos públicos legados que recebiam password pessoal/PBKDF2 foram descontinuados; o login público é exclusivamente OPAQUE.
- Senha MP: apenas autoriza a criação inicial do registo OPAQUE e ativa/licencia o período; nunca deriva chaves.
- OPAQUE export key: apenas cliente.
- Master key do backup: aleatória, 256 bits, criada no cliente.
- Wrapping key v3: derivada no cliente da OPAQUE export key com HKDF-SHA-256 e contexto versionado.
- Dados: continuam cifrados localmente com AES-256-GCM antes do envio.

No caminho OPAQUE/backup v3, o servidor não recebe:
- OPAQUE export key;
- master key v3;
- wrapping key v3.

No fluxo público atual, a password pessoal não é enviada ao servidor. Esta garantia aplica-se à autenticação OPAQUE; não deve ser confundida com a garantia do backup v3, que só existe depois de a cópia ativa ter sido efetivamente migrada.

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

## Autenticação — corte 12B

O corte de autenticação deixou de manter uma migração pública PBKDF2 -> OPAQUE.

Contas novas:
- fazem o pedido apenas com email;
- depois da aprovação recebem uma senha MP;
- criam a password pessoal localmente durante o enrollment OPAQUE;
- o servidor guarda o `registrationRecord` OPAQUE, nunca a password pessoal;
- a ativação do período só é concluída depois de existir esse registo OPAQUE.

Login:
- usa exclusivamente OPAQUE;
- não existe fallback público para login v2/PBKDF2;
- a password pessoal não é enviada ao Worker;
- logout revoga a sessão normal; um novo login volta a executar OPAQUE.

Contas de teste anteriores ao corte podem ser repostas/apagadas. A ação administrativa de reposição remove também o registo OPAQUE e os desafios pendentes da conta selecionada, sem afetar os restantes utilizadores.

Este corte de autenticação **não promove automaticamente o backup para v3**. Uma conta pode autenticar por OPAQUE enquanto a sua cópia cloud ativa continua v2 até ao passo de migração específico do backup.

## Rotas

O fluxo público atual preserva a mesma cadeia de proteção administrativa, mas separa responsabilidades:

- `/request`: pedido email-only; campos antigos de password pessoal são rejeitados;
- `/opaque/enroll/start` e `/opaque/enroll/finish`: criação do registo OPAQUE autorizada pela senha MP;
- `/activate`: ativa o período apenas depois de existir o registo OPAQUE;
- `/opaque/login/start` e `/opaque/login/finish`: login protegido sem transmitir a password pessoal;
- `/login` legado: não é um caminho válido para autenticação pessoal.

Continuam obrigatórios:
- rate limiting;
- anti-enumeração;
- privacidade das respostas públicas;
- sessão/device binding;
- aprovação explícita;
- renovação e comércio;
- notificações administrativas.

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

## Fecho técnico do passo 13

Implementado:

- cifragem manual v3 no cliente com master key aleatória AES-256-GCM;
- wrapping da master key a partir da OPAQUE export key via HKDF-SHA-256;
- promoção v2 -> v3 com CAS de serverRevision e recordRevision e acoplamento transacional perfil/registo;
- leitura, restauro e upload v3 sem acesso ao endpoint legado `/key`;
- dispatcher compatível v2/v3 para leitura e escrita;
- migração acionada apenas pela ação manual de cópia, nunca por login, abertura, restauro ou automático;
- preservação do estado v3 se o upload posterior à promoção falhar;
- novo login OPAQUE repõe a export key apenas em memória para abrir a cópia v3;
- testes de adulteração de ciphertext, hash, wrapped master key e nonces;
- endpoint legado `/key` permanece restrito a perfis v2.

O passo só deve ser marcado operacionalmente como fechado quando existir uma execução integral do workflow com build e suite completa efetivamente executados e verdes; um commit apenas documental pode produzir um run verde com esses passos ignorados e não satisfaz este gate.

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
