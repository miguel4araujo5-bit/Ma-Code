import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const policySource = await readFile(
  new URL(
    '../../src/components/ma-professor/attendance/learningRecoveryLifecycle.ts',
    import.meta.url
  ),
  'utf8'
).catch(() => '')

const attendanceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/attendance/attendanceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const typesSource = await readFile(
  new URL(
    '../../src/components/ma-professor/types.ts',
    import.meta.url
  ),
  'utf8'
)

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/repository.ts',
    import.meta.url
  ),
  'utf8'
)

const backupValidationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/backupValidation.ts',
    import.meta.url
  ),
  'utf8'
)

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    item => item.category === ts.DiagnosticCategory.Error
  )

  assert.equal(errors.length, 0)

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

test('learning recoveries record a conservative optional origin and teacher-touch marker', () => {
  assert.match(
    typesSource,
    /export type LearningRecoveryOrigin[\s\S]*'automatic_threshold'[\s\S]*'manual'/
  )

  assert.match(
    typesSource,
    /origin\?:\s*LearningRecoveryOrigin/
  )

  assert.match(
    typesSource,
    /teacherTouchedAt\?:\s*ISODateTime\s*\|\s*null/
  )
})

test('only untouched pending automatic recoveries are eligible for automatic cleanup', async () => {
  assert.ok(
    policySource,
    'learningRecoveryLifecycle.ts must exist'
  )

  const policy = await import(
    transpile(policySource)
  )

  const base = {
    origin: 'automatic_threshold',
    status: 'pending',
    teacherTouchedAt: null,
    contents: '',
    activity: '',
    plannedDate: null,
    result: ''
  }

  assert.equal(
    policy.canAutomaticallyRemoveRecovery(base),
    true
  )

  for (const protectedRecovery of [
    {
      ...base,
      origin: 'manual'
    },
    {
      ...base,
      origin: undefined
    },
    {
      ...base,
      teacherTouchedAt: '2026-09-06T08:00:00.000Z'
    },
    {
      ...base,
      status: 'in_progress'
    },
    {
      ...base,
      status: 'completed'
    },
    {
      ...base,
      contents: 'Conteúdo definido pelo professor'
    },
    {
      ...base,
      activity: 'Ficha de recuperação'
    },
    {
      ...base,
      plannedDate: '2026-10-10'
    },
    {
      ...base,
      result: 'Trabalho iniciado'
    }
  ]) {
    assert.equal(
      policy.canAutomaticallyRemoveRecovery(
        protectedRecovery
      ),
      false
    )
  }
})

test('manual creation and automatic threshold creation use different origins', () => {
  assert.match(
    attendanceSource,
    /createLearningRecovery\([\s\S]*origin[\s\S]*manual/
  )

  assert.match(
    attendanceSource,
    /ensureLearningRecovery[\s\S]*automatic_threshold/
  )
})

test('editing a recovery marks it as teacher-touched before persistence completes', () => {
  assert.match(
    attendanceSource,
    /updateLearningRecovery[\s\S]*teacherTouchedAt[\s\S]*updatedAt/
  )
})

test('synchronization removes only stale untouched automatic recoveries below the threshold', () => {
  assert.match(
    attendanceSource,
    /synchronizeRecoveriesForModule[\s\S]*warningLevel[\s\S]*recovery_required[\s\S]*canAutomaticallyRemoveRecovery[\s\S]*learningRecoveries[\s\S]*(?:delete|bulkDelete)/
  )
})

test('active-year reconciliation exists for threshold changes', () => {
  assert.match(
    attendanceSource,
    /synchronizeRecoveriesForActiveAcademicYear/
  )
})

test('settings reconcile recoveries centrally only when the recovery threshold changes', () => {
  assert.match(
    repositorySource,
    /updateSettings[\s\S]*learningRecoveryThresholdPercent[\s\S]*!==[\s\S]*learningRecoveryThresholdPercent[\s\S]*settings\.put[\s\S]*synchronizeRecoveriesForActiveAcademicYear/
  )
})

test('backup validation accepts legacy omissions but validates new provenance when present', () => {
  assert.match(
    backupValidationSource,
    /learningRecoveries[\s\S]*origin[\s\S]*automatic_threshold[\s\S]*manual/
  )

  assert.match(
    backupValidationSource,
    /teacherTouchedAt[\s\S]*isIsoDateTime/
  )

  assert.doesNotMatch(
    backupValidationSource,
    /required[^\n]*origin|origin[^\n]*required/i,
    'legacy recovery records without origin must remain valid'
  )
})