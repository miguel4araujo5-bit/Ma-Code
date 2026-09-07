# MA-CODE — Estado consolidado dos agentes

Atualizado por: AGENTE 1 — SEGUNDA GERAÇÃO (A1-G2)
Sessão: A1-G2
Data da verificação: 2026-09-08T00:00:28+01:00
Último evento processado no `AGENT_MESSAGES.md` ativo: `A4-20260907T120048Z-cfdep`
Fonte técnica: `main` confirmada em `344841c1fc402e813f9d8658d96fa20b0fefa779`.

## Regra central de coordenação

A1-G2 é o ponto central. O utilizador não transporta mensagens entre agentes. A1 identifica causas, distribui trabalho por ownership, resolve dependências e pede revisão A6 quando aplicável.

O `AGENT_MESSAGES.md` continua append-only. O conector disponível nesta sessão não oferece append atómico e substituir o ficheiro completo já originou `COMM-01/02/03`; por isso A1 não reescreve esse histórico. Enquanto não existir append seguro, instruções urgentes são publicadas diretamente nos PRs/canais GitHub dos agentes e refletidas neste `AGENT_STATUS.md`.

Nada é integrado ou publicado em `main` sem aprovação explícita do utilizador para o lote concreto.

## Proteção operacional — DEPLOY-PR-01

Cloudflare publicou comentários `Deployment successful` em PRs de trabalho, embora `main` continue em `344841c...`. Não está provado que esses builds tenham promovido produção, mas a configuração privada de Branch control ainda não foi verificada.

Até esclarecimento:
- não abrir novos PRs nem fazer novos pushes funcionais a PRs existentes apenas para obter CI;
- trabalho seguro em branches autorizadas pode continuar;
- testes locais e revisão de código por SHA são permitidos;
- parar antes de qualquer nova ação que possa disparar publicação/CI não necessária;
- `main` permanece protegida.

## Estado atual por agente/lote

### A2-G2 — acesso/renovação — PRIORIDADE MÁXIMA

- Branch: `agent2-g2/access-session-contract-7ec8904`
- HEAD intermédio: `a3d07b8e8ed774fd88d23859d6b64e19ebff9f23`
- PR #28 draft.
- Build Check #1648 / run `34117890604`: SUCCESS; MA-Professor 251/251; Conquistador e build passaram.
- O próprio A2 encontrou depois um risco adicional: `/logout` escreve revogação em storage mas pode deixar `this.existing` com cache antiga; `/account/verify` também escreve `lastSeenAt` sem refresh. Compatibilidade hex legada também não está provada end-to-end em `/account/verify` e `/logout`.
- A1 autorizou follow-up isolado por teste determinístico: sessão válida → `/logout` → `/account/verify` = 401 → `/renew` = 401 sem renewal; mais cenário histórico hash hex.
- Se o stale-cache se confirmar, correção preferida: refresh/invalidação mínima após writes diretos no bridge, sem redesenho do núcleo.
- Estado: **NÃO APTO / follow-up em curso**. A6 aguarda novo HEAD/checkpoint.

### A3-G2 — setup

#### A3-SETUP-ACTION-COLORS-01
- Branch: `agent3-g2/setup-action-colors-344841c`
- HEAD atual congelado: `64e3149336c6097c9777a8feb38209f9bfb37be9`.
- O finding A6 `A6-SETUP-COLORS-NR-01` do HEAD anterior `f61bdb87...` foi corrigido: `daySlots.map(...)` voltou a fechar corretamente com `)}`.
- A6 reviu o novo SHA e declarou o bloqueio de código **CORRIGIDO**, sem novo finding de código, mas com **VERIFICAÇÃO INCOMPLETA** por falta de execução de teste/build nesse SHA.
- A1 pediu ao A3, sem alterar o HEAD: `node --test tests/ma-professor/setup-action-color-coding.test.mjs`, `npm run build` e, se possível, suite MA-Professor proporcional, com comando + resultado.
- Estado: **código corrigido; falta prova executável para fechar parecer A6**.

#### A3-HORARIO-XADREZ-01
- Branch: `agent3-g2/schedule-pdf-xadrez-344841c`
- Continua em `344841c1fc402e813f9d8658d96fa20b0fefa779` neste checkpoint.
- Objetivo: reconhecer/importar `Clube Xadrez` terça 15:20–16:10.
- Âmbito A3 autorizado: `src/components/ma-professor/setup/SchedulePdfImportStep.tsx` + testes próprios.
- `src/lib/maPdf/extractPdfText.ts` continua reservado ao A1; se necessário, A3 para e pede contrato.
- A1 autorizou A3 a começar Xadrez em paralelo enquanto o A6 fecha o lote de cores.
- Estado: **pendente de implementação**.

#### A3-PTPT-COPY-01
- Branch: `agent3-g2/setup-ptpt-copy-344841c`
- Continua na base `344841c...` neste checkpoint.
- Alterações exclusivas: `Revisei os dados apresentados.` → `Revi os dados apresentados.`; `Posso criar cópias cifradas online` → `Posso criar cópias de segurança cifradas online`.
- Tratar depois do Xadrez; não misturar com o HEAD de cores ou PR #23.

#### PDF-IMPORT
- PR #23 / HEAD `e4df193d78c5d9523cf7803af30241ab92e8ec6b` permanece congelado/APTO.
- Não alterar nem integrar ainda; smokes reais ficam para o candidato combinado.

### A4-G2 — Daily e GIAE

#### A4-DAILY-NR-01
- Branch `agent4-g2/daily-null-assessment-9bde7c4`
- HEAD `df7098fe510aa79fc72bde035053389045a8d117`
- PR #29 draft.
- A6: **APTO** nesse SHA; CI #1645 SUCCESS; MA-Professor 248/248; Conquistador e build PASS.
- PR #29 contém o trabalho histórico do PR #17; não integrar PR #17 separadamente.
- Estado: **congelado/APTO para futura combinação**.

#### A4-GIAE-NR-02
- Contrato A1/A6 base: `f314a8b6379d876cacacb96481cbf40effd2d5ce`, APTO para consumo controlado.
- Branch canónica A4: `agent4-g2/giae-explicit-resubmit-f314a8b`.
- HEAD atual: `ba87e69873a0277a63e84b98bf539038aba0151f`.
- A4 corrigiu administrativamente o nome da branch por fast-forward; ignorar a branch antiga `agent4-g2/giae-explicit-submit-f314a8b` para coordenação futura.
- Delta contra `f314a8b...`: 2 commits, 0 behind, apenas `src/components/ma-professor/giae/giaeWorkspaceRepository.ts` e `tests/ma-professor/giae-copy-version-guard.test.mjs`.
- Implementação consome exclusivamente `giaeExplicitSubmissionRepository`, guarda `expectedUpdatedAt`, rejeita retorno não realmente `submitted`, preserva retry/autorização de cópia e bloqueia uso legacy nos testes.
- A1 aceitou o checkpoint e pediu: comando + resultado dos testes locais neste SHA, sem novo push; revisão independente A6 por SHA exato, mesmo sem CI/E2E.
- Estado: **implementado e congelado; aguarda evidência local + parecer A6**.

### A5-G2 — preservação

- Backup/restore PR #18 / HEAD `94fd528ac0a38d4eca7b56a83cd160a0616a84df` permanece congelado/APTO.
- Para a futura funcionalidade Excel, A5 recomenda como contrato base: template `.xlsx` efémero por defeito; original nunca escrito; output preenchido fora de backup/sync por defeito; classificações estruturadas do MA-Professor permanecem fonte de verdade; metadados mínimos de mapeamento apenas se necessários e isolados por conta/ano letivo.
- Nenhuma implementação Excel autorizada ainda.

### A6-G2 — revisão independente

Fila atual:
1. fechar A3 cores `64e3149336c6097c9777a8feb38209f9bfb37be9` assim que A3 entregar teste/build local;
2. rever código A4 GIAE `ba87e69873a0277a63e84b98bf539038aba0151f` contra `f314a8b...`, explicitando ausência de CI/E2E e incorporando evidência local A4 quando chegar;
3. manter A2 `a3d07b8e...` suspenso até novo follow-up/HEAD;
4. rever futuros HEADs Xadrez/PT-PT separadamente.

A6 nunca autoriza merge por si só; parecer é sempre por SHA exato.

## Nova funcionalidade — avaliação final UFCD/módulo em Excel

Planeamento: `A1_EXCEL_UFCD_FINAL_ASSESSMENT_PLANNING.md`.

Princípios já suportados pela análise:
- reutilizar `assessments/**` e `moduleFinalGrades` como fonte de verdade;
- Excel é camada de importação/mapeamento/exportação, não segunda base de classificações;
- original nunca alterado;
- gerar uma cópia `.xlsx` preenchida;
- template efémero por defeito e output fora de backup/sync;
- mapeamento de alunos/colunas e ambiguidades exigem revisão explícita do professor;
- autoavaliação e regra de cálculo não podem ser inventadas universalmente; devem respeitar critérios/configuração reais;
- preservar fórmulas, folhas e formatação tanto quanto tecnicamente possível;
- nenhuma implementação até A1 receber as análises A3/A4/A5 e definir contrato.

## Lotes já APTO e congelados para futura combinação

- `PDF-IMPORT`: `e4df193d78c5d9523cf7803af30241ab92e8ec6b`
- `BACKUP-ATOMIC`: `94fd528ac0a38d4eca7b56a83cd160a0616a84df`
- `CI-ISOLATION`: `745dab64e2355b1e14a36687d60a21e77b6e0f34`
- `A4-DAILY-NR-01`: `df7098fe510aa79fc72bde035053389045a8d117`

Não combinar ainda: A2, A3 cores/Xadrez/PT-PT e A4 GIAE ainda não estão todos fechados.

## Incidentes de integridade do canal

- `COMM-01`: evento A5 desapareceu do conteúdo ativo apesar de permanecer na história Git.
- `COMM-02`: um append anterior alterou texto histórico.
- `COMM-03`: tentativa de restaurar histórico também voltou a editar mensagens antigas.

Regra permanente: nunca corrigir histórico por edição; qualquer retificação futura apenas por novo evento append-only quando existir mecanismo seguro.

## Próxima fase

Quando A2, A3 e A4 tiverem HEADs finais tecnicamente fechados:
1. A1 verifica dependências e lotes contidos/empilhados;
2. prepara um único candidato combinado sem duplicar PRs históricos;
3. executa suites Conquistador + MA-Professor + MA-Quadro, build e smokes proporcionais aos riscos;
4. entrega o SHA combinado ao A6 para revisão final independente;
5. só após parecer final e aprovação explícita do utilizador poderá haver autorização de merge para `main`.
