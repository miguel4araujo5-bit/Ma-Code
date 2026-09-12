import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/assessmentCriteriaPdfParser.ts',
    import.meta.url
  ),
  'utf8'
)

function loadParser({
  genericResult,
  matrixResult = null
}) {
  const javascript = ts.transpileModule(
    source,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      }
    }
  ).outputText
  const module = { exports: {} }

  new Function(
    'module',
    'exports',
    'require',
    javascript
  )(
    module,
    module.exports,
    request => {
      if (
        request ===
        './assessmentCriteriaPdfParserCore'
      ) {
        return {
          parseAssessmentCriteriaPdfDocument: () =>
            structuredClone(genericResult)
        }
      }

      if (
        request ===
        './assessmentCriteriaProfessionalMatrixParser'
      ) {
        return {
          parseProfessionalAssessmentCriteriaMatrix: () =>
            matrixResult
              ? structuredClone(matrixResult)
              : null
        }
      }

      throw new Error(
        `Dependência inesperada: ${request}`
      )
    }
  )

  return module.exports
    .parseAssessmentCriteriaPdfDocument
}

function emptyMetadata() {
  return {
    subject: null,
    course: null,
    grade: null,
    group: null
  }
}

function candidate(
  name,
  weightPercent,
  confidence = 'high'
) {
  return {
    id: `candidate-${name}`,
    name,
    description: '',
    domainLabel: '',
    subcriteria: [],
    weightPercent,
    sourcePages: [1],
    confidence,
    warnings: []
  }
}

function documentWithLines(...values) {
  return {
    pageCount: 1,
    characterCount: values.join(' ').length,
    pages: [
      {
        pageNumber: 1,
        lines: values.map(text => ({
          text,
          cells: [text],
          positionedCells: [
            {
              text,
              x: 0,
              width: Math.max(
                40,
                text.length * 5
              )
            }
          ]
        }))
      }
    ]
  }
}

test(
  'generic candidates stop claiming high confidence when their own weights do not total 100%',
  () => {
    const parse = loadParser({
      genericResult: {
        sourceDocumentName: 'criterios.pdf',
        pageCount: 1,
        metadata: emptyMetadata(),
        candidates: [
          candidate('Conhecimentos', 60),
          candidate('Atitudes', 30)
        ],
        warnings: [
          'As ponderações detetadas totalizam 90%, não 100%. Confirme a estrutura do documento.'
        ]
      }
    })

    const parsed = parse(
      documentWithLines('Critérios'),
      'criterios.pdf'
    )

    assert.deepEqual(
      parsed.candidates.map(item => [
        item.name,
        item.weightPercent,
        item.confidence
      ]),
      [
        ['Conhecimentos', 60, 'medium'],
        ['Atitudes', 30, 'medium']
      ]
    )
  }
)

test(
  'valid generic confidence remains unchanged when no total inconsistency was detected',
  () => {
    const parse = loadParser({
      genericResult: {
        sourceDocumentName: 'criterios.pdf',
        pageCount: 1,
        metadata: emptyMetadata(),
        candidates: [
          candidate('Conhecimentos', 60),
          candidate('Atitudes', 40)
        ],
        warnings: []
      }
    })

    const parsed = parse(
      documentWithLines('Critérios'),
      'criterios.pdf'
    )

    assert.ok(
      parsed.candidates.every(
        item =>
          item.confidence === 'high'
      )
    )
  }
)

test(
  'professional matrix candidates use the same confidence rule without changing extracted values',
  () => {
    const parse = loadParser({
      genericResult: {
        sourceDocumentName: 'unused.pdf',
        pageCount: 1,
        metadata: emptyMetadata(),
        candidates: [],
        warnings: []
      },
      matrixResult: {
        metadata: emptyMetadata(),
        candidates: [
          candidate('Domínio A', 50),
          candidate('Domínio B', 40)
        ],
        warnings: [
          'As ponderações detetadas na matriz totalizam 90%, não 100%. Confirme a estrutura do documento.'
        ]
      }
    })

    const parsed = parse(
      documentWithLines('Matriz'),
      'matriz.pdf'
    )

    assert.deepEqual(
      parsed.candidates.map(item => [
        item.name,
        item.weightPercent,
        item.confidence
      ]),
      [
        ['Domínio A', 50, 'medium'],
        ['Domínio B', 40, 'medium']
      ]
    )
  }
)

test(
  'metadata inferred only from fallback text is marked for review while explicit metadata keeps its confidence',
  () => {
    const inferredParse = loadParser({
      genericResult: {
        sourceDocumentName: 'inferido.pdf',
        pageCount: 1,
        metadata: emptyMetadata(),
        candidates: [],
        warnings: []
      }
    })

    const inferred = inferredParse(
      documentWithLines(
        'Critérios de avaliação da disciplina de Área de Expressões'
      ),
      'inferido.pdf'
    )

    assert.equal(
      inferred.metadata.subject.value,
      'Área de Expressões'
    )
    assert.equal(
      inferred.metadata.subject.confidence,
      'medium'
    )

    const explicitParse = loadParser({
      genericResult: {
        sourceDocumentName: 'explicito.pdf',
        pageCount: 1,
        metadata: {
          ...emptyMetadata(),
          subject: {
            value: 'Área de Expressões',
            sourceText: 'Disciplina: Área de Expressões',
            sourcePage: 1,
            confidence: 'high'
          }
        },
        candidates: [],
        warnings: []
      }
    })

    const explicit = explicitParse(
      documentWithLines(
        'Critérios de avaliação da disciplina de Outra Coisa'
      ),
      'explicito.pdf'
    )

    assert.equal(
      explicit.metadata.subject.value,
      'Área de Expressões'
    )
    assert.equal(
      explicit.metadata.subject.confidence,
      'high'
    )
  }
)
