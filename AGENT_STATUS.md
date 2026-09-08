# MA-CODE — Estado operacional único dos agentes

Atualizado por: AGENTE 1 — SEGUNDA GERAÇÃO (A1-G2)
Data: 2026-09-08
Fonte técnica: `main` confirmada em `344841c1fc402e813f9d8658d96fa20b0fefa779`.

## Regra de coordenação em vigor

Este ficheiro é o **único resumo operacional** dos seis agentes.

- `AGENT_MESSAGES.md` fica preservado como histórico append-only e canal de comunicações curtas; não apagar nem reescrever mensagens.
- PRs/tarefas mantêm discussão técnica, evidência, SHAs, findings e pedidos de revisão.
- `A1_BLOCKER_BOARD.md` está preservado mas **SUBSTITUÍDO por este ficheiro**.
- Só o A1 edita ficheiros centrais de coordenação.
- Uma mensagem publicada não prova leitura nem acorda uma conversa parada; cada agente deve reler respostas no início de cada execução.
- Trabalho em branches/checkouts próprios continua livre dentro do ownership atual.
- **Nenhuma tarefa nova conta como concluída sem SHA exato, provas proporcionais e pedido explícito de revisão.**
- Nenhum merge/publicação em `main` sem candidato testado, revisão independente A6 no SHA exato e aprovação explícita do utilizador.
- O realinhamento de responsabilidades não reinicia trabalho nem invalida SHAs já aprovados.

## Papéis principais

- **A1 — coordenação, produto e workflow**: âmbito, contratos funcionais, ownership, integração, candidato e gates.
- **A2 — core, acesso, dados e persistência**: acesso/sessão/licença, repositórios centrais, atomicidade, concorrência, guards e invariantes de persistência.
- **A3 — interface, UX, PT-PT e visual**: percursos de utilização, simplicidade, acessibilidade, feedback visual e consumo das APIs core.
- **A4 — pedagogia, aulas, avaliações e GIAE**: regras pedagógicas, Daily, assiduidade, avaliações e GIAE.
- **A5 — segurança de dados, recuperação e snapshots**: backups, cifragem, recuperação, snapshots e preservação.
- **A6 — revisão independente, não-regressão e release**: revisão por SHA, não-regressão global e gate técnico de release.

## ÂMBITO DEFINITIVO — entrega atual MA-Professor

O âmbito está fechado. Novas melhorias passam para a entrega seguinte, salvo erro bloqueante, risco confirmado de perda de dados ou novo pedido explícito do utilizador com decisão A1 registada.

### Lotes congelados/elegíveis já existentes

1. **A2-NR-01 — acesso/sessão/logout/renovação**
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
   - PT-PT HEAD `b0e2928a0e80306503a38787f4a46a8acea7fee1`, A6 APTO.
   - sobreposição mecânica: HEAD `ad4ff49b471bfae487da7ab72b95134d894f9e37`; blob final `SetupConfirmationStep.tsx` `7281fea873e0d3766d3531ff438995dd5e9eefb2`; apenas 2 adições + 2 remoções.

5. **A4-DAILY-NR-01 — primeira avaliação concorrente**
   - HEAD `df7098fe510aa79fc72bde035053389045a8d117`
   - CI #1645 SUCCESS; A6 **APTO**.

6. **A4-GIAE-NR-02 — submissão explícita segura**
   - HEAD `ba87e69873a0277a63e84b98bf539038aba0151f`
   - contrato explícito base `f314a8b6379d876cacacb96481cbf40effd2d5ce`.
   - prova local 9/9 PASS; A6 sem finding bloqueante de código; prova global fica para candidato.

7. **A5 BACKUP-ATOMIC**
   - HEAD `94fd528ac0a38d4eca7b56a83cd160a0616a84df`
   - A6 **APTO**; rollback Dexie real anteriormente reportado 2/2.

8. **CI-ISOLATION**
   - HEAD `745dab64e2355b1e14a36687d60a21e77b6e0f34`
   - A6 **APTO**.

## Lotes novos desta entrega

### 9. CRITERIA-SIMPLE-01 — critérios simples por disciplina

Produto: `definir critérios -> aplicar a uma ou várias associações turma+disciplina -> todas as UFCD herdam`; `Personalizar uma UFCD` fica como exceção avançada.

- batch A1 HEAD `2bfc028dc4ff4b93bc2a0350a7a51e54ebc43d80` — multi-associação all-or-nothing.
- guard core A2 HEAD `715ecd84b66a616ae4973979f4658be3be19b3fc` — bloqueia override UFCD com assessment/result/final-grade, revalida stale na transação, zero migração histórica. Provas A2: estrutural 4/4, compile isolada PASS, harness 6/6 PASS.
- UX A3 HEAD `c3104b700d8435b2401ab41b0b16bb892db549e5` — consome `assessmentCriteriaModuleRepository.createModuleScheme(...)`; mantém batch geral, PT-PT e unsaved protection.
- A6: sem blocker de código no core; finding UX anterior corrigido; **VERIFICAÇÃO INCOMPLETA** até prova executável Dexie/IndexedDB/suite no candidato.

Decisão A1: se a UFCD já tiver avaliação, resultado ou classificação final, a criação/troca do scheme efetivo fica bloqueada nesta entrega; zero remapeamento silencioso. Versionamento de critérios fica para lote futuro.

### 10. A4-DAILY-QUICK-GRADE-01 — avaliação rápida por aula

Requisito: abrir aula e escrever diretamente `0–20` junto ao aluno; nota válida implica `evaluated`; detalhes avançados recolhidos; zero avaliação vazia; teclado rápido; preservar concorrência e unsaved-work.

**Checkpoint anterior bloqueado:** `391346b3c5261203ae78c343facb1a31f7196e41` — A6 encontrou `A6-DAILY-QUICK-GRADE-NR-01`: criação do assessment e gravação dos resultados não eram atómicas.

**Core A2 de correção:**
- HEAD `abfa52e21b49f6b52ba2748c9d11ff6d1ab40656`
- `assessmentAtomicPersistenceRepository.createLessonAssessmentWithResults(...)` envolve criação + resultados numa só transação.
- provas A2: estrutural 3/3 PASS; compile isolada PASS; harness rollback/retry 2/2 PASS.

**Correção A4 entregue para revisão:**
- branch `agent4-g2/daily-quick-grade-atomic-faf6f38`
- HEAD `8d7ea0dd15434b2ff425d4c1cb7569a8e2599034`
- base funcional `df7098fe...`; preserva o UX Quick Grade anterior e consome o core A2 no caminho de nova avaliação.
- delta exclusivo sobre `391346b3...`: `assessmentAtomicPersistenceRepository.ts`, `DailyLessonAssessmentSection.tsx`, teste core, teste de consumo.
- pedido A6 publicado; suite/build literal ainda não executada neste SHA.

### 11. A4-DAILY-GIAE-AUTO-01 — copiar sumário assinala automaticamente GIAE

Regra de produto:
- clipboard conclui primeiro;
- cópia bem-sucedida da versão atual -> tick automático `Submetido no GIAE`;
- persistir `submitted` apenas para a versão realmente copiada;
- edição posterior invalida e exige nova cópia;
- clipboard fail = zero alteração;
- stale/submit fail nunca produz falso sucesso.

**HEAD A4 atual:**
- branch `agent4-g2/daily-giae-auto-0cb0bdc`
- HEAD `9c023277c2b7c954508a7cab2b058f0f12f4f9bf`
- inclui GIAE Auto no `DailyWorkspaceView`, testes de auto-submissão e o contrato explícito GIAE herdado da linha `ba87e698...`.

**Decisão A1 de composição — opção core existente:**
- A2 criou a alternativa `bfaf4e5d8dc7133019c186146eb73c5a9e081235` (`giaeDailyPersistenceRepository.savePendingVersion(...)`), mas auditoria posterior mostrou que o caminho real `dailyWorkspaceRepository.saveLesson()` já satisfaz o contrato pending-first de forma mais completa porque guarda o editor inteiro.
- No HEAD `9c02327...`, `handleCopySummary()` guarda primeiro alterações pendentes via `saveAll`; `saveLesson()` executa `updateLesson()` + eventual `submitted -> pending` na mesma transação; depois o handler relê a versão, confirma o sumário, executa clipboard e só então `markSubmitted({ expectedUpdatedAt: currentLesson.updatedAt })`.
- **A1 decide NÃO integrar `bfaf4e5...` nesta entrega.** O SHA fica congelado como experiência core alternativo não consumido; não entra apenas por organização.
- A2 classificou `9c02327...` como sem finding core bloqueante nesta leitura, mas ainda **VERIFICAÇÃO INCOMPLETA** até prova proporcional.

### 12. A4-DAILY-FINAL-SAFE — composição final Quick Grade + GIAE Auto

**ÚNICO DESENVOLVIMENTO BLOQUEANTE ATUAL: A4.**

- merge-base entre `9c023277...` e `8d7ea0dd...` = `391346b3...`.
- o delta exclusivo de `8d7ea0dd...` toca apenas 4 paths e não colide com `DailyWorkspaceView.tsx` do GIAE Auto.
- A1 autorizou: criar branch nova a partir de `9c023277...`, integrar o estado `8d7ea0dd...` por merge/cherry-pick controlado, preservar branches anteriores e entregar novo HEAD final.
- o HEAD final tem de conter simultaneamente Quick Grade atómico + GIAE Auto + contrato explícito GIAE.

Comentário operacional A1 no PR #27: `5588937439`.

## Segurança/recuperação A5

Investigação concluída sem encontrar risco atualmente alcançável de perda irrecuperável que obrigue a reabrir esta entrega. Existe caminho destrutivo demonstrado em código atualmente inativo relacionado com `CryptoSetupGate`; deve ser corrigido antes de futura montagem desse gate. Não entra silenciosamente nesta entrega.

## Ações atuais por agente

### A1 — COORDENAÇÃO / PRODUTO / WORKFLOW
1. manter âmbito/ownership fechados;
2. acompanhar `A4-DAILY-FINAL-SAFE` e impedir uso dos checkpoints bloqueados como final;
3. após HEAD final A4 + parecer A6, materializar candidato único, verificar ancestralidade/deduplicação, executar MA-Professor + Conquistador + MA-Quadro + build + smokes e entregar SHA ao A6.

### A2 — CORE / ACESSO / DADOS / PERSISTÊNCIA
- acesso `703893...` APTO e congelado;
- critérios `715ecd84...` congelado; prova real final no candidato;
- Quick Grade atomic core `abfa52e...` entregue/congelado;
- `bfaf4e5...` congelado como alternativa GIAE não consumida nesta entrega;
- sem novo write salvo finding A6 concreto.

### A3 — INTERFACE / UX / PT-PT / VISUAL
- critérios UX `c3104b...` congelado; sem desenvolvimento pendente;
- preservar PDF/Xadrez/Cores/PT-PT.

### A4 — PEDAGOGIA / AULAS / AVALIAÇÕES / GIAE — AÇÃO ATIVA BLOQUEANTE
- Quick Grade corrigido `8d7ea0dd...` entregue separadamente;
- GIAE Auto `9c023277...` entregue separadamente;
- **FAZER AGORA:** criar HEAD final único que combine estes dois estados, executar provas dirigidas e pedir revisão A6.
- parecer Excel entregue e separado desta entrega.

### A5 — SEGURANÇA DE DADOS / RECUPERAÇÃO / SNAPSHOTS
- BACKUP-ATOMIC preservado; sem blocker atual.
- smoke backup/restore no candidato.

### A6 — REVISÃO INDEPENDENTE / NÃO-REGRESSÃO / RELEASE — AÇÃO ATIVA
1. rever `8d7ea0dd...` e `9c023277...` como checkpoints;
2. não gastar gate de release em `bfaf4e5...`, que ficou fora da composição funcional;
3. quando A4 entregar `A4-DAILY-FINAL-SAFE`, rever o SHA integral sem herdar APTO automaticamente dos checkpoints;
4. critérios core+UX mantêm VERIFICAÇÃO INCOMPLETA até prova executável do candidato;
5. revisão final obrigatória do candidato combinado.

Comentário operacional A1 ao A6 no PR #24: `5588941843`.

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
- smokes: critérios multi-disciplina; override UFCD sem evidência; bloqueio real Dexie com evidência/stale; PDF/Xadrez; Daily Quick Grade; rollback/retry sem assessment órfão; cópia/tick GIAE; stale/clipboard fail/submit fail; GIAE single/bulk; backup/restore; acesso/logout/renovação;
- dados descartáveis; nenhuma informação escolar privada em comentários/fixtures públicas;
- cada prova deve corresponder ao SHA avaliado;
- build verde não substitui testes funcionais.

Fluxo final obrigatório:
`lotes finais -> candidato A1 -> testes/verificações -> A6 no SHA final -> apresentação ao utilizador -> aprovação explícita -> integração/publicação`.

## Estado de fecho neste momento

**Ainda não concluído.** Falta `A4-DAILY-FINAL-SAFE -> A6 do SHA final A4 -> candidato A1 -> testes globais -> A6 final -> aprovação explícita do utilizador`. A `main` permanece protegida em `344841c1fc402e813f9d8658d96fa20b0fefa779`.