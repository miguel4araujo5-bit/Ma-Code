# MA-Professor — passagem definitiva das cópias online para V3

Base confirmada: `main` em `45167bb6573fc037af4f2e662ade683c3eceae02`, 03/10/2026.
Risco C. Os dados V1/V2 existentes são de teste e a sua eliminação foi autorizada.

## Alteração

- `/api/ma-professor/sync/initialize` passa a responder 410. O código de criação de perfis/dispositivos antigos foi removido; `/sync/status` mantém o contrato de leitura atual.
- A migração `0005_cloud_backup_v3_only.sql` instala primeiro guardas de escrita no D1. Perfis, registos e histórico aceitam apenas V3; a tabela antiga de dispositivos RSA deixa de aceitar escritas.
- A mesma migração elimina os perfis que não são V3, os seus registos/histórico, as entradas cifradas antigas e os dispositivos RSA. Não converte perfis nem apaga qualquer perfil com `crypto_version = 3`, incluindo os marcados como eliminados.
- Apagar uma conta remove e verifica explicitamente o histórico cifrado, mesmo sem depender de cascatas. Mantém o percurso administrativo existente de eliminação e invalidação de sessões.
- A cifra V3, OPAQUE, licenças e a escolha explícita antes do envio não foram alterados.

## Gate Cloudflare Free

Limites oficiais consultados em 03/10/2026:

- Workers: 100 000 pedidos/dia e 10 ms de CPU por invocação — https://developers.cloudflare.com/workers/platform/limits/
- D1: 5 milhões de linhas lidas/dia, 100 000 escritas/dia e 5 GB totais — https://developers.cloudflare.com/d1/platform/pricing/
- D1 Free: 500 MB por base, linha até 2 MB e 50 consultas por invocação — https://developers.cloudflare.com/d1/platform/limits/

A alteração não acrescenta pedidos de rede, polling, timers, jobs, Durable Objects ou recursos pagos. As guardas comparam campos da linha escrita; a limpeza percorre os resíduos uma vez. A eliminação administrativa acrescenta uma eliminação e uma verificação do histórico à rotina já existente.

Para 20 professores e duas cópias manuais diárias por professor, o percurso atual faz cerca de 200 pedidos/dia. O teto atual de 1 MB de conteúdo cifrado, com codificação Base64 e até duas gerações anteriores, representa cerca de 80 MB para 20 contas, antes de metadados e de outros dados da aplicação. Estes valores dimensionam o backup; não substituem a medição do consumo total da conta Cloudflare nem da CPU de produção. Não há aumento material de consumo diário com esta alteração.

## Aplicação em produção — pendente de publicação autorizada

1. Confirmar que a main publicada corresponde à alteração validada. Não executar conversões V2 → V3 nem repor o endpoint antigo.
2. Antes da migração, obter uma salvaguarda administrativa/Time Travel e registar contagens por `crypto_version`/`encryption_version`, sem divulgar chaves, passwords ou conteúdos cifrados.
3. Aplicar pelo percurso Cloudflare existente:

   ```sh
   npx wrangler d1 migrations apply ma-professor-production --remote
   ```

   Confirmar previamente a lista de migrações pendentes. Não usar este comando às cegas se houver outras migrações por analisar.

4. Confirmar que não existem perfis ou registos com versão diferente de 3, que os dispositivos RSA estão vazios e que `PRAGMA foreign_key_check` não acusa resíduos. Comparar os perfis/registos V3 com a salvaguarda.
5. Numa conta de teste, confirmar uma cópia manual, recarregar, iniciar sessão noutro dispositivo e restaurar sumários, faltas e avaliações. Confirmar que um lembrete sozinho não envia dados.

A limpeza e a verificação de produção não foram executadas no ambiente de desenvolvimento. Não considerar a passagem encerrada apenas por a API responder 200 ou pelos testes locais passarem. Não voltar a publicar uma versão do Worker que escreva dados legados; as guardas D1 devem permanecer ativas.

## Validação automatizada

- Integração com o Worker real e SQLite: perfis novos em V3, e-mail reutilizado após limpeza e após eliminação, rejeição de escritas antigas, preservação byte a byte do V3 e conflitos de revisão.
- Percurso real de código: IndexedDB → criação da cópia → cifra V3 → Worker/D1 local → descarga e decifra → nova IndexedDB → reabertura; verifica sumários, faltas, critérios, avaliações e notas finais.
- Suites gerais de Conquistador, MA-Professor e MA-Quadro, compilação e percursos existentes de navegador. Resultados concretos no resumo da alteração.

Os bindings D1/DO dos testes de navegador são locais. Estes testes não constituem um restauro já confirmado na D1 de produção ou num dispositivo físico do utilizador.
