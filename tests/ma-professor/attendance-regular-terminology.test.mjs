import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/attendance/AttendanceWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'attendance wording follows the selected education type without changing the recovery model',
  () => {
    assert.match(
      source,
      /snapshot\.selectedGroup\?\.educationType ===\s*['"]regular['"]/
    )

    assert.match(
      source,
      /Acompanhamento da disciplina/
    )
    assert.match(
      source,
      /Componente curricular/
    )
    assert.match(
      source,
      /contabilizadas nesta disciplina/
    )
    assert.match(
      source,
      /ligada a esta disciplina e ao aluno selecionado/
    )

    assert.match(
      source,
      /Acompanhamento por UFCD/
    )
    assert.match(
      source,
      /UFCD ou módulo/
    )
    assert.match(
      source,
      /contabilizadas nesta UFCD ou módulo/
    )

    assert.match(
      source,
      /onSynchronizeRecoveries\(\s*moduleId\s*\)/
    )
    assert.match(
      source,
      /onCreateRecovery\(\{[\s\S]*moduleId,[\s\S]*studentId/
    )
  }
)
