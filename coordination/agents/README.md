# MA-CODE — Coordenação de Agentes

O router de agentes não é automático em todas as conversas do projeto.

Só deve ser usado quando o utilizador ativar explicitamente a conversa como trabalho de agente, por exemplo dizendo no início:

> Quero que esta conversa seja trabalho de agente.

Depois dessa ativação, a conversa deve seguir `../../AGENTS.md` como ponto de entrada universal.

Se a conversa não tiver essa ativação explícita, deve continuar como conversa normal e não assumir nem anunciar 101/102/103 por iniciativa própria.

## Depois da ativação

Antes de iniciar qualquer alteração:

1. ler `AGENT_EXECUTION_POLICY.md`;
2. ler `AGENT_ROUTER.md`;
3. se já existir tarefa concreta, escolher autonomamente o papel principal: 101, 102 ou 103;
4. anunciar ao utilizador, numa frase curta, qual o papel escolhido e porquê;
5. ler o ficheiro específico do papel escolhido (`AGENT_101_ROLE.md`, `AGENT_102_ROLE.md` ou `AGENT_103_ROLE.md`);
6. confirmar a `main` remota atual;
7. consultar `AGENT_WORKSTREAMS.md` para evitar colisões;
8. classificar a tarefa como VERDE, AMARELO ou VERMELHO;
9. executar segundo a política de risco, sem pedir ao utilizador que escolha manualmente o agente.

Se a mensagem inicial contiver apenas a ativação do modo agente e ainda não existir problema concreto, confirmar o modo agente mas esperar pela primeira tarefa antes de escolher 101/102/103.

## Ficheiros

- `../../AGENTS.md` — ponto de entrada universal para conversas explicitamente ativadas como trabalho de agente.
- `AGENT_EXECUTION_POLICY.md` — política comum de execução, segurança, Fast Lane e critérios de branch/PR.
- `AGENT_ROUTER.md` — decide automaticamente qual dos agentes 101/102/103 deve liderar a tarefa após ativação.
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
