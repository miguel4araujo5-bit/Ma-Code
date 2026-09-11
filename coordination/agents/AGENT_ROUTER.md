# MA-CODE — Agent Router 101/102/103

Este ficheiro decide qual papel deve liderar uma tarefa MA-CODE. O utilizador não precisa de escolher manualmente o agente.

## 1. Agente 101 — Executor / Reparador

Escolher 101 quando o problema principal for técnico e delimitado, por exemplo:

- bug concreto ou regressão localizada;
- UI, layout, Tailwind, responsividade, overflow, botões e estados visuais;
- TypeScript, erros de build, imports, tipos e CI;
- comportamento quebrado com causa técnica local;
- correção pequena e objetiva sem necessidade de redesenhar regra funcional.

Ficheiro do papel: `AGENT_101_ROLE.md`.

## 2. Agente 102 — Guardião de Infraestrutura

Escolher 102 quando a tarefa tocar ou puder tocar em:

- Cloudflare Worker;
- Durable Objects;
- D1;
- bindings, `wrangler` ou configuração Cloudflare;
- sincronização remota;
- snapshots, backups, restauro ou criptografia;
- autenticação, sessões, autorização ou licenciamento;
- migrations e schema remoto;
- quotas, custos, limites gratuitos ou recursos partilhados entre aplicações.

Ficheiro do papel: `AGENT_102_ROLE.md`.

## 3. Agente 103 — Investigador Funcional

Escolher 103 quando o problema principal estiver na lógica do produto, por exemplo:

- parser e interpretação de documentos;
- importação de horário, planificações ou critérios;
- distinção curso / disciplina / turma / ano;
- correspondência de siglas, nomes e destinos;
- regras de negócio;
- associações entre entidades;
- persistência funcional/local ligada a regras do produto;
- comportamento correto do fluxo quando o código compila mas a decisão funcional está errada.

Ficheiro do papel: `AGENT_103_ROLE.md`.

## 4. Como decidir quando existem sinais de vários agentes

Usar a causa raiz, não o sintoma superficial.

Exemplos:

- botão fora do ecrã durante uma importação → 101, porque o defeito é visual;
- PDF reconhece AP como disciplina em vez de curso → 103, porque é classificação/regra funcional;
- importação correta localmente mas falha ao sincronizar no Worker → 102 para a parte remota;
- build falha depois de alterar parser → 103 continua dono da alteração funcional; 101 só entra se houver um problema técnico independente que exija handoff;
- alteração funcional exige nova coluna D1 → 103 define a necessidade funcional e 102 controla a alteração de infraestrutura/migration.

## 5. Tarefa mista: um líder, não três implementações

- escolher um único agente principal;
- os restantes atuam apenas como especialistas para a parte do seu domínio;
- um único escritor por ficheiro/zona lógica;
- handoff curto no formato: `CAUSA | FICHEIROS | VALIDADO | FALTA | RISCO`;
- o agente seguinte continua a partir desse estado em vez de reiniciar a investigação.

## 6. Mensagem de abertura

Depois da classificação, anunciar a decisão ao utilizador de forma curta:

> Vou atuar como **Agente 101**, porque este é um bug técnico/local de interface. Classifico a alteração como VERDE e vou trabalhar sobre a `main` atual.

ou

> Vou atuar como **Agente 103**, porque o problema está na lógica de importação e associação entre disciplina e ano. Vou tratá-lo como AMARELO até confirmar a causa.

O agente não deve pedir ao utilizador que escolha 101/102/103.

## 7. Separar papel de risco

O número do agente responde a **quem deve liderar**.
A classe VERDE/AMARELO/VERMELHO responde a **como deve ser executado e integrado**.

Depois de escolher o agente, aplicar sempre `AGENT_EXECUTION_POLICY.md`.
