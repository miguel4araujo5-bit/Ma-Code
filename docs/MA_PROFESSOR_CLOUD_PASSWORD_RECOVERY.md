# MA-Professor — confirmação da password para cópias online

Data: 30/09/2026. Base: `ce463ce00e4bd37abcb4d89fd8db33e76ff7b470`. Risco C.

O relato foi «coloco a password e não faz nada». O percurso normal passou no Chromium antes da alteração. A falha concreta do dispositivo do professor não foi observada: não foi disponibilizado o estado do botão ou um erro. A investigação identificou e reproduziu três defeitos que podem impedir a confirmação: uma descarga OPAQUE rejeitada ficava permanentemente em cache; a descarga e os pedidos de login podiam ficar pendentes sem limite; a confirmação lia apenas o estado React e podia ignorar um preenchimento nativo do gestor de passwords.

O carregamento da proteção e o login passam a ter um prazo local de 30 segundos. Uma falha repõe o carregamento, permitindo uma nova tentativa manual sem recarregar a página. O prazo cancela os pedidos pendentes e uma resposta tardia não prossegue para o passo seguinte nem disponibiliza a nova sessão/chave ao chamador. Não há retries automáticos. A UI apresenta o erro de demora, desbloqueia o botão e lê o campo realmente submetido. A confirmação bem-sucedida indica explicitamente que falta preparar a cópia e confirmar o envio.

A inspeção visual encontrou ainda texto pouco legível no tema claro: o painel mantinha o gradiente escuro com texto escuro e os avisos usavam cores demasiado claras. A correção de cores é limitada ao painel de cópia online. O formulário passa a usar o campo e o botão em linhas separadas, evitando reduzir a password a cerca de 60 px nas colunas estreitas de Definições.

O fluxo relevante mantém-se: campo → cliente OPAQUE local → login/start → prova local → login/finish → validação da conta/licença → substituição da sessão e chave só em memória → preparação dos dados atuais → confirmação do professor → cifra v3 → envio/validação da única cópia online. A password e a chave não são enviadas nem persistidas. Mantêm-se parâmetros de cifra, licenças, escolhas dos lembretes, ficheiros de backup, contratos Worker/D1 e dados locais. O sinal de cancelamento é opcional nos dois pedidos OPAQUE; os restantes pedidos de acesso mantêm o comportamento anterior.

## Gate Cloudflare Free antes do código

Limites oficiais confirmados em 30/09/2026: [Workers](https://developers.cloudflare.com/workers/platform/limits/) (100 000 pedidos/dia e 10 ms CPU/pedido) e [D1](https://developers.cloudflare.com/d1/platform/pricing/) (5 milhões de linhas lidas/dia, 100 000 escritas/dia, 5 GB totais).

O caminho bem-sucedido acrescenta zero pedidos Worker, CPU no servidor, consultas/escritas D1 ou armazenamento. Para vinte professores em simultâneo, continuam a existir quarenta pedidos de login no total; não há polling, jobs, novos recursos ou plano pago. Se todos repetirem manualmente uma tentativa que falhou, reservar mais quarenta pedidos de login e até vinte descargas de um recurso estático; são os mesmos endpoints e limites de tentativas existentes. Não há repetição automática nem alterações ao backend. O consumo agregado da conta não foi medido; a estimativa anterior das cópias continua aplicável.

## Validação

- Antes da correção: três reproduções falharam, confirmando o cache rejeitado e as duas esperas sem prazo. Uma comparação React/DOM confirmou que o preenchimento nativo submetia uma string vazia; a versão corrigida submete o campo preenchido.
- Depois: testes com o Wasm real verificam recuperação da descarga, timeout sem retry e bloqueio de respostas tardias.
- O percurso Chromium verifica os dois pedidos de confirmação sem resposta, erro visível e botão disponível, password incorreta, preenchimento nativo sem onChange, confirmação correta, rotação da sessão, preparação/envio/restauro v3 e preservação do sumário/dados.
- Suite MA-Professor completa, restantes produtos, build e três percursos de browser.

As contas, ligações e dados de teste são fictícios. A validação num Safari/iPhone real e a causa específica do dispositivo do professor permanecem por confirmar. Build/CI não prova publicação em produção.
