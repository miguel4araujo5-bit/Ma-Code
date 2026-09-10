import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/GuidedAssessmentCriteriaImportPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

test('guided criteria import falls back to all available destinations when automatic matching fails', () => {
  assert.match(
    source,
    /const destinationOptions =[\s\S]*?destinationCandidates\.length > 0[\s\S]*?destinationCandidates[\s\S]*?: assignments/
  )
  assert.match(source, /destinationOptions\.map\(item =>/)
  assert.match(
    source,
    /Não foi possível reconhecer automaticamente o destino\. Escolha abaixo a turma e a disciplina onde pretende aplicar estes critérios\./
  )
})

test('manual destination selection keeps existing safety gates', () => {
  assert.match(source, /onChange=\{\(\) => toggleAssignment\(item\.assignment\.id\)\}/)
  assert.match(source, /assignmentIds\.length > 0/)
  assert.match(
    source,
    /current\.assessmentSchemes\.some\(scheme =>[\s\S]*?scheme\.scope === 'subject'[\s\S]*?scheme\.teachingAssignmentId === assignmentId/
  )
  assert.doesNotMatch(
    source,
    /Pode tratar este caso na configuração avançada\./
  )
})
