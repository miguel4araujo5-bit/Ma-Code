# MA-Professor — ponto 1: estrutura geral e navegação

Data da análise: 17-09-2026.
Base verificada diretamente na `main` remota: `4a703e143751db09ecd27548c548180252a73e50` (PR #228).
Âmbito: estrutura e navegação do produto, com preservação das funcionalidades existentes.

## Árvore encontrada na main

A rota pública do produto é `/produtos/ma-professor`, através de `src/pages/MAProfessorPage.tsx`. As áreas internas são estado React; não são URLs independentes. Antes do produto existem os controlos de ativação, autenticação, isolamento de conta e preparação da escola/ano letivo.

| Entrada | Percursos e componentes existentes |
| --- | --- |
| Hoje | `DailyWorkspaceWithDuties`: dia/semana, seleção de aula ou cargo, sumário, alunos, faltas, avaliação, gravação e ações GIAE. |
| Calendário | `CalendarProductWorkspace`: mês/semana/dia, filtros, abertura da aula em Hoje, eventos/cargos e recuperações. |
| Segurança | `SettingsWorkspaceView` com o separador de segurança; disponível antes de concluir a configuração. |
| Menu → Pedagogia | `MAProfessorApp`, com uma segunda shell e navegação própria. |
| Pedagogia → Painel | `DashboardView`: indicadores do ano, agenda/progresso, sumários pendentes de cargos e área diária incorporada. É funcional. |
| Pedagogia → Calendário | Outra instância de `CalendarWorkspaceView`, com edição por diálogo e criação de aulas extra. |
| Pedagogia → Sumários / GIAE | Pesquisa/filtros, edição de sumário, estados de entrega, cópia e exportação. |
| Pedagogia → Avaliações | Avaliações e critérios, incluindo os componentes já existentes para ensino regular/profissional. |
| Pedagogia → Planificações | Consulta, criação, edição, importação de linhas, ordenação e estados de itens. |
| Pedagogia → Turmas e alunos | Consulta, criação/edição de turmas, lista de alunos, edição e ativação/desativação de alunos. |
| Menu → Faltas e recuperações | `AttendanceProductWorkspace`: assiduidade, alertas, recuperações e tentativas de avaliação. |
| Menu → Horário e calendário escolar | `ScheduleProductWorkspace`: horário semanal e eventos escolares. |
| Menu → Corrigir configuração inicial | `SetupWizard` avançado, sobre o ano e os dados atuais; alternativa de assistente simples. |
| Menu → Definições e segurança | Perfil e regras; Segurança e recuperação; Pesquisa; Licença/terminar sessão. |
| Menu → Restaurar dados | Os mesmos componentes de definições, abertos no restauro local ou cifrado online. |
| Barra lateral global | Calendário, Sumários/GIAE, Avaliações, Critérios de avaliação, Planificações, Turmas e alunos, Faltas e recuperações, Horários, Definições e Restaurar dados; Hoje em botão próprio. |

A configuração avançada mantém nove passos: ano letivo, turmas, disciplinas, organização curricular, horário semanal, critérios, planificações, alunos e confirmação. O percurso guiado e os respetivos importadores continuam a ser os mesmos componentes.

## Problemas demonstrados pelo código

1. `ProductNavigation` e `MAProfessorApp` definiam listas de navegação independentes. A segunda shell também tinha barra inferior própria no telemóvel.
2. `singleSidebar.css` escondia a barra lateral antiga apenas a partir de 1280 px, sem eliminar a segunda arquitetura.
3. `ManagementSidebarBridge` escondia três botões marcados «Em breve» e injetava ações reais por portais/observação do DOM. Esses destinos já existiam no produto.
4. A mesma ponte continha ações úteis para editar/substituir um horário guardado. Apagá-la integralmente perderia essas ações.
5. Só o calendário antigo ligava `onCreateLesson`. Eliminar esse calendário sem transferir a ação perderia a criação de aulas extra.
6. O botão superior Menu regressava antecipadamente quando `workspace` já era `menu`; não voltava à página inicial a partir de uma subárea.
7. Os cartões do Menu e a barra lateral não partilhavam uma definição; o destino efetivo podia não corresponder à seleção visual.
8. Definições e Restaurar dados reutilizavam o mesmo componente com `initialTab`. Na transição direta, o estado do separador podia sobreviver indevidamente.

## Arquitetura consolidada

`MAProfessorProduct` é o único proprietário do destino atual. `productNavigationModel.ts` define as entradas partilhadas. `ProductNavigation` apresenta a barra superior e a mesma lista lateral em computador/telemóvel. `ProductMenuWorkspace` apresenta os cartões e o destino pedido pelo produto, sem estado de navegação paralelo.

| Entrada comum | Destino preservado |
| --- | --- |
| Hoje | Área diária existente e respetiva proteção de gravação antes de sair. |
| Calendário | Único `CalendarProductWorkspace`, agora também com criação de aulas extra. Abrir uma aula leva a Hoje. |
| Segurança | Componentes existentes de segurança, cópias, restauro e exportação. |
| Menu / Visão geral | `DashboardView` existente, incluindo os seus indicadores e área diária. |
| Menu / Sumários/GIAE, Avaliações, Planificações, Turmas e alunos | Os mesmos componentes e repositórios, apresentados por `MAProfessorApp` sem shell própria. |
| Menu / Faltas e recuperações, Horários, Corrigir configuração, Definições, Restaurar dados | Os componentes já existentes. Todas as entradas também estão na navegação lateral comum. |
| Critérios de avaliação | Área própria para consultar e editar critérios, ponderações e conjuntos de avaliação, separada da página Avaliações. |
| Voltar à MA-Code | Ligação ao site preservada na navegação comum. |

`MAProfessorApp` foi conservado como contentor funcional; eliminar o ficheiro inteiro destruiria capacidades reais. O nome do ficheiro não implica uma segunda aplicação: deixou de possuir menu, barra lateral, barra móvel e calendário próprios.

## Remoções e transferências justificadas

- Removidas as duas listas antigas, a shell visual, os botões sem destino e o estado local do calendário duplicado de `MAProfessorApp`.
- Removido `singleSidebar.css`, sem consumidor depois de retirar a shell.
- `ManagementSidebarBridge.tsx` substituído por `SavedScheduleActions.tsx`, que preserva a edição e substituição de horário. A lógica de substituição/persistência e as confirmações existentes não foram alteradas.
- A criação de aulas extra reutiliza `ExtraLessonDialog` e `extraLessonRepository` através de `useCalendarExtraLesson`; não foi reimplementado o editor.
- A edição de sumários através do GIAE foi preservada, apesar de partilhar tipos/repositório com o calendário.
- Não foram alterados esquema IndexedDB, migrations, autenticação, Worker, cifragem, sincronização ou motores de importação/avaliação.

## Verificação

- Build TypeScript/Vite e geração das 14 rotas estáticas: passou. Permanece o aviso de dimensão dos bundles, sem erro de build.
- 924 testes do MA-Professor: passaram; os testes de estrutura foram atualizados para verificarem a navegação consolidada e manterem as garantias de segurança/restauro.
- Percurso existente no Chromium: passou; ativação simulada local, configuração, gravação do sumário e persistência após reload.
- Novo `browser-unified-navigation.e2e.mjs`: passou; entradas pela barra lateral e pelos cartões a 1366, 1024 e 390 px, retorno pelo botão Menu, ausência da segunda navegação, disponibilidade da exportação GIAE e restauro, alternância Definições/Restauro, aulas extra e persistência.
- Teste integrado existente (`browser-integrated-regression.e2e.mjs`): passou.
- Falha de gravação simulada: a tentativa de sair de Hoje foi cancelada, mantendo o rascunho; ao recuperar a gravação, a navegação guardou a alteração automaticamente.
- Inspeção visual do Menu em computador e telemóvel; sem overflow horizontal nas larguras verificadas.
- As APIs de acesso são simuladas nos testes de navegador. Estes testes não validam o serviço remoto, o deploy público ou uma sessão real de professor.

A análise não representa uma auditoria completa de segurança, persistência ou regras pedagógicas; cobre apenas o ponto 1.
