import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dbSource = await readFile(
  new URL(
    '../../src/components/ma-professor/db.ts',
    import.meta.url
  ),
  'utf8'
)

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/assessmentWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const snapshotSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/databaseSnapshotService.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'UFCD final-grid metadata remains non-indexed and needs no Dexie schema migration',
  () => {
    assert.match(
      dbSource,
      /MA_PROFESSOR_DATABASE_VERSION\s*=\s*\n\s*1/
    )
    assert.doesNotMatch(
      dbSource,
      /moduleFinalGrades:[\s\S]{0,300}(selfAssessmentGrade|usesAcs)/
    )
  }
)

test(
  'UFCD final-grid metadata is stored on the existing module final grade record',
  () => {
    assert.match(
      repositorySource,
      /const record:\s*\n\s*ModuleFinalGrade\s*=\s*\{[\s\S]*selfAssessmentGrade,[\s\S]*usesAcs,[\s\S]*finalGrade/
    )
    assert.match(
      repositorySource,
      /maProfessorDb\.moduleFinalGrades[\s\S]*\.put\([\s\S]*record/
    )
  }
)

test(
  'online snapshot continues to carry complete ModuleFinalGrade records without a new network path',
  () => {
    assert.match(
      snapshotSource,
      /moduleFinalGrades:\s*\n\s*ModuleFinalGrade\[\]/
    )
    assert.match(
      snapshotSource,
      /JSON\.stringify\([\s\S]*snapshot/
    )
    assert.doesNotMatch(
      repositorySource,
      /fetch\(|WebSocket|setInterval|setTimeout/
    )
  }
)
