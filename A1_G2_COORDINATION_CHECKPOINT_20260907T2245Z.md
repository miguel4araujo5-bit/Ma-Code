# A1-G2 — Checkpoint de coordenação

Data: 2026-09-07T22:45Z / 23:45 Europe/Lisbon

## Main

`main` confirmada em `344841c1fc402e813f9d8658d96fa20b0fefa779`. Nenhum dos lotes abaixo foi integrado.

## A2 — acesso/renovação

Branch `agent2-g2/access-session-contract-7ec8904`, HEAD `a3d07b8e8ed774fd88d23859d6b64e19ebff9f23`. Build Check #1648/run `34117890604` = SUCCESS; MA-Professor 251/251, Conquistador e build PASS.

Auto-revisão A2 encontrou lacuna adicional: `/logout` grava `revokedAt` no storage sem refrescar a cadeia interna em memória; `/account/verify` também escreve `lastSeenAt` diretamente sem refresh. A divergência storage/cache está provada pelo código; aceitação indevida de `/renew` após logout ainda não foi provada por teste. O HEAD `a3d07b8e...` não é considerado APTO.

A1 autorizou follow-up isolado: provar `sessão válida → logout → account/verify=401 → renew=401 sem renewal`, mais sessão histórica hex para decidir compatibilidade end-to-end. Se reproduzido, preferir correção mínima de refresh/invalidação depois de writes diretos. A6 deve rever apenas o novo HEAD posterior.

## A3 — setup

### Cores
Branch `agent3-g2/setup-action-colors-344841c`, HEAD `f61bdb8724dcf95016e18813164a07149d45ec3e`.

A6 emitiu BLOQUEADO, finding `A6-SETUP-COLORS-NR-01`: `WeeklyScheduleSetupStep.tsx` perdeu o fecho `)}` de `{daySlots.map(...)}`, deixando TSX inválido. Restante diff visual foi considerado coerente com o contrato.

A1 autorizou correção mínima na mesma branch: restaurar apenas a estrutura TSX em falta, sem alterações funcionais; novo HEAD volta a A6.

### Horário / Clube Xadrez
Branch `agent3-g2/schedule-pdf-xadrez-344841c` continua exatamente em `344841c...`; ainda não implementado. Ordem após fechar cores: Xadrez primeiro.

### Texto PT-PT
Branch `agent3-g2/setup-ptpt-copy-344841c` continua exatamente em `344841c...`; ainda não implementado. Fazer depois de Xadrez, isoladamente.

PR #23 / planificações PDF `e4df193d...` permanece congelado/APTO e não deve ser alterado por estes lotes.

## A4 — GIAE

Contrato central A1/A6 `f314a8b6379d876cacacb96481cbf40effd2d5ce` continua APTO para consumo controlado.

Branch `agent4-g2/giae-explicit-resubmit-f314a8b` continua exatamente em `f314a8b...`; consumo ainda não implementado.

A1 respondeu ao pedido de handoff de A4-G2: passagem de responsabilidade confirmada, antecessor parado para novos writes funcionais e branch/base exatas autorizadas. A4 pode alterar apenas `giae/**` + testes próprios, consumindo `giaeExplicitSubmissionRepository.ts`; ficheiros centrais continuam reservados ao A1.

## A5 — preservação e Excel

Backup/restore PR #18 / `94fd528ac0a38d4eca7b56a83cd160a0616a84df` permanece congelado/APTO.

Parecer A5 sobre a futura avaliação final Excel recebido e incorporado em `A1_EXCEL_UFCD_FINAL_ASSESSMENT_PLANNING.md`: template efémero por defeito, original nunca escrito, output sempre numa nova cópia, classificações estruturadas como fonte de verdade, template/output fora de backup/sync por defeito, mapeamento mínimo isolado por conta+ano letivo e invalidado por template diferente. A1 aceita esta orientação como base provisória de arquitetura; não autoriza implementação.

## A6 — revisão independente

- Cores A3 `f61bdb...`: BLOQUEADO por `A6-SETUP-COLORS-NR-01`; aguarda novo HEAD mínimo.
- A2 `a3d07b8e...`: parecer final suspenso; follow-up A2 obrigatório devido à lacuna encontrada na auto-revisão.
- GIAE A4: contrato central já APTO; aguarda consumo A4 e novo HEAD combinado.
- Daily `df7098fe...`, PDF `e4df193d...`, backup `94fd528...` e CI isolation `745dab64...` mantêm os pareceres APTO já registados nos respetivos SHAs.

## DEPLOY-PR-01

Continua aberto. Comentários Cloudflare `Deployment successful` foram observados em PRs de validação, incluindo #28/#29. A `main` Git permanece intacta, mas a configuração privada de Branch control Cloudflare ainda não foi confirmada. Enquanto isto se mantiver, não criar novos PRs nem fazer pushes funcionais apenas para obter CI. Trabalho seguro/local em branches pode continuar conforme coordenação A1.

## Próxima sequência

1. A3 corrige o finding de sintaxe das cores e A6 revalida.
2. A2 prova/corrige logout/cache e entrega novo HEAD para A6.
3. A4 consome o contrato GIAE e entrega novo HEAD para A6.
4. A3 resolve Xadrez e depois texto PT-PT em lotes separados.
5. Só quando estes HEADs estiverem fechados, A1 prepara um candidato único sem duplicar lotes empilhados, executa suites/build/smokes proporcionais e pede revisão final A6.
6. Nada vai para `main` sem aprovação explícita do utilizador.
