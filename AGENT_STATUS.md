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
- **Aceleração operacional em vigor:** não criar micro-gates A3/A6 para sobreposições mecânicas ou checkpoints já destinados ao candidato. O A1 resolve sobreposições de integração; o A6 concentra o gate no SHA candidato final, salvo finding novo que exija revisão antecipada.

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

3. **A3 Horário/Xadrez — base preservada**
   - HEAD base `800d91198d7f1b2c2193ebdd89a78425ceb8effd`
   - smoke A3 6/6; A6 **APTO**.
   - Para o candidato, o estado deste lote nos paths do importador é agora **substituído** pelo lote A1 `A1-SCHEDULE-DUTY-COMPLETE-01` HEAD `891a95270efe2b097c462e48b99220f939a1215f`, que parte exatamente de `800d911...` e preserva a correção de geometria/Xadrez.

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

**Correção A4 consumida no final seguro:**
- checkpoint `8d7ea0dd15434b2ff425d4c1cb7569a8e2599034`
- o estado final a integrar é `A4-DAILY-FINAL-SAFE` `1189b340f9a11ff1ce6910a7777da99fa7a0846b`.

### 11. A4-DAILY-GIAE-AUTO-01 — copiar sumário assinala automaticamente GIAE

Regra de produto:
- clipboard conclui primeiro;
- cópia bem-sucedida da versão atual -> tick automático `Submetido no GIAE`;
- persistir `submitted` apenas para a versão realmente copiada;
- edição posterior invalida e exige nova cópia;
- clipboard fail = zero alteração;
- stale/submit fail nunca produz falso sucesso.

Checkpoint `9c023277c2b7c954508a7cab2b058f0f12f4f9bf`; estado final consumido por `A4-DAILY-FINAL-SAFE` abaixo.

Decisão A1: a alternativa core A2 `bfaf4e5d8dc7133019c186146eb73c5a9e081235` não entra nesta entrega; o caminho real `dailyWorkspaceRepository.saveLesson()` já satisfaz o pending-first guardando o editor inteiro antes de copiar/submeter.

### 12. A4-DAILY-FINAL-SAFE — Quick Grade atómico + GIAE Auto

- branch `agent4-g2/daily-final-safe-9c02327`
- HEAD **`1189b340f9a11ff1ce6910a7777da99fa7a0846b`**
- parent `9c023277c2b7c954508a7cab2b058f0f12f4f9bf`.
- A1 confirmou que o avanço parent→HEAD é 1 commit / 4 paths e apenas a correção atómica Quick Grade; GIAE Auto do parent permanece.
- leitura A1 confirmou: nova avaliação usa `createLessonAssessmentWithResults(...)`; avaliação existente não cria duplicado; GIAE guarda/relê a versão atual, copia primeiro e submete apenas com `expectedUpdatedAt` correspondente.
- Não há CI específico deste SHA; por decisão de aceleração, não se cria PR/push apenas para CI e o gate A6 concentra-se no candidato combinado.

### 13. A1-SCHEDULE-DUTY-COMPLETE-01 — cargos completos + correção manual do preview

Novo pedido explícito/bloqueante do utilizador após observar o PDF real de horário.

PDF real esperado na quinta-feira:
- `Eq Pedag` — 09:25–10:15;
- `Co PCE` — 10:30–11:20;
- `Clube Xadrez` — 13:20–14:10.

Bug observado: preview mostrava apenas `Eq Pedag` e `Clube Xadrez`; `Co PCE` era perdido porque a geometria removia a coluna `SP` e `extractDutyName()` ficava dependente de uma lista rígida.

Correção A1, com agentes em pausa por decisão do utilizador:
- branch `agent1/schedule-duty-complete-800d911`
- base `800d91198d7f1b2c2193ebdd89a78425ceb8effd`
- HEAD **`891a95270efe2b097c462e48b99220f939a1215f`**
- paths: `SchedulePdfImportStep.tsx` + `schedule-pdf-duty-completeness.test.mjs`.
- compare base→HEAD: 2 commits / 2 paths; componente +108/-3, teste +76.
- parser aceita `Co PCE` e outros nomes multi-palavra válidos sem depender do marcador removido; rejeita ruído de sala/marcador e siglas letivas isoladas.
- preview passa a mostrar **`+ Adicionar aula / hora`** e **`+ Adicionar cargo`**, permitindo completar manualmente blocos em falta antes da confirmação.
- harness A1 isolado do parser: **11/11 PASS** (`Eq Pedag`, `Co PCE`, `Clube Xadrez`, `Co PCE SP`, e rejeição de `SP`, `REO`, `A2.14`, `Aud2`, `AS`, `AEXP`, turma).
- teste de regressão adicionado; suite/build literal ainda não executados neste SHA e ficam para candidato.
- comentário operacional no PR #23: `5590224977`.

## Segurança/recuperação A5

Investigação concluída sem encontrar risco atualmente alcançável de perda irrecuperável que obrigue a reabrir esta entrega. Existe caminho destrutivo demonstrado em código atualmente inativo relacionado com `CryptoSetupGate`; deve ser corrigido antes de futura montagem desse gate. Não entra silenciosamente nesta entrega.

## Ações atuais por agente

### A1 — COORDENAÇÃO / PRODUTO / WORKFLOW — AÇÃO ATIVA
1. compor agora o candidato único partindo de `main` `344841c...` sem merges históricos duplicados;
2. usar `891a9527...` como estado final do importador de horário/Xadrez/cargos;
3. integrar `1189b340...`, critérios `c3104b...` + guard `715ecd84...`, acesso, PDF planificações, cores/PT-PT, backup e CI isolation, resolvendo sobreposições mecanicamente;
4. executar testes MA-Professor + Conquistador + MA-Quadro + build + smokes dirigidos;
5. entregar o SHA candidato exato ao A6 para **uma revisão final única**.

### A2 — CORE / ACESSO / DADOS / PERSISTÊNCIA
- lotes desta entrega congelados; sem nova ação enquanto não houver finding concreto no candidato.

### A3 — INTERFACE / UX / PT-PT / VISUAL
- lotes desta entrega congelados; sem nova ação enquanto não houver finding concreto no candidato.
- a correção A1 `891a9527...` substitui apenas o estado final dos paths de importação do horário; não reescreve o histórico A3.

### A4 — PEDAGOGIA / AULAS / AVALIAÇÕES / GIAE
- final seguro `1189b340...` congelado; sem nova ação enquanto não houver finding concreto no candidato.

### A5 — SEGURANÇA DE DADOS / RECUPERAÇÃO / SNAPSHOTS
- BACKUP-ATOMIC preservado; smoke backup/restore no candidato.

### A6 — REVISÃO INDEPENDENTE / NÃO-REGRESSÃO / RELEASE
- não gastar novo gate em checkpoints intermédios sem finding concreto;
- próxima ação útil: revisão independente do **SHA candidato final A1** depois das provas globais.

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
- smokes: critérios multi-disciplina; override UFCD sem evidência; bloqueio real Dexie com evidência/stale; PDF planificações; horário real com `Eq Pedag` + `Co PCE` + `Clube Xadrez`; adição manual de aula/hora e cargo no preview; Daily Quick Grade; rollback/retry sem assessment órfão; cópia/tick GIAE; stale/clipboard fail/submit fail; GIAE single/bulk; backup/restore; acesso/logout/renovação;
- dados descartáveis; nenhuma informação escolar privada em comentários/fixtures públicas;
- cada prova deve corresponder ao SHA avaliado;
- build verde não substitui testes funcionais.

Fluxo final obrigatório:
`lotes finais -> candidato A1 -> testes/verificações -> A6 no SHA final -> apresentação ao utilizador -> aprovação explícita -> integração/publicação`.

## Estado de fecho neste momento

**Desenvolvimento funcional desta entrega está fechado nos SHAs acima, incluindo o novo bug de cargos.** Falta apenas `candidato A1 -> testes globais/smokes -> A6 final -> apresentação -> aprovação explícita do utilizador`. A `main` permanece protegida em `344841c1fc402e813f9d8658d96fa20b0fefa779`.
