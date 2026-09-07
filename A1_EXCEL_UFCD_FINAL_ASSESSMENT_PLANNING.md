# A1-G2 — Planeamento: avaliação final por UFCD/módulo em Excel

Data: 2026-09-07
Estado: ANÁLISE / PLANEAMENTO, não implementação
Prioridade: abaixo dos bloqueios ativos A2-NR-01, A3-HORARIO-XADREZ-01 / A3-PTPT-COPY-01 / validação de A3-SETUP-ACTION-COLORS-01 e A4-GIAE-NR-02

## Objetivo funcional recebido do utilizador

Permitir ao professor fornecer um ficheiro Excel oficial/proforma utilizado pela escola e, posteriormente, gerar uma CÓPIA preenchida para a avaliação final de uma UFCD/módulo.

Fluxo de referência a validar:

Excel oficial da escola → associação/mapeamento da estrutura → dados dos alunos e avaliações existentes no MA-Professor → introdução/confirmação da autoavaliação quando necessária → cálculo/obtenção da avaliação final da UFCD/módulo → geração de uma CÓPIA do Excel oficial já preenchida.

O ficheiro original nunca deve ser alterado.

## Estado técnico já existente relevante

A `main` atual já contém um workspace de avaliações em `src/components/ma-professor/assessments/`, incluindo `assessmentWorkspaceRepository.ts` e `AssessmentWorkspaceView.tsx`. O repositório expõe `SaveModuleFinalGradeInput` e persiste classificações finais de módulo/UFCD. Esta funcionalidade Excel deve portanto começar por reutilizar/avaliar o domínio de avaliações existente, sem criar uma segunda fonte de verdade para classificações finais.

Ainda não foi encontrada na `main` uma implementação existente de importação/exportação `.xlsx` para este fim.

## Questões obrigatórias antes de implementar

- diversidade de modelos Excel usados por diferentes escolas;
- identificação segura de folhas, cabeçalhos, alunos, número/nome e colunas de avaliação;
- critérios e regras de cálculo já configurados no MA-Professor;
- como e onde a autoavaliação entra no cálculo, sem inventar uma regra universal;
- preservação de células, fórmulas, merged cells, estilos, larguras, folhas, impressão e formatação;
- comportamento perante fórmulas ou células protegidas;
- ambiguidades de mapeamento que exigem confirmação explícita do professor;
- proteção de dados pessoais dos alunos e retenção local do ficheiro/modelo;
- preview/validação antes da exportação;
- geração de novo `.xlsx` preservando o original e o modelo tão fielmente quanto possível;
- compatibilidade com backups/sync e necessidade, ou não, de persistir o template original;
- conflitos entre classificação calculada/proposta e classificação final já confirmada no MA-Professor.

## Ownership de análise

- **A4-G2 — principal no domínio funcional:** analisar o encaixe em `assessments/**`, regras de classificação final, autoavaliação e fonte de verdade. Não implementar ainda.
- **A3-G2 — contributo de UX/importação:** analisar experiência de upload, mapeamento/revisão explícita e reutilização de padrões de importação existentes, sem assumir ownership de `assessments/**`.
- **A5-G2 — preservação/dados:** analisar privacidade, retenção, backup/sync, cópia do original e risco de guardar dados escolares/ficheiros binários.
- **A1-G2 — contratos partilhados:** decidir posteriormente onde vive parsing/exportação `.xlsx`, dependências, tipos/contratos partilhados e fronteiras de ownership.
- **A6-G2 — revisão independente:** rever o desenho antes de implementação e novamente o SHA final quando existir.

## Regra de prioridade

Esta funcionalidade não bloqueia nem desvia trabalho dos bloqueios atuais. Nenhum agente deve começar implementação funcional sem decisão posterior do A1 após receber os pareceres de análise.

## Critério para passar de planeamento a desenho técnico

A1 recebe dos agentes responsáveis: proposta de localização funcional, dados existentes reutilizáveis, necessidades de novo estado/persistência, estratégia de mapeamento e preservação do `.xlsx`, riscos/ambiguidades e testes de aceitação. Só depois é definido contrato e branch de implementação.
