# MA-CODE — Coordenação de Agentes

Qualquer nova conversa ou agente que trabalhe no repositório deve começar pelo router universal `AGENTS.md` na raiz do projeto.

Antes de iniciar qualquer alteração:

1. ler `AGENT_EXECUTION_POLICY.md`;
2. ler `AGENT_ROUTER.md` e escolher autonomamente o papel principal: 101, 102 ou 103;
3. anunciar ao utilizador, numa frase curta, qual o papel escolhido e porquê;
4. ler o ficheiro específico do papel escolhido (`AGENT_101_ROLE.md`, `AGENT_102_ROLE.md` ou `AGENT_103_ROLE.md`);
5. confirmar a `main` remota atual;
6. consultar `AGENT_WORKSTREAMS.md` para evitar colisões;
7. classificar a tarefa como VERDE, AMARELO ou VERMELHO;
8. executar segundo a política de risco, sem pedir ao utilizador que escolha manualmente o agente.

## Ficheiros

- `../../AGENTS.md` — ponto de entrada universal para qualquer nova conversa/agente MA-CODE.
- `AGENT_EXECUTION_POLICY.md` — política comum de execução, segurança, Fast Lane e critérios de branch/PR.
- `AGENT_ROUTER.md` — decide automaticamente qual dos agentes 101/102/103 deve liderar a tarefa.
- `AGENT_101_ROLE.md` — Executor / Reparador rápido: bugs concretos, UI, TypeScript, build, CI e regressões localizadas.
- `AGENT_102_ROLE.md` — Guardião de infraestrutura: Worker, D1, Durable Objects, Cloudflare, sync, backups, auth, migrations, quotas e custos.
- `AGENT_103_ROLE.md` — Investigador funcional: parser, importações, regras de negócio, resolução de destinos e persistência funcional.
- `AGENT_WORKSTREAMS.md` — apenas reservas/trabalho atualmente ativo ou bloqueado.

## Encaminhamento rápido

- bug concreto, UI, TypeScript, build ou regressão local → **101**;
- infraestrutura, Cloudflare, D1, Worker, sync, backup, auth ou migration → **102**;
- parser, importação, regras funcionais, turma/disciplina/curso ou persistência funcional → **103**.

O número do agente define **quem lidera**. A classificação VERDE/AMARELO/VERMELHO define **como executar e integrar**.

Se uma tarefa mudar de domínio durante a investigação, o agente atual deve deixar um handoff curto e transferir apenas a parte que saiu do seu âmbito. Não devem existir dois agentes a implementar em paralelo a mesma zona lógica.

A `main` é sempre a fonte de verdade. Branches antigas, PRs fechados e linhas históricas do registo de workstreams não devem ser usados como base para novas alterações.
