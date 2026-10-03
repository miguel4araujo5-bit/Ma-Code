# MA-Professor — cópia online com confirmação

## Estado atual — 03/10/2026, issue #237

As decisões desta secção substituem a temporização e as escolhas descritas no registo histórico abaixo. Base: `main` em `711076bf2ccdfb0c05cab695f198c2876c8ec640`. Risco C.

- Os lembretes aparecem às **12:19 e 16:59**, na hora local do dispositivo, apenas com a aplicação aberta, em foco e com alterações locais pendentes. Um horário perdido em segundo plano ou durante a suspensão do navegador é descartado; não gera um aviso atrasado.
- **Guardar agora** prepara o quadro dos dados locais. Atualizar, cancelar, ignorar e abrir o aviso não enviam dados. Apenas a confirmação final envia o snapshot revisto. O aviso fica acima dos diálogos existentes e devolve o foco ao contexto anterior.
- A cópia manual chama-se **Guardar cópia online** e fica disponível mesmo sem alterações pendentes. Os controlos bloqueiam envios simultâneos e impõem **30 segundos** entre tentativas locais. O Worker confirma também o intervalo de 30 segundos entre envios bem-sucedidos, usando o perfil D1 existente e uma condição atómica de escrita, incluindo entre dispositivos. Não há retries automáticos.
- A chave OPAQUE `exportKey` continua apenas em memória. A password só é pedida quando a chave não está disponível; a cifra e o contrato de recuperação V3 mantêm-se.
- **Eliminar cópia online** exige escrever exatamente **APAGAR** e confirmar. A eliminação usa as revisões mostradas ao professor; remove o snapshot cifrado e o histórico da conta numa transação, incrementa a revisão e conserva o perfil V3/OPAQUE, os dados locais e os lembretes. Uma cópia posterior volta a usar a mesma proteção. O apagamento local continua separado.
- As falhas oferecem **Tentar novamente**, **Enviar relatório** e **Ignorar**. Tentar novamente prepara um novo quadro que exige outra confirmação final. O relatório existente acrescenta dispositivo e, com sessão verificada no backend, contacto da conta para suporte. Não inclui IndexedDB, conteúdo escolar, passwords, chaves ou snapshot cifrado. Só os campos técnicos normalizados e a mensagem opcional são persistidos.
- O Admin existente recebe os relatórios com estados **Novo**, **Em análise** e **Resolvido**, e uma nota interna. A listagem é manual e limitada a 100, com índice para a ordenação. A eliminação administrativa da conta remove também os relatórios associados.

### Gate Cloudflare Free da conclusão, antes do código

Limites oficiais novamente consultados em 03/10/2026: [Workers](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) e [D1 limits](https://developers.cloudflare.com/d1/platform/limits/). Workers Free: 100 000 pedidos/dia e 10 ms CPU/pedido. D1 Free: 5 milhões de linhas lidas/dia, 100 000 escritas/dia, 500 MB/base, 5 GB/conta e 50 consultas/invocação.

Para 20 professores e duas cópias confirmadas por dia, reservar 40 envios, até 300 pedidos e 800 escritas/dia para o percurso completo. Vinte eliminações de cópia acrescentam até 60 linhas eliminadas, vinte atualizações do perfil e as verificações indexadas. Vinte relatórios/dia, com uma reserva de 2 KB por relatório e respetivos índices, acrescentam cerca de 40 KB/dia (14,6 MB/ano), além do limitador existente. Este já limita a oito relatórios por origem/15 minutos e quarenta por hora no total, e limpa os seus metadados após dois dias. Estes números dimensionam o uso habitual; não são medições de produção nem garantias para abuso no limite máximo.

O intervalo e a eliminação reutilizam o perfil, registo e histórico existentes. O relatório acrescenta uma tabela e dois índices na migração `0006_problem_reports.sql`; usa o D1, a autenticação Admin e a verificação de sessão existentes. Não há novo Durable Object, polling, job periódico, dependência ou recurso pago. As consultas novas usam identificadores indexados ou a fila limitada. A CPU e o consumo agregado da conta continuam a exigir medição de produção.

### Aplicação em produção

Aplicar `0006_problem_reports.sql` no D1 existente para ativar a persistência e gestão dos relatórios no Admin. Enquanto essa tabela não existir, conserva-se exclusivamente o percurso anterior de envio por email; se esse envio falhar, não se confirma sucesso. Outras falhas D1 continuam visíveis e não acionam este fallback. Confirmar as migrações pendentes pelo procedimento existente; a limpeza V1/V2 da migração `0005` conserva o gate de salvaguarda e verificação descrito em `MA-PROFESSOR_BACKUP_V3_CUTOVER.md`. A conclusão desta implementação não afirma que as migrações remotas já foram aplicadas.

Os testes usam contas fictícias, Worker real com SQLite local e Chromium. Os resultados concretos constam do resumo da alteração. Não equivalem a publicação, medição de CPU D1/Worker ou validação num iPhone físico.

### Validação da conclusão

- Build TypeScript/Vite e geração das 16 rotas: passaram.
- MA-Professor: 1127 testes na suite completa inicial, zero falhas, e teste adicional do envio anterior enquanto a migração está pendente. Incluem horários locais, avisos perdidos, foco preservado, snapshot confirmado, erros sem reenvio automático, intervalo entre dispositivos, eliminação concorrente e rollback, recuperação V3 após eliminação e relatórios com identidade verificada/anonimato/auth Admin.
- Conquistador: 1 teste; MA-Quadro: 15 testes; todos passaram.
- Chromium: os três percursos existentes de acesso/OPAQUE/cópias, navegação unificada e regressão integrada passaram. O percurso de cópias cobre APAGAR, preservação dos dados e perfil, novo envio após eliminar e os dois horários de lembrete a 1366 e 390 px.
- Verificação de whitespace/diff: passou. Os dados e bindings remotos não foram alterados durante os testes.

## Registo histórico — 30/09 e 01/10/2026

Data: 30/09/2026. Base: `3760012d322ac5d0095fe544f7df54783a6cf454`. Risco C.

Decisão aprovada: substituir o envio automático pelo aviso «Tem alterações significativas por guardar. Deseja guardar o seu progresso?», com **Sim**, **Não** e **Não voltar a perguntar**. Sim prepara o quadro dos dados atuais, sem envio; só a confirmação final do quadro usa o envio cifrado v3 existente; Não adia; a terceira opção desativa os lembretes até serem reativados em Segurança e recuperação. A cópia manual permanece disponível. O aviso não compara os dados locais com a cópia remota nem exige alinhamento prévio para permitir guardar.

Mantêm-se a deteção Dexie e os tempos existentes: 90 segundos sem alterações, máximo de cinco minutos de alterações contínuas, intervalo mínimo de dez minutos depois de uma cópia ou aviso. As janelas em segundo plano aguardam foco. A escolha ativa passa a ser gravada como `reminders` na preferência existente; a leitura migra a escolha `enabled` sem perder a preferência. As versões antigas só reconhecem `enabled`, pelo que suspendem os uploads ao receber esta alteração.

Não há pedidos de rede ao montar o observador, mostrar o aviso, adiar ou desativar. Sim e a atualização do quadro só leem dados locais. O envio exige a confirmação final, sem retries automáticos. Erros são apresentados ao professor. Mantêm-se autenticação, cifra, validação do envio/restauro e contratos Worker/D1. O Worker atual atualiza o único registo `database-v1` por conta; a migração `0002_encrypted_snapshot_history.sql` acrescenta um trigger que conserva duas gerações cifradas anteriores. A cópia atual continua a ser a única disponível na interface. O histórico é recuperável tecnicamente por SQL, sem alteração da cifra. O apagamento por cascata acompanha a eliminação do perfil da conta. A presença do trigger em produção continua por confirmar com acesso D1.

## Gate Cloudflare Free antes do código

Fontes oficiais consultadas em 30/09/2026: [Workers](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) e [D1 limits](https://developers.cloudflare.com/d1/platform/limits/). Workers Free: 100 000 pedidos/dia e 10 ms CPU/pedido. D1 Free: 5 milhões de linhas lidas/dia, 100 000 escritas/dia, 500 MB/base e 5 GB/conta.

Para vinte professores que confirmem todos os avisos em oito horas, reservar 20 × 48 = 960 envios/dia, seis pedidos/envio e vinte escritas D1/envio: 5 760 pedidos e 19 200 escritas. Reservar ainda cem linhas lidas/envio dá 96 000 leituras/dia. São estimativas conservadoras, não medições da conta. O volume de envios não aumenta em relação à temporização anterior e desaparecem as consultas de alinhamento e retries automáticos. A cifra continua local e o custo de CPU por operação do Worker não muda. O serviço de acesso existente é reutilizado; não há novos DO, polling, jobs, migrations, índices, dependências nem recursos pagos.

O pedido aprovado mantém uma única cópia no produto. A recuperação técnica da infraestrutura D1 é independente desse comportamento e não é alterada nesta tarefa.

## Validação

- Treze testes funcionais com React/DOM: três escolhas, dados lidos no momento de Sim, intervalo persistido, migração da escolha antiga, reativação, falta de chave, alterações durante envio, cancelamento durante preparação, erros sem retries, janela em segundo plano, editor aberto e confirmação manual.
- Auditoria de dados: marcador pendente depois de reload, reset durante um envio explicitamente confirmado e falhas que não originam reenvio automático.
- Suite MA-Professor, Conquistador e MA-Quadro; build TypeScript/Vite.
- Três percursos Chromium existentes: acesso/OPAQUE/cópias (incluindo o novo aviso), navegação e regressão integrada. O aviso foi inspecionado a 1366 e 390 px.

Testes de rede/sessão usam fixtures; nenhum dado real de professor foi alterado. Safari/iPhone reais e o consumo agregado de produção permanecem fora desta validação.

## Correção de 01/10/2026 — risco C

Ausência de confiança anterior e ativação dos lembretes deixam de ser tratadas como alterações. O observador local conserva alterações reais mesmo com os lembretes desligados, sem pedidos remotos. O apagamento explícito suspende a marcação durante a transação de reset. Sim prepara o mesmo quadro usado na cópia manual; cancelar ou atualizar nunca envia. A confirmação envia exatamente o snapshot revisto, preservando alterações posteriores como pendentes. O controlo de concorrência durante o envio permanece no serviço v3; não se repõe o veto por antiguidade entre dispositivos.

Gate antes do código: limites oficiais Workers e D1 novamente consultados em 01/10/2026. A correção acrescenta zero pedidos, leituras/escritas D1, armazenamento remoto ou tráfego por professor e para vinte professores simultâneos, incluindo picos de edição/atualização do quadro. Apenas os envios confirmados usam o serviço existente. Não se alteram Worker, migrations, chaves, cifra, DO, polling, dependências ou plano.

Validação da correção: build TypeScript/Vite; 23 testes dirigidos; suite completa com 1094 testes MA-Professor, 1 Conquistador e 15 MA-Quadro; teste SQL adicional do histórico e cascata; auditoria de segurança de dados incluindo reset durante envio, alterações concorrentes, restauro e falhas sem retries. Os testes usam dados fictícios e SQL local. A confirmação do D1 de produção permanece pendente.

O percurso Chromium de acesso/OPAQUE/cópia/restauro também passou, incluindo a cópia manual com o quadro comum e o lembrete Sim → quadro → confirmação final. Não valida Safari/iPhone reais nem publicação em produção.
