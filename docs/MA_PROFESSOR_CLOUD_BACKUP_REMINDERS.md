# MA-Professor — cópia online com confirmação

Data: 30/09/2026. Base: `3760012d322ac5d0095fe544f7df54783a6cf454`. Risco C.

Decisão aprovada: substituir o envio automático pelo aviso «Tem alterações significativas por guardar. Deseja guardar o seu progresso?», com **Sim**, **Não** e **Não voltar a perguntar**. Sim prepara os dados atuais e usa o envio cifrado v3 existente; Não adia; a terceira opção desativa os lembretes até serem reativados em Segurança e recuperação. A cópia manual permanece disponível. O aviso não compara os dados locais com a cópia remota nem exige alinhamento prévio para permitir guardar.

Mantêm-se a deteção Dexie e os tempos existentes: 90 segundos sem alterações, máximo de cinco minutos de alterações contínuas, intervalo mínimo de dez minutos depois de uma cópia ou aviso. As janelas em segundo plano aguardam foco. A escolha ativa passa a ser gravada como `reminders` na preferência existente; a leitura migra a escolha `enabled` sem perder a preferência. As versões antigas só reconhecem `enabled`, pelo que suspendem os uploads ao receber esta alteração.

Não há pedidos de rede ao montar o observador, mostrar o aviso, adiar ou desativar. Só Sim inicia um envio, sem retries automáticos. Erros são apresentados ao professor. Mantêm-se autenticação, cifra, validação do envio/restauro e contratos Worker/D1. O Worker atual atualiza o único registo `database-v1` por conta; não cria histórico de gerações.

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
