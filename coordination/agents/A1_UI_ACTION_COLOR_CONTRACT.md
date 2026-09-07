# A1-G2 — Contrato visual dos botões de progressão

Data: 2026-09-07
Sessão: A1-G2
Destinatários: A3-G2, A6-G2
Lote: `A3-SETUP-ACTION-COLORS-01`
Estado: AUTORIZADO PARA IMPLEMENTAÇÃO CONTROLADA

## Decisão do utilizador

Melhorar a orientação visual do utilizador no setup/onboarding do MA-Professor, distinguindo claramente ações de avanço e conclusão, sem criar um “arco-íris” nem uma linguagem visual nova desligada do produto atual.

## Contrato visual fechado pelo A1-G2

Reutilizar a linguagem já existente no MA-Professor e reduzir ruído:

- **Ciano = ação principal / avançar**: `Próximo`, `Prosseguir`, `Continuar` e equivalentes que levam ao quadro/passo seguinte.
- **Verde/esmeralda = conclusão real / sucesso**: `Concluir`, `Terminar configuração`, `Confirmar e concluir` e estados efetivamente concluídos.
- **Slate/cinza = ação secundária**: `Voltar`, `Cancelar`, `Editar`, `Agora não`, `Ignorar por agora` e equivalentes que não representam avanço principal.
- **Vermelho = apenas destrutivo**: apagar/remover/perder dados. Nunca usar vermelho como navegação normal.

A cor não pode ser o único sinal semântico: manter rótulos claros, estados disabled/hover/focus perceptíveis e contraste adequado.

## Limpeza visual autorizada

No setup, evitar acrescentar uma nova família cromática apenas para CTA. Em particular:

- não introduzir roxo/violeta como nova cor de avanço;
- a barra de progresso pode passar do gradiente ciano/azul/violeta para uma apresentação ciana simples; verde apenas quando o percurso estiver efetivamente concluído;
- `Ir para o passo atual` não deve competir cromaticamente com o CTA principal; usar ciano discreto ou estilo secundário neutro, conforme hierarquia;
- preservar o fundo dark, tipografia, raios, espaçamentos e restante identidade atual.

## Ownership e limites

**A3-G2 implementa** este lote apenas no domínio `src/components/ma-professor/setup/**` e testes próprios do setup.

Não misturar com:
- PR #23 / importação PDF, que permanece congelado;
- `A3-HORARIO-XADREZ-01`;
- persistência central, tipos centrais ou navegação partilhada reservada ao A1;
- qualquer outro produto MA-CODE.

Branch dedicada autorizada pelo A1:

`agent3-g2/setup-action-colors-344841c`

Base obrigatória:

`344841c1fc402e813f9d8658d96fa20b0fefa779`

Enquanto `DEPLOY-PR-01` estiver aberto, o A3 pode desenvolver e testar na branch, mas deve parar e comunicar ao A1 antes de criar PR ou fazer push funcional para provocar CI.

## Critérios mínimos de implementação A3-G2

1. Inventariar os CTAs reais do setup e classificar cada um como avanço, conclusão, secundário ou destrutivo.
2. Aplicar a regra sem alterar comportamento, persistência ou ordem do wizard.
3. Não transformar todos os botões ciano; só o CTA principal de avanço deve dominar visualmente.
4. Garantir que `disabled`, `hover`, `focus-visible` e contraste continuam claros em dark mode.
5. Onde existir conclusão, o verde deve significar conclusão real e não mero “guardar”.
6. Preservar proteções de alterações não guardadas já existentes.
7. Produzir diff controlado e testes proporcionais; comunicar HEAD exato ao A1 e A6.

## Revisão independente A6-G2

Quando A3 comunicar o HEAD final, A6-G2 revê o SHA exato e verifica pelo menos:

- coerência semântica da paleta;
- ausência de “arco-íris”/cores concorrentes;
- contraste e legibilidade;
- foco por teclado e estado disabled;
- não depender apenas da cor para transmitir ação;
- nenhum comportamento funcional do setup alterado;
- nenhum ficheiro fora do manifesto do lote;
- regressões no fluxo `passo atual → avançar → concluir`.

Emitir **APTO** ou **BLOQUEADO** com limitações explícitas. O parecer não autoriza merge nem publicação na `main`.

## Regra final

Este lote melhora apenas hierarquia visual. Não há merge/publicação em `main` sem aprovação explícita do utilizador para o lote concreto.
