# MA-Professor — lista de pendências e auditoria profunda

Data: 29/09/2026. Base auditada: [`50c78098a466e6f71cbff35c99fd187e652ec616`](https://github.com/miguel4araujo5-bit/Ma-Code/commit/50c78098a466e6f71cbff35c99fd187e652ec616), na `main` remota.

Atualização: 30/09/2026. Os **12 achados têm correção integrada no código**; permanecem **3 validações operacionais pendentes**. «Corrigido no código» não significa validação de produção ou certificação de compatibilidade em todos os dispositivos. A descrição e as reproduções originais abaixo conservam o histórico da auditoria. A análise anterior de [estrutura e navegação](ma-professor-navigation.md) mantém o seu âmbito e histórico.

Não foi encontrada uma lista consolidada de pendências no repositório ou nos documentos de contexto consultados. Este ficheiro passa a concentrar os novos achados, sem colocar bugs temporários no Master Prompt ou no Active Context. Antes de uma nova intervenção, voltar a verificar a `main` atual.

## Prioridade e ordem de trabalho

- **P1:** corrigir antes de considerar concluída a segurança dos fluxos de backup, restauro e eliminação de dados.
- **P2:** corrigir a seguir; afeta consistência funcional, segurança das exportações ou controlo de consumo.
- **P3:** alinhar documentação técnica.
- **V:** falta evidência operacional; não equivale a um bug reproduzido.

A classe A/B/C indica o risco da intervenção segundo o workflow do projeto: A local/documental; B funcional; C crítico, incluindo backup, autenticação, apagamento, Worker/D1 e custos. A auditoria original foi documental, de classe A; a correção executada inclui classe C e o seu [gate de segurança e consumo](ma-professor-correcao-gate-cloudflare.md). Não foi confirmado um P0 nesta análise; isso não certifica a ausência de outras vulnerabilidades.

| Estado | ID | Prioridade | Classe da correção | Ponto a resolver |
| --- | --- | --- | --- | --- |
| [x] Corrigido no código | AUD-01 | P1 | C | Preservar alterações pendentes quando ocorrem durante um upload automático. |
| [x] Corrigido no código | AUD-02 | P1 | C | Impedir que apagar dados do browser substitua a cópia online automaticamente. |
| [x] Corrigido no código | AUD-03 | P1 | C | Eliminar também os rascunhos diários no apagamento local explícito. |
| [x] Corrigido no código | AUD-04 | P1 | C | Proteger o restauro JSON contra alterações guardadas após a pré-visualização. |
| [x] Corrigido no código | AUD-05 | P1 | C | Abranger tickets e mensagens na política e execução de eliminação de conta. |
| [x] Corrigido no código | AUD-06 | P2 | C | Tornar atómico o limite de dez pedidos de apoio abertos. |
| [x] Corrigido no código | AUD-07 | P2 | C | Limitar respostas de apoio e paginar a conversa. |
| [x] Corrigido no código | AUD-08 | P2 | B | Neutralizar fórmulas em campos de texto exportados para CSV. |
| [x] Corrigido no código | AUD-09 | P2 | B | Distinguir médias atuais de valores históricos na exportação de notas. |
| [x] Corrigido no código | AUD-10 | P2 | C | Comparar conteúdo de backups independentemente da ordem dos registos. |
| [x] Corrigido no código | AUD-11 | P2 | C | Parar retries de erros permanentes e mostrar uma ação de resolução. |
| [x] Corrigido no código | AUD-12 | P3 | A | Atualizar o estado técnico documentado para a baseline v3-only. |
| [ ] Por validar | V-01 | P1 | C | Validar OPAQUE e backup em WebKit e Safari num iPhone real. |
| [ ] Por validar | V-02 | P1 | C | Confirmar deployment, migrations e perfis efetivos no D1 de produção. |
| [ ] Por validar | V-03 | P2 | C | Medir CPU e consumo agregado Cloudflare Free para pelo menos 20 professores. |

AUD-01 a AUD-12 foram implementados nos pontos canónicos. V-01 a V-03 continuam abertos; a estimativa arquitetural Free está documentada, mas faltam as medições reais. Para AUD-08, falta ainda confirmar a importação em Excel e LibreOffice reais: a neutralização está testada no ficheiro gerado.

## Auditoria externa de 05/10/2026 — autenticação

Reverificada na main `9e6c884f6ac9d6672025ae52dbde16f832fe3ec9`, posterior à base externa `4452509`. As duas correções aprovadas pelo utilizador estão no commit [`a59836a00608dc1e56238ce7062a7ba988adb987`](https://github.com/miguel4araujo5-bit/Ma-Code/commit/a59836a00608dc1e56238ce7062a7ba988adb987). Âmbito, consumo Free e resultados completos no [gate de autenticação](ma-professor-auth-guard-gate.md).

| Estado | ID | Resultado e evidência |
| --- | --- | --- |
| [x] Corrigido no código | F-01 | Guard de 25 inícios OPAQUE por **dois minutos**, por IP Cloudflare em hash. Teto global existente de 64 passa a rejeitar novos inícios com HTTP 429/Retry-After, sem expulsar os anteriores. Testes reais cobrem reinício, fim da janela, outra origem, ausência de novas escritas numa rejeição e conclusão de uma prova válida enquanto o sistema está cheio. Os limites são de autenticação; não se aplicam à gravação local de sumários, faltas ou avaliações. |
| [x] Corrigido no código | F-02 | Exceção pública depende de `/access/account/verify`, dispositivo e email próprio. Um token inventado, revogado, expirado, de outro dispositivo ou de outra conta não dispensa a resposta genérica nem o limite público de pedidos. Via pública retira o token não autorizado antes de delegar. Teste da cadeia real cobre esses casos e a preservação da escolha de plano com uma sessão válida, mesmo sem licença ativa. |
| [ ] Avaliação pendente | F-03 | O crescimento de mapas por chave continua a exigir dimensionamento e medições. Não é resolvido pelo limite de login. Avaliar tamanhos serializados, retenção e limites seguros antes de redesenhar armazenamento; preservar Free e o cenário-base de vinte professores. |
| [ ] Avaliação pendente | F-04 | Separar o `serverSetup` OPAQUE do armazenamento dos registos é uma defesa adicional a avaliar. Esta correção não roda nem desloca essa chave; uma intervenção futura deve preservar credenciais e chaves de cópias existentes. |
| [ ] Manutenção pendente | F-05 | A cadeia de wrappers exige cuidado nos percursos sobrepostos. As correções atuais usam os pontos existentes e testes com a cadeia completa. Uma reorganização ampla fica fora deste âmbito mínimo. |

Validação local: 33 testes dirigidos e três novos testes da cadeia real passaram; build TypeScript/Worker/Vite e 16 rotas passaram. A execução completa MA-Professor fez 1 148 testes: 1 146 passaram e dois testes antigos pressupunham comportamentos alterados pela correção. Após ajustar a simulação para devolver identidade de sessão validada e retirar uma exigência literal do argumento de delegação, os 14 testes desses dois ficheiros passaram. O código de produção não mudou entre essas execuções; nenhuma falha executada ficou pendente. A execução inicial não deve ser descrita como tendo zero falhas.

Verificação adicional: **Terminar sessões já existe no admin**, em `MAProfessorAdminAccountDetail.tsx`, com a rota própria `/sessions/revoke` implementada no Worker. Não confundir essa ação com revogar a licença. Os restantes pontos antigos da auditoria externa não foram reabertos sem nova evidência. V-01, V-02 e V-03 continuam a exigir evidência operacional.

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

## Achados originais, corrigidos no código

As evidências de código ligam à base auditada, anterior à correção. As propostas e condições de conclusão são o registo original; o resultado implementado e os limites da validação constam do fecho abaixo.

### AUD-01 — alterações durante o upload perdem o marcador persistente

**P1 · C · Corrigido no código.** A cópia automática pode deixar alterações recentes apenas no dispositivo após um reload.

**Evidência:** [AutomaticCloudBackup.tsx](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/sync/AutomaticCloudBackup.tsx#L454-L497) deteta uma mutação durante o envio e conserva `dirtySince` em memória. Contudo, chama sempre `markTrust`; [cloudBackupTrust.ts](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/sync/cloudBackupTrust.ts#L171-L188) grava `dirtyAt: null`. No próximo arranque, a revisão remota coincidente permite reutilizar essa confiança sem detetar a alteração ainda não copiada.

**Reprodução:** iniciar upload de um snapshot; emitir uma nova mutação antes da conclusão; terminar o upload; desmontar e montar o scheduler, simulando reload. Resultado: `dirtyAt = null`, zero timers após o novo arranque e apenas um upload. Sem reload, o timer em memória ainda existe. Os dados locais não foram apagados; é a cobertura da cópia online que fica incompleta até nova mutação ou cópia manual.

**Correção mínima proposta:** atualizar a revisão confirmada sem apagar o marcador de mutações posteriores ao snapshot; persistir a necessidade do segundo envio. Preservar CAS/409, opt-in, reautenticação e intervalo mínimo.

**Concluído quando:** um teste dirigido comprovar edição durante upload + conclusão + reload + reautenticação, com a edição a entrar na cópia seguinte; ausência de edição não deve provocar novos uploads.

### AUD-02 — apagar o browser pode substituir a cópia online

**P1 · C · Corrigido no código.** Uma ação apresentada como eliminação local pode enviar automaticamente um snapshot sem os dados escolares que existiam na cópia online.

**Evidência:** [BackupSettingsPanel.tsx](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/settings/BackupSettingsPanel.tsx#L243-L267) chama o reset sem suspender a preferência automática, invalidar a confiança ou cancelar uploads em curso. [resetMAProfessorDatabase](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/settings/backupRepository.ts#L497-L507) limpa as tabelas principais e repõe as definições padrão. O observador automático continua montado fora da configuração escolar, através de `OperationalReadinessReporter` em `MAProfessorProduct`.

**Reprodução dirigida:** com preferência ativa, chave disponível e revisão remota já confiável, executar o reset real e gerar a cópia real dessa IndexedDB. A cópia é válida, tem zero aulas e uma linha de definições padrão; a preferência continua ativa e a confiança conserva a revisão anterior. Entregar a mutação ao scheduler real faz enviar esse snapshot. O ensaio controlou os eventos, relógio e rede, sem substituir uma cópia remota real.

**Impacto:** a cópia atual deixa de conter os dados anteriores. As duas gerações cifradas de histórico podem ainda permitir recuperação técnica; não há aqui prova de destruição de todas as gerações. A intenção «apagar deste browser» não esclarece esta substituição remota.

**Correção mínima proposta:** suspender o envio antes de iniciar o reset, invalidar a confiança para envio automático e proteger também o upload em curso. A eliminação local deve preservar a cópia remota; qualquer substituição remota precisa de uma decisão explícita separada.

**Concluído quando:** um teste com cópia automática ativa, reset, timer pendente, upload em curso e reload comprovar que a revisão/conteúdo remoto se mantêm; a criação posterior de uma escola não deve autorizar uma substituição silenciosa.

### AUD-03 — o apagamento local deixa rascunhos diários

**P1 · C · Corrigido no código.** A mensagem «Todos os dados escolares foram eliminados deste browser» excede o que o reset faz.

**Evidência:** os rascunhos vivem na IndexedDB separada `ma-professor-daily-drafts`, gerida por [dailyDraftStorage.ts](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/daily/dailyDraftStorage.ts). O reset só limpa `ma-professor`; não chama a limpeza dos rascunhos.

**Reprodução:** guardar um rascunho com sumário, executar `resetMAProfessorDatabase` e reler o rascunho. Resultado: zero aulas na base principal, mas o texto do rascunho continua legível. O mesmo rascunho pode voltar a ser recuperado se forem restaurados o ano/aula com os mesmos identificadores.

**Correção mínima proposta:** incluir os rascunhos abrangidos pela ação de apagamento, usando as funções canónicas e respeitando o isolamento por conta. O sucesso visual deve depender da verificação de ambas as bases.

**Concluído quando:** o reset deixar zero dados escolares e zero rascunhos no âmbito anunciado; testar sumários e dados de alunos em rascunho, falha de limpeza e preservação de outras contas quando aplicável.

### AUD-04 — o restauro JSON não protege alterações posteriores

**P1 · C · Corrigido no código.** Uma alteração guardada noutro separador depois de abrir a pré-visualização pode ser substituída sem nova confirmação informada.

**Evidência:** [RestoreSettingsPanel.tsx](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/settings/RestoreSettingsPanel.tsx#L130-L160) valida o ficheiro e a palavra `RESTAURAR`, mas não captura/compara uma assinatura dos dados locais. [backupRepository.ts](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/settings/backupRepository.ts#L471-L494) limpa e repõe diretamente as tabelas; a verificação final é feita depois da transação. O restauro online já tem o ponto canónico [guardedSnapshotRestore.ts](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/sync/guardedSnapshotRestore.ts#L50-L92).

**Reprodução:** preparar a cópia/pré-visualização, guardar um novo sumário e confirmar o restauro local. O novo sumário desaparece. Como controlo, o restauro online protegido rejeita a mesma alteração concorrente com `MAProfessorLocalSnapshotChangedError`.

**Correção mínima proposta:** reutilizar a proteção canónica no percurso local: assinatura capturada na pré-visualização, comparação e escrita na mesma transação e verificação antes do commit. A confirmação deve corresponder ao estado que o professor reviu.

**Concluído quando:** uma edição após a pré-visualização impedir a substituição e pedir uma nova revisão; restauro sem alterações manter-se funcional; falha de verificação provocar rollback e conservar os dados anteriores.

### AUD-05 — eliminar a conta deixa tickets e mensagens

**P1 · C · Corrigido no código.** A eliminação administrativa confirma apenas a limpeza de três tabelas cloud e não abrange as conversas de apoio.

**Evidência:** [maProfessorAccountAdmin.ts](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/worker/maProfessorAccountAdmin.ts#L485-L606) elimina/verifica registos cifrados, dispositivos e perfis. Em [0004_support_tickets.sql](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/migrations/ma-professor/0004_support_tickets.sql), o `account_id` do ticket não tem uma relação de eliminação em cascata com o perfil; apenas as mensagens dependem do ticket. O identificador da conta deriva do email normalizado. A página pública de privacidade anuncia remoção dos dados cloud associados, com exceção de conservação legalmente obrigatória, sem explicar uma retenção específica de tickets.

**Reprodução:** criar tickets/mensagens com os handlers reais e executar o helper canónico de eliminação administrativa. Permaneceram 11 tickets e 36 mensagens na SQLite de teste. Pelo identificador determinístico, voltar a criar uma conta com o mesmo email também reutiliza o âmbito desses tickets; não foi ensaiado um novo registo remoto.

**Correção mínima proposta:** definir explicitamente o destino dos tickets na eliminação e implementar/verificar a remoção ou anonimização adequada. Qualquer conservação obrigatória precisa de fundamento, prazo e comunicação coerentes. Manter os tickets em claro para apoio humano é uma decisão distinta deste problema; não se propõe aqui alterar toda a arquitetura de apoio para E2E.

**Concluído quando:** a operação e a política coincidirem; contagens pós-operação incluírem tickets/mensagens, outras contas permanecerem intactas e uma conta recriada não herdar indevidamente dados que deveriam ter sido eliminados. Cobrir pedidos concorrentes à eliminação.

### AUD-06 — o limite de tickets pode ser ultrapassado por concorrência

**P2 · C · Corrigido no código.** O limite de dez tickets abertos não é uma garantia atómica.

**Evidência:** [maProfessorSupportTickets.ts](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/worker/maProfessorSupportTickets.ts#L587-L619) consulta `COUNT(*)` antes e fora do batch de criação. Dois pedidos podem ler nove e ambos inserir.

**Reprodução:** nove tickets existentes; sincronizar dois pedidos de criação depois da consulta da contagem. Ambos devolveram HTTP 200 e ficaram onze tickets abertos.

**Correção mínima proposta:** garantir a condição de admissão no ponto de escrita atómico em D1, mantendo a criação do ticket e primeira mensagem consistente. Reutilizar a infraestrutura existente.

**Concluído quando:** nove tickets + duas criações concorrentes produzirem exatamente uma criação e uma rejeição; nenhuma mensagem órfã; outras contas não ficarem bloqueadas.

### AUD-07 — respostas ilimitadas e leitura integral da conversa

**P2 · C · Corrigido no código.** O limite por mensagem e por tickets abertos não limita a quantidade de respostas nem o crescimento das leituras.

**Evidência:** [handleProfessorReply](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/worker/maProfessorSupportTickets.ts#L790-L885) não aplica quota de respostas por conta/janela. Depois de inserir, devolve o detalhe completo; [getTicketMessages](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/worker/maProfessorSupportTickets.ts#L523-L543) consulta todas as mensagens, sem paginação. Repetir respostas cresce em armazenamento, leituras e tamanho da resposta.

**Reprodução e limite da evidência:** 25 respostas sucessivas num ticket foram aceites. A ausência de quota/paginação foi confirmada no código; não se executou um ataque de carga em produção. Uma conversa legítima longa também sofre o crescimento da leitura integral.

**Correção mínima proposta:** limite conservador por conta/janela no D1 existente e paginação da conversa, com política de conservação explícita. Evitar novos Durable Objects, polling ou ciclos de retry para resolver este ponto.

**Concluído quando:** excesso de envio receber resposta controlada; leitura de uma conversa longa devolver uma página limitada com continuação; apoio/admin preservarem o contexto; consumo por operação ficar documentado e medido.

### AUD-08 — texto exportado pode ser interpretado como fórmula

**P2 · B · Corrigido no código.** Colocar campos entre aspas no CSV não garante que Excel/LibreOffice os tratem como texto.

**Evidência:** [csvExport.ts](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/settings/csvExport.ts#L3-L20) só escapa aspas e delimitadores. Campos livres, como nomes/notas/sumários, podem começar por caracteres de fórmula.

**Reprodução:** nome de aluno `=1+1` produz a célula `"=1+1"`; o prefixo não é neutralizado. A interpretação efetiva depende do programa e do modo de importação. Não foi demonstrada execução de código na aplicação nem num computador de professor. Referência técnica: [OWASP — CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection).

**Correção mínima proposta:** exportar campos de texto do professor como texto seguro, considerando `=`, `+`, `-`, `@` e caracteres de controlo, preservando números legítimos nas colunas numéricas.

**Concluído quando:** verificar ficheiros em Excel e LibreOffice com fórmulas, tabs/CR/LF, aspas e `;`; os campos livres devem aparecer como texto e as notas numéricas manter o seu tipo/utilidade.

### AUD-09 — CSV apresenta médias históricas como calculadas

**P2 · B · Corrigido no código.** Depois de alterar ponderações, a média atual na aplicação pode divergir da coluna «Média calculada» exportada.

**Evidência:** [assessmentCriteriaManagementRepository.ts](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/assessments/assessmentCriteriaManagementRepository.ts#L1053-L1160) guarda novos critérios/ponderações. A área de avaliação recalcula a média provisória; [exportGradesCsv](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/settings/csvExport.ts#L185-L240) lê `calculatedAverage` e `suggestedGrade` históricos de `moduleFinalGrades`, com rótulos sem essa distinção temporal.

**Reprodução:** resultados 10 e 20, ponderações 50/50 e nota final confirmada 15. Alterar para 90/10: média atual 11, média do registo exportado 15 e nota final confirmada 15. A preservação da nota final confirmada é intencional e deve continuar.

**Correção mínima proposta:** recalcular apenas os valores derivados atuais na exportação, ou identificar claramente as colunas como valores à data da confirmação e incluir os valores atuais quando necessário. Reutilizar o motor de cálculo existente.

**Concluído quando:** CSV e UI concordarem sobre o significado/data de cada valor após mudar critérios, resultados, faltas e ponderações; a nota final confirmada não deve ser substituída automaticamente.

### AUD-10 — igualdade de backups depende da ordem

**P2 · C · Corrigido no código.** Backups com os mesmos registos podem ser tratados como divergentes pela cópia automática.

**Evidência:** [createMAProfessorBackupContentSignature](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/sync/cloudBackupTrust.ts#L243-L255) aplica `JSON.stringify` diretamente a `data`. Arrays com ordem diferente produzem assinaturas diferentes; essa comparação é usada na reconciliação da confiança automática. A canonicalização existente noutros percursos não corrige este comparador.

**Reprodução:** os mesmos dois registos de aula, com os mesmos identificadores e valores, em ordem invertida dão assinaturas diferentes. O risco aplica-se quando a ordem remota/local difere, por exemplo num snapshot válido não ordenado; não significa que todas as cópias atuais estejam bloqueadas.

**Correção mínima proposta:** assinatura determinística de conteúdo por tabela/identificador e campos, reutilizando a canonicalização adequada. Preservar diferenças reais e a validação de hashes do ciphertext.

**Concluído quando:** a permutação de registos/propriedades não causar divergência, enquanto alteração, adição e remoção de um registo continuarem a ser detetadas. Testar reconciliação após restauro.

### AUD-11 — erros permanentes são repetidos indefinidamente

**P2 · C · Corrigido no código.** Um problema que exige intervenção pode gerar novas tentativas automáticas de cinco em cinco minutos, sem estado acionável apresentado pelo scheduler.

**Evidência:** [AutomaticCloudBackup.tsx](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/src/components/ma-professor/sync/AutomaticCloudBackup.tsx#L498-L535) pausa autenticação e conflito de revisão; os restantes erros usam sempre `AUTO_BACKUP_RETRY_MS`. Uma cópia acima do limite do servidor, por exemplo, não se resolve repetindo o mesmo envio. O componente devolve `null` e não publica um diagnóstico próprio desse bloqueio.

**Reprodução dirigida:** injetar um erro permanente de «cópia demasiado grande» no envio do scheduler real; avançar os timers três vezes. Resultado: três novas tentativas e outro retry agendado. O ensaio não enviou três pedidos 413 a um servidor real.

**Correção mínima proposta:** distinguir erros permanentes de transitórios; suspender os primeiros e mostrar o estado/ação em Segurança e recuperação. Manter retry controlado para rede/5xx, com margem Free e sem comprometer o trabalho local.

**Concluído quando:** 400/413 permanentes não provocarem ciclos infinitos; rede/5xx recuperarem com política limitada; autenticação/409 mantiverem as proteções atuais; uma alteração relevante ou ação explícita puder retomar o envio.

### AUD-12 — documentação técnica de estado ainda descreve v2 ativo

**P3 · A · Corrigido no código.** A documentação pode levar uma futura intervenção a assumir rotas e compatibilidade que já não existem na baseline.

**Evidência:** [MA_PROFESSOR_BACKUP_PRIVACY_STATUS.md](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/docs/MA_PROFESSOR_BACKUP_PRIVACY_STATUS.md) e o início de [MA_PROFESSOR_OPAQUE_V3_PLAN.md](https://github.com/miguel4araujo5-bit/Ma-Code/blob/50c78098a466e6f71cbff35c99fd187e652ec616/docs/MA_PROFESSOR_OPAQUE_V3_PLAN.md) anunciam compatibilidade v2, promoção manual e `/key` como estado atual. O Worker atual e `cloud-backup-v3-only-baseline.test.mjs` impõem v3-only, com `/status`, `/get`, `/initialize-v3` e `/push-v3`.

**Correção mínima proposta:** separar claramente o histórico de migração do contrato atualmente implementado e datar o estado efetivo. A limpeza documental não autoriza eliminar colunas `recovery_*`, alterar migrations ou destruir registos antigos.

**Concluído quando:** os documentos de estado descrevam o código atual e remetam a confirmação de dados de produção para V-02; referências históricas estejam identificadas como tal.

## Fecho das correções — 30/09/2026

Commit: [`bd2c6bf71932437de2bc7295d8c93fe82549cf4a`](https://github.com/miguel4araujo5-bit/Ma-Code/commit/bd2c6bf71932437de2bc7295d8c93fe82549cf4a). Integração direta na `main`, sem alterar parâmetros OPAQUE, migrations, bindings ou dependências.

| ID | Resultado implementado | Evidência dirigida |
| --- | --- | --- |
| AUD-01 | Mantém `dirtyAt` de alterações posteriores ao snapshot, incluindo após reload. | Mutação durante upload, conclusão, remontagem e envio seguinte; sem ciclo adicional quando não há mutação. |
| AUD-02 | Desativa a preferência e invalida confiança antes do reset; conclusão de upload antigo não reativa o envio. A UI distingue eliminação local de cópia online. | Reset real, snapshot local vazio válido, timer/reload e conclusão em curso sem novo envio vazio nem confiança restabelecida. |
| AUD-03 | Limpa e verifica também a IndexedDB de rascunhos antes de anunciar sucesso do reset explícito de todo o browser. | Rascunho e dados principais removidos. O âmbito anunciado é todo o browser; esta operação não é usada para limpeza automática ao trocar de conta. |
| AUD-04 | Captura assinatura na pré-visualização e compara/escreve/verifica na mesma transação. | Edição concorrente rejeitada com o sumário recente preservado; proteção online continua funcional. |
| AUD-05 | Limpa e verifica tickets/mensagens na eliminação. Confirma a sessão após escrita de apoio e desfaz a operação se foi revogada. Atualiza a política pública. | Sem resíduos próprios, outras contas preservadas; escrita concorrente revogada retirada; ausência completa do schema opcional suportada, schema parcial falha fechado. |
| AUD-06 | Aplica limite de dez tickets no SQL atómico de inserção; primeira mensagem depende do ticket criado. | Nove tickets + duas criações simultâneas: uma HTTP 200 e uma 429, dez tickets, sem mensagens órfãs. |
| AUD-07 | Páginas de 30 mensagens, cursor data/id, botão de histórico professor/admin; até 40 mensagens do professor/24h, 200/conversa e 500/conta incluindo admin. Não trunca histórico antigo. | Quotas, isolamento, cursor inválido e ausência de duplicados; interfaces React preservam ordem ao carregar páginas anteriores. Dimensionamento no gate; consumo real em V-03. |
| AUD-08 | Neutraliza prefixos de fórmula e controlo em texto, incluindo variantes fullwidth; preserva valores numéricos. | Casos dirigidos de fórmula, tab/CR/LF, aspas e delimitador no CSV. **Excel e LibreOffice reais não ensaiados.** |
| AUD-09 | Rotula média e sugestão como valores «na confirmação», preservando o histórico e a nota final confirmada. | Ponderações 50/50 → 90/10: média atual 11, histórico/nota confirmada 15, CSV com significado temporal explícito. |
| AUD-10 | Canonicaliza registos por identificador e propriedades recursivamente antes da assinatura de conteúdo. | Permutações equivalentes não divergem; alterações reais continuam detetadas. |
| AUD-11 | Suspende imediatamente erro permanente; limita falhas transitórias a três tentativas consecutivas. Persiste estado acionável em Segurança e recuperação. | Erro permanente sem timer/retry após reload; nova mutação limpa bloqueio e permite retomar; proteção de autenticação/conflito mantida pelos testes existentes. |
| AUD-12 | Documenta contrato v3-only e identifica o plano de migração como histórico. | Documentos alinhados com rotas/testes v3-only; dados efetivos de produção continuam em V-02. |

Testes novos: [segurança de dados e concorrência](../../tests/ma-professor/audit-data-safety-regression.test.mjs) e [paginação nas interfaces](../../tests/ma-professor/support-pagination-ui.test.mjs). Usam código real com IndexedDB/SQLite locais e eventos/autenticação controlados; não representam uma operação executada sobre dados de produção.

Validação local: suite MA-Professor com **216 entradas e zero falhas**, suites Conquistador e MA-Quadro, build TypeScript/Worker/Vite e os três percursos Chromium passaram. Os limites de consumo, cenários de vinte professores e condições de classe C constam do [gate](ma-professor-correcao-gate-cloudflare.md). Corrigidas ainda quatro utilizações preexistentes de `.at(-1)` incompatíveis com o alvo ES2020, substituídas pelo equivalente `.slice(-1)[0]`, sem mudar configurações ou dependências.

CI do commit de código: **sucesso** — [Build Check](https://github.com/miguel4araujo5-bit/Ma-Code/actions/runs/36675035845). Confirmada a execução efetiva das suites MA-Professor, Conquistador e MA-Quadro, dos três percursos Chromium e do build; não foram apenas passos ignorados num commit documental.

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

**P2 · C · Por validar.** Rever CPU real e quotas consumidas por backup, autenticação, apoio e restantes produtos da mesma conta. Os caminhos sem limite de AUD-07 e AUD-11 foram controlados no código; a estimativa e o custo adicional da confirmação de sessão estão no [gate das correções](ma-professor-correcao-gate-cloudflare.md).

Limites oficiais consultados em 29/09/2026: [Workers](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) e [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/). Workers Free: 100 mil pedidos/dia e 10 ms de CPU por pedido. D1 Free: 5 milhões de linhas lidas/dia, 100 mil escritas/dia, 5 GB totais e 500 MB por base. Escritas em índices também contam. Durable Objects SQLite têm quotas próprias; não ignorar as operações de armazenamento da autenticação.

O intervalo mínimo automático é dez minutos. Como cenário extremo de referência, vinte professores a alterar dados durante 24 horas permitem até 2 880 ciclos/dia. Este número não mede CPU, operações D1/DO nem o consumo restante da conta. O armazenamento deve incluir a cópia atual **e as duas gerações anteriores**, além de base64, índices e tickets.

Fechar com tempos de CPU/erros por rota, linhas D1 lidas/escritas, operações DO, armazenamento, picos e margem para pelo menos vinte professores simultâneos. Preferir medições de operações isoladas e extrapolação conservadora antes de qualquer carga de produção. A correção não adiciona recursos, jobs ou polling; acrescenta confirmação de sessão após escritas de apoio, contabilizada no gate. Falta a medição agregada real.

## Regra para atualizar esta lista

Marcar um ponto como concluído só depois de indicar commit da correção, reprodução/teste dirigido, validação exigida pela classe e eventuais limitações. Conservar o ID para manter o histórico. Se uma verificação da `main` mostrar que um ponto já foi resolvido por outro trabalho, registar a evidência em vez de duplicar a implementação. Não reabrir achados da auditoria antiga de navegação sem uma nova regressão demonstrada.
