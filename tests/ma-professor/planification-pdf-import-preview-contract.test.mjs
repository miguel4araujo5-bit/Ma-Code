import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationPdfImportPreview.ts',
    import.meta.url
  ),
  'utf8'
)

const parserSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationPdfParser.ts',
    import.meta.url
  ),
  'utf8'
)

function dataUrl(value) {
  return `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`
}

function transpile(value, filename) {
  return ts.transpileModule(value, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022
    }
  }).outputText
}

const parserUrl = dataUrl(
  transpile(parserSource, 'planificationPdfParser.ts')
)

const runtimeSource = transpile(
  source,
  'planificationPdfImportPreview.ts'
)
  .replaceAll("'./planificationPdfParser'", `'${parserUrl}'`)
  .replaceAll('"./planificationPdfParser"', `"${parserUrl}"`)

const preview = await import(
  dataUrl(runtimeSource)
)

const section0349 = {
  sourceDocumentName: 'planificacao.pdf',
  sourcePages: [2, 3],
  code: '0349',
  name: 'UFCD de teste',
  durationHours: 25,
  plannedLessons: 30,
  periodLabel: '1.º período',
  contentsText: 'Conteúdo A',
  objectivesText: 'Objetivo A',
  methodologyText: 'Metodologia A',
  resourcesText: 'Recurso A',
  evaluationText: 'Avaliação A',
  warnings: []
}

function destination(overrides = {}) {
  return {
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId: 'module-1',
    code: '0349',
    name: 'UFCD de teste',
    label: '11.º D · AP · 0349',
    activePlanification: null,
    itemVersions: [],
    ...overrides
  }
}

test('preview preserves canonical destination identity and exact textual code without writes', () => {
  const destinations = [destination()]
  const rows = preview.createPlanificationImportPreviewRows(
    [{
      sourceDocumentName: 'planificacao.pdf',
      sections: [section0349],
      warnings: []
    }],
    [[{
      section: section0349,
      candidates: [{
        moduleId: 'module-1',
        teachingAssignmentId: 'assignment-1',
        code: '0349',
        name: 'UFCD de teste',
        label: '11.º D · AP · 0349',
        hasActivePlanification: false
      }],
      automaticDestinationId: 'module-1',
      warnings: []
    }]],
    destinations
  )

  assert.equal(rows[0].section.code, '0349')
  assert.equal(rows[0].selectedModuleId, 'module-1')
  assert.equal(rows[0].mode, 'create')
  assert.equal(rows[0].fingerprint.academicYearId, 'year-1')
  assert.equal(rows[0].fingerprint.teachingAssignmentId, 'assignment-1')
  assert.equal(rows[0].fingerprint.moduleId, 'module-1')
  assert.equal(rows[0].draft.suggestedSummary, '')
  assert.equal(rows[0].draft.sourceDocumentName, 'planificacao.pdf')
  assert.deepEqual(rows[0].draft.sourcePages, [2, 3])

  assert.doesNotMatch(source, /maProfessorDb\.|commitPlanificationImportBatch\s*\(|createPlanification\s*\(|addPlanificationItem\s*\(/)
})

test('same code in two classes never selects a destination silently', () => {
  const destinations = [
    destination(),
    destination({
      teachingAssignmentId: 'assignment-2',
      moduleId: 'module-2',
      label: '12.º E · AP · 0349'
    })
  ]

  const rows = preview.createPlanificationImportPreviewRows(
    [{
      sourceDocumentName: 'planificacao.pdf',
      sections: [section0349],
      warnings: []
    }],
    [[{
      section: section0349,
      candidates: [
        {
          moduleId: 'module-1',
          teachingAssignmentId: 'assignment-1',
          code: '0349',
          name: 'UFCD de teste',
          label: '11.º D · AP · 0349',
          hasActivePlanification: false
        },
        {
          moduleId: 'module-2',
          teachingAssignmentId: 'assignment-2',
          code: '0349',
          name: 'UFCD de teste',
          label: '12.º E · AP · 0349',
          hasActivePlanification: false
        }
      ],
      automaticDestinationId: null,
      warnings: ['Existem vários destinos possíveis.']
    }]],
    destinations
  )

  assert.equal(rows[0].selectedModuleId, null)
  assert.equal(rows[0].mode, null)
  assert.equal(rows[0].fingerprint, null)
})

test('existing planification requires explicit append or skip and preserves observed historical item state in the fingerprint', () => {
  const destinations = [
    destination({
      activePlanification: {
        id: 'plan-1',
        updatedAt: '2026-09-01T10:00:00.000Z'
      },
      itemVersions: [
        {
          id: 'item-used',
          updatedAt: '2026-09-01T11:00:00.000Z',
          status: 'used',
          usedLessonId: 'lesson-1',
          usedAt: '2026-09-01T12:00:00.000Z'
        }
      ]
    })
  ]

  let row = preview.createPlanificationImportPreviewRows(
    [{
      sourceDocumentName: 'planificacao.pdf',
      sections: [section0349],
      warnings: []
    }],
    [[{
      section: section0349,
      candidates: [{
        moduleId: 'module-1',
        teachingAssignmentId: 'assignment-1',
        code: '0349',
        name: 'UFCD de teste',
        label: '11.º D · AP · 0349',
        hasActivePlanification: true
      }],
      automaticDestinationId: null,
      warnings: ['Já existe uma planificação ativa.']
    }]],
    destinations
  )[0]

  assert.equal(row.selectedModuleId, 'module-1')
  assert.equal(row.mode, null)
  assert.equal(
    preview.validatePlanificationImportPreview([row], destinations).valid,
    false
  )

  row = preview.setPlanificationImportMode(
    row,
    'append',
    destinations
  )

  assert.equal(row.mode, 'append')
  assert.equal(row.fingerprint.activePlanificationId, 'plan-1')
  assert.equal(row.fingerprint.itemVersions[0].status, 'used')
  assert.equal(row.fingerprint.itemVersions[0].usedLessonId, 'lesson-1')
  assert.equal(row.fingerprint.itemVersions[0].usedAt, '2026-09-01T12:00:00.000Z')
  assert.equal(
    preview.validatePlanificationImportPreview([row], destinations).valid,
    true
  )

  const confirmation = preview.buildPlanificationImportPreviewConfirmation(
    [row],
    destinations
  )

  assert.equal(confirmation[0].mode, 'append')
  assert.equal(confirmation[0].moduleId, 'module-1')
  assert.equal(confirmation[0].teachingAssignmentId, 'assignment-1')
  assert.equal(confirmation[0].academicYearId, 'year-1')
})
