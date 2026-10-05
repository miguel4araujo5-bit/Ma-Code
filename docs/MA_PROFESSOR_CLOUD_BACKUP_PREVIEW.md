# MA-Professor — quadro e confirmação antes do envio

Data: 30/09/2026. Risco C. Complementa a correção da confirmação da password.

## Percurso

Já existia uma pré-visualização manual, mas exigia carregar em «Preparar cópia para a nuvem». Confirmar a password passa a preparar localmente esse quadro sem outro clique. Se uma cópia já estiver preparada após uma falha de autenticação, o quadro é conservado e exige nova confirmação.

A tabela apresenta contagens das 23 coleções incluídas na cópia completa, mais os totais derivados de sumários, faltas, lembretes semanais e notas finais preenchidas. Os eventos do calendário e as atividades do PAA têm contagens separadas. As quantidades pertencem ao snapshot efetivamente enviado, incluindo horário, PAA, planificações, critérios, assiduidade, avaliações, recuperações e definições. A preferência dos lembretes permanece acessível abaixo do quadro.

Desde 05/10/2026, as atividades do PAA são guardadas numa tabela própria da base local, com transferência transacional do armazenamento anterior para todos os anos letivos existentes. A próxima gravação explícita substitui a cópia anterior por outra que já inclui essas atividades, sem alterar a cifra v3 ou os endpoints. O restauro inclui o PAA na mesma transação e verificação dos outros dados; as cópias anteriores sem essa coleção continuam aceites, mas não podem recuperar atividades que nunca incluíram. O armazenamento antigo não é reaplicado depois de um restauro ou reset.

Os rascunhos por guardar continuam fora da cópia. Um aviso na descarga e no quadro de envio indica quantas aulas da conta atual têm alterações por guardar, sem revelar dados de outras contas nem iniciar envios. O aviso atualiza por eventos locais e ao regressar à janela, sem polling.

Antes de enviar, o professor assinala «Confirmo o envio dos dados apresentados e a substituição da cópia online anterior» e carrega em «Confirmar e enviar para a nuvem». Preparar, atualizar, assinalar a confirmação ou cancelar não envia a cópia. Atualizar, cancelar, reautenticar ou iniciar uma tentativa de envio repõe a confirmação. Uma tentativa falhada não volta a enviar automaticamente.

O envio reutiliza o snapshot apresentado e o uploader v3 existente. Depois de verificar a gravação remota, uma comparação local identifica alterações posteriores à preparação e mantém-nas pendentes. Se essa leitura local falhar, a cópia remota confirmada continua reconhecida e os dados atuais ficam conservadoramente pendentes. Não se alteram os dados escolares, o formato das cópias, chaves, cifra, endpoints, Worker, D1 ou migrations. O comportamento aprovado do lembrete «Sim / Não / Não voltar a perguntar» mantém-se.

Em 05/10/2026 foi corrigida uma falsa falha ao substituir a cópia: o Worker exigia exatamente uma alteração no resultado D1, mas a rotação das gerações cifradas acrescenta alterações de triggers a `meta.changes`. O upload podia ficar gravado e devolver 409. A confirmação passa a aceitar uma contagem positiva em cada uma das duas escritas condicionais; zero alterações continua a ser conflito. As revisões, a transação e a verificação por download/desencriptação/hash mantêm-se. Os bindings de teste reproduzem agora `sqlite3_total_changes()`, conforme o D1, incluindo arquivo e remoção do histórico. O painel identifica explicitamente a cópia no servidor e distingue-a de um envio não confirmado.

## Gate Cloudflare Free antes do código

Limites oficiais confirmados em 30/09/2026: [Workers](https://developers.cloudflare.com/workers/platform/limits/) — 100 000 pedidos/dia e 10 ms CPU/pedido; [D1](https://developers.cloudflare.com/d1/platform/pricing/) — 5 milhões de linhas lidas/dia, 100 000 escritas/dia e 5 GB totais.

O quadro, a confirmação e a comparação posterior usam apenas dados locais. Acréscimo por professor e para vinte professores simultâneos: zero pedidos Worker, leituras/escritas D1, armazenamento ou tráfego de cópias. Mesmo com atualizações repetidas do quadro, o acréscimo remoto é zero. O envio confirmado mantém o percurso e consumo existentes, sem polling, retries automáticos, recursos novos ou plano pago.

Gate da inclusão do PAA, revisto em 05/10/2026: mantêm-se os limites oficiais acima, com [500 MB por base D1 e 2 MB por linha](https://developers.cloudflare.com/d1/platform/limits/). Não há novos pedidos ou linhas D1 por cópia. Um cenário de 500 atividades de 1 KiB por professor acrescenta aproximadamente 10 MiB antes da compressão para 20 professores, ou 30 MiB contando as três gerações já existentes. A compressão/cifra permanece no dispositivo e o limite existente de 1 MB cifrado por cópia mantém-se. Nenhum recurso cloud, migration D1 ou plano é alterado.

Gate da correção da confirmação, revisto antes do código em 05/10/2026: o [D1 documenta `changes` como `sqlite3_total_changes()`](https://developers.cloudflare.com/api/resources/d1/), que inclui [escritas de triggers](https://www.sqlite.org/c3ref/total_changes.html). A correção da comparação acrescenta zero pedidos, leituras, escritas ou bytes remotos, por professor e para 20 professores. Os triggers e o histórico existentes permanecem; não há polling, retries automáticos ou alterações de infraestrutura.

## Validação

O percurso Chromium usa o Worker de produção com SQL e bindings locais, conta escritas cloud e verifica as quantidades contra os dados reais da aplicação. Inclui password preenchida nativamente, quadro automático, confirmação inicialmente desmarcada, cancelamento, atualização, falha temporária, nova autenticação, envio/restauro cifrado, snapshot preservado e alterações posteriores pendentes. Uma segunda gravação verifica que dados inalterados ficam atualizados.

As capturas em 1366 e 390 px, nos temas claro e escuro, destinam-se à inspeção visual da tabela e confirmação. As contas e os dados são fictícios. Safari/iPhone reais continuam por validar; build/CI não comprova publicação em produção.

Passaram o build, os 1091 testes MA-Professor, os testes dos restantes produtos e os três percursos Chromium. A última execução do percurso de cópia decorreu isoladamente e passou, depois de uma execução concorrente com as suites expirar ainda no onboarding; essa expiração ocorreu antes de carregar este painel, sem erros JavaScript registados. As quatro capturas da tabela final foram inspecionadas, sem sobreposição ou corte de texto.
