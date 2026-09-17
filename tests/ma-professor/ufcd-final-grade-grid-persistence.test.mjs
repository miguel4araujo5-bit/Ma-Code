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
    '../../src/components/ma-professor/assessments/assessmentWorkspaceRepositoryBase.ts',
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

const backupSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/backupRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const cloudBackupSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/cloudBackupService.ts',
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
  'UFCD final grades remain covered by local snapshots and the current encrypted cloud backup',
  () => {
    assert.match(
      snapshotSource,
      /database\.moduleFinalGrades\.toArray\(\)/
    )
    assert.match(
      snapshotSource,
      /database\.moduleFinalGrades\.bulkPut\(/
    )
    assert.match(
      backupSource,
      /maProfessorDb\.moduleFinalGrades\.toArray\(\)/
    )
    assert.match(
      cloudBackupSource,
      /JSON\.stringify\(backup\)/
    )
    assert.match(
      cloudBackupSource,
      /subtle\.encrypt\(/
    )
    assert.doesNotMatch(
      repositorySource,
      /fetch\(|WebSocket|setInterval|setTimeout/
    )
  }
)
