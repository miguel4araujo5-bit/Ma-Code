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

const settingsPanelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/ProfileSettingsPanel.tsx',
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

  assert.equal(
    policy.canAutomaticallyRemoveRecovery({
      ...base,
      origin: 'manual'
    }),
    false
  )

  assert.equal(
    policy.canAutomaticallyRemoveRecovery({
      ...base,
      origin: undefined
    }),
    false,
    'legacy recoveries without origin must be preserved'
  )

  assert.equal(
    policy.canAutomaticallyRemoveRecovery({
      ...base,
      teacherTouchedAt: '2026-09-06T08:00:00.000Z'
    }),
    false
  )

  assert.equal(
    policy.canAutomaticallyRemoveRecovery({
      ...base,
      status: 'in_progress'
    }),
    false
  )

  assert.equal(
    policy.canAutomaticallyRemoveRecovery({
      ...base,
      contents: 'Conteúdo definido pelo professor'
    }),
    false
  )
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

test('editing a recovery marks it as teacher-touched before persistence', () => {
  assert.match(
    attendanceSource,
    /updateLearningRecovery[\s\S]*teacherTouchedAt[\s\S]*timestamp[\s\S]*learningRecoveries[\s\S]*put/
  )
})

test('synchronization removes only stale untouched automatic recoveries below the threshold', () => {
  assert.match(
    attendanceSource,
    /synchronizeRecoveriesForModule[\s\S]*warningLevel[\s\S]*recovery_required[\s\S]*canAutomaticallyRemoveRecovery[\s\S]*learningRecoveries[\s\S]*delete/
  )
})

test('threshold changes trigger a conservative active-year reconciliation', () => {
  assert.match(
    attendanceSource,
    /synchronizeRecoveriesForActiveAcademicYear/
  )

  assert.match(
    settingsPanelSource,
    /learningRecoveryThresholdPercent[\s\S]*synchronizeRecoveriesForActiveAcademicYear/
  )
})
