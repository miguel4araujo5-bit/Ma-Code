# Planificações por disciplina e turma

O passo guiado das planificações apresenta as aulas do horário já guardado. O professor pode largar um PDF/DOCX numa célula ou clicar nela para escolher o documento. Depois da leitura, clicar noutra célula corrige o destino sem reler o ficheiro.

## Associação e persistência

- A célula identifica um `teachingAssignmentId` existente: ano letivo, disciplina e turma. Todas as células dessa associação mostram o mesmo estado.
- A importação guiada transmite apenas esse ID à transação existente. Nunca expande a seleção para todas as turmas da disciplina nem cria disciplinas homónimas a partir de siglas.
- Sem célula escolhida, a correspondência usa nomes/siglas do estado confirmado, ano, turma e curso. O ano e a turma explícitos são restrições, mesmo com uma única associação disponível. Destinos ambíguos ficam pendentes.
- Uma divergência entre documento e célula é apresentada a âmbar. O professor pode corrigir o destino ou importar para a célula escolhida. O botão Importar confirma a operação, sem outro diálogo no fluxo guiado.
- Os módulos e planificações mantêm a estrutura atual, separados por associação. Mesmo código de UFCD em duas turmas não mistura conteúdos. Reimportações preservam módulos e planificações existentes.
- As tabelas de critérios não são alteradas por este fluxo. Não há migrações, novas chamadas de API, polling ou alterações a Worker/D1/Cloudflare.
- As associações antigas não são corrigidas retroativamente por inferência. Não é possível deduzir com segurança se os conteúdos antigos pertenciam a outro ano.

## Validação

`tests/ma-professor/planification-schedule-destination.test.mjs` cobre resolução por ano/turma, siglas, restrições de curso, destinos inativos/de outro ano letivo, avisos não bloqueantes, seleção por ficheiro, eventos de largar, correção por clique, persistência real em Dexie/fake-indexeddb, reimportação e preservação dos critérios.

Comandos de validação: `node --test tests/ma-professor/*.test.mjs`, `npm run test:conquistador`, `npm run test:ma-quadro` e `npm run build`.

A inspeção visual num navegador real está pendente: o navegador disponibilizado bloqueou o endereço local com `net::ERR_BLOCKED_BY_CLIENT`. Os testes React não substituem essa inspeção. Antes de integrar, verificar a grelha numa largura de computador e numa largura móvel, largar uma planificação numa aula do 10.º D e outra numa aula do 12.º D, confirmar as restantes células e avançar para os critérios.
