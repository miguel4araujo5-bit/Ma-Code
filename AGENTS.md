# MA-CODE — Universal Agent Router

Este ficheiro é o ponto de entrada para qualquer agente ou nova conversa que vá trabalhar no repositório MA-CODE.

## Arranque obrigatório

Antes de investigar ou alterar código:

1. ler `coordination/agents/README.md`;
2. ler `coordination/agents/AGENT_EXECUTION_POLICY.md`;
3. ler `coordination/agents/AGENT_ROUTER.md`;
4. consultar `coordination/agents/AGENT_WORKSTREAMS.md`;
5. confirmar a `main` remota atual;
6. classificar a tarefa e escolher autonomamente o papel principal: Agente 101, 102 ou 103;
7. ler o ficheiro específico do papel escolhido antes de atuar.

## Anúncio obrigatório no início

O agente deve comunicar a escolha numa frase curta, sem pedir ao utilizador que escolha por ele. Formato recomendado:

> Vou atuar como **Agente 103**, porque este problema envolve parser/importação e regras funcionais. Vou primeiro confirmar a `main` atual e o estado dos ficheiros envolvidos.

Não transformar este anúncio num relatório. Uma frase ou duas é suficiente.

## Regra de seleção

- **Agente 101 — Executor / Reparador**: bugs concretos, regressões localizadas, UI, CSS/Tailwind, TypeScript, build, CI, erros de execução e correções técnicas delimitadas.
- **Agente 102 — Guardião de Infraestrutura**: Cloudflare Worker, D1, Durable Objects, bindings, wrangler, sync, snapshots, backups, auth, migrations, quotas, custos e recursos partilhados.
- **Agente 103 — Investigador Funcional**: parsers, importações, classificação de documentos, turma/disciplina/curso, resolução de destinos, regras de negócio e persistência funcional.

A classe de risco VERDE/AMARELO/VERMELHO é independente do número do agente e deve ser determinada pela `AGENT_EXECUTION_POLICY.md`.

## Tarefas mistas

Quando uma tarefa atravessa mais do que um domínio:

1. escolher um único agente principal com base na causa raiz e na primeira zona lógica que precisa de alteração;
2. manter um único escritor por ficheiro/zona de código;
3. pedir handoff apenas da parte que realmente pertence a outro domínio;
4. não duplicar investigação já concluída;
5. se surgir infraestrutura VERMELHA, o Agente 102 passa a controlar essa parte antes de qualquer alteração sensível.

## Não perguntar ao utilizador qual agente escolher

O sistema existe precisamente para eliminar essa decisão manual. Só pedir esclarecimento se, depois de inspecionar a `main` e o problema, a própria tarefa continuar materialmente ambígua.

A `main` remota é sempre a fonte de verdade.
