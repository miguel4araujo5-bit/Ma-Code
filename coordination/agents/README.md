# MA-CODE — Coordenação de Agentes

## Fast Lane V2

`/AGENTS.md` é a fonte operacional única e a única leitura obrigatória no arranque de uma conversa ativada como trabalho de agente.

Não é necessário ler automaticamente todos os ficheiros desta pasta antes de começar uma tarefa.

Os documentos abaixo existem como referência detalhada e só devem ser abertos quando `AGENTS.md` indicar necessidade real, existir ambiguidade, conflito entre agentes ou trabalho VERMELHO:

- `AGENT_EXECUTION_POLICY.md` — detalhe da política VERDE/AMARELO/VERMELHO;
- `AGENT_ROUTER.md` — exemplos adicionais de encaminhamento 101/102/103;
- `AGENT_101_ROLE.md` — detalhe do Executor / Reparador;
- `AGENT_102_ROLE.md` — detalhe do Guardião de Infraestrutura;
- `AGENT_103_ROLE.md` — detalhe do Investigador Funcional;
- `AGENT_WORKSTREAMS.md` — reservas/trabalho ativo ou bloqueado.

## Regra de velocidade

No arranque normal:

`AGENTS.md → tarefa → ficheiros reais do problema`

Consultar `AGENT_WORKSTREAMS.md` apenas para AMARELO/VERMELHO, trabalho paralelo conhecido ou risco concreto de colisão.

A `main` remota continua a ser a fonte de verdade. Um único agente pode investigar e implementar a sua tarefa sem percorrer documentação de coordenação redundante.
