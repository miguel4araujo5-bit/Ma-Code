# MA-CODE — Estado operacional único dos agentes

Atualizado por: AGENTE 1 — SEGUNDA GERAÇÃO (A1-G2)
Data: 2026-09-08 17:09+01:00
Fonte técnica: `main` confirmada em `344841c1fc402e813f9d8658d96fa20b0fefa779`.

## Regra de coordenação em vigor

Este ficheiro é o **único resumo operacional** dos seis agentes.

- `AGENT_MESSAGES.md` fica preservado como histórico append-only e canal de comunicações curtas; não apagar nem reescrever mensagens.
- PRs/tarefas mantêm discussão técnica, evidência, SHAs, findings e pedidos de revisão.
- `A1_BLOCKER_BOARD.md` fica preservado, mas está **SUBSTITUÍDO por este ficheiro**.
- Só o A1 edita ficheiros centrais de coordenação.
- Uma mensagem publicada não prova leitura nem acorda uma conversa parada; cada agente deve reler respostas no início da sua execução.
- Trabalho em branches/checkouts próprios continua livre dentro do âmbito e ownership atuais.
- **Nenhuma tarefa nova conta como concluída sem SHA exato, provas proporcionais e pedido explícito de revisão.**
- Nenhum merge/publicação em `main` sem provas do candidato, revisão independente A6 no SHA exato e aprovação explícita do utilizador.
- O realinhamento de responsabilidades não reinicia trabalho nem invalida SHAs aprovados.

## Papéis principais

- **A1 — coordenação, produto e workflow**: âmbito, contratos funcionais, ownership, integração, candidato e gates.
- **A2 — core, acesso, dados e persistência**: acesso/sessão/licença, repositórios centrais, atomicidade, concorrência, guards e invariantes de persistência.
- **A3 — interface, UX, PT-PT e visual**: percursos de utilização, simplicidade, acessibilidade, feedback visual e consumo das APIs core.
- **A4 — pedagogia, aulas, avaliações e GIAE**: regras pedagógicas, Daily, assiduidade, avaliações e GIAE.
- **A5 — segurança de dados, recuperação e snapshots**: backups, cifragem, recuperação, snapshots e preservação.
- **A6 — revisão independente, não-regressão e release**: revisão por SHA, não-regressão global e gate técnico de release.

## ÂMBITO DEFINITIVO — entrega atual MA-Professor

O âmbito está fechado. Novas melhorias passam para entrega seguinte, salvo erro bloqueante, risco confirmado de perda de dados ou novo pedido explícito do utilizador com decisão A1 registada.

### Lotes congelados/elegíveis já existentes

1. **A2-NR-01 — acesso/sessão/logout/renovação**
   - branch `agent2-g2/access-session-contract-7ec8904`
   - HEAD `7038930471c80753b40ffde91eb023fc050f0030`
   - Build Check #1649 SUCCESS; MA-Professor 253/253; Conquistador PASS; build PASS; A6 **APTO**.

2. **A3 PDF planificações**
   - HEAD `e4df193d78c5d9523cf7803af30241ab92e8ec6b`
   - A6 **APTO**; smokes reais ficam para candidato.

3. **A3 Horário/Xadrez**
   - HEAD `800d91198d7f1b2c2193ebdd89a78425ceb8effd`
   - smoke A3 6/6; A6 **APTO**.

4. **A3 Cores + PT-PT — estado efetivo para composição**
   - Cores HEAD `64e3149336c6097c9777a8feb38209f9bfb37be9`.
   - PT-PT isolado HEAD `b0e2928a0e80306503a38787f4a46a8acea7fee1`, A6 APTO.
   - sobreposição mecânica entregue pelo A3: HEAD `ad4ff49b471bfae487da7ab72b95134d894f9e37`; blob final `SetupConfirmationStep.tsx` `7281fea873e0d3766d3531ff438995dd5e9eefb2`; apenas 2 adições + 2 remoções.
   - candidato consome o estado visual de Cores + este blob, sem integrar história temporária.

5. **A4-DAILY-NR-01 — primeira avaliação concorrente**
   - HEAD `df7098fe510aa79fc72bde035053389045a8d117`
   - CI #1645 SUCCESS; A6 **APTO**.

6. **A4-GIAE-NR-02 — submissão explícita segura**
   - branch `agent4-g2/giae-explicit-resubmit-f314a8b`
   - HEAD `ba87e69873a0277a63e84b98bf539038aba0151f`
   - prova local 9/9 PASS; A6 sem finding bloqueante de código; prova global fica para candidato.

7. **A5 BACKUP-ATOMIC**
   - HEAD `94fd528ac0a38d4eca7b56a83cd160a0616a84df`
   - A6 **APTO**; rollback Dexie real anteriormente reportado 2/2.

8. **CI-ISOLATION**
   - HEAD `745dab64e2355b1e14a36687d60a21e77b6e0f34`
   - A6 **APTO**.

## Lotes novos desta entrega

### 9. CRITERIA-SIMPLE-01 — critérios simples por disciplina

Produto: `definir critérios -> aplicar a uma ou várias associações turma+disciplina -> todas as UFCD herdam`. `Personalizar uma UFCD` é exceção avançada.

**Batch geral A1**
- branch `agent1/criteria-batch-344841c`
- HEAD `2bfc028dc4ff4b93bc2a0350a7a51e54ebc43d80`
- operação multi-associação all-or-nothing, sem schema/db migration.

**Guard core A2 — ENTREGUE / CONGELADO**
- branch `agent2/criteria-evidence-guard-2bfc028d`
- HEAD `715ecd84b66a616ae4973979f4658be3be19b3fc`
- exatamente 2 ficheiros novos: `assessmentCriteriaModuleRepository.ts` + teste.
- comportamento: UFCD sem evidência pode receber `scope: module`; assessment/result/final-grade existentes bloqueiam com zero writes; stale entre pré-check e transação é revalidado; nenhum remapeamento histórico.
- provas A2: teste estrutural 4/4 PASS; compile TS isolada PASS; harness transacional 6/6 PASS.
- A6: **VERIFICAÇÃO INCOMPLETA**, sem finding bloqueante de código. Falta prova Dexie/IndexedDB/suite completa no SHA exato; será obrigatória no candidato.

**UX A3 — ENTREGUE / CONGELADO**
- branch `agent3-g2/criteria-simple-ux-715ecd8`
- base core `715ecd84...`
- HEAD `c3104b700d8435b2401ab41b0b16bb892db549e5`
- consome `assessmentCriteriaModuleRepository.createModuleScheme(...)` no override UFCD; mantém batch geral multi-disciplina e proteção de trabalho não guardado.
- A6: finding UX anterior **CORRIGIDO**; sem novo blocker de código; **VERIFICAÇÃO INCOMPLETA** apenas por falta de prova executável/suite e dependência da prova real do parent core.

**Decisão A1 de preservação:** se uma UFCD já tiver avaliação, resultado ou classificação final, a troca/criação de scheme efetivo fica bloqueada nesta entrega; zero migração/remapeamento silencioso. Versionamento de critérios fica para lote futuro.

Estado: **não há desenvolvimento A3 pendente**. Core+UX podem entrar apenas no candidato de integração/teste para obter prova executável real; isto não equivale a APTO/release.

### 10. A4-DAILY-QUICK-GRADE-01 — avaliação rápida por aula

- pedido explícito do utilizador: abrir aula e escrever diretamente `0–20` junto ao aluno; nota válida implica `evaluated`; detalhes avançados recolhidos; zero avaliação vazia; teclado rápido; preservar concorrência e unsaved-work.
- branch `agent4-g2/daily-quick-grade-df7098f`
- base `df7098fe...`
- HEAD final entregue `391346b3c5261203ae78c343facb1a31f7196e41`
- delta: 4 ficheiros A4 (`DailyLessonAssessmentSection.tsx`, `dailyQuickGrade.ts`, `DailyWorkspaceView.tsx`, teste).
- provas A4: harness isolado 10/10 PASS; teste de repo contém 14 testes/asserções; sem suite/build completa neste SHA.
- **A6 AÇÃO AGORA:** rever este SHA e emitir APTO/BLOQUEADO/VERIFICAÇÃO INCOMPLETA.
- A4 mantém HEAD congelado salvo finding concreto.

### 11. A4-DAILY-GIAE-AUTO-01 — copiar sumário assinala automaticamente GIAE

Pedido explícito do utilizador. Regra correta:
- clipboard conclui primeiro;
- cópia bem-sucedida da versão atual -> tick automático `Submetido no GIAE`;
- persistir `submitted` apenas para a versão realmente copiada;
- edição posterior invalida e exige nova cópia;
- clipboard fail = zero alteração;
- stale/submit fail nunca produz falso sucesso.

**BLOQUEIO ATUAL:** A4 diagnosticou que o Daily APTO ainda usa o caminho legacy de submissão depois de guardar. Só restaurar `giaeStatus:'submitted'` no React pode submeter S2 depois de copiar S1.

**A2 AÇÃO BLOQUEANTE AGORA — CORE/PERSISTÊNCIA:**
- fornecer API mínima para o Daily guardar primeiro a versão atual como `pending` sem submissão legacy, devolver `updatedAt` persistido e depois permitir `giaeExplicitSubmissionRepository.markSubmitted({ lessonId, expectedUpdatedAt })`.
- preservar contrato aprovado `f314a8b...`; não reescrever por ownership.
- entregar branch/HEAD + testes de transação/stale/zero-write + pedido A6.

**A4 PRÓXIMA AÇÃO:** assim que o HEAD/API A2 existir, implementar o percurso Daily automático em branch própria e entregar HEAD + provas + pedido A6.

Este é o **único desenvolvimento funcional bloqueante ainda não entregue** antes do candidato.

## Segurança/recuperação A5

Investigação concluída sem encontrar risco atualmente alcançável de perda irrecuperável que obrigue a reabrir a entrega. Existe caminho destrutivo demonstrado em código atualmente inativo relacionado com `CryptoSetupGate`; deve ser corrigido antes de qualquer futura montagem desse gate. Não entra silenciosamente nesta entrega.

## Ações atuais por agente

### A1 — COORDENAÇÃO / PRODUTO / WORKFLOW
1. manter âmbito/ownership fechados;
2. coordenar a cadeia A2 core GIAE -> A4 GIAE Auto;
3. não reabrir A3 critérios salvo finding A6;
4. após GIAE Auto e pareceres A6: materializar candidato, verificar ancestralidade/deduplicação, executar MA-Professor + Conquistador + MA-Quadro + build + smokes e entregar SHA ao A6.

### A2 — CORE / ACESSO / DADOS / PERSISTÊNCIA — AÇÃO ATIVA BLOQUEANTE
- `703893...` acesso APTO e congelado.
- `715ecd84...` critérios congelado; prova real final no candidato.
- **FAZER AGORA:** dependência core `A4-DAILY-GIAE-AUTO-01` conforme comentário A1 `5588500143`.

### A3 — INTERFACE / UX / PT-PT / VISUAL — SEM DESENVOLVIMENTO PENDENTE
- critérios UX final atual `c3104b...` congelado; A6 sem blocker de código, prova final no candidato.
- preservar PDF/Xadrez/Cores/PT-PT.

### A4 — PEDAGOGIA / AULAS / AVALIAÇÕES / GIAE
- Quick Grade `391346b...` entregue/congelado, aguarda A6.
- GIAE Auto aguarda API core A2; assim que existir, retomar imediatamente.
- parecer Excel entregue e separado da entrega atual.

### A5 — SEGURANÇA DE DADOS / RECUPERAÇÃO / SNAPSHOTS
- BACKUP-ATOMIC preservado.
- investigação de risco atual concluída; sem blocker alcançável desta entrega.
- smoke backup/restore volta no candidato.

### A6 — REVISÃO INDEPENDENTE / NÃO-REGRESSÃO / RELEASE — AÇÃO ATIVA
1. rever agora Quick Grade `391346b...`;
2. critérios core `715ecd84...` + UX `c3104b...`: sem blocker de código conhecido, mas prova executável real obrigatória no candidato antes de APTO/release;
3. depois rever HEAD core A2 + HEAD A4 de GIAE Auto;
4. revisão final obrigatória do candidato combinado.

## Fila seguinte visível — fora da entrega atual

### NEXT-STUDENTS-NAV-01 — gestão de alunos sem concluir planificações
A1 produto/workflow; A3 UX; A2 core/persistência se necessário. Conclusão: professor gere alunos sem marcar falsamente planificações como concluídas e sem perder rascunhos.

### NEXT-PLANIFICATION-DAILY-01 — planificações na preparação de sumários
A1 contrato; A3 UX; A4 Daily/pedagogia; A2 core se necessário. Conclusão: sugestões apenas da UFCD correta, sem write antecipado e sem cross-UFCD silencioso.

### NEXT-EXCEL-FINAL-01 — Excel avaliação final UFCD/módulo
Planeamento apenas nesta entrega. A3/A4/A5 já contribuíram; original nunca alterado, output é cópia e dados estruturados continuam fonte de verdade.

### NEXT-CRITERIA-VERSIONING-01 — mudar critérios com evidência histórica
Futuro versionamento/migração explícita e atómica. Até lá, mudança bloqueada quando existe evidência.

### NEXT-CRYPTO-RECOVERY-01 — cifragem e recuperação
A5 segurança/recuperação; A2 core; A1 âmbito; A6 revisão. Corrigir o caminho destrutivo antes de futura montagem de `CryptoSetupGate`.

## Validação obrigatória do candidato

- testes MA-Professor;
- testes Conquistador;
- testes MA-Quadro;
- build completo;
- testes específicos dos lotes novos;
- smokes funcionais proporcionais: critérios multi-disciplina; override UFCD sem evidência; bloqueio real Dexie com evidência/stale; PDF/Xadrez; Daily Quick Grade; cópia/tick GIAE; GIAE single/bulk/stale; backup/restore; acesso/logout/renovação;
- dados descartáveis; nenhuma informação escolar privada em comentários/fixtures públicas;
- cada prova deve corresponder ao SHA avaliado;
- build verde não substitui testes funcionais.

Fluxo final obrigatório:
`lotes finais -> candidato A1 -> testes/verificações -> A6 no SHA final -> apresentação ao utilizador -> aprovação explícita -> integração/publicação`.

## Estado de fecho neste momento

**Ainda não concluído.** Falta: `A2 core GIAE Auto -> A4 GIAE Auto -> A6 dos novos SHAs -> candidato A1 -> testes globais -> A6 final -> aprovação do utilizador`. A `main` permanece protegida em `344841c1fc402e813f9d8658d96fa20b0fefa779`.