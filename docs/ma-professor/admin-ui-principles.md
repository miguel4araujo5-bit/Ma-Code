# MA-Professor — princípios do MA-ADMIN

## Objetivo

O MA-ADMIN deve privilegiar o trabalho operacional do administrador e evitar ocupar espaço visual com lembretes internos de implementação ou segurança que não exigem uma ação naquele momento.

## Regra de interface

- Regras internas de segurança e invariantes técnicas devem ficar documentadas no código, testes e documentação técnica, não em cartões informativos permanentes no MA-ADMIN.
- O ADMIN deve mostrar sobretudo estados, problemas e ações que o administrador possa efetivamente resolver.
- Informação técnica sem ação imediata só deve aparecer quando explica um erro, um estado anómalo ou uma decisão que o administrador precisa de tomar.
- Explicadores permanentes do fluxo geral não devem ocupar o topo do MA-ADMIN quando não exigem qualquer ação do administrador.

## Fluxo administrativo de acesso

A sequência de referência é:

1. Pedido
2. Plano
3. Decisão
4. Senha
5. Email
6. Acesso

Esta sequência é documentação interna do funcionamento e não deve ser apresentada como um bloco visual permanente no MA-ADMIN.

## Invariante de segurança do acesso

A geração da credencial de ativação deve acontecer antes da tentativa de envio do email de ativação.

Se o transporte de email não estiver configurado ou falhar:

- a credencial já gerada não deve ser perdida;
- o MA-ADMIN deve poder receber a senha como fallback para cópia manual;
- a conta não deve ficar aprovada num estado impossível de ativar.

O período de licença começa apenas quando o professor conclui uma ativação válida, não no momento da aprovação administrativa.

## Modalidades de aprovação

Para um pedido pendente, o MA-ADMIN permite uma decisão explícita por utilizador:

- Gratuito — 30 dias após ativação;
- Fundador · 30 dias — 30 dias após ativação;
- Fundador · ano letivo — validade até ao limite definido para o ano letivo.

Estas regras são de funcionamento e de manutenção do produto. Não devem ser repetidas como cartões explicativos permanentes no fundo ou no topo da interface administrativa.

## Manutenção de contas

A secção de manutenção existe para operações raras e deve ficar recolhida por defeito no MA-ADMIN.

- **Repor acesso**: limpa o estado de acesso da conta para permitir um novo ciclo de teste/ativação. Remove pedido, licença, sessões, senhas de ativação, password pessoal, renovações e autorizações de acesso, preservando a cópia cifrada dos dados escolares guardados na cloud.
- **Apagar utilizador**: remove a identidade de acesso e também a cópia cloud cifrada associada ao email selecionado. Dados que existam apenas localmente no dispositivo do professor não podem ser apagados remotamente.

Estas diferenças devem permanecer documentadas e protegidas pelas confirmações das próprias ações, sem ocupar espaço visual permanente em cartões informativos dentro da secção de manutenção.
