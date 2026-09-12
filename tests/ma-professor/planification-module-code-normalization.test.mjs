import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationPdfPreview.ts',
    import.meta.url
  ),
  'utf8'
)

function dataUrl(value) {
  return `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`
}

const runtimeSource = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText

const preview = await import(dataUrl(runtimeSource))

const section = {
  sourceDocumentName: 'planificacao.docx',
  sourcePages: [],
  code: 'M1',
  name: 'Módulo de teste',
  durationHours: null,
  plannedLessons: null,
  periodLabel: '',
  contentsText: 'Conteúdo A',
  objectivesText: 'Objetivo A',
  methodologyText: '',
  resourcesText: '',
  evaluationText: '',
  warnings: []
}

function destination(code, moduleId) {
  return {
    moduleId,
    teachingAssignmentId: 'assignment-1',
    code,
    name: 'Módulo de teste',
    label: `${code} · Módulo de teste`,
    existingPlanification: 'no'
  }
}

test(
  'module code matching ignores case and surrounding whitespace without collapsing punctuation',
  () => {
    const matched = preview.buildPlanificationPdfPreview(
      {
        sourceDocumentName: 'planificacao.docx',
        sections: [section],
        warnings: []
      },
      [destination('  m1  ', 'module-m1')]
    )

    assert.equal(matched.rows[0].candidates.length, 1)
    assert.equal(matched.rows[0].candidates[0].moduleId, 'module-m1')
    assert.equal(matched.rows[0].suggestedDestinationId, 'module-m1')

    const punctuationMustRemainDistinct =
      preview.buildPlanificationPdfPreview(
        {
          sourceDocumentName: 'planificacao.docx',
          sections: [section],
          warnings: []
        },
        [destination('M-1', 'module-m-dash-1')]
      )

    assert.equal(
      punctuationMustRemainDistinct.rows[0].candidates.length,
      0
    )
    assert.equal(
      punctuationMustRemainDistinct.rows[0].suggestedDestinationId,
      null
    )
  }
)
