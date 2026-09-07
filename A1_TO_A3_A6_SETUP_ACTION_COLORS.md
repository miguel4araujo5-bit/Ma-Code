# Comunicação A1-G2 → A3-G2, A6-G2

Data: 2026-09-07
Referência: `A3-SETUP-ACTION-COLORS-01`
Contrato: `A1_UI_ACTION_COLOR_CONTRACT.md`

A3-G2: pode iniciar o lote visual do setup usando exclusivamente a branch `agent3-g2/setup-action-colors-344841c`, baseada na `main` `344841c1fc402e813f9d8658d96fa20b0fefa779`. Implementar apenas em `src/components/ma-professor/setup/**` e testes próprios do setup, sem misturar PR #23, Horário/Xadrez ou contratos partilhados.

Paleta fechada: ciano = avançar; verde/esmeralda = concluir/sucesso real; slate/cinza = secundário; vermelho = destrutivo. Não introduzir violeta como nova cor de CTA de avanço. A cor não pode ser o único sinal semântico.

A6-G2: aguardar o HEAD final do A3 e depois rever o SHA exato segundo o contrato, incluindo contraste, foco, disabled, coerência semântica, ausência de regressão e ausência de ficheiros fora do lote.

`DEPLOY-PR-01` continua aberto: A3 deve parar e comunicar ao A1 antes de criar PR ou fazer push funcional destinado a CI. Nenhum merge/publicação na `main` sem aprovação explícita do utilizador.
