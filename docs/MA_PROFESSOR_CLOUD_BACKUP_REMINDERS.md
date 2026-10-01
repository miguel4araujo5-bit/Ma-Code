# MA-Professor — cópia online com confirmação

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
