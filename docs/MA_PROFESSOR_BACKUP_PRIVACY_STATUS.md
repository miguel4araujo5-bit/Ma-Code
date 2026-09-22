# MA-Professor — estado da privacidade das cópias

Referência: 22/09/2026.

Este documento descreve o contrato de privacidade efetivamente implementado após o fecho técnico do backup v3. Não substitui os testes nem o plano arquitetural em `MA_PROFESSOR_OPAQUE_V3_PLAN.md`.

## Estado atual

- O pedido público de acesso é apenas por email.
- A password pessoal é definida no dispositivo depois da aprovação e não é enviada nem guardada pela MA-CODE.
- O enrollment e o login usam OPAQUE; o servidor mantém apenas o material criptográfico necessário ao protocolo, não a password pessoal.
- A senha MP permanece separada: autoriza a ativação/licenciamento e não substitui a password pessoal nem deriva chaves de backup.
- As cópias automáticas começam desligadas e exigem escolha explícita por conta e dispositivo.
- A preferência é verificada durante a preparação e novamente antes do envio; falha de leitura da preferência impede o upload automático.
- A cópia online é cifrada no dispositivo antes do envio.
- Nas cópias com proteção v3, a OPAQUE export key, a master key e a wrapping key permanecem no cliente; o Worker/D1 recebem apenas ciphertext, envelope público de proteção, hashes e metadados/revisões.
- Por essa razão, para uma cópia v3 a MA-CODE não guarda no servidor material suficiente para decifrar os dados.
- A primeira cópia de uma conta sem perfil é criada diretamente em v3, com perfil e ciphertext na mesma transação. O servidor deixou de gerar chaves v2 para novas contas.
- A compatibilidade v2 é mantida para contas antigas: o servidor conserva material técnico que permite decifrar essas cópias até à migração explícita e atómica para v3.
- A migração v2 -> v3 é acionada apenas pela ação manual de cópia; não ocorre por login, abertura da aplicação, restauro ou backup automático.
- A migração preserva `serverRevision`, `recordRevision`, CAS/409 e a cópia v2 se a promoção não for concluída.
- O endpoint legado `/key` permanece restrito a perfis v2 e não abre cópias v3.
- Um novo login OPAQUE repõe a export key apenas em memória para permitir abrir uma cópia v3; não existe persistência dessa chave em `localStorage`, `sessionStorage`, D1 ou Durable Objects.

Após recarregar a página, a sessão pode continuar válida sem a export key. A cópia protegida mostra um pedido de reautenticação, suspende tentativas automáticas e retoma após login OPAQUE, sem fechar o trabalho local. Password e export key não são persistidas. A senha MP não permite substituir um registo OPAQUE existente; uma ativação interrompida retoma através da password já registada.

## Contrato de texto público

Os textos apresentados ao professor devem distinguir claramente duas situações:

1. **Proteção v3** — a MA-CODE não recebe a password pessoal e não possui no servidor material suficiente para decifrar a cópia.
2. **Compatibilidade v2** — o servidor conserva material técnico que permite decifrar as cópias antigas até à migração explícita. Esta limitação deve estar escrita no consentimento.

Enquanto puder existir uma cópia v2, não se deve apresentar uma promessa genérica de “zero-knowledge”, “ponta-a-ponta” ou equivalente para todas as contas.

Também não se deve dizer que a MA-CODE “apaga a password pessoal” numa operação administrativa: a password pessoal não está guardada no servidor. A operação pode apagar o registo OPAQUE e o restante estado de autenticação associado à conta.

## Password pessoal e recuperação

A comunicação pública deve manter estes pontos:

- a password pessoal é usada pelo protocolo OPAQUE no cliente;
- não é enviada nem armazenada pela MA-CODE;
- a MA-CODE não a consegue recuperar;
- um novo login OPAQUE volta a obter localmente a export key necessária à proteção v3;
- a senha MP serve para ativação/licenciamento e não é uma password de login;
- perder a password pessoal impede um novo login protegido até existir um fluxo administrativo de reposição/novo enrollment, não uma recuperação da password anterior.

## Cópias locais

As cópias JSON descarregadas para o dispositivo continuam sem cifragem própria. O aviso de segurança local deve continuar explícito: o professor deve guardar esse ficheiro apenas num local seguro.

## Passo 15 — fecho de copy de privacidade

Em 21/09/2026 foram revistos e alinhados os textos visíveis de:

- pedido e ativação de acesso;
- apresentação inicial;
- Apoio Fundador/senha MP;
- consentimento de cópia automática;
- confirmação da configuração inicial;
- manutenção administrativa de contas.

O aviso cloud passou a descrever v3 sem esconder a compatibilidade v2. A manutenção administrativa deixou de afirmar que o servidor guarda/remove a password pessoal.

O passo 15 só fica operacionalmente fechado depois de o build e a suite MA-Professor correspondentes a estas alterações passarem no CI.
