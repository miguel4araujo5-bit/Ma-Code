# MA-Professor — quadro e confirmação antes do envio

Data: 30/09/2026. Risco C. Complementa a correção da confirmação da password.

## Percurso

Já existia uma pré-visualização manual, mas exigia carregar em «Preparar cópia para a nuvem». Confirmar a password passa a preparar localmente esse quadro sem outro clique. Se uma cópia já estiver preparada após uma falha de autenticação, o quadro é conservado e exige nova confirmação.

A tabela apresenta contagens das 22 coleções incluídas na cópia completa, mais os totais derivados de sumários, faltas e notas finais preenchidas. As quantidades pertencem ao snapshot efetivamente enviado, incluindo horário, calendário/PAA, planificações, critérios, assiduidade, avaliações, recuperações e definições. A preferência dos lembretes permanece acessível abaixo do quadro.

Antes de enviar, o professor assinala «Confirmo o envio dos dados apresentados e a substituição da cópia online anterior» e carrega em «Confirmar e enviar para a nuvem». Preparar, atualizar, assinalar a confirmação ou cancelar não envia a cópia. Atualizar, cancelar, reautenticar ou iniciar uma tentativa de envio repõe a confirmação. Uma tentativa falhada não volta a enviar automaticamente.

O envio reutiliza o snapshot apresentado e o uploader v3 existente. Depois de verificar a gravação remota, uma comparação local identifica alterações posteriores à preparação e mantém-nas pendentes. Se essa leitura local falhar, a cópia remota confirmada continua reconhecida e os dados atuais ficam conservadoramente pendentes. Não se alteram os dados escolares, o formato das cópias, chaves, cifra, endpoints, Worker, D1 ou migrations. O comportamento aprovado do lembrete «Sim / Não / Não voltar a perguntar» mantém-se.

## Gate Cloudflare Free antes do código

Limites oficiais confirmados em 30/09/2026: [Workers](https://developers.cloudflare.com/workers/platform/limits/) — 100 000 pedidos/dia e 10 ms CPU/pedido; [D1](https://developers.cloudflare.com/d1/platform/pricing/) — 5 milhões de linhas lidas/dia, 100 000 escritas/dia e 5 GB totais.

O quadro, a confirmação e a comparação posterior usam apenas dados locais. Acréscimo por professor e para vinte professores simultâneos: zero pedidos Worker, leituras/escritas D1, armazenamento ou tráfego de cópias. Mesmo com atualizações repetidas do quadro, o acréscimo remoto é zero. O envio confirmado mantém o percurso e consumo existentes, sem polling, retries automáticos, recursos novos ou plano pago.

## Validação

O percurso Chromium usa o Worker de produção com SQL e bindings locais, conta escritas cloud e verifica as quantidades contra os dados reais da aplicação. Inclui password preenchida nativamente, quadro automático, confirmação inicialmente desmarcada, cancelamento, atualização, falha temporária, nova autenticação, envio/restauro cifrado, snapshot preservado e alterações posteriores pendentes. Uma segunda gravação verifica que dados inalterados ficam atualizados.

As capturas em 1366 e 390 px, nos temas claro e escuro, destinam-se à inspeção visual da tabela e confirmação. As contas e os dados são fictícios. Safari/iPhone reais continuam por validar; build/CI não comprova publicação em produção.

Passaram o build, os 1091 testes MA-Professor, os testes dos restantes produtos e os três percursos Chromium. A última execução do percurso de cópia decorreu isoladamente e passou, depois de uma execução concorrente com as suites expirar ainda no onboarding; essa expiração ocorreu antes de carregar este painel, sem erros JavaScript registados. As quatro capturas da tabela final foram inspecionadas, sem sobreposição ou corte de texto.
