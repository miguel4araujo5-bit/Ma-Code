# Importação integrada no passo UFCD/módulos

Base: lote PDF A3 `e4df193d78c5d9523cf7803af30241ab92e8ec6b`.
Pedido: importar uma planificação PDF/Word logo no passo 4, criando UFCD e planificações em conjunto.

## Comportamento

- Entrada visível no passo UFCD/módulos, sem exigir a criação manual prévia.
- PDF com texto e Word DOCX com a tabela de seis colunas: período, UFCD, conteúdos, objetivos, metodologias e aulas.
- Revisão editável de código, designação, tempos, conteúdos, objetivos, metodologias, recursos e avaliação.
- A disciplina indicada no documento é mostrada; disciplina e turmas de destino exigem escolha explícita.
- Aulas previstas e horas do documento são preservadas separadamente. O campo do módulo recebe tempos letivos, nunca horas tratadas silenciosamente como tempos.
- A divergência entre horas e aulas exige revisão; nenhuma correção automática do documento.
- As seleções confirmadas são gravadas numa transação Dexie única.
- Módulos com o mesmo código no destino são apresentados como existentes e ignorados, incluindo planificações. Nenhuma substituição ou reativação.
- Reimportação não duplica módulos; alterações após a revisão invalidam a confirmação e exigem atualização.
- Rascunho manual bloqueia a abertura do importador; importador aberto bloqueia os formulários manuais.
- Sem gravação de aulas, assiduidade, avaliações, GIAE ou progresso do assistente.
- Os documentos são analisados no dispositivo. Os originais privados de teste não integram o repositório.

## Verificação

- TypeScript no conjunto de módulos materializado: PASS.
- Build Vite do passo com os componentes reais e leitor PDF: PASS.
- 22 testes dirigidos: PASS (inclui regressões existentes).
- Documentos Word fornecidos: seis UFCD extraídas, incluindo a divergência 50 horas/30 aulas.
- Os mesmos documentos exportados por LibreOffice para PDF: seis UFCD, duração, aulas e todas as colunas extraídas.
- Persistência Dexie com fake-indexeddb: rollback de destino tardio e falha de escrita de item, reimportação, concorrência, stale state, confirmação, reabertura.
- Interface React com jsdom: ficheiro -> seleção de destino -> revisão -> confirmação -> módulos e planificações gravados.

Comando de regressão sem dados privados:
`node --test tests/ma-professor/module-planification-import.test.mjs tests/ma-professor/planification-pdf-parser.test.mjs tests/ma-professor/planification-import-persistence-contract.test.mjs`

Os testes privados adicionais são ativados por `MA_IMPORT_PRIVATE_DOCX_DIR` e `MA_IMPORT_PRIVATE_PDF_DIR`, apontando para diretórios locais. Não os colocar no CI nem publicar os ficheiros.

## Limitações e integração

- A inspeção visual no navegador não foi concluída: o navegador disponibilizado bloqueou o endereço local. O teste jsdom não substitui um smoke em navegador real.
- PDF com colunas estreitas pode fragmentar palavras. A interface avisa e permite corrigir o texto; o Word conserva melhor esses limites.
- A leitura geométrica reconhece tabelas retangulares de seis colunas no formato PDF.js 6 e mantém o extrator anterior como fallback. Estruturas mistas reconhecidas como ambíguas são bloqueadas.
- Não é um leitor OCR para PDFs digitalizados nem um importador de qualquer formato arbitrário.
- O fingerprint é conservador: outra alteração aos dados de configuração pode obrigar a atualizar a revisão.
- `package.json` acrescenta apenas dependências de teste: jsdom e fake-indexeddb.
- Exige revisão independente do novo SHA, testes globais e smoke real antes da integração pelo A1. Esta proposta não autoriza publicação em main.
- A integração deve preservar os restantes lotes A3 e evitar reaplicar o lote PDF base duas vezes.
