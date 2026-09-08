# MA-CODE — Estado operacional único dos agentes

Atualizado por: AGENTE 1 — SEGUNDA GERAÇÃO (A1-G2)
Data: 2026-09-08
Fonte técnica: `main` confirmada em `344841c1fc402e813f9d8658d96fa20b0fefa779`.

## Regra de coordenação em vigor

Este ficheiro é o **único resumo operacional** dos seis agentes.

- `AGENT_MESSAGES.md` fica preservado como histórico append-only e é o canal para comunicações curtas entre agentes; não apagar nem reescrever mensagens.
- PRs/tarefas mantêm discussão técnica, evidência, SHAs, findings e pedidos de revisão.
- `A1_BLOCKER_BOARD.md` fica preservado, mas está **SUBSTITUÍDO por este ficheiro**.
- Só o A1 edita ficheiros centrais de coordenação.
- Uma mensagem publicada não prova leitura nem acorda uma conversa parada; cada agente deve reler respostas no início da sua execução.
- Trabalho em branches/checkouts próprios continua livre dentro do âmbito e ownership atuais.
- **Nenhuma tarefa nova conta como concluída sem SHA exato, provas proporcionais e pedido explícito de revisão.** Para tarefas sem alteração funcional de código, o SHA é o commit/documento que fixa o resultado e a evidência.
- Nenhum merge/publicação em `main` sem provas do candidato, revisão independente A6 no SHA exato e aprovação explícita do utilizador.
- Este realinhamento **não reinicia trabalho, não invalida SHAs já aprovados e não autoriza reabrir lotes apenas por organização**.

## Papéis principais — realinhamento operacional

### A1 — coordenação, produto e workflow
- fechar âmbito e prioridades de produto;
- definir contratos funcionais e critérios de aceitação;
- manter `AGENT_STATUS.md`, manifesto de ownership e dependências;
- coordenar branches, integração, candidato, testes e gates;
- resolver conflitos de ownership e sobreposições;
- não absorver trabalho de core/persistência que pertença ao A2, salvo integração mecânica ou contrato de produto.

### A2 — core, acesso, dados e persistência
- acesso, sessão, ativação, licença e renovação;
- repositórios centrais, contratos de persistência, atomicidade, concorrência, dados e invariantes;
- implementar guards/core partilhado quando necessário, preservando compatibilidade e dados existentes;
- qualquer alteração central deve ter testes de integridade/rollback/stale proporcionais.

### A3 — interface, UX, PT-PT e visual
- componentes de interface e percursos de utilização;
- clareza, simplicidade, acessibilidade, feedback visual e PT-PT;
- setup visual, import UX e apresentação dos contratos fornecidos pelo core;
- não inventar persistência paralela nem alterar core quando houver API/ownership A2.

### A4 — pedagogia, aulas, avaliações e GIAE
- regras pedagógicas e semântica das avaliações;
- Daily, aulas, assiduidade, avaliação rápida, critérios na perspetiva pedagógica e GIAE;
- definir/validar comportamento pedagógico, mas escalar persistência/core partilhado ao A2 e produto/âmbito ao A1.

### A5 — segurança de dados, recuperação e snapshots
- backups, snapshots, cifragem, recuperação e preservação de dados;
- reproduzir riscos com dados descartáveis e classificar impacto;
- qualquer risco atual de perda irrecuperável de dados/chaves é escalado imediatamente ao A1.

### A6 — revisão independente, não-regressão e release
- revisão independente por SHA exato;
- verificar não-regressão em MA-Professor, Conquistador, MA-Quadro e componentes globais afetados;
- classificar APTO / BLOQUEADO / VERIFICAÇÃO INCOMPLETA com provas e limitações;
- gate técnico de release; não altera código funcional nem assume integração.

## ÂMBITO DEFINITIVO — entrega atual MA-Professor

O âmbito está fechado. Novas melhorias passam para a entrega seguinte, salvo erro bloqueante, risco confirmado de perda de dados ou novo pedido explícito do utilizador com decisão de âmbito registada pelo A1.

### Lotes congelados/elegíveis já existentes

1. **A2-NR-01 — acesso/sessão/logout/renovação**
   - branch `agent2-g2/access-session-contract-7ec8904`
   - HEAD `7038930471c80753b40ffde91eb023fc050f0030`
   - Build Check #1649 SUCCESS; A6 **APTO**.

2. **A3 PDF planificações**
   - HEAD `e4df193d78c5d9523cf7803af30241ab92e8ec6b`
   - A6 **APTO**; smokes reais ficam para candidato.

3. **A3 Horário/Xadrez**
   - HEAD `800d91198d7f1b2c2193ebdd89a78425ceb8effd`
   - smoke A3 6/6; A6 **APTO**.

4. **A3 Cores + PT-PT — estado efetivo para composição**
   - Cores HEAD `64e3149336c6097c9777a8feb38209f9bfb37be9`.
   - PT-PT isolado HEAD `b0e2928a0e80306503a38787f4a46a8acea7fee1`, A6 APTO.
   - sobreposição resolvida mecanicamente pelo A3:
     - branch temporária `agent3-g2/setup-colors-ptpt-overlap-64e3149`
     - HEAD `ad4ff49b471bfae487da7ab72b95134d894f9e37`
     - blob final `SetupConfirmationStep.tsx`: `7281fea873e0d3766d3531ff438995dd5e9eefb2`
     - prova BASE→HEAD: apenas 1 ficheiro, 2 adições + 2 remoções.
   - o candidato consome o estado visual de Cores + este blob; não integra a branch temporária como história.

5. **A4-DAILY-NR-01 — proteção da primeira avaliação concorrente**
   - HEAD `df7098fe510aa79fc72bde035053389045a8d117`
   - CI #1645 SUCCESS; A6 **APTO**.
   - PR #29 já contém a cadeia histórica relevante; não integrar PR #17 separadamente.

6. **A4-GIAE-NR-02 — submissão explícita segura**
   - branch canónica `agent4-g2/giae-explicit-resubmit-f314a8b`
   - HEAD `ba87e69873a0277a63e84b98bf539038aba0151f`
   - contém o contrato A1 `f314a8b...`; não integrar PR #22/contrato separadamente.
   - prova local 9/9 PASS; A6 sem finding bloqueante de código; suite/build/E2E final no candidato.

7. **A5 BACKUP-ATOMIC**
   - HEAD `94fd528ac0a38d4eca7b56a83cd160a0616a84df`
   - A6 **APTO**; rollback Dexie real anteriormente reportado 2/2.

8. **CI-ISOLATION**
   - HEAD `745dab64e2355b1e14a36687d60a21e77b6e0f34`
   - A6 **APTO**.

### Novos lotes incluídos nesta entrega

9. **CRITERIA-SIMPLE-01 — critérios simples por disciplina**
   - caso normal: `definir critérios -> aplicar a uma ou várias associações turma+disciplina -> todas as UFCD herdam`.
   - `Personalizar uma UFCD` fica como exceção secundária `scope: module`.
   - contrato funcional/produto: `A1_CRITERIA_SIMPLE_FLOW_20260908.md`, owner A1.
   - batch geral multi-associação já produzido: branch `agent1/criteria-batch-344841c`, HEAD `2bfc028dc4ff4b93bc2a0350a7a51e54ebc43d80`; este SHA é preservado, não refeito.
   - delta existente: apenas `src/components/ma-professor/assessmentCriteriaBatchRepository.ts` + `tests/ma-professor/assessment-criteria-batch-contract.test.mjs`.
   - garante pré-validação total, revalidação transacional e all-or-nothing para múltiplas associações; rejeita seleção repetida ou associação que já tenha scheme geral ativo.

   **Finding funcional A4 aceite pelo A1:** mudar o scheme efetivo de uma UFCD depois de já existir evidência avaliativa pode tornar avaliações históricas invisíveis/ilegíveis no workspace final, porque `buildActivityRows()`/`buildStudentRows()` usam apenas os critérios do scheme atualmente efetivo.

   **DECISÃO A1 DE PRODUTO/PRESERVAÇÃO:**
   - `scope: module` pode ser criado livremente enquanto a UFCD ainda não tiver evidência avaliativa persistida;
   - se já existir qualquer avaliação/resultado/classificação final nessa UFCD, a troca de scheme fica **BLOQUEADA nesta entrega**;
   - zero migração/remapeamento silencioso; dados históricos ficam intactos;
   - versionamento/migração de critérios com evidência será lote próprio futuro;
   - a mesma proteção será exigida a qualquer futura remoção/desativação de override com evidência.

   **A2 ação atual — CORE/PERSISTÊNCIA:** preservar `2bfc028d...` e assumir a continuação técnica do contrato: implementar o guard central/transacional de evidência e qualquer API partilhada necessária. Não reescrever o batch existente apenas por ownership.
   **A3 ação atual — UX:** implementar o fluxo visual sobre o contrato core; não usar persistência paralela nem concluir `Personalizar uma UFCD` pelo API antigo sem o guard A2.
   **A4:** revisão pedagógica deste ponto concluída; disponível para validar semântica, sem escrever core.
   **A6:** rever o HEAD core A2 + HEAD UX A3 por SHA exato.

10. **A4-DAILY-QUICK-GRADE-01 — avaliação rápida por aula**
    - pedido explícito do utilizador.
    - objetivo: abrir aula e escrever diretamente `0–20` junto ao aluno; nota válida implica `evaluated`; detalhes avançados ficam recolhidos; zero avaliação vazia; preservar concorrência e unsaved-work protection.
    - A4 já entregou checkpoint pré-implementação confirmando que o bloqueio UX está concentrado em `DailyLessonAssessmentSection.tsx` no HEAD Daily APTO.
    - **A4 ação atual:** implementar em branch própria baseada em `df7098fe...`, apenas `daily/**`/`assessments/**` + testes; qualquer necessidade de core/persistência central é escalada ao A2 e qualquer decisão de produto ao A1.
    - entra obrigatoriamente no candidato desta entrega.

11. **A4-DAILY-GIAE-AUTO-01 — copiar sumário assinala automaticamente GIAE**
    - pedido explícito do utilizador; restaura comportamento removido em `5ecaa5619e3147902115e8f6880ca78fa327b2a2`.
    - regra correta: clipboard bem-sucedido da versão atual -> tick automático; persistir `submitted` apenas se a versão guardada corresponder à versão copiada; alteração posterior invalida e exige nova cópia; falha de clipboard = zero mudança; nunca falso tick.
    - a asserção Daily do teste `giae-copy-does-not-submit.test.mjs` fica superada por este contrato; cobertura de stale/invalidation mantém-se obrigatória.
    - **A4 ação atual:** diagnosticar/implementar em lote separado/coordenado com Quick Grade, sem tocar nos HEADs GIAE/Daily congelados; se precisar de core/persistência partilhado, pedir ao A2; se houver ambiguidade de produto, pedir decisão A1.
    - entra obrigatoriamente no candidato desta entrega.

### Fora do âmbito atual

- Follow-up PT-PT mais amplo sugerido no comentário A4 `5586314005`: **NÃO ENTRA**; o lote PT-PT aprovado não é reaberto apenas para melhoria adicional.
- Excel final UFCD/módulo: planeamento/análise apenas, **não entra**.
- acesso à gestão de alunos sem concluir planificações: próxima entrega.
- utilização das planificações na preparação dos sumários: próxima entrega.
- hardening de cifragem/recuperação: investigação de risco em paralelo; não entra silenciosamente, salvo confirmação de risco atual de perda de dados e decisão A1 específica.

## Ações atuais por agente

### A1 — COORDENAÇÃO / PRODUTO / WORKFLOW

1. manter fechados âmbito, critérios de aceitação e ownership;
2. preservar o batch `2bfc028d...` e entregar a continuação de core/persistência ao A2 sem reescrever trabalho;
3. aceitar/preservar o blob A3 Cores+PT-PT `7281fea...`;
4. resolver decisões de produto/integração que A2/A3/A4 escalem;
5. após HEADs finais A2/A3/A4: materializar candidato, verificar ancestralidade/deduplicação, executar MA-Professor + Conquistador + MA-Quadro + build + smokes e entregar SHA ao A6.

### A2 — CORE / ACESSO / DADOS / PERSISTÊNCIA — AÇÃO ATIVA

- preservar o lote de acesso APTO `7038930471...`.
- assumir `CRITERIA-SIMPLE-01` no core a partir do trabalho existente `2bfc028d...`: implementar guard transacional que bloqueia mudança/override de scheme quando a UFCD já tem evidência avaliativa persistida; não migrar/remapear silenciosamente.
- publicar HEAD exato, provas de zero-write/atomicidade/stale e pedido de revisão A6.
- no candidato, verificar acesso, sessão, logout, ativação, renovação e invariantes de persistência com dados descartáveis.

### A3 — INTERFACE / UX / PT-PT / VISUAL — AÇÃO ATIVA

- micro-overlap Cores+PT-PT: **concluído**, HEAD `ad4ff49b...`, blob `7281fea...`.
- implementar UX de `CRITERIA-SIMPLE-01` consumindo o contrato A2; sem persistência paralela.
- percurso normal: critérios -> selecionar uma/várias turma+disciplina -> todas as UFCD herdam; personalização por UFCD fica avançada e respeita o guard core.
- preservar PDF, Xadrez, Cores e PT-PT congelados.
- entregar HEAD exato + provas UX/unsaved/PT-PT + pedido de revisão A6.

### A4 — PEDAGOGIA / AULAS / AVALIAÇÕES / GIAE — AÇÃO ATIVA

- revisão pedagógica dos critérios: resultado entregue; finding de evidência histórica aceite pelo A1.
- implementar `A4-DAILY-QUICK-GRADE-01` em branch própria.
- diagnosticar/implementar `A4-DAILY-GIAE-AUTO-01` com contrato seguro; não restaurar apenas estado React.
- core/persistência partilhado -> A2; decisão de produto -> A1.
- parecer Excel permanece separado e não bloqueante para esta entrega.
- preservar `df7098...` e `ba87e698...` congelados.
- cada lote funcional só fecha com HEAD, provas e pedido de revisão A6.

### A5 — SEGURANÇA DE DADOS / RECUPERAÇÃO / SNAPSHOTS — AÇÃO DE RISCO EM PARALELO

- preservar BACKUP-ATOMIC.
- reproduzir com dados descartáveis os riscos já registados de cifragem/recuperação sem corrigir ainda: `CryptoSetupGate` não montado, remoção de material crypto local antes de nova proteção, possível corrida de recuperação/troca de conta.
- classificar cada ponto como PROVADO / NÃO REPRODUZIDO / INFERIDO e impacto real. Se houver risco atual confirmado de perda irrecuperável/acesso a dados, escalar imediatamente ao A1 para decisão de âmbito.
- no candidato, verificar exportar/restaurar/reabrir com dados descartáveis.
- qualquer correção futura exige branch própria, SHA, provas e revisão A6.

### A6 — REVISÃO INDEPENDENTE / NÃO-REGRESSÃO / RELEASE

- rever o próximo HEAD core A2 de critérios e o HEAD UX A3 por SHA exato.
- rever Quick Grade + GIAE Auto nos SHAs exatos quando entregues.
- revisão final obrigatória do candidato combinado: MA-Professor, Conquistador, MA-Quadro e componentes globais afetados.
- exigir SHA + provas + pedido de revisão; não considerar tarefa nova encerrada sem estes elementos.
- não alterar código funcional nem assumir integração/publicação.

## Fila seguinte visível — não entra silenciosamente nesta entrega

### NEXT-STUDENTS-NAV-01 — acesso à gestão de alunos sem concluir planificações
- A1 produto/workflow; A3 UX; A2 core/persistência se necessário.
- conclusão: professor consegue aceder/gerir alunos sem marcar falsamente planificações como concluídas; rascunhos/unsaved protection preservados; nenhuma perda de setup.

### NEXT-PLANIFICATION-DAILY-01 — planificações na preparação de sumários
- A1 produto/contrato; A3 UX/fonte de planificação; A4 pedagogia/Daily; A2 core se houver persistência partilhada.
- conclusão: Daily apresenta itens/sumários sugeridos apenas da UFCD correta, permite inserir/editar sem write antecipado, marca utilização apenas ao guardar e reabre de forma coerente; zero cross-UFCD silencioso.

### NEXT-EXCEL-FINAL-01 — Excel de avaliação final UFCD/módulo
- A1 produto/workflow; A2 dados/persistência; A3 UX/mapeamento; A4 regras pedagógicas/cálculo; A5 privacidade/preservação; A6 revisão.
- A3 UX/mapeamento e A5 privacidade já contribuíram; A4 ainda deve entregar parecer funcional `assessments/**`.
- original `.xlsx` nunca alterado; output é cópia; dados estruturados continuam fonte de verdade.

### NEXT-CRITERIA-VERSIONING-01 — alteração de critérios com evidência histórica
- A1 produto/contrato; A2 core/persistência; A3 UX; A4 semântica pedagógica; A6 valida.
- objetivo: permitir mudar critérios depois de existirem avaliações sem perder/ocultar evidência, com versionamento ou migração explícita e atómica.
- fora da entrega atual; até lá, mudança é bloqueada quando existe evidência.

### NEXT-CRYPTO-RECOVERY-01 — cifragem e recuperação
- A5 owner de segurança/recuperação; A2 participa quando tocar core/persistência; A1 decide âmbito/produto; A6 verifica qualquer correção.
- conclusão da investigação: reproduções com dados descartáveis, gatilhos exatos, impacto e classificação PROVADO/INFERIDO. Qualquer perda de chave/dados atualmente alcançável é escalada imediatamente e pode reabrir o âmbito por decisão A1.

## Validação obrigatória do candidato

- testes MA-Professor;
- testes Conquistador;
- testes MA-Quadro;
- build completo;
- testes específicos dos lotes novos;
- smokes funcionais proporcionais: setup/critério multi-disciplina, override UFCD sem evidência, bloqueio de override com evidência, PDF/Xadrez, Daily quick-grade, sumário/cópia GIAE, GIAE single/bulk/stale, backup/restore, acesso/logout/renovação;
- dados descartáveis; nenhuma informação escolar privada em comentários/fixtures públicas;
- cada prova automatizada deve corresponder ao SHA avaliado;
- build verde não prova publicação correta.

Fluxo final obrigatório:
`lotes finais -> candidato A1 -> testes/verificações -> A6 no SHA final -> apresentação ao utilizador -> aprovação explícita -> integração/publicação`.