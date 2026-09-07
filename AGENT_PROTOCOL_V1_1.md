# MA-CODE — Protocolo de comunicação entre agentes v1.1

Data: 2026-09-07
Responsável pela estrutura: AGENTE 1
Branch exclusiva de comunicação: `coordination/agents`

Este documento complementa `AGENT_MESSAGES.md` sem apagar nem alterar o histórico existente. Em caso de dúvida, aplicar estas regras às comunicações posteriores à publicação da v1.1.

## 1. Leitura no início do turno

Cada agente deve:

1. ler `AGENT_STATUS.md` para obter o estado consolidado mais recente;
2. ler em `AGENT_MESSAGES.md` os eventos posteriores ao `Último evento processado` indicado no status;
3. recuperar mensagens anteriores apenas quando forem dependência direta do lote em curso ou forem referidas pelos eventos novos.

A leitura do resumo não substitui a consulta da evidência técnica nem da `main`.

## 2. Receção de mensagens

`RESPOSTA` ou `RESOLVIDO` podem também confirmar receção da mensagem referenciada quando a resposta é imediata e inequívoca. Nesse caso não é necessário publicar um `LIDO` separado.

`LIDO` continua válido quando é útil separar receção de resolução/aprovação.

Nenhum destes tipos significa, por si só, autorização para merge ou publicação.

## 3. Branches e trabalho independente

- Um lote que recebe `APTO` fica congelado no SHA exato aprovado.
- Congelar um lote não impede o mesmo agente de continuar outro trabalho independente já atribuído, desde que use outra branch e respeite o manifesto/ownership.
- Não alterar silenciosamente uma branch aprovada para trabalho novo.
- Um HEAD alterado não herda automaticamente o parecer A6 anterior.

## 4. Integração e lotes empilhados

`AGENT_STATUS.md` deve identificar:

- lote;
- responsável;
- branch;
- BASE_SHA;
- HEAD_SHA;
- PR final;
- PRs/lotes antecessores já contidos;
- CI;
- parecer A6;
- limitações;
- próxima ação;
- data da verificação.

Lotes substituídos ou já contidos num PR/HEAD final não são integrados novamente. Branches antigas não são apagadas automaticamente.

Qualquer HEAD candidato que combine lotes exige:

1. verificação de diff e dependências;
2. suite global aplicável;
3. nova revisão A6 no SHA combinado;
4. aprovação explícita do utilizador antes de `main`.

## 5. Validação global

O objetivo do Build Check global passa a incluir explicitamente:

- Conquistador;
- MA-Professor;
- MA-Quadro;
- build completo.

A concorrência dos workflows deve impedir que PRs/ref distintos se cancelem entre si; `cancel-in-progress` deve cancelar apenas execuções substituídas do mesmo workflow + PR/ref.

Uma alteração do próprio workflow é um lote A1 separado, com PR draft, CI e revisão A6 antes de `main`.

## 6. Arquivo e preservação do histórico

Não apagar nem reescrever eventos antigos para reduzir tamanho.

Se o registo ativo precisar de arquivo:

1. criar primeiro uma cópia verificável;
2. manter índice com IDs/faixas arquivadas;
3. confirmar o conteúdo arquivado;
4. só depois reduzir o registo ativo;
5. nunca perder referências usadas por `AGENT_STATUS.md` ou decisões ainda abertas.

## 7. Escrita segura

Mantêm-se obrigatórias as regras da v1.0:

- reler o remoto antes de escrever;
- obter SHA atual do blob;
- acrescentar apenas eventos próprios;
- escrever explicitamente em `coordination/agents`;
- em conflito, reler e reaplicar apenas o que falta;
- em timeout, verificar IDs antes de repetir;
- máximo de três tentativas;
- nunca force-push/rebase/reset da branch de comunicação;
- confirmar por leitura antes de declarar uma mensagem publicada.

## 8. Fontes de verdade

- `main`: fonte técnica oficial do código publicado/candidato-base.
- branches de trabalho: evidência dos lotes ainda não integrados.
- `AGENT_STATUS.md`: resumo operacional mantido pelo A1.
- `AGENT_MESSAGES.md`: histórico de comunicação e decisões.
- este documento: regras de comunicação v1.1.

Nenhum ficheiro de coordenação autoriza merge ou publicação na `main`.
