import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/GuidedAssessmentCriteriaImportPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

test('guided criteria expose multi-destination selection on the first review', () => {
  assert.match(source, /Selecione uma ou várias turmas\/disciplinas/)
  assert.match(source, /visibleDestinations\.map/)
  assert.match(source, /type="checkbox"/)
  assert.match(source, /Selecionar todas as turmas desta disciplina/)
  assert.match(source, /O destino reconhecido é apenas uma proposta/)
  assert.doesNotMatch(source, /showDestinations/)
})

test('guided criteria keep the add-another path explicit after applying', () => {
  assert.match(source, /Pode adicionar outro critério ou seguir em frente/)
  assert.match(source, /Adicionar outro critério/)
  assert.match(source, /Concluir por agora/)
  assert.match(source, /createSubjectSchemes/)
  assert.match(source, /teachingAssignmentIds: assignmentIds/)
})
