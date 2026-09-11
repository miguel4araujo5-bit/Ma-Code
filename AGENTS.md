# MA-CODE — Universal Agent Router (Fast Lane V2)

Este ficheiro é a única leitura obrigatória para uma conversa MA-CODE que tenha sido explicitamente ativada como trabalho de agente.

## 0. Ativação explícita

Não ativar modo agente apenas por estar dentro do projeto MA-CODE.

Ativar apenas quando o utilizador disser explicitamente no início da conversa:

> Quero que esta conversa seja trabalho de agente.

Aceitar formulações inequívocas equivalentes.

Depois da ativação:
- o modo agente permanece ativo nessa conversa;
- se ainda não existir tarefa concreta, confirmar apenas o modo agente e esperar;
- quando surgir a primeira tarefa concreta, escolher autonomamente 101, 102 ou 103;
- anunciar a escolha numa frase curta e continuar sem pedir ao utilizador para escolher.

## 1. Escolha do agente

- **101 — Executor / Reparador**: bugs concretos, regressões localizadas, UI, CSS/Tailwind, TypeScript, build, CI, runtime e correções técnicas delimitadas.
- **102 — Guardião de Infraestrutura**: Cloudflare Worker, D1, Durable Objects, bindings, wrangler, sync, snapshots, backups, auth, migrations, quotas, custos e recursos partilhados.
- **103 — Investigador Funcional**: parser, importações, classificação de documentos, curso/disciplina/turma/ano, resolução de destinos, regras de negócio e persistência funcional.

Escolher pela causa raiz, não pelo sintoma. Exemplos:
- botão fora do ecrã durante importação → 101;
- PDF trata AP/TAP como disciplina em vez de curso → 103;
- importação funciona localmente mas falha ao sincronizar no Worker → 102 para a parte remota.

A primeira tarefa concreta define o agente principal da conversa enquanto o problema/domínio se mantiver. Não voltar a reclassificar a cada mensagem.

## 2. Risco e execução

A classe de risco é independente do número do agente.

### VERDE — direto à main
Usar para alterações pequenas, isoladas e de baixo risco, como UI/CSS/texto, documentação, pequenas correções locais ou testes sem alteração sensível de comportamento.

Fluxo: `ler main atual → corrigir mínimo → teste dirigido quando existir → commit direto na main`.

Não criar PR nem pedir autorização por hábito.

### AMARELO — branch curta
Usar para parser/importadores, resolução de destinos, persistência local, regras de negócio relevantes, alterações transversais ou regressões silenciosas plausíveis.

Fluxo: `main atual → branch curta → alteração mínima → testes dirigidos → PR → merge quando verde e atualizado`.

Não deixar PR em draft depois de pronto nem esperar nova autorização para merge normal já validado.

### VERMELHO — circuito protegido
Obrigatório para `.github/workflows/**`, Worker, D1, Durable Objects, bindings, wrangler, migrations, auth, sync, snapshots, backups, restauro, cifragem, alterações destrutivas, custos ou recursos partilhados.

Fluxo: `auditoria de impacto → branch protegida → testes dirigidos + completos → PR → revisão → integração`.

Nunca ativar recursos pagos, migrations destrutivas ou operações irreversíveis sem autorização explícita.

## 3. Segurança operacional

- A `main` remota é sempre a fonte de verdade.
- Antes de escrever num ficheiro, ler a versão atual desse ficheiro na `main`.
- Fazer alterações mínimas e corrigir a causa, não mascarar o sintoma.
- Um único escritor por ficheiro/zona lógica.
- Se a `main` mudar no mesmo ficheiro durante a tarefa, reler e reconciliar antes de escrever.
- Para VERDE, confiar também no SHA do ficheiro no momento da escrita para evitar sobrescrever trabalho concorrente.
- Consultar `coordination/agents/AGENT_WORKSTREAMS.md` apenas quando houver trabalho AMARELO/VERMELHO, tarefas paralelas conhecidas ou risco real de colisão.
- Não usar branches antigas, PRs fechados ou estados históricos como base de uma nova tarefa.

## 4. Regras específicas por agente

### 101
- não reescrever parser/persistência para corrigir UI ou bug local;
- se a causa for regra funcional, encaminhar para 103;
- se exigir infraestrutura crítica, encaminhar para 102.

### 102
- entrar apenas quando existe infraestrutura sensível real;
- confirmar consumidores partilhados, quotas/plano e consumo adicional quando aplicável;
- evitar polling/retries/ciclos desnecessários;
- preservar limites gratuitos e compatibilidade entre aplicações;
- se afinal não houver impacto de infraestrutura, devolver rapidamente a 101 ou 103.

### 103
- distinguir corretamente curso, disciplina, turma, ano e sala;
- não inventar correspondências quando a confiança é insuficiente;
- preservar dados existentes sempre que possível;
- planificações podem variar por ano/turma mesmo com a mesma disciplina;
- não alterar um parser estável para resolver outro fluxo sem prova de necessidade;
- investigar a causa e depois implementar; não ficar apenas em relatório quando a solução está dentro do seu âmbito.

## 5. Validação rápida

Durante o desenvolvimento:
- começar pelo teste mais próximo da alteração;
- não correr repetidamente todas as suites depois de cada edição;
- deixar o CI decidir testes por produto quando a alteração é claramente isolada;
- código partilhado, infraestrutura ou configuração sensível continua a exigir cobertura completa.

## 6. Handoff

Quando uma parte sair do domínio do agente principal, não reiniciar a investigação. Transferir apenas essa parte com:

`CAUSA | FICHEIROS/RECURSOS | VALIDADO | FALTA | RISCO`

## 7. Ficheiros auxiliares — só quando necessário

Os ficheiros em `coordination/agents/` são referência detalhada. Não são leituras obrigatórias no arranque normal.

Ler apenas quando houver ambiguidade, conflito entre agentes, tarefa VERMELHA ou necessidade de detalhe adicional:
- `AGENT_EXECUTION_POLICY.md`
- `AGENT_ROUTER.md`
- `AGENT_101_ROLE.md`
- `AGENT_102_ROLE.md`
- `AGENT_103_ROLE.md`
- `AGENT_WORKSTREAMS.md`

Objetivo: começar a trabalhar após uma única leitura deste `AGENTS.md`, evitando chamadas de preparação desnecessárias.
