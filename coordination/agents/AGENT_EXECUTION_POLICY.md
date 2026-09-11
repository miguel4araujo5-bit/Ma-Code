# MA-CODE — Agent Execution Policy

Esta é a política operacional para os agentes MA-CODE. O objetivo é maximizar velocidade sem perder segurança, reduzir branches/PRs desnecessários e impedir regressões causadas por trabalho concorrente ou estado desatualizado.

## 1. Fonte de verdade

- A `main` remota é sempre a fonte de verdade.
- Antes de alterar um ficheiro, o agente deve ler a versão atual desse ficheiro na `main`.
- Nunca trabalhar a partir de uma cópia antiga quando o mesmo ficheiro mudou entretanto.
- Se a `main` avançar durante a tarefa e tocar num ficheiro em edição, reler a versão atual e reconciliar antes de escrever.
- O registo `AGENT_WORKSTREAMS.md` é apenas coordenação operacional; nunca substitui o estado real do repositório.

## 2. Fast Lane — VERDE

Alterações de baixo risco podem ser feitas diretamente na `main`, sem branch nem PR.

Exemplos típicos:

- CSS, Tailwind, espaçamento, largura, overflow, alinhamento e responsividade;
- textos, labels, mensagens, documentação e comentários;
- correções visuais isoladas;
- testes ou fixtures sem alteração de comportamento de produção;
- pequenas correções locais sem persistência, parser, sincronização ou infraestrutura.

Condições obrigatórias:

1. confirmar a versão atual dos ficheiros na `main`;
2. alteração pequena, atómica e claramente delimitada;
3. correr a validação dirigida mais próxima do comportamento alterado, quando existir;
4. não tocar em nenhuma área AMARELA ou VERMELHA descrita abaixo;
5. após o commit, verificar o Build Check da `main` antes de iniciar trabalho dependente desse commit;
6. se o Build Check falhar, corrigir ou reverter imediatamente antes de continuar.

Não pedir autorização de merge para uma alteração VERDE validada. Não criar PR apenas por hábito.

## 3. Branch curta — AMARELO

Usar branch curta + PR quando existe risco funcional relevante, mas sem impacto direto em infraestrutura crítica.

Inclui, entre outros:

- parsers e importadores;
- lógica de associação/resolução de destinos;
- alterações de persistência local ou IndexedDB/Dexie;
- regras de negócio com impacto em vários fluxos;
- alterações transversais a vários componentes/produtos;
- refactors que mexam em vários ficheiros ou contratos;
- correções em que uma regressão silenciosa seja plausível.

Fluxo:

1. partir da `main` atual;
2. reservar os ficheiros no `AGENT_WORKSTREAMS.md` quando houver agentes concorrentes;
3. implementar a alteração mínima;
4. correr primeiro testes dirigidos;
5. correr o Build Check do PR;
6. se todos os checks estiverem verdes e a branch continuar atual face à `main`, integrar sem esperar por uma nova autorização do utilizador;
7. remover/atualizar a entrada do workstream concluído.

O PR não deve ficar em draft depois de a implementação estar pronta para validação.

## 4. Circuito protegido — VERMELHO

Branch + PR são obrigatórios para:

- `.github/workflows/**` e alterações ao próprio CI;
- Cloudflare Worker, Durable Objects, D1, bindings, `wrangler` e configuração Cloudflare;
- migrations ou alterações destrutivas de schema;
- autenticação, licenças, sessões ou autorização;
- sincronização, snapshots, backups, restauro e criptografia;
- alterações com potencial custo, consumo adicional relevante ou impacto noutras aplicações MA-CODE;
- operações que possam apagar, migrar ou tornar dados incompatíveis.

Regras adicionais:

- confirmar consumidores partilhados antes de alterar;
- preservar limites gratuitos aplicáveis e não ativar recursos pagos sem autorização explícita;
- não executar migrations destrutivas ou operações irreversíveis sem autorização explícita;
- usar testes de regressão e Build Check completo;
- só integrar quando os checks estiverem verdes e o impacto tiver sido revisto.

## 5. Um único escritor por zona de código

- Dois agentes podem investigar em paralelo, mas não devem editar simultaneamente o mesmo ficheiro ou a mesma zona lógica.
- Um ficheiro em alteração por um agente fica reservado até commit/abandono explícito.
- Se dois problemas exigirem o mesmo ficheiro central, um único agente deve tratá-los sequencialmente ou o segundo deve esperar pelo primeiro commit e reler a `main`.
- Evitar branches longas. Quanto maior a duração da branch, maior o risco de regressão e reconciliação cara.

## 6. Validação proporcional ao risco

Durante a implementação:

- começar pelo teste/regressão diretamente relacionado com a alteração;
- não correr repetidamente toda a suite depois de cada pequena edição;
- reservar a bateria completa para o ponto final exigido pela classe de risco;
- não duplicar manualmente validações que o CI já fará, salvo quando necessário para diagnosticar uma falha.

## 7. Estado dos agentes

`AGENT_WORKSTREAMS.md` deve conter apenas trabalho ativo ou bloqueado.

Quando um PR/commit for integrado:

- atualizar ou remover a entrada correspondente;
- não deixar estados como “aguarda merge” depois de o merge já ter acontecido;
- não usar uma branch antiga como base de uma nova tarefa;
- começar novas tarefas na `main` atual.

## 8. Regra de decisão rápida

- **VERDE** → direto à `main` → validação dirigida → Build Check da `main`.
- **AMARELO** → branch curta → testes dirigidos → PR → Build Check → merge automático quando verde e atual.
- **VERMELHO** → branch protegida → auditoria de impacto → testes completos → PR → revisão antes de integrar.

Em caso de dúvida entre duas classes, escolher a classe de maior risco.
