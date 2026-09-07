# MA-CODE — Estado consolidado dos agentes

Atualizado por: AGENTE 1
Data da verificação: 2026-09-07T09:15:00+01:00
Último evento processado: `EXT-20260907T082132Z-a1wf`
Fonte técnica: `main` em `344841c1fc402e813f9d8658d96fa20b0fefa779`; este ficheiro é apenas coordenação e não substitui a main.

## Regras do registo

- Escrita deste ficheiro: AGENTE 1.
- Um lote APTO fica congelado no SHA exato indicado.
- Lotes empilhados/contidos noutros não são integrados duas vezes.
- Qualquer HEAD combinado exige nova validação e nova revisão A6 antes de `main`.
- Nada é integrado/publicado em `main` sem aprovação explícita do utilizador.

## Estado por lote

| Lote | Responsável | Branch / HEAD | PR final / antecessores | CI | Parecer A6 | Limitações / dependências | Próxima ação |
|---|---|---|---|---|---|---|---|
| Planificações PDF — persistência completa | A1 + A3 | `agent3/planification-pdf-persist-8bbed823` / `e4df193d78c5d9523cf7803af30241ab92e8ec6b` | PR #23. Contém contrato A1 do PR #21 e substitui para integração os lotes A3 anteriores do PR #20 | Build Check #1639/run `34059722771`: MA-Professor 269/269, Conquistador, build; Workers Build SUCCESS | **APTO** `A6-20260906T225903Z-pdfapto` | Sem E2E browser/multi-tab IndexedDB; Build Check antigo não cobriu MA-Quadro; smoke final deve testar janela concorrente com formulários manuais | Manter congelado. Incluir apenas uma vez no candidato; executar smoke real + MA-Quadro no candidato |
| Backups — atomicidade restore/reset | A5 | `agent5/data-preservation-344841c` / `94fd528ac0a38d4eca7b56a83cd160a0616a84df` | PR #18 | Build Check #1635/run `34056754474`: MA-Professor 252/252, Conquistador, build; Workers Build SUCCESS; rollback real Dexie 2/2 previamente provado | **APTO** `A6-20260906T203634Z-b5apto` | Sem repetição E2E browser/IndexedDB na revisão A6 | Manter congelado; incluir uma vez no candidato e repetir smoke guardar/restaurar/reabrir com dados descartáveis |
| GIAE — concorrência base | A4 | `agent4/giae-concurrency-safety` / `7f0016d63a567be9d1297532be23fb0087b92560` | PR #15 | Build Check #1613 SUCCESS | Não é lote final isolado; conteúdo está empilhado no PR #22 | Antecessor do lote de guarda de versão; não integrar separadamente se PR final o contiver | Manter como antecessor histórico; não integrar duas vezes |
| GIAE — identidade da versão copiada | A4 | `agent4/giae-copy-version-guard-7f0016d` / `efa7446be88c9c12f684032acc9480a0f414d974` | PR #22; contém PR #15 | Build Check #1637/run `34059020915`: MA-Professor 255/255, Conquistador, build | **BLOQUEADO** `A6-20260906T225901Z-gia02` | Falso sucesso após edição de aula submetida: guard central `giaeInvalidatedAt` pode manter `pending` depois de nova cópia explícita | A1 trata contrato central; A4 permanece congelado até API autorizada |
| GIAE — contrato central de re-submissão explícita | A1 | `agent1/giae-explicit-resubmit-contract-efa7446` / base atual `efa7446be88c9c12f684032acc9480a0f414d974` | Ainda sem PR final | Não executado | Pendente | `lessonRepositoryBase.ts` permanece ownership A1; comportamento default deve continuar a bloquear re-submissão automática de Daily/Calendar | Implementar contrato opt-in por versão esperada, testar single/bulk/default, CI e A6; depois devolver API ao A4 |
| Daily — concorrência de relacionados | A4 | `safety/daily-related-concurrency-20260906` / `9bde7c424ff14becf833b0c974f70d69d335af1c` | PR #17 | Build Check #1616 SUCCESS; MA-Professor 247/247; build PASS | Parecer final do HEAD não registado neste resumo | Separado do GIAE e do futuro consumo de planificações | Manter separado; obter/reconfirmar revisão A6 antes de candidato |
| Acesso/renovação | A2 | `agent2/access-activation-344841c` / `7ec8904767b40c5d53b3283ebcacb7c1f6939de0` | PR #16 fechado sem merge no HEAD anterior `6f9212ce...`; novo HEAD não tem PR final comunicado | Novo HEAD é commit de teste de reprodução; CI final não comunicado | **BLOQUEADO** por A2-NR-01 no lote anterior | Cadeia real login → sessão → renew continua sem correção funcional comprovada; novo HEAD acrescenta reprodução | A2 deve publicar estado atual verificável e entregar correção funcional + CI + A6 antes de elegibilidade |
| Workflow — isolamento de CI + MA-Quadro | A1 | `agent1/ci-isolation-maquadro-344841c` / `745dab64e2355b1e14a36687d60a21e77b6e0f34` | PR #24 draft | Run ainda não associado no momento desta verificação | Pendente | Altera apenas `.github/workflows/deploy.yml`; deve provar que PRs diferentes não se cancelam e que Conquistador + MA-Professor + MA-Quadro + build executam | Aguardar CI, validar comportamento de concorrência e enviar HEAD exato ao A6 |

## Decisões de coordenação relevantes

- Planificações PDF APTO: `A6-20260906T225903Z-pdfapto`; congelamento A1: `A1-20260907T080201Z-3pdfapto`.
- Backups APTO: `A6-20260906T203634Z-b5apto`; congelamento A1: `A1-20260906T205633Z-5freeze`.
- GIAE bloqueado: `A6-20260906T225901Z-gia02`; ownership/contrato A1: `A1-20260907T080202Z-gia02-lido` e `A1-20260907T080203Z-4gia02-hold`.
- Pedido de melhoria do workflow/status/protocolo: `EXT-20260907T082132Z-a1wf`.

## Candidato

Ainda não existe candidato final aprovado para `main`.

Elegíveis atualmente para futura combinação controlada:
- Planificações PDF `e4df193d...`;
- Backups `94fd528...`.

Não elegíveis atualmente:
- A2 acesso/renovação;
- A4 GIAE;
- workflow A1 até CI + A6;
- qualquer lote sem revisão A6 no SHA final combinado.
