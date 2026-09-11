# MA-CODE — Coordenação de Agentes

Antes de iniciar qualquer alteração no repositório:

1. ler `AGENT_EXECUTION_POLICY.md`;
2. ler o ficheiro de papel do agente (`AGENT_101_ROLE.md`, `AGENT_102_ROLE.md` ou `AGENT_103_ROLE.md`);
3. confirmar a `main` remota atual;
4. consultar `AGENT_WORKSTREAMS.md` para evitar colisões;
5. classificar a tarefa como VERDE, AMARELO ou VERMELHO;
6. confirmar se a tarefa pertence realmente ao seu domínio; se não pertencer, encaminhar em vez de duplicar investigação;
7. usar direto à `main` apenas quando a política VERDE o permitir.

## Ficheiros

- `AGENT_EXECUTION_POLICY.md` — política comum de execução, segurança, Fast Lane e critérios de branch/PR.
- `AGENT_101_ROLE.md` — Executor / Reparador rápido: bugs concretos, UI, TypeScript, build, CI e regressões localizadas.
- `AGENT_102_ROLE.md` — Guardião de infraestrutura: Worker, D1, Durable Objects, Cloudflare, sync, backups, auth, migrations, quotas e custos.
- `AGENT_103_ROLE.md` — Investigador funcional: parser, importações, regras de negócio, resolução de destinos e persistência funcional.
- `AGENT_WORKSTREAMS.md` — apenas reservas/trabalho atualmente ativo ou bloqueado.

## Encaminhamento rápido

- bug concreto, UI, TypeScript, build ou regressão local → **101**;
- infraestrutura, Cloudflare, D1, Worker, sync, backup, auth ou migration → **102**;
- parser, importação, regras funcionais, turma/disciplina/curso ou persistência funcional → **103**.

Se uma tarefa mudar de domínio durante a investigação, o agente atual deve deixar um handoff curto e transferir apenas a parte que saiu do seu âmbito. Não devem existir dois agentes a implementar em paralelo a mesma zona lógica.

A `main` é sempre a fonte de verdade. Branches antigas, PRs fechados e linhas históricas do registo de workstreams não devem ser usados como base para novas alterações.
