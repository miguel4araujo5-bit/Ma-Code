import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(new URL('../..', import.meta.url).pathname)
const read = path => readFileSync(resolve(root, path), 'utf8')

const guided = read('src/components/ma-professor/setup/GuidedAssessmentCriteriaImportPanel.tsx')
const advanced = read('src/components/ma-professor/setup/AssessmentCriteriaPdfImportPanel.tsx')
const reader = read('src/components/ma-professor/setup/assessmentCriteriaDocumentReader.ts')

test('guided and advanced criteria imports share the same document reader and parser', () => {
  for (const source of [guided, advanced]) {
    assert.match(source, /readAssessmentCriteriaDocument/)
    assert.match(source, /parseAssessmentCriteriaPdfDocument/)
    assert.match(source, /resolveAssessmentCriteriaDestinations/)
  }

  assert.doesNotMatch(advanced, /extractPlanificationPdf/)
  assert.match(reader, /return extractPlanificationPdf\(file\)/)
  assert.match(reader, /parseAssessmentCriteriaDocxXml/)
})

test('advanced criteria import accepts PDF and DOCX while keeping mandatory preview before save', () => {
  assert.match(
    advanced,
    /accept="application\/pdf,\.pdf,\.docx,application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document"/
  )
  assert.match(advanced, /Pré-visualização/)
  assert.match(advanced, /Revisão obrigatória/)
  assert.match(advanced, /Confirmar importação revista/)

  const previewIndex = advanced.indexOf('{parsed ? (')
  const confirmButtonIndex = advanced.indexOf('Confirmar importação revista')
  assert.ok(previewIndex >= 0)
  assert.ok(confirmButtonIndex > previewIndex)
})

test('advanced criteria import preserves manual subject and UFCD destination controls', () => {
  assert.match(advanced, /Critérios gerais da disciplina/)
  assert.match(advanced, /Critérios específicos de UFCD/)
  assert.match(advanced, /Nome do conjunto/)
  assert.match(advanced, /assessmentCriteriaBatchRepository\.createSubjectSchemes/)
  assert.match(advanced, /assessmentCriteriaModuleRepository\.createModuleScheme/)
  assert.match(advanced, /teachingAssignmentIds: assignmentIds/)
  assert.match(advanced, /moduleId/)
})

test('advanced destination suggestions use the same resolver without forcing a save target', () => {
  assert.match(
    advanced,
    /const destinationResolution = useMemo\([\s\S]*resolveAssessmentCriteriaDestinations\(snapshot, detectedSubject\)/
  )
  assert.match(
    advanced,
    /No modo avançado o destino continua a exigir seleção explícita\./
  )
  assert.match(advanced, /setAssignmentIds\(\[\]\)/)
})
