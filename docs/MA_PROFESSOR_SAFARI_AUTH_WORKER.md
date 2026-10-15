# Safari: isolamento do cálculo de autenticação — 15/10/2026

## Diagnóstico e âmbito

O utilizador reportou «ocorreu um problema repetidamente» no Safari privado de um iPhone 16 Pro Max. Não foi possível confirmar se a mensagem surge antes ou depois de submeter a password, nem reproduzir o encerramento no dispositivo.

A main `6129f0803bc21abb2851c1df537f469ef545fc05` executava `finishClientLogin`/`finishClientRegistration` de forma síncrona na página. O runtime Wasm ficava retido durante a vida da página. O perfil `rfc-recommended` do upstream fixado em `SOURCE.md` usa Argon2id com 2^21−1 KiB, uma iteração e quatro vias (quase 2 GiB). Um temporizador da página não conseguia interromper esse cálculo síncrono.

## Alteração e compatibilidade

- O adaptador público mantém as operações existentes, mas executa cada uma num Web Worker descartável do navegador.
- As operações são serializadas na página para evitar dois cálculos pesados simultâneos.
- O worker é terminado após sucesso, erro, falha de mensagens, cancelamento ou timeout. Não existe fallback para o cálculo na página nem repetição automática.
- O limite total do login propaga o cancelamento ao cálculo. Uma resposta tardia não submete a prova nem abre sessão.
- Mantidos o Wasm auditado, o perfil Argon2, os registos OPAQUE, a exportKey, os payloads/API e o formato das cópias V3. Password e estados transitórios apenas atravessam uma mensagem local; não são guardados nem enviados ao servidor.

Esta correção elimina o bloqueio do event loop e a retenção da instância Wasm na página. **Não reduz o pico de memória do cálculo.** Se o iPhone continuar a encerrar por limite de memória do processo, será necessária uma migração de credenciais para um perfil de menor memória, com preservação verificável das chaves de cópia. Não substituir simplesmente `rfc-recommended` por `memory-constrained`.

## Gate de segurança e consumo

Alteração crítica local, no navegador. Não há alterações ao Cloudflare Worker, Durable Object, D1, migrations, autorizações ou sessões. Mantêm-se os dois pedidos de login e dois pedidos de registo; delta de pedidos/escritas/CPU dinâmica Cloudflare: zero. O bundle adicional é um asset estático de cerca de 10 KB. Não exige novos recursos nem plano pago.

## Validação

- TypeScript e build de produção aprovados; o build emite o worker e o mesmo asset Wasm.
- 22 testes existentes dirigidos aprovados: contrato OPAQUE, recuperação de descarga/rede, separação de chaves e password nunca enviada.
- Seis testes novos aprovados: término por sucesso/password errada, recuperação de crash, timeout sem retry, serialização/cancelamento em fila, deadline sem prova tardia e autenticação real de um registo RFC anterior com exportKey exatamente igual.
- O teste criptográfico real executa o worker de produção adaptando apenas o transporte a `node:worker_threads` e os bytes Wasm a ficheiro local; confirma que o event loop permanece responsivo durante Argon2. Não simula limites de memória do iPhone.
- O WebKit local não arrancou por falta de bibliotecas nativas; a instalação dessas dependências foi impedida pelas permissões do ambiente. Não equivale a validação em Safari/iPhone.
- Os percursos completos Chromium são verificados pelo CI antes de integrar; registar o resultado da publicação no ponto de retoma.

Nenhum dado, conta ou cópia real foi utilizado nos testes.
