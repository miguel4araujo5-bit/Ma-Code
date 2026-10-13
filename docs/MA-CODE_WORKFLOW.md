# MA-CODE — WORKFLOW OPERACIONAL
**Versão:** 1.8 | **Data:** 13/10/2026 | **Branch normal:** main

## 1. Missão
Executar cada tarefa explicitamente autorizada até ao estado terminal verificável. Não confundir resposta, ferramenta concluída, commit, build, integração e publicação.

## 2. Máquina de estados
- `EM_EXECUÇÃO`: existem ações autorizadas e executáveis; continuar.
- `EM_VERIFICAÇÃO`: testar comportamento e confirmar integração/publicação quando aplicável; continuar.
- `BLOQUEADA`: falta decisão indispensável, aprovação obrigatória, credencial inacessível ou existe impedimento técnico concreto. Identificar o que está bloqueado, evidência e alternativa segura; continuar pontos independentes.
- `INTERROMPIDA`: interrupção externa ou pedido de parar. Guardar o ponto de retoma com estado confirmado e próximo passo; não afirmar conclusão.
- `CONCLUÍDA`: todos os critérios aplicáveis foram verificados, incluindo resultado funcional, testes proporcionais, main e deploy quando aplicável.

Transições normais: EM_EXECUÇÃO → EM_VERIFICAÇÃO → CONCLUÍDA. Falha de verificação → EM_EXECUÇÃO para correção. Bloqueio real → BLOQUEADA. Interrupção → INTERROMPIDA. Retoma → estado executável adequado.

## 3. Ciclo obrigatório
1. Interpretar o pedido e definir critérios objetivos de aceitação. Perguntar apenas por decisão indispensável.
2. Ler o contexto necessário e a implementação canónica da `main`. Confirmar versão antes de escrever.
3. Classificar risco: A (visual/local), B (funcional/dados derivados), C (segurança, persistência crítica, Cloudflare, auth, backups, configuração/deploy).
4. Seguir dependências e gates aplicáveis. Para impacto Cloudflare, estimar com pelo menos 20 professores, limites Free oficiais atuais, pico e margem; não introduzir custo pago sem autorização.
5. Alterar o mínimo necessário. Preservar comportamento, dados, contratos e trabalho concorrente. Coordenar um escritor por ficheiro.
6. Validar o comportamento alterado e regressões relevantes; executar verificações comuns uma vez por lote compatível.
7. Integrar na `main` pelo método GitHub autenticado comprovado, verificando SHA e checks. Confirmar publicação se a tarefa a exigir.
8. Verificar os critérios de aceitação. Se falta uma ação executável, continuar; se existe falha, corrigir e repetir a verificação relevante.
9. Registar estado e evidência no ponto de retoma no fim da tarefa/lote, ou antes de interrupção/bloqueio.

## 4. Regra anti-paragem
Uma mensagem de progresso não encerra a tarefa. Um check em curso não justifica encerrar enquanto houver verificações ou trabalho independente. O modo passo a passo, com pausas, só se aplica por pedido explícito. Não inventar trabalho em segundo plano: sem ferramenta de agendamento ou execução ativa, não prometer continuação autónoma depois do turno.

## 5. Recuperação de falhas
- Detectar: identificar a operação e o resultado esperado.
- Isolar: distinguir erro transitório, falha de acesso, conflito de versão, falha funcional e bloqueio de segurança.
- Recuperar: reutilizar o método comprovado, reconciliar `main`, corrigir apenas a causa, repetir somente a validação necessária.
- Conter: não repetir indefinidamente chamadas, não usar métodos já comprovadamente bloqueados, não contornar gates.
- Retomar: executar próximos passos independentes; se impossível, registar estado BLOQUEADA com evidência.
- Verificar: só declarar CONCLUÍDA com evidência de todos os critérios.

## 6. Matriz proporcional
- A: componente canónico, alteração cirúrgica, validação visual/mobile se relevante e build/typecheck.
- B: produtor, persistência, consumidores derivados, reabertura e testes funcionais.
- C: fluxo completo relevante, contratos, segurança, compatibilidade, custos e testes aprofundados.
Build não substitui teste funcional. Testes com dados fictícios; nunca usar a conta/cópia real do professor.

## 7. Entrega e evidência
Informar de forma breve: ALTERADO, VALIDADO, ESTADO e, só se necessário, BLOQUEIO/PRÓXIMO PASSO. Não declarar publicado sem confirmação do deploy. Não tratar a ausência de credenciais git locais como ausência do conector GitHub. Não criar PR/branch por rotina; usar apenas se necessário tecnicamente ou pedido.

## 8. Precedência
Pedido explícito mais recente define intenção; Active Context define decisões atuais; Master Prompt define regras permanentes; este workflow define execução; `main` define implementação real; deploy define comportamento publicado. Preservar as regras de segurança, não-regressão e Cloudflare Free.
