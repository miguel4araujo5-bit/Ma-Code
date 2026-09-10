import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const matrixSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/assessmentCriteriaProfessionalMatrixParser.ts',
    import.meta.url
  ),
  'utf8'
)

const wrapperSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/assessmentCriteriaPdfParser.ts',
    import.meta.url
  ),
  'utf8'
)

function transpile(source) {
  return ts.transpileModule(
    source,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      }
    }
  ).outputText
}

function loadMatrixParser() {
  const module = { exports: {} }
  new Function(
    'module',
    'exports',
    'require',
    transpile(matrixSource)
  )(
    module,
    module.exports,
    () => ({})
  )
  return module.exports.parseProfessionalAssessmentCriteriaMatrix
}

const parseMatrix = loadMatrixParser()

function cells(values, positions) {
  return {
    text: values.filter(Boolean).join(' '),
    cells: values,
    positionedCells: values.map(
      (text, index) => ({
        text,
        x: positions[index],
        width: 100
      })
    )
  }
}

const positions = [0, 150, 280, 520, 900]
const header = cells(
  [
    'Domínios',
    'Ponderação',
    'Descritores',
    'Níveis de Desempenho',
    'Técnicas e Instrumentos de avaliação'
  ],
  positions
)

function document(lines) {
  return {
    pages: [{
      pageNumber: 1,
      lines
    }],
    pageCount: 1,
    characterCount: lines.reduce(
      (total, line) => total + line.text.length,
      0
    )
  }
}

function weightedRow(domain, weight, descriptor = '') {
  return cells(
    [
      domain,
      `${weight}%`,
      descriptor,
      'Nível de desempenho',
      'Observação direta'
    ],
    positions
  )
}

test(
  'Educação Física 70/15/15 ignores descriptor percentages as independent criteria',
  () => {
    const parsed = parseMatrix(
      document([
        header,
        weightedRow(
          'ÁREA DAS AT. FÍSICAS',
          70,
          'Cooperar e aplicar ações técnico-táticas.'
        ),
        cells(
          [
            '',
            '',
            'Continuação do descritor',
            'Adquiriu entre 20% e 49% das aprendizagens; 50% a 69%; 70% a 89%; 90% ou mais.',
            'Auto e heteroavaliação'
          ],
          positions
        ),
        weightedRow('APTIDÃO FÍSICA', 15),
        cells(
          ['', '', 'Zona saudável', '20% 49% 69% 89% 90%', 'Testes de aptidão'],
          positions
        ),
        weightedRow('CONHECIMENTOS', 15)
      ])
    )

    assert.ok(parsed)
    assert.deepEqual(
      parsed.candidates.map(candidate => candidate.weightPercent),
      [70, 15, 15]
    )
    assert.equal(parsed.candidates.length, 3)
    assert.equal(
      parsed.candidates.reduce(
        (total, candidate) => total + candidate.weightPercent,
        0
      ),
      100
    )
  }
)

test(
  '60/40 professional criteria remain two weighted domains instead of being forced into a three-domain template',
  () => {
    const parsed = parseMatrix(
      document([
        header,
        weightedRow('Conhecimentos e capacidades', 60),
        weightedRow('Atitudes e valores', 40)
      ])
    )

    assert.ok(parsed)
    assert.deepEqual(
      parsed.candidates.map(candidate => candidate.weightPercent),
      [60, 40]
    )
  }
)

test(
  'English-style four-domain 25/25/25/25 matrix keeps all four real domains',
  () => {
    const parsed = parseMatrix(
      document([
        header,
        weightedRow('Compreensão oral', 25),
        weightedRow('Compreensão escrita / leitura / gramática', 25),
        weightedRow('Interação / produção oral', 25),
        weightedRow('Produção escrita', 25)
      ])
    )

    assert.ok(parsed)
    assert.equal(parsed.candidates.length, 4)
    assert.deepEqual(
      parsed.candidates.map(candidate => candidate.weightPercent),
      [25, 25, 25, 25]
    )
  }
)

test(
  'criteria title “da disciplina de” supplies subject metadata when the table itself does not',
  () => {
    const module = { exports: {} }
    const matrixResult = {
      metadata: {
        subject: null,
        course: null,
        grade: null,
        group: null
      },
      candidates: [
        {
          id: 'c1',
          name: 'A',
          description: '',
          domainLabel: '',
          subcriteria: [],
          weightPercent: 60,
          sourcePages: [1],
          confidence: 'high',
          warnings: []
        },
        {
          id: 'c2',
          name: 'B',
          description: '',
          domainLabel: '',
          subcriteria: [],
          weightPercent: 40,
          sourcePages: [1],
          confidence: 'high',
          warnings: []
        }
      ],
      warnings: []
    }

    new Function(
      'module',
      'exports',
      'require',
      transpile(wrapperSource)
    )(
      module,
      module.exports,
      request => {
        if (request.includes('assessmentCriteriaProfessionalMatrixParser')) {
          return {
            parseProfessionalAssessmentCriteriaMatrix: () => matrixResult
          }
        }
        if (request.includes('assessmentCriteriaPdfParserCore')) {
          return {
            parseAssessmentCriteriaPdfDocument: () => ({
              sourceDocumentName: '',
              pageCount: 1,
              metadata: matrixResult.metadata,
              candidates: [],
              warnings: []
            })
          }
        }
        return {}
      }
    )

    const result = module.exports.parseAssessmentCriteriaPdfDocument(
      document([
        cells(
          [
            'CRITÉRIOS DE AVALIAÇÃO DA DISCIPLINA DE EDUCAÇÃO FÍSICA - PROFISSIONAIS'
          ],
          [0]
        )
      ]),
      'EF_PROFISSIONAIS.pdf'
    )

    assert.equal(
      result.metadata.subject?.value,
      'EDUCAÇÃO FÍSICA'
    )
  }
)
