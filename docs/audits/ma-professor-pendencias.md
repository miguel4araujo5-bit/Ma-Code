# MA-Professor — lista de pendências e auditoria profunda

Data: 29/09/2026. Base auditada: [`50c78098a466e6f71cbff35c99fd187e652ec616`](https://github.com/miguel4araujo5-bit/Ma-Code/commit/50c78098a466e6f71cbff35c99fd187e652ec616), na `main` remota.

Esta lista regista **12 problemas confirmados e 3 validações pendentes**. Todos estão abertos. A auditoria acrescenta documentação; não implementa as correções propostas. A análise anterior de [estrutura e navegação](ma-professor-navigation.md) mantém o seu âmbito e histórico.

Não foi encontrada uma lista consolidada de pendências no repositório ou nos documentos de contexto consultados. Este ficheiro passa a concentrar os novos achados, sem colocar bugs temporários no Master Prompt ou no Active Context. Antes de corrigir um ponto, voltar a verificar a `main` atual.

## Prioridade e ordem de trabalho

- **P1:** corrigir antes de considerar concluída a segurança dos fluxos de backup, restauro e eliminação de dados.
- **P2:** corrigir a seguir; afeta consistência funcional, segurança das exportações ou controlo de consumo.
- **P3:** alinhar documentação técnica.
- **V:** falta evidência operacional; não equivale a um bug reproduzido.

A classe A/B/C indica o risco da futura intervenção segundo o workflow do projeto: A local/documental; B funcional; C crítico, incluindo backup, autenticação, apagamento, Worker/D1 e custos. Esta entrega é documental, de classe A. Não foi confirmado um P0 nesta análise; isso não certifica a ausência de outras vulnerabilidades.

| Estado | ID | Prioridade | Classe da correção | Ponto a resolver |
| --- | --- | --- | --- | --- |
| [ ] Aberto | AUD-01 | P1 | C | Preservar alterações pendentes quando ocorrem durante um upload automático. |
| [ ] Aberto | AUD-02 | P1 | C | Impedir que apagar dados do browser substitua a cópia online automaticamente. |
| [ ] Aberto | AUD-03 | P1 | C | Eliminar também os rascunhos diários no apagamento local explícito. |
| [ ] Aberto | AUD-04 | P1 | C | Proteger o restauro JSON contra alterações guardadas após a pré-visualização. |
| [ ] Aberto | AUD-05 | P1 | C | Abranger tickets e mensagens na política e execução de eliminação de conta. |
| [ ] Aberto | AUD-06 | P2 | C | Tornar atómico o limite de dez pedidos de apoio abertos. |
| [ ] Aberto | AUD-07 | P2 | C | Limitar respostas de apoio e paginar a conversa. |
| [ ] Aberto | AUD-08 | P2 | B | Neutralizar fórmulas em campos de texto exportados para CSV. |
| [ ] Aberto | AUD-09 | P2 | B | Distinguir médias atuais de valores históricos na exportação de notas. |
| [ ] Aberto | AUD-10 | P2 | C | Comparar conteúdo de backups independentemente da ordem dos registos. |
| [ ] Aberto | AUD-11 | P2 | C | Parar retries de erros permanentes e mostrar uma ação de resolução. |
| [ ] Aberto | AUD-12 | P3 | A | Atualizar o estado técnico documentado para a baseline v3-only. |
| [ ] Por validar | V-01 | P1 | C | Validar OPAQUE e backup em WebKit e Safari num iPhone real. |
| [ ] Por validar | V-02 | P1 | C | Confirmar deployment, migrations e perfis efetivos no D1 de produção. |
| [ ] Por validar | V-03 | P2 | C | Medir CPU e consumo agregado Cloudflare Free para pelo menos 20 professores. |

Ordem recomendada: AUD-01 e AUD-02; AUD-03 e AUD-04; AUD-05; restantes P2; AUD-12. V-01 e V-02 são gates de validação operacional e podem decorrer em paralelo com a preparação das correções. As correções devem preservar as funcionalidades existentes e reutilizar os pontos canónicos.

## Âmbito e validação efetuada

Foram revistos os percursos de acesso e isolamento de conta, OPAQUE e proteção v3, Worker/admin/apoio, persistência e rascunhos, backups/restauro, navegação e gravação, calendário/horários/UFCD/GIAE, assiduidade/recuperações, avaliações/critérios, importações e exportações. A profundidade concentrou-se nas dependências que podem perder dados, produzir valores inconsistentes ou consumir recursos sem limite.

| Verificação | Resultado e alcance |
| --- | --- |
| `npm run test:ma-professor` | Passou: 214 entradas no relatório do executor, zero falhas. Inclui os testes internos executados por esses ficheiros; não converter este número numa contagem de todas as assertions. |
| `npm run build` | Passou: TypeScript da aplicação e Worker, Vite e geração de 16 rotas estáticas. O aviso de dimensão do bundle mantém-se; isoladamente não demonstra um bug funcional. |
| `browser-critical-path.e2e.mjs` | Passou em Chromium: configuração, gravação e persistência do percurso crítico existente. |
| `browser-unified-navigation.e2e.mjs` | Passou em Chromium, incluindo destinos pela barra lateral e Menu a 1366, 1024 e 390 px. |
| `browser-integrated-regression.e2e.mjs` | Passou em Chromium: segurança antes da configuração, navegação protegida quando a gravação falha, gravação ao sair após recuperação e aulas extra com persistência. |
| [CI da base auditada](https://github.com/miguel4araujo5-bit/Ma-Code/actions/runs/36631419069) | Sucesso; os passos MA-Professor, três testes de navegador e build foram efetivamente executados. |
| Reproduções dirigidas | Código real dos repositórios com IndexedDB de teste; scheduler automático real com efeitos/tempo/rede controlados; handlers e SQL reais do Worker com SQLite local e autenticação simulada. Evidências descritas abaixo. |
| WebKit | Não executado: o lançamento local ficou bloqueado por bibliotecas nativas em falta no ambiente. Não é uma falha demonstrada da aplicação. |
| Produção | Sem acesso autenticado ao D1/Cloudflare nem ensaio entre dispositivos reais. Sem escrita ou eliminação de dados de professores. |

Os testes de navegador simulam as APIs de acesso. As reproduções de concorrência e retries controlam eventos, relógio e respostas da rede; confirmam o comportamento do código nessas condições, não uma ocorrência observada em produção. A suite passar não elimina os casos adicionais desta lista. Esta análise não é uma certificação criptográfica nem um teste de intrusão de produção.

## Problemas confirmados

### AUD-01 — alterações durante o upload perdem o marcador persistente

**P1 · C · Aberto.** A cópia automática pode deixar alterações recentes apenas no dispositivo após um reload.

**Evidência:** [AutomaticCloudBackup.tsx](../../src/components/ma-professor/sync/AutomaticCloudBackup.tsx#L454-L497) deteta uma mutação durante o envio e conserva `dirtySince` em memória. Contudo, chama sempre `markTrust`; [cloudBackupTrust.ts](../../src/components/ma-professor/sync/cloudBackupTrust.ts#L171-L188) grava `dirtyAt: null`. No próximo arranque, a revisão remota coincidente permite reutilizar essa confiança sem detetar a alteração ainda não copiada.

**Reprodução:** iniciar upload de um snapshot; emitir uma nova mutação antes da conclusão; terminar o upload; desmontar e montar o scheduler, simulando reload. Resultado: `dirtyAt = null`, zero timers após o novo arranque e apenas um upload. Sem reload, o timer em memória ainda existe. Os dados locais não foram apagados; é a cobertura da cópia online que fica incompleta até nova mutação ou cópia manual.

**Correção mínima proposta:** atualizar a revisão confirmada sem apagar o marcador de mutações posteriores ao snapshot; persistir a necessidade do segundo envio. Preservar CAS/409, opt-in, reautenticação e intervalo mínimo.

**Concluído quando:** um teste dirigido comprovar edição durante upload + conclusão + reload + reautenticação, com a edição a entrar na cópia seguinte; ausência de edição não deve provocar novos uploads.

### AUD-02 — apagar o browser pode substituir a cópia online

**P1 · C · Aberto.** Uma ação apresentada como eliminação local pode enviar automaticamente um snapshot sem os dados escolares que existiam na cópia online.

**Evidência:** [BackupSettingsPanel.tsx](../../src/components/ma-professor/settings/BackupSettingsPanel.tsx#L243-L267) chama o reset sem suspender a preferência automática, invalidar a confiança ou cancelar uploads em curso. [resetMAProfessorDatabase](../../src/components/ma-professor/settings/backupRepository.ts#L497-L507) limpa as tabelas principais e repõe as definições padrão. O observador automático continua montado fora da configuração escolar, através de `OperationalReadinessReporter` em `MAProfessorProduct`.

**Reprodução dirigida:** com preferência ativa, chave disponível e revisão remota já confiável, executar o reset real e gerar a cópia real dessa IndexedDB. A cópia é válida, tem zero aulas e uma linha de definições padrão; a preferência continua ativa e a confiança conserva a revisão anterior. Entregar a mutação ao scheduler real faz enviar esse snapshot. O ensaio controlou os eventos, relógio e rede, sem substituir uma cópia remota real.

**Impacto:** a cópia atual deixa de conter os dados anteriores. As duas gerações cifradas de histórico podem ainda permitir recuperação técnica; não há aqui prova de destruição de todas as gerações. A intenção «apagar deste browser» não esclarece esta substituição remota.

**Correção mínima proposta:** suspender o envio antes de iniciar o reset, invalidar a confiança para envio automático e proteger também o upload em curso. A eliminação local deve preservar a cópia remota; qualquer substituição remota precisa de uma decisão explícita separada.

**Concluído quando:** um teste com cópia automática ativa, reset, timer pendente, upload em curso e reload comprovar que a revisão/conteúdo remoto se mantêm; a criação posterior de uma escola não deve autorizar uma substituição silenciosa.

### AUD-03 — o apagamento local deixa rascunhos diários

**P1 · C · Aberto.** A mensagem «Todos os dados escolares foram eliminados deste browser» excede o que o reset faz.

**Evidência:** os rascunhos vivem na IndexedDB separada `ma-professor-daily-drafts`, gerida por [dailyDraftStorage.ts](../../src/components/ma-professor/daily/dailyDraftStorage.ts). O reset só limpa `ma-professor`; não chama a limpeza dos rascunhos.

**Reprodução:** guardar um rascunho com sumário, executar `resetMAProfessorDatabase` e reler o rascunho. Resultado: zero aulas na base principal, mas o texto do rascunho continua legível. O mesmo rascunho pode voltar a ser recuperado se forem restaurados o ano/aula com os mesmos identificadores.

**Correção mínima proposta:** incluir os rascunhos abrangidos pela ação de apagamento, usando as funções canónicas e respeitando o isolamento por conta. O sucesso visual deve depender da verificação de ambas as bases.

**Concluído quando:** o reset deixar zero dados escolares e zero rascunhos no âmbito anunciado; testar sumários e dados de alunos em rascunho, falha de limpeza e preservação de outras contas quando aplicável.

### AUD-04 — o restauro JSON não protege alterações posteriores

**P1 · C · Aberto.** Uma alteração guardada noutro separador depois de abrir a pré-visualização pode ser substituída sem nova confirmação informada.

**Evidência:** [RestoreSettingsPanel.tsx](../../src/components/ma-professor/settings/RestoreSettingsPanel.tsx#L130-L160) valida o ficheiro e a palavra `RESTAURAR`, mas não captura/compara uma assinatura dos dados locais. [backupRepository.ts](../../src/components/ma-professor/settings/backupRepository.ts#L471-L494) limpa e repõe diretamente as tabelas; a verificação final é feita depois da transação. O restauro online já tem o ponto canónico [guardedSnapshotRestore.ts](../../src/components/ma-professor/sync/guardedSnapshotRestore.ts#L50-L92).

**Reprodução:** preparar a cópia/pré-visualização, guardar um novo sumário e confirmar o restauro local. O novo sumário desaparece. Como controlo, o restauro online protegido rejeita a mesma alteração concorrente com `MAProfessorLocalSnapshotChangedError`.

**Correção mínima proposta:** reutilizar a proteção canónica no percurso local: assinatura capturada na pré-visualização, comparação e escrita na mesma transação e verificação antes do commit. A confirmação deve corresponder ao estado que o professor reviu.

**Concluído quando:** uma edição após a pré-visualização impedir a substituição e pedir uma nova revisão; restauro sem alterações manter-se funcional; falha de verificação provocar rollback e conservar os dados anteriores.

### AUD-05 — eliminar a conta deixa tickets e mensagens

**P1 · C · Aberto.** A eliminação administrativa confirma apenas a limpeza de três tabelas cloud e não abrange as conversas de apoio.

**Evidência:** [maProfessorAccountAdmin.ts](../../worker/maProfessorAccountAdmin.ts#L485-L606) elimina/verifica registos cifrados, dispositivos e perfis. Em [0004_support_tickets.sql](../../migrations/ma-professor/0004_support_tickets.sql), o `account_id` do ticket não tem uma relação de eliminação em cascata com o perfil; apenas as mensagens dependem do ticket. O identificador da conta deriva do email normalizado. A página pública de privacidade anuncia remoção dos dados cloud associados, com exceção de conservação legalmente obrigatória, sem explicar uma retenção específica de tickets.

**Reprodução:** criar tickets/mensagens com os handlers reais e executar o helper canónico de eliminação administrativa. Permaneceram 11 tickets e 36 mensagens na SQLite de teste. Pelo identificador determinístico, voltar a criar uma conta com o mesmo email também reutiliza o âmbito desses tickets; não foi ensaiado um novo registo remoto.

**Correção mínima proposta:** definir explicitamente o destino dos tickets na eliminação e implementar/verificar a remoção ou anonimização adequada. Qualquer conservação obrigatória precisa de fundamento, prazo e comunicação coerentes. Manter os tickets em claro para apoio humano é uma decisão distinta deste problema; não se propõe aqui alterar toda a arquitetura de apoio para E2E.

**Concluído quando:** a operação e a política coincidirem; contagens pós-operação incluírem tickets/mensagens, outras contas permanecerem intactas e uma conta recriada não herdar indevidamente dados que deveriam ter sido eliminados. Cobrir pedidos concorrentes à eliminação.

### AUD-06 — o limite de tickets pode ser ultrapassado por concorrência

**P2 · C · Aberto.** O limite de dez tickets abertos não é uma garantia atómica.

**Evidência:** [maProfessorSupportTickets.ts](../../worker/maProfessorSupportTickets.ts#L587-L619) consulta `COUNT(*)` antes e fora do batch de criação. Dois pedidos podem ler nove e ambos inserir.

**Reprodução:** nove tickets existentes; sincronizar dois pedidos de criação depois da consulta da contagem. Ambos devolveram HTTP 200 e ficaram onze tickets abertos.

**Correção mínima proposta:** garantir a condição de admissão no ponto de escrita atómico em D1, mantendo a criação do ticket e primeira mensagem consistente. Reutilizar a infraestrutura existente.

**Concluído quando:** nove tickets + duas criações concorrentes produzirem exatamente uma criação e uma rejeição; nenhuma mensagem órfã; outras contas não ficarem bloqueadas.

### AUD-07 — respostas ilimitadas e leitura integral da conversa

**P2 · C · Aberto.** O limite por mensagem e por tickets abertos não limita a quantidade de respostas nem o crescimento das leituras.

**Evidência:** [handleProfessorReply](../../worker/maProfessorSupportTickets.ts#L790-L885) não aplica quota de respostas por conta/janela. Depois de inserir, devolve o detalhe completo; [getTicketMessages](../../worker/maProfessorSupportTickets.ts#L523-L543) consulta todas as mensagens, sem paginação. Repetir respostas cresce em armazenamento, leituras e tamanho da resposta.

**Reprodução e limite da evidência:** 25 respostas sucessivas num ticket foram aceites. A ausência de quota/paginação foi confirmada no código; não se executou um ataque de carga em produção. Uma conversa legítima longa também sofre o crescimento da leitura integral.

**Correção mínima proposta:** limite conservador por conta/janela no D1 existente e paginação da conversa, com política de conservação explícita. Evitar novos Durable Objects, polling ou ciclos de retry para resolver este ponto.

**Concluído quando:** excesso de envio receber resposta controlada; leitura de uma conversa longa devolver uma página limitada com continuação; apoio/admin preservarem o contexto; consumo por operação ficar documentado e medido.

### AUD-08 — texto exportado pode ser interpretado como fórmula

**P2 · B · Aberto.** Colocar campos entre aspas no CSV não garante que Excel/LibreOffice os tratem como texto.

**Evidência:** [csvExport.ts](../../src/components/ma-professor/settings/csvExport.ts#L3-L20) só escapa aspas e delimitadores. Campos livres, como nomes/notas/sumários, podem começar por caracteres de fórmula.

**Reprodução:** nome de aluno `=1+1` produz a célula `"=1+1"`; o prefixo não é neutralizado. A interpretação efetiva depende do programa e do modo de importação. Não foi demonstrada execução de código na aplicação nem num computador de professor. Referência técnica: [OWASP — CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection).

**Correção mínima proposta:** exportar campos de texto do professor como texto seguro, considerando `=`, `+`, `-`, `@` e caracteres de controlo, preservando números legítimos nas colunas numéricas.

**Concluído quando:** verificar ficheiros em Excel e LibreOffice com fórmulas, tabs/CR/LF, aspas e `;`; os campos livres devem aparecer como texto e as notas numéricas manter o seu tipo/utilidade.

### AUD-09 — CSV apresenta médias históricas como calculadas

**P2 · B · Aberto.** Depois de alterar ponderações, a média atual na aplicação pode divergir da coluna «Média calculada» exportada.

**Evidência:** [assessmentCriteriaManagementRepository.ts](../../src/components/ma-professor/assessments/assessmentCriteriaManagementRepository.ts#L1053-L1160) guarda novos critérios/ponderações. A área de avaliação recalcula a média provisória; [exportGradesCsv](../../src/components/ma-professor/settings/csvExport.ts#L185-L240) lê `calculatedAverage` e `suggestedGrade` históricos de `moduleFinalGrades`, com rótulos sem essa distinção temporal.

**Reprodução:** resultados 10 e 20, ponderações 50/50 e nota final confirmada 15. Alterar para 90/10: média atual 11, média do registo exportado 15 e nota final confirmada 15. A preservação da nota final confirmada é intencional e deve continuar.

**Correção mínima proposta:** recalcular apenas os valores derivados atuais na exportação, ou identificar claramente as colunas como valores à data da confirmação e incluir os valores atuais quando necessário. Reutilizar o motor de cálculo existente.

**Concluído quando:** CSV e UI concordarem sobre o significado/data de cada valor após mudar critérios, resultados, faltas e ponderações; a nota final confirmada não deve ser substituída automaticamente.

### AUD-10 — igualdade de backups depende da ordem

**P2 · C · Aberto.** Backups com os mesmos registos podem ser tratados como divergentes pela cópia automática.

**Evidência:** [createMAProfessorBackupContentSignature](../../src/components/ma-professor/sync/cloudBackupTrust.ts#L243-L255) aplica `JSON.stringify` diretamente a `data`. Arrays com ordem diferente produzem assinaturas diferentes; essa comparação é usada na reconciliação da confiança automática. A canonicalização existente noutros percursos não corrige este comparador.

**Reprodução:** os mesmos dois registos de aula, com os mesmos identificadores e valores, em ordem invertida dão assinaturas diferentes. O risco aplica-se quando a ordem remota/local difere, por exemplo num snapshot válido não ordenado; não significa que todas as cópias atuais estejam bloqueadas.

**Correção mínima proposta:** assinatura determinística de conteúdo por tabela/identificador e campos, reutilizando a canonicalização adequada. Preservar diferenças reais e a validação de hashes do ciphertext.

**Concluído quando:** a permutação de registos/propriedades não causar divergência, enquanto alteração, adição e remoção de um registo continuarem a ser detetadas. Testar reconciliação após restauro.

### AUD-11 — erros permanentes são repetidos indefinidamente

**P2 · C · Aberto.** Um problema que exige intervenção pode gerar novas tentativas automáticas de cinco em cinco minutos, sem estado acionável apresentado pelo scheduler.

**Evidência:** [AutomaticCloudBackup.tsx](../../src/components/ma-professor/sync/AutomaticCloudBackup.tsx#L498-L535) pausa autenticação e conflito de revisão; os restantes erros usam sempre `AUTO_BACKUP_RETRY_MS`. Uma cópia acima do limite do servidor, por exemplo, não se resolve repetindo o mesmo envio. O componente devolve `null` e não publica um diagnóstico próprio desse bloqueio.

**Reprodução dirigida:** injetar um erro permanente de «cópia demasiado grande» no envio do scheduler real; avançar os timers três vezes. Resultado: três novas tentativas e outro retry agendado. O ensaio não enviou três pedidos 413 a um servidor real.

**Correção mínima proposta:** distinguir erros permanentes de transitórios; suspender os primeiros e mostrar o estado/ação em Segurança e recuperação. Manter retry controlado para rede/5xx, com margem Free e sem comprometer o trabalho local.

**Concluído quando:** 400/413 permanentes não provocarem ciclos infinitos; rede/5xx recuperarem com política limitada; autenticação/409 mantiverem as proteções atuais; uma alteração relevante ou ação explícita puder retomar o envio.

### AUD-12 — documentação técnica de estado ainda descreve v2 ativo

**P3 · A · Aberto.** A documentação pode levar uma futura intervenção a assumir rotas e compatibilidade que já não existem na baseline.

**Evidência:** [MA_PROFESSOR_BACKUP_PRIVACY_STATUS.md](../MA_PROFESSOR_BACKUP_PRIVACY_STATUS.md) e o início de [MA_PROFESSOR_OPAQUE_V3_PLAN.md](../MA_PROFESSOR_OPAQUE_V3_PLAN.md) anunciam compatibilidade v2, promoção manual e `/key` como estado atual. O Worker atual e `cloud-backup-v3-only-baseline.test.mjs` impõem v3-only, com `/status`, `/get`, `/initialize-v3` e `/push-v3`.

**Correção mínima proposta:** separar claramente o histórico de migração do contrato atualmente implementado e datar o estado efetivo. A limpeza documental não autoriza eliminar colunas `recovery_*`, alterar migrations ou destruir registos antigos.

**Concluído quando:** os documentos de estado descrevam o código atual e remetam a confirmação de dados de produção para V-02; referências históricas estejam identificadas como tal.

## Validações operacionais pendentes

### V-01 — WebKit e Safari/iPhone real

**P1 · C · Por validar.** Os três scripts de navegador e o CI atual usam Chromium. Não há prova de compatibilidade OPAQUE ponta a ponta no WebKit/Safari atual; o ensaio WebKit local não arrancou por falta de bibliotecas do sistema.

Validar criação de conta, enrollment/login, logout/reentrada, reload sem export key, reautenticação e cópia/restauro entre dispositivos, incluindo um iPhone real. Registar versão de iOS, browser, tempos, memória e eventuais encerramentos. O incidente anterior em iPhone justifica este gate, mas não demonstra uma falha na `main` agora auditada.

`opaqueClient.ts` continua com `keyStretching: 'rfc-recommended'`. Não alterar estes parâmetros apenas para reduzir consumo sem analisar compatibilidade das credenciais e da `exportKey` usada nas cópias, com contas existentes/novas e backups existentes. Um teste WebKit de desktop não substitui completamente o ensaio em iPhone.

### V-02 — deployment e D1 de produção

**P1 · C · Por validar.** CI verde e código v3-only não provam que o deployment e todos os dados de produção correspondem a essa baseline.

Confirmar, em modo de leitura, binding `MA_PROFESSOR_DB`, base `ma-professor-production`, migrations aplicadas incluindo `0004_support_tickets.sql`, frontend/Worker efetivamente publicados e ausência de perfis ativos v2. Consulta de diagnóstico, depois de confirmar a base correta:

```sql
SELECT crypto_version, COUNT(*) AS total
FROM ma_professor_sync_profiles
WHERE deleted_at IS NULL
GROUP BY crypto_version;
```

Não se confirmou nesta auditoria que existam perfis v2 remanescentes. Fechar com evidência do deployment/schema e ensaio completo de conta de teste com dados escolares fictícios em dois dispositivos, sem tocar em dados de professores.

### V-03 — Cloudflare Free com 20 professores e consumo agregado

**P2 · C · Por validar.** Rever CPU real e quotas consumidas por backup, autenticação, apoio e restantes produtos da mesma conta. Os problemas AUD-07 e AUD-11 criam caminhos de crescimento que precisam de ser controlados.

Limites oficiais consultados em 29/09/2026: [Workers](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) e [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/). Workers Free: 100 mil pedidos/dia e 10 ms de CPU por pedido. D1 Free: 5 milhões de linhas lidas/dia, 100 mil escritas/dia, 5 GB totais e 500 MB por base. Escritas em índices também contam. Durable Objects SQLite têm quotas próprias; não ignorar as operações de armazenamento da autenticação.

O intervalo mínimo automático é dez minutos. Como cenário extremo de referência, vinte professores a alterar dados durante 24 horas permitem até 2 880 ciclos/dia. Este número não mede CPU, operações D1/DO nem o consumo restante da conta. O armazenamento deve incluir a cópia atual **e as duas gerações anteriores**, além de base64, índices e tickets.

Fechar com tempos de CPU/erros por rota, linhas D1 lidas/escritas, operações DO, armazenamento, picos e margem para pelo menos vinte professores simultâneos. Preferir medições de operações isoladas e extrapolação conservadora antes de qualquer carga de produção. Esta entrega documental não adiciona recursos nem consumo recorrente.

## Regra para atualizar esta lista

Marcar um ponto como concluído só depois de indicar commit da correção, reprodução/teste dirigido, validação exigida pela classe e eventuais limitações. Conservar o ID para manter o histórico. Se uma verificação da `main` mostrar que um ponto já foi resolvido por outro trabalho, registar a evidência em vez de duplicar a implementação. Não reabrir achados da auditoria antiga de navegação sem uma nova regressão demonstrada.
