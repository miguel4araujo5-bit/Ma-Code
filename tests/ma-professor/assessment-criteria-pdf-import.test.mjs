import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const parserSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/assessmentCriteriaPdfParserCore.ts',
    import.meta.url
  ),
  'utf8'
)

const panelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/AssessmentCriteriaPdfImportPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const wizardSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SetupWizard.tsx',
    import.meta.url
  ),
  'utf8'
)

function loadParser() {
  const javascript = ts.transpileModule(
    parserSource,
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
    () => {
      throw new Error('O parser não deve exigir dependências de runtime neste teste.')
    }
  )

  return module.exports.parseAssessmentCriteriaPdfDocument
}

const parseAssessmentCriteriaPdfDocument = loadParser()

function line(text) {
  return {
    text,
    cells: [text],
    positionedCells: [
      { text, x: 0, width: Math.max(40, text.length * 5) }
    ]
  }
}

function cells(values) {
  return {
    text: values.join(' '),
    cells: values,
    positionedCells: values.map((text, index) => ({
      text,
      x: index * 160,
      width: 110
    }))
  }
}

test(
  'structured table extracts unknown criteria, domains, weights and explicit metadata without importing Total',
  () => {
    const parsed = parseAssessmentCriteriaPdfDocument(
      {
        pageCount: 1,
        characterCount: 200,
        pages: [
          {
            pageNumber: 1,
            lines: [
              line('Disciplina: Estudos Interdisciplinares X'),
              line('Curso Profissional - Técnico de Exemplo'),
              cells(['Domínio', 'Critério', 'Ponderação']),
              cells(['Conhecimentos', 'Leitura crítica', '60%']),
              cells(['Atitudes', 'Autonomia criativa', '40%']),
              cells(['', 'Total', '100%'])
            ]
          }
        ]
      },
      'criterios.pdf'
    )

    assert.equal(parsed.metadata.subject.value, 'Estudos Interdisciplinares X')
    assert.equal(parsed.metadata.course.value, 'Técnico de Exemplo')
    assert.equal(parsed.candidates.length, 2)
    assert.deepEqual(
      parsed.candidates.map(item => [
        item.name,
        item.domainLabel,
        item.weightPercent
      ]),
      [
        ['Leitura crítica', 'Conhecimentos', 60],
        ['Autonomia criativa', 'Atitudes', 40]
      ]
    )
    assert.ok(parsed.candidates.every(item => item.confidence === 'high'))
    assert.ok(parsed.candidates.every(item => !/^total$/i.test(item.name)))
  }
)

test(
  'unknown labels are preserved and an explicit percentage can be proposed without a known template',
  () => {
    const parsed = parseAssessmentCriteriaPdfDocument(
      {
        pageCount: 1,
        characterCount: 80,
        pages: [
          {
            pageNumber: 1,
            lines: [
              line('CIS 75%'),
              line('Projeto experimental Z 25%')
            ]
          }
        ]
      },
      'modelo-desconhecido.pdf'
    )

    assert.deepEqual(
      parsed.candidates.map(item => [
        item.name,
        item.weightPercent
      ]),
      [
        ['CIS', 75],
        ['Projeto experimental Z', 25]
      ]
    )
    assert.ok(parsed.candidates.every(item => item.confidence === 'medium'))
  }
)

test(
  'missing weights remain unresolved instead of being invented',
  () => {
    const parsed = parseAssessmentCriteriaPdfDocument(
      {
        pageCount: 1,
        characterCount: 80,
        pages: [
          {
            pageNumber: 1,
            lines: [
              cells(['Critério', 'Peso']),
              cells(['Participação', ''])
            ]
          }
        ]
      },
      'peso-em-falta.pdf'
    )

    assert.equal(parsed.candidates.length, 1)
    assert.equal(parsed.candidates[0].name, 'Participação')
    assert.equal(parsed.candidates[0].weightPercent, null)
    assert.match(
      parsed.candidates[0].warnings.join(' '),
      /Ponderação não identificada/
    )
  }
)

test(
  'a line containing several percentages is not silently split into invented criteria',
  () => {
    const parsed = parseAssessmentCriteriaPdfDocument(
      {
        pageCount: 1,
        characterCount: 80,
        pages: [
          {
            pageNumber: 1,
            lines: [
              line('Conhecimentos 60% Atitudes 40%')
            ]
          }
        ]
      },
      'ambiguo.pdf'
    )

    assert.equal(parsed.candidates.length, 0)
    assert.match(
      parsed.warnings.join(' '),
      /várias percentagens/
    )
    assert.match(
      parsed.warnings.join(' '),
      /Nenhum critério foi inventado/
    )
  }
)

test(
  'the setup import stays local, requires review and reuses protected assessment repositories',
  () => {
    assert.match(panelSource, /extractPlanificationPdf/)
    assert.match(panelSource, /Arraste o PDF para aqui/)
    assert.match(panelSource, /Revisão obrigatória/)
    assert.match(panelSource, /criteriaStateFingerprint/)
    assert.match(panelSource, /createSubjectSchemes/)
    assert.match(panelSource, /createModuleScheme/)
    assert.match(panelSource, /não substitui critérios existentes/i)
    assert.doesNotMatch(panelSource, /snapshotApi|Durable Object|wrangler|cloudflare/i)
    assert.match(wizardSource, /AssessmentCriteriaPdfImportPanel/)
    assert.match(wizardSource, /AssessmentCriteriaSetupStep/)
  }
)
