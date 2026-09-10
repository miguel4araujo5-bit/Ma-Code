import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/setupDocumentClassifier.ts',
    import.meta.url
  ),
  'utf8'
)

const resolverSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/setupDocumentInterpretationResolver.ts',
    import.meta.url
  ),
  'utf8'
)

function transpile(value) {
  return ts.transpileModule(
    value,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      }
    }
  ).outputText
}

function loadResolver() {
  const module = { exports: {} }
  new Function(
    'module',
    'exports',
    transpile(resolverSource)
  )(
    module,
    module.exports
  )
  return module.exports
}

function loadClassifier() {
  const javascript = transpile(source)
  const module = { exports: {} }
  const resolver = loadResolver()

  new Function(
    'module',
    'exports',
    'require',
    javascript
  )(
    module,
    module.exports,
    request => {
      if (request.includes('setupDocumentInterpretationResolver')) {
        return resolver
      }

      if (request.includes('planificationPdfParser')) {
        return {
          parsePlanificationPdfDocument(document) {
            return {
              sourceDocumentName: '',
              sections: document.__planificationSections ?? [],
              warnings: []
            }
          }
        }
      }

      if (request.includes('assessmentCriteriaPdfParser')) {
        return {
          parseAssessmentCriteriaPdfDocument(document) {
            return {
              sourceDocumentName: '',
              pageCount: document.pageCount,
              metadata: document.__criteriaMetadata ?? {
                subject: null,
                course: null,
                grade: null,
                group: null
              },
              candidates: document.__criteriaCandidates ?? [],
              warnings: []
            }
          }
        }
      }

      throw new Error(`Unexpected dependency: ${request}`)
    }
  )

  return module.exports.classifySetupPdfDocument
}

const classify = loadClassifier()

function line(text) {
  return {
    text,
    cells: [text],
    positionedCells: [
      {
        text,
        x: 0,
        width: Math.max(10, text.length * 5)
      }
    ]
  }
}

function documentWith(lines, extras = {}) {
  return {
    pageCount: 1,
    characterCount: lines.join('\n').length,
    pages: [
      {
        pageNumber: 1,
        lines: lines.map(line)
      }
    ],
    ...extras
  }
}

function criteria(weights) {
  return weights.map((weightPercent, index) => ({
    id: `c-${index + 1}`,
    name: `Critério ${index + 1}`,
    description: '',
    domainLabel: '',
    subcriteria: [],
    weightPercent,
    sourcePages: [1],
    confidence: 'high',
    warnings: []
  }))
}

test(
  'weekly grid is classified as schedule instead of planification or criteria',
  () => {
    const result = classify(
      documentWith([
        'HORÁRIO DO PROFESSOR',
        'Segunda-feira Terça-feira Quarta-feira Quinta-feira Sexta-feira',
        '08:30 - 09:20 10.º D AE',
        '09:20 - 10:10 10.º D AE',
        '10:20 - 11:10 11.º E ASC',
        '11:10 - 12:00 11.º E ASC'
      ]),
      'Horario_Miguel.pdf'
    )

    assert.equal(result.kind, 'schedule')
    assert.equal(result.confidence, 'high')
    assert.ok(result.summary.scheduleTimeRanges >= 4)
    assert.deepEqual(
      result.summary.detectedGroups,
      ['10.º D', '11.º E']
    )
  }
)

test(
  'annual UFCD document is classified as planification',
  () => {
    const result = classify(
      documentWith(
        [
          'PLANIFICAÇÃO DE ÁREA DE EXPRESSÕES',
          'Curso Profissional - Técnico de Apoio Psicossocial',
          'Período Letivo UFCD Temas/Conteúdos Objetivos/Competências Estratégias/Metodologias Aulas previstas',
          'UFCD 3279 Oficina de expressão dramática',
          'UFCD 4261 Expressão corporal',
          'UFCD 4271 Projeto de animação'
        ],
        {
          __planificationSections: [
            { code: '3279' },
            { code: '4261' },
            { code: '4271' }
          ]
        }
      ),
      'Planificacao_AE_10D.pdf'
    )

    assert.equal(result.kind, 'planification')
    assert.equal(result.confidence, 'high')
    assert.equal(result.summary.planificationSections, 3)
  }
)

test(
  '60/20/20 evaluation matrix is classified as criteria',
  () => {
    const result = classify(
      documentWith(
        [
          'CRITÉRIOS DE AVALIAÇÃO - Área de Expressões',
          'Curso Profissional de Técnico de Apoio Psicossocial',
          'Domínio Ponderação Operacionalização Indicadores de desempenho',
          'Desempenho nas aprendizagens 60%',
          'Raciocínio, informação e comunicação 20%',
          'Competências Transversais e Atitudinais 20%'
        ],
        {
          __criteriaCandidates: criteria([60, 20, 20]),
          __criteriaMetadata: {
            subject: { value: 'Área de Expressões' },
            course: { value: 'Técnico de Apoio Psicossocial' },
            grade: null,
            group: null
          }
        }
      ),
      'Criterios_AE_2026_2027.pdf'
    )

    assert.equal(result.kind, 'criteria')
    assert.equal(result.confidence, 'high')
    assert.equal(result.summary.criteriaCandidates, 3)
    assert.equal(result.summary.criteriaWeightTotal, 100)
    assert.equal(
      result.summary.subjectLabel,
      'Área de Expressões'
    )
  }
)

test(
  'descriptor percentages do not turn an evaluation rubric into a timetable',
  () => {
    const descriptorNoise = Array.from(
      { length: 15 },
      (_, index) =>
        `${20 + index * 5}% descritor de desempenho`
    )

    const result = classify(
      documentWith(
        [
          'CRITÉRIOS DE AVALIAÇÃO EDUCAÇÃO FÍSICA',
          'Domínios Ponderação Descritores',
          'Desempenho 70%',
          'Atitudes 15%',
          'Conhecimento 15%',
          ...descriptorNoise
        ],
        {
          __criteriaCandidates: criteria([70, 15, 15])
        }
      ),
      'EF_PROFISSIONAIS_criterios.pdf'
    )

    assert.equal(result.kind, 'criteria')
    assert.equal(result.summary.criteriaWeightTotal, 100)
    assert.equal(result.summary.scheduleTimeRanges, 0)
  }
)

test(
  'strong criteria structure overrides a misleading timetable filename',
  () => {
    const result = classify(
      documentWith(
        [
          'CRITÉRIOS DE AVALIAÇÃO - Área de Expressões',
          'Domínio Ponderação Indicadores',
          'Desempenho 60%',
          'Raciocínio e comunicação 20%',
          'Competências transversais 20%'
        ],
        {
          __criteriaCandidates: criteria([60, 20, 20])
        }
      ),
      'horario_criterios.pdf'
    )

    assert.equal(result.kind, 'criteria')
    assert.notEqual(result.confidence, 'low')
  }
)

test(
  'criteria that do not total 100 can be recognised but never receive high confidence',
  () => {
    const result = classify(
      documentWith(
        [
          'CRITÉRIOS DE AVALIAÇÃO',
          'Domínio Ponderação',
          'Conhecimentos 60%',
          'Atitudes 25%'
        ],
        {
          __criteriaCandidates: criteria([60, 25])
        }
      ),
      'criterios_incompletos.pdf'
    )

    assert.equal(result.kind, 'criteria')
    assert.equal(result.confidence, 'medium')
    assert.match(
      result.warnings.join(' '),
      /85%/
    )
  }
)

test(
  'weak or contradictory evidence stays unknown instead of inventing a document type',
  () => {
    const result = classify(
      documentWith([
        'Documento pedagógico',
        'Informação geral para o ano letivo',
        'Sem estrutura de horário, planificação ou critérios'
      ]),
      'documento.pdf'
    )

    assert.equal(result.kind, 'unknown')
    assert.equal(result.confidence, 'low')
    assert.ok(result.warnings.length > 0)
  }
)
