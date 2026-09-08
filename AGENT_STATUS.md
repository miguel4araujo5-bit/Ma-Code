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

**Checkpoint A4 anterior — BLOQUEADO:**
- HEAD `391346b3c5261203ae78c343facb1a31f7196e41`.
- A6 finding `A6-DAILY-QUICK-GRADE-NR-01`: criação do assessment e gravação dos resultados não eram atómicas; uma falha intermédia podia deixar assessment vazio persistido.

**Correção CORE A2 — ENTREGUE / CONGELADA:**
- branch `agent2/quick-grade-atomic-df7098f`
- HEAD `abfa52e21b49f6b52ba2748c9d11ff6d1ab40656`
- apenas `assessmentAtomicPersistenceRepository.ts` + teste.
- contrato: `createLessonAssessmentWithResults(...)` envolve criação + resultados na mesma transação.
- provas A2: teste estrutural 3/3 PASS; compile isolada PASS; harness rollback/retry 2/2 PASS.
- pedido A6 publicado; não há APTO automático até revisão do SHA e do novo HEAD A4.

### 11. A4-DAILY-GIAE-AUTO-01 — copiar sumário assinala automaticamente GIAE

Regra de produto:
- clipboard conclui primeiro;
- cópia bem-sucedida da versão atual -> tick automático `Submetido no GIAE`;
- persistir `submitted` apenas para a versão realmente copiada;
- edição posterior invalida e exige nova cópia;
- clipboard fail = zero alteração;
- stale/submit fail nunca produz falso sucesso.

**Checkpoint A4 preservado mas NÃO integrável:**
- branch `agent4-g2/daily-giae-auto-0cb0bdc`
- HEAD `885988c1c47fc90b3231ffc36f6644d8b78d0654`
- contém o comportamento GIAE Auto, mas descende do Quick Grade bloqueado `391346b3...`; A6 determinou que não pode entrar no candidato neste estado.

**Correção CORE A2 pending-first — ENTREGUE / CONGELADA:**
- branch `agent2/giae-daily-pending-core-f314a8b`
- HEAD `bfaf4e5d8dc7133019c186146eb73c5a9e081235`
- apenas `giaeDailyPersistenceRepository.ts` + teste.
- `savePendingVersion(...)` usa `expectedUpdatedAt`, guarda a versão e garante `pending`; nunca marca submitted por si; a submissão posterior usa `giaeExplicitSubmissionRepository.markSubmitted(...)` com a versão persistida.
- provas A2: estrutural 3/3 PASS; compile isolada PASS; harness GIAE 4/4 PASS, incluindo stale zero-write e rollback se pending falhar.
- pedido A6 publicado.

### 12. A4-DAILY-FINAL-SAFE — recomposição final Quick Grade + GIAE Auto

**AÇÃO BLOQUEANTE ATUAL: A4.**

A1 autorizou recomposição controlada, sem apagar/mover checkpoints anteriores:
- criar branch nova a partir de `885988c1c47fc90b3231ffc36f6644d8b78d0654`;
- consumir os dois commits core A2 exatos `abfa52e21b49f6b52ba2748c9d11ff6d1ab40656` e `bfaf4e5d8dc7133019c186146eb73c5a9e081235` como deltas, evitando merge histórico das branches A2;
- Quick Grade novo: usar `assessmentAtomicPersistenceRepository.createLessonAssessmentWithResults(...)` no percurso de criação;
- GIAE Auto: usar `giaeDailyPersistenceRepository.savePendingVersion(...)` antes da submissão explícita e só marcar submitted se a autorização de cópia continuar válida para a versão persistida;
- entregar HEAD final + delta + provas dirigidas + pedido A6.

Comentário operacional A1 no PR #27: `5588864896`.

## Segurança/recuperação A5

Investigação concluída sem encontrar risco atualmente alcançável de perda irrecuperável que obrigue a reabrir esta entrega. Existe caminho destrutivo demonstrado em código atualmente inativo relacionado com `CryptoSetupGate`; deve ser corrigido antes de futura montagem desse gate. Não entra silenciosamente nesta entrega.

## Ações atuais por agente

### A1 — COORDENAÇÃO / PRODUTO / WORKFLOW
1. manter âmbito/ownership fechados;
2. acompanhar a recomposição A4 final e impedir reutilização de HEADs bloqueados como candidato;
3. após HEAD final A4 + parecer A6, materializar candidato único, verificar ancestralidade/deduplicação, executar MA-Professor + Conquistador + MA-Quadro + build + smokes e entregar SHA ao A6.

### A2 — CORE / ACESSO / DADOS / PERSISTÊNCIA
- acesso `703893...` APTO e congelado;
- critérios `715ecd84...` congelado; prova real final no candidato;
- Quick Grade atomic core `abfa52e...` entregue/congelado;
- GIAE pending core `bfaf4e5d...` entregue/congelado;
- sem novo write salvo finding A6 concreto; responder a questões técnicas da revisão.

### A3 — INTERFACE / UX / PT-PT / VISUAL
- critérios UX `c3104b...` congelado; sem desenvolvimento pendente;
- preservar PDF/Xadrez/Cores/PT-PT.

### A4 — PEDAGOGIA / AULAS / AVALIAÇÕES / GIAE — AÇÃO ATIVA BLOQUEANTE
- checkpoints `391346b3...` e `885988c1...` preservados, mas NÃO elegíveis como final;
- **FAZER AGORA:** criar `A4-DAILY-FINAL-SAFE`, consumir `abfa52e...` + `bfaf4e5d...`, corrigir Quick Grade e pending-first GIAE Auto, executar provas e pedir revisão A6.
- parecer Excel entregue e separado desta entrega.

### A5 — SEGURANÇA DE DADOS / RECUPERAÇÃO / SNAPSHOTS
- BACKUP-ATOMIC preservado; sem blocker atual.
- smoke backup/restore no candidato.

### A6 — REVISÃO INDEPENDENTE / NÃO-REGRESSÃO / RELEASE — AÇÃO ATIVA
1. rever core A2 `abfa52e21b49f6b52ba2748c9d11ff6d1ab40656` e `bfaf4e5d8dc7133019c186146eb73c5a9e081235`;
2. critérios core+UX mantêm VERIFICAÇÃO INCOMPLETA até prova executável do candidato;
3. quando A4 entregar `A4-DAILY-FINAL-SAFE`, rever o SHA integral sem herdar APTO automaticamente dos cores;
4. revisão final obrigatória do candidato combinado.

Comentário operacional A1 ao A6 no PR #24: `5588867966`.

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

**Ainda não concluído.** O desenvolvimento core necessário já foi entregue. Falta agora `A4-DAILY-FINAL-SAFE -> A6 do SHA final A4 -> candidato A1 -> testes globais -> A6 final -> aprovação explícita do utilizador`. A `main` permanece protegida em `344841c1fc402e813f9d8658d96fa20b0fefa779`.