# MA-CODE — Estado operacional único dos agentes

Atualizado por: AGENTE 1 — SEGUNDA GERAÇÃO (A1-G2)
Data: 2026-09-08
Fonte técnica: `main` confirmada em `344841c1fc402e813f9d8658d96fa20b0fefa779`.

## Regra de coordenação em vigor

Este ficheiro é o **único resumo operacional** dos seis agentes.

- `AGENT_MESSAGES.md` fica preservado como histórico append-only; não apagar nem reescrever mensagens.
- `A1_BLOCKER_BOARD.md` fica preservado, mas está **SUBSTITUÍDO por este ficheiro** a partir desta atualização.
- Mensagens operacionais são publicadas no PR/tarefa correspondente.
- Só o A1 edita ficheiros centrais de coordenação.
- Uma mensagem publicada não prova leitura nem acorda uma conversa parada; cada agente deve reler respostas no início da sua execução.
- Nenhum merge/publicação em `main` sem candidato final, parecer A6 no SHA exato e aprovação explícita do utilizador.

## ÂMBITO DEFINITIVO — entrega atual MA-Professor

O âmbito fica fechado nesta atualização. Novas melhorias passam para a entrega seguinte, salvo erro bloqueante, risco confirmado de perda de dados ou novo pedido explícito do utilizador com decisão de âmbito registada pelo A1.

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

### Novos lotes explicitamente incluídos antes deste fecho

9. **CRITERIA-SIMPLE-01 — critérios simples por disciplina**
   - caso normal: `definir critérios -> aplicar a uma ou várias associações turma+disciplina -> todas as UFCD herdam`.
   - `Personalizar uma UFCD` fica como exceção secundária `scope: module`.
   - contrato A1 fechado em `A1_CRITERIA_SIMPLE_FLOW_20260908.md`.
   - contrato atómico A1 implementado na branch `agent1/criteria-batch-344841c`, HEAD `2bfc028dc4ff4b93bc2a0350a7a51e54ebc43d80`.
   - delta A1: apenas `src/components/ma-professor/assessmentCriteriaBatchRepository.ts` + `tests/ma-professor/assessment-criteria-batch-contract.test.mjs`.
   - garante pré-validação total, revalidação transacional e all-or-nothing para múltiplas associações; rejeita associação repetida ou associação que já tenha scheme geral ativo.
   - **A3 ação atual:** implementar UX em branch baseada exatamente em `2bfc028d...`, apenas `setup/**` + testes A3; não alterar o contrato A1.
   - **A4 ação atual:** parecer funcional `subject` geral + `module` override; sem código.
   - **A6:** rever o novo lote no SHA A3 final e depois no candidato.

10. **A4-DAILY-QUICK-GRADE-01 — avaliação rápida por aula**
    - pedido explícito do utilizador.
    - objetivo: abrir aula e escrever diretamente `0–20` junto ao aluno; nota válida implica `evaluated`; detalhes avançados ficam recolhidos; zero avaliação vazia; preservar concorrência e unsaved-work protection.
    - **A4 ação atual:** diagnóstico mínimo + branch separada baseada no HEAD Daily APTO `df7098fe...`, depois implementação em `daily/**`/`assessments/**` + testes; pedir contrato A1 se precisar de ficheiro central.
    - entra obrigatoriamente no candidato desta entrega.

11. **A4-DAILY-GIAE-AUTO-01 — copiar sumário assinala automaticamente GIAE**
    - pedido explícito do utilizador; restaura comportamento removido em `5ecaa5619e3147902115e8f6880ca78fa327b2a2`.
    - regra correta: clipboard bem-sucedido da versão atual -> tick automático; persistir `submitted` apenas se a versão guardada corresponder à versão copiada; alteração posterior invalida e exige nova cópia; falha de clipboard = zero mudança; nunca falso tick.
    - a asserção Daily do teste `giae-copy-does-not-submit.test.mjs` fica superada por este contrato; cobertura de stale/invalidation mantém-se obrigatória.
    - **A4 ação atual:** diagnosticar o caminho mínimo em conjunto com Quick Grade, sem tocar no HEAD GIAE congelado; se precisar do contrato partilhado A1, pedir base/integração ao A1 antes de escrever.
    - entra obrigatoriamente no candidato desta entrega.

### Fora do âmbito atual

- Follow-up PT-PT mais amplo sugerido no comentário A4 `5586314005`: **NÃO ENTRA**; o lote PT-PT aprovado não é reaberto apenas para melhoria adicional.
- Excel final UFCD/módulo: planeamento/análise apenas, **não entra**.
- acesso à gestão de alunos sem concluir planificações: próxima entrega.
- utilização das planificações na preparação dos sumários: próxima entrega.
- hardening de cifragem/recuperação: investigação de risco em paralelo; não entra silenciosamente, salvo confirmação de risco atual de perda de dados e decisão A1 específica.

## Ações atuais por agente

### A1 — FAZER AGORA

- contrato batch de critérios: **implementado** em `2bfc028dc4ff4b93bc2a0350a7a51e54ebc43d80`; aguarda revisão/consumo A3.
- aceitar e preservar o blob A3 Cores+PT-PT `7281fea...`.
- manter manifesto de ficheiros e preparar candidato apenas quando A3/A4 entregarem os novos lotes.
- resolver qualquer dependência partilhada para GIAE-auto sem reintroduzir falso sucesso.
- após HEADs finais: materializar candidato, verificar ancestralidade/deduplicação, executar MA-Professor + Conquistador + MA-Quadro + build + smokes e entregar SHA ao A6.

### A2

- lote congelado. Próxima ação apenas quando existir SHA candidato: verificar acesso, sessão, logout, ativação e renovação com dados descartáveis.

### A3 — AÇÃO ATIVA

- micro-overlap Cores+PT-PT: **concluído**, HEAD `ad4ff49b...`, blob `7281fea...`.
- agora implementar `CRITERIA-SIMPLE-01` sobre base A1 `2bfc028d...`.
- preservar PDF, Xadrez, Cores e PT-PT congelados.

### A4 — AÇÃO ATIVA

- responder ao parecer funcional de critérios.
- implementar `A4-DAILY-QUICK-GRADE-01` em branch própria.
- diagnosticar/implementar `A4-DAILY-GIAE-AUTO-01` com contrato seguro; não restaurar apenas estado React.
- parecer Excel permanece separado e não bloqueante para esta entrega.
- preservar `df7098...` e `ba87e698...` congelados.

### A5 — AÇÃO DE RISCO EM PARALELO

- preservar BACKUP-ATOMIC.
- reproduzir com dados descartáveis os riscos já registados de cifragem/recuperação sem corrigir ainda: `CryptoSetupGate` não montado, remoção de material crypto local antes de nova proteção, possível corrida de recuperação/troca de conta.
- classificar cada ponto como PROVADO / NÃO REPRODUZIDO / INFERIDO e impacto real. Se houver risco atual confirmado de perda irrecuperável/acesso a dados, escalar imediatamente ao A1 para decisão de âmbito.
- no candidato, verificar exportar/restaurar/reabrir com dados descartáveis.

### A6

- revisão independente do novo lote de critérios no SHA final A3.
- depois rever Quick Grade + GIAE Auto nos SHAs exatos quando entregues.
- revisão final obrigatória do candidato combinado: MA-Professor, Conquistador, MA-Quadro e componentes globais afetados.
- não alterar código funcional.

## Fila seguinte visível — não entra silenciosamente nesta entrega

### NEXT-STUDENTS-NAV-01 — acesso à gestão de alunos sem concluir planificações
- owner funcional: A3; A1 apenas se houver navegação/contrato partilhado.
- conclusão: professor consegue aceder/gerir alunos sem marcar falsamente planificações como concluídas; rascunhos/unsaved protection preservados; nenhuma perda de setup.

### NEXT-PLANIFICATION-DAILY-01 — planificações na preparação de sumários
- owners: A3 para fonte/planificação; A4 para percurso Daily; A1 para contrato partilhado se necessário.
- conclusão: Daily apresenta itens/sumários sugeridos apenas da UFCD correta, permite inserir/editar sem write antecipado, marca utilização apenas ao guardar e reabre de forma coerente; zero cross-UFCD silencioso.

### NEXT-EXCEL-FINAL-01 — Excel de avaliação final UFCD/módulo
- A3 UX/mapeamento e A5 privacidade já contribuíram; A4 ainda deve entregar parecer funcional `assessments/**`.
- A1 consolida desenho; A6 revê antes de qualquer implementação.
- original `.xlsx` nunca alterado; output é cópia; dados estruturados continuam fonte de verdade.

### NEXT-CRYPTO-RECOVERY-01 — cifragem e recuperação
- owner investigação: A5; shared integration: A1; A6 verifica qualquer correção.
- conclusão da investigação: reproduções com dados descartáveis, gatilhos exatos, impacto e classificação PROVADO/INFERIDO. Qualquer perda de chave/dados atualmente alcançável é escalada imediatamente e pode reabrir o âmbito por decisão A1.

## Validação obrigatória do candidato

- testes MA-Professor;
- testes Conquistador;
- testes MA-Quadro;
- build completo;
- testes específicos dos lotes novos;
- smokes funcionais proporcionais: setup/critério multi-disciplina, PDF/Xadrez, Daily quick-grade, sumário/cópia GIAE, GIAE single/bulk/stale, backup/restore, acesso/logout/renovação;
- dados descartáveis; nenhuma informação escolar privada em comentários/fixtures públicas;
- cada prova automatizada deve corresponder ao SHA avaliado;
- build verde não prova publicação correta.

Fluxo final obrigatório:
`lotes finais -> candidato A1 -> testes/verificações -> A6 no SHA final -> apresentação ao utilizador -> aprovação explícita -> integração/publicação`.
