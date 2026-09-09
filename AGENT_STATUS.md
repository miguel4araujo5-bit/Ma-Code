# MA-CODE — Estado operacional único dos agentes

Atualizado por: coordenação unificada A1–A6
Data: 2026-09-09
Fonte técnica: `main` confirmada em `54544a127d31a9c39d9e8b61c5de4fc353e85dd6`.

## Estado global

**A release candidate de 2026-09-08 foi integrada e validada, mas existem novos trabalhos ativos posteriores ao release.**

O PR #41 (`[RELEASE CANDIDATE] MA-Professor — composição final 2026-09-08`) foi integrado em `main` no commit:

`00898c6a354ef276f54f641c925fc69013c2e274`

A prova pós-merge desse release passou em Node 24:
- instalação — PASS;
- Conquistador — PASS;
- MA-Professor — PASS;
- MA-Quadro — PASS;
- `npm run build` — PASS.

Depois desse release, a `main` avançou com correções adicionais, incluindo:
- PR #42 — compatibilidade Safari da importação PDF de planificações;
- PR #45 — correção do fluxo de importação/correção de disciplina/curso.

HEAD atual confirmado:

`54544a127d31a9c39d9e8b61c5de4fc353e85dd6`

## Prioridade BLOQUEANTE atual — issue #44

Issue aberto:

`#44 — MA-Professor — permitir avaliação em aula futura com aviso, sem bloquear saída`

**Estado: NÃO RESOLVIDO na `main` atual.**

Confirmação técnica contra a `main` atual:
- `dailyWorkspaceRepository.ts` continua a rejeitar `futurePreparation && input.assessment.mode !== 'none'`;
- `hasFutureAttendanceOrAssessmentInput(...)` continua a misturar assiduidade e avaliação no bloqueio temporal;
- `assessmentRepository.ts` continua a exigir `lesson.status === 'taught'` para criar/alterar avaliações e guardar classificações;
- `DailyWorkspaceView.tsx` continua a fazer `saveBeforeNavigation() -> saveAll()` e a cancelar a navegação quando o save falha.

Contrato obrigatório do hotfix:
1. permitir criar/editar avaliação em aula `planned`, incluindo data futura;
2. mostrar aviso `🚨` não bloqueante para data futura;
3. manter a aula `planned` e não criar assiduidade/GIAE/progresso prematuros;
4. preservar proteção para `cancelled`;
5. preservar guards de concorrência/stale sem overwrite silencioso;
6. em falha de save/stale, permitir escolha explícita entre ficar/recarregar e sair sem guardar;
7. provar regressões específicas + suites globais antes de qualquer integração.

Nenhum merge/publicação deste hotfix sem revisão independente e autorização explícita do utilizador.

## PR aberto — #43

PR draft:

`#43 — [A2] MA-ADMIN — Cortar acesso sem apagar dados`

Branch:

`agent2/account-cut-access-00898c6`

HEAD entregue:

`16d6397be51c441dc2179aea1085f52b0a4fe611`

Estado:
- implementação entregue em 3 ficheiros;
- Build Check #1685 / run `34341745030` — SUCCESS;
- Conquistador — PASS;
- MA-Professor — 369/369 PASS;
- MA-Quadro — 15/15 PASS;
- build — PASS;
- **sem revisão A6 registada no PR neste momento**;
- PR continua DRAFT e não está autorizado para merge.

Nota: a base declarada pelo PR é anterior à `main` atual. Antes de eventual integração deve ser revalidado contra a `main` atual e revisto no SHA exato resultante.

## Risco operacional a investigar — deploy de branch draft

O bot da Cloudflare registou `Deployment successful` para o SHA `16d6397be51c441dc2179aea1085f52b0a4fe611` do PR #43, apesar de o PR permanecer draft e sem autorização de publicação.

Não assumir automaticamente que isto significa exposição pública definitiva da branch, mas a política de deploy deve ser verificada: branches/PRs de trabalho não devem promover alterações para produção sem autorização explícita.

## Estado dos PRs / issues

- PRs abertos: **1** — #43 (draft).
- Issues funcionais abertos: **1** — #44 (bloqueante).
- O estado anterior “Zero PRs abertos” ficou obsoleto e não deve ser usado.

## Funcionalidade integrada e preservada

- importação PDF + DOCX diretamente em UFCD/módulos, com revisão antes de guardar e criação atómica de módulos + planificações;
- importação persistente e idempotente de planificações, com proteção contra stale preview e rollback;
- compatibilidade Safari da importação PDF;
- correção do fluxo de associação/correção de disciplinas importadas;
- acesso, sessão, ativação, renovação e logout consistentes;
- backup/restore atómico e proteções de recuperação/snapshot;
- Daily com persistência segura e proteção de concorrência, com a exceção funcional ativa descrita no issue #44;
- GIAE com cópia/versionamento e submissão explícita segura;
- critérios simples por disciplina e personalização de UFCD protegida por evidência histórica;
- importação de horário com `Eq Pedag`, `Co PCE`, `Clube Xadrez` e adições manuais no preview;
- CI global com Conquistador + MA-Professor + MA-Quadro + build em Node 24.

## MA-Quadro

Estado preservado:
- `MAQuadroHomeWorkspace.tsx` continua ausente;
- `MAQuadroHome.tsx` continua canónico;
- `MAQuadroApp.tsx` consome `MAQuadroHome`;
- suite MA-Quadro passou no release candidate.

## Segurança / dados locais e cloud

### Apagar utilizador

A eliminação de utilizador no servidor remove os dados cifrados/snapshot cloud e metadados de sync associados antes de remover o estado de acesso.

Os dados locais IndexedDB do dispositivo **não são apagados remotamente**. Por isso, apagar uma conta e recriar a mesma identidade no mesmo browser pode voltar a expor os dados pedagógicos que permaneceram localmente. Isto não prova restauração cloud; é comportamento local-first.

Uma conta diferente com dados locais significativos continua bloqueada pela fronteira de isolamento em vez de receber esses dados silenciosamente.

### CryptoSetupGate

A investigação histórica `NEXT-CRYPTO-RECOVERY-01` fica arquivada:
- existe um risco demonstrável delete-before-replacement num caminho atualmente inativo;
- não foi encontrado consumidor produtivo de `CryptoSetupGate`;
- não é um defeito produtivo alcançável no estado atual;
- se o gate vier a ser montado no futuro, esta investigação deve ser reaberta antes da ativação.

## Regra operacional a partir de agora

1. A `main` atual é a única base funcional autorizada.
2. O agente unificado assume internamente as funções A1–A6: produto/coordenação, acesso/core, UX/setup, pedagogia/Daily/GIAE, dados/sync/recuperação e revisão independente.
3. Não retomar branches/SHAs antigos como se fossem trabalho pendente sem comparação contra a `main` atual.
4. Nova tarefa começa por leitura da `main` atual e diagnóstico verificável.
5. Alterações de alto risco exigem branch isolada, testes proporcionais, revisão independente do SHA exato e gate global antes de merge.
6. `AGENT_MESSAGES.md` permanece histórico append-only.
7. Este ficheiro deve acompanhar findings, entregas e alterações reais de estado.
8. Prioridade imediata: resolver e provar o issue #44; depois fechar/revalidar #43 e auditar a política de deploy de branches draft.

## Pendências não bloqueantes / futuras

- UX opcional para tornar mais explícita a diferença entre “Apagar utilizador” na cloud e “Apagar dados deste dispositivo”. Não apagar dados locais silenciosamente.
- Se `CryptoSetupGate` for ativado no futuro, corrigir primeiro o caminho destrutivo demonstrado na investigação arquivada.
