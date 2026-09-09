# MA-CODE — Estado operacional único dos agentes

Atualizado por: coordenação unificada / função A1
Data: 2026-09-09
Fonte técnica: `main` confirmada em `00898c6a354ef276f54f641c925fc69013c2e274`.

## Estado global

**ENTREGA MA-PROFESSOR INTEGRADA E VALIDADA.**

O PR #41 (`[RELEASE CANDIDATE] MA-Professor — composição final 2026-09-08`) foi integrado em `main` no commit:

`00898c6a354ef276f54f641c925fc69013c2e274`

HEAD exacto validado antes do merge:

`7c83135888313c5356f1d3fb1707b4966475b37e`

### Prova final antes do merge

Build Check run `34330385099`, job `102397336384`, Node 24:
- instalação — PASS;
- Conquistador — PASS;
- MA-Professor — PASS;
- MA-Quadro — PASS;
- `npm run build` — PASS.

### Prova pós-merge em `main`

Build Check run `34330558886`, job `102397895174`, commit `00898c6a354ef276f54f641c925fc69013c2e274`:
- instalação — PASS;
- Conquistador — PASS;
- MA-Professor — PASS;
- MA-Quadro — PASS;
- `npm run build` — PASS.

## Estado dos PRs

**Zero PRs abertos.**

Os drafts históricos/empilhados foram automaticamente fechados pelo merge quando aplicável ou encerrados como substituídos/evidência após confirmação do release. Nenhum deve ser reaberto ou integrado separadamente sem finding novo e comparação contra a `main` actual.

As branches antigas permanecem apenas como histórico técnico; não são fonte operacional.

## Funcionalidade integrada nesta entrega

- importação PDF + DOCX directamente em UFCD/módulos, com revisão antes de guardar e criação atómica de módulos + planificações;
- importação persistente e idempotente de planificações, com proteção contra stale preview e rollback;
- acesso, sessão, activação, renovação e logout consistentes;
- backup/restore atómico e proteções de recuperação/snapshot;
- Daily com persistência segura, Quick Grade atómico e proteção de concorrência;
- GIAE com cópia/versionamento e submissão explícita segura;
- critérios simples por disciplina e personalização de UFCD protegida por evidência histórica;
- importação de horário com `Eq Pedag`, `Co PCE`, `Clube Xadrez` e adições manuais no preview;
- CI global com Conquistador + MA-Professor + MA-Quadro + build em Node 24.

## MA-Quadro

Estado preservado:
- `MAQuadroHomeWorkspace.tsx` continua ausente;
- `MAQuadroHome.tsx` continua canónico;
- `MAQuadroApp.tsx` consome `MAQuadroHome`;
- suite MA-Quadro passou antes e depois do merge.

## Segurança / dados locais e cloud

### Apagar utilizador

A eliminação de utilizador no servidor remove os dados cifrados/snapshot cloud e metadados de sync associados antes de remover o estado de acesso.

Os dados locais IndexedDB do dispositivo **não são apagados remotamente**. Por isso, apagar uma conta e recriar a mesma identidade no mesmo browser pode voltar a expor os dados pedagógicos que permaneceram localmente. Isto não prova restauração cloud; é comportamento local-first.

Uma conta diferente com dados locais significativos continua bloqueada pela fronteira de isolamento em vez de receber esses dados silenciosamente.

### CryptoSetupGate

A investigação histórica `NEXT-CRYPTO-RECOVERY-01` fica arquivada:
- existe um risco demonstrável delete-before-replacement num caminho actualmente inactivo;
- não foi encontrado consumidor produtivo de `CryptoSetupGate`;
- não é um defeito produtivo alcançável no estado actual;
- **se o gate vier a ser montado no futuro, esta investigação deve ser reaberta antes da activação.**

## Regra operacional a partir de agora

1. A `main` actual é a única base funcional autorizada.
2. Não retomar branches/SHAs antigos como se fossem trabalho pendente.
3. Os seis papéis A1–A6 ficam **em pausa**; servem apenas como especialidades internas para nova análise.
4. Uma nova tarefa começa por leitura da `main` actual e diagnóstico, não por continuação automática de lotes antigos.
5. Alterações de alto risco continuam a exigir branch isolada, testes proporcionais e gate global antes de merge.
6. `AGENT_MESSAGES.md` permanece histórico append-only; não reescrever mensagens antigas.
7. Este ficheiro volta a ser actualizado quando existir uma nova entrega ou finding confirmado.

## Pendências não bloqueantes / futuras

- UX opcional para tornar mais explícita a diferença entre “Apagar utilizador” na cloud e “Apagar dados deste dispositivo”. Não apagar dados locais silenciosamente.
- Se `CryptoSetupGate` for activado no futuro, corrigir primeiro o caminho destrutivo demonstrado na investigação arquivada.
- Novas melhorias de produto só entram por pedido explícito do utilizador ou finding novo confirmado contra a `main` actual.
