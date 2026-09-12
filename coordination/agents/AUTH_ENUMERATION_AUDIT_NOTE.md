# Auditoria de enumeração/autenticação — 2026-09-12

Âmbito desta fase: reduzir canais públicos de enumeração sem alterar o modelo de contas, licenças ou administração do MA-Professor.

Medidas desta branch:
- aproximar o custo criptográfico do login quando o email não tem credencial pessoal;
- validar a senha de ativação antes de permitir que estados de pedido/licença/pagamento sejam observáveis;
- limitar tentativas inválidas de ativação por origem e por origem+conta, sem bloqueio global por email;
- exigir sessão válida para o endpoint público de estado comercial e derivar o email exclusivamente dessa sessão;
- manter os endpoints internos administrativos inalterados;
- não adicionar Durable Objects, D1, bindings, migrations, alarms, cron, polling ou recursos pagos.

Este ficheiro é apenas registo de auditoria e não altera comportamento em produção.
