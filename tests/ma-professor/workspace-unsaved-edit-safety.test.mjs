import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    diagnostic =>
      diagnostic.category === ts.DiagnosticCategory.Error
  )

  assert.equal(
    errors.length,
    0,
    errors.map(diagnostic =>
      ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      )
    ).join('\n')
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const reconciliationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/navigation/draftReconciliation.ts',
    import.meta.url
  ),
  'utf8'
)

const navigationProtectionSource = await readFile(
  new URL(
    '../../src/components/ma-professor/navigation/useUnsavedWorkspaceProtection.ts',
    import.meta.url
  ),
  'utf8'
)

const planificationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/PlanificationWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const assessmentSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/AssessmentWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const reconciliation = await import(
  transpile(reconciliationSource)
)

test(
  'draft reconciliation preserves dirty rows while accepting refreshed clean rows',
  () => {
    const previousPersisted = {
      a: { value: 'A1', note: '' },
      b: { value: 'B1', note: '' },
      deleted: { value: 'old', note: '' }
    }

    const currentDrafts = {
      a: { value: 'A2 local', note: '' },
      b: { value: 'B1', note: '' },
      deleted: { value: 'local deleted row', note: '' }
    }

    const nextPersisted = {
      a: { value: 'A1 remote', note: '' },
      b: { value: 'B2 persisted', note: '' },
      added: { value: 'new', note: '' }
    }

    assert.deepEqual(
      reconciliation.reconcileMAProfessorDraftRecord(
        previousPersisted,
        currentDrafts,
        nextPersisted
      ),
      {
        a: { value: 'A2 local', note: '' },
        b: { value: 'B2 persisted', note: '' },
        added: { value: 'new', note: '' }
      }
    )
  }
)

test(
  'dirty record detection distinguishes unchanged and edited drafts',
  () => {
    const persisted = {
      a: { value: '10', note: '' },
      b: { value: '11', note: 'ok' }
    }

    assert.equal(
      reconciliation.hasMAProfessorDirtyDraftRecord(
        persisted,
        {
          a: { value: '10', note: '' },
          b: { value: '11', note: 'ok' }
        }
      ),
      false
    )

    assert.equal(
      reconciliation.hasMAProfessorDirtyDraftRecord(
        persisted,
        {
          a: { value: '10', note: '' },
          b: { value: '12', note: 'ok' }
        }
      ),
      true
    )
  }
)

test(
  'shared unsaved-work protection warns on browser close and intercepts navigation outside the editor root',
  () => {
    assert.match(
      navigationProtectionSource,
      /beforeunload/
    )
    assert.match(
      navigationProtectionSource,
      /document\.addEventListener\([\s\S]*['"]click['"][\s\S]*handleExternalClick[\s\S]*true/
    )
    assert.match(
      navigationProtectionSource,
      /rootRef\.current\?\.contains/
    )
    assert.match(
      navigationProtectionSource,
      /window\.confirm/
    )
    assert.match(
      navigationProtectionSource,
      /event\.preventDefault\(\)/
    )
    assert.match(
      navigationProtectionSource,
      /event\.stopPropagation\(\)/
    )
    assert.match(
      navigationProtectionSource,
      /event\.stopImmediatePropagation\(\)/
    )
  }
)

test(
  'planifications preserve unrelated unsaved edits across snapshot refreshes and guard destructive actions',
  () => {
    assert.match(
      planificationSource,
      /reconcileMAProfessorDraftRecord/
    )
    assert.match(
      planificationSource,
      /hasPlanificationUnsavedChanges/
    )
    assert.match(
      planificationSource,
      /confirmDiscardUnsavedChanges/
    )
    assert.match(
      planificationSource,
      /useMAProfessorUnsavedWorkspaceProtection/
    )

    assert.match(
      planificationSource,
      /snapshot\.generatedAt[\s\S]*reconcileMAProfessorDraftRecord/
    )

    assert.match(
      planificationSource,
      /handleFiltersChange[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onFiltersChange/
    )

    assert.match(
      planificationSource,
      /handleRefresh[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onRefresh/
    )

    assert.match(
      planificationSource,
      /handleLessonSelect[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onLessonSelect/
    )
  }
)

test(
  'assessment grades preserve other dirty students across one-student saves and guard destructive actions',
  () => {
    assert.match(
      assessmentSource,
      /reconcileMAProfessorDraftRecord/
    )
    assert.match(
      assessmentSource,
      /hasAssessmentUnsavedChanges/
    )
    assert.match(
      assessmentSource,
      /confirmDiscardUnsavedChanges/
    )
    assert.match(
      assessmentSource,
      /useMAProfessorUnsavedWorkspaceProtection/
    )

    assert.match(
      assessmentSource,
      /snapshot\.generatedAt[\s\S]*reconcileMAProfessorDraftRecord/
    )

    assert.match(
      assessmentSource,
      /handleAssignmentChange[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onFiltersChange/
    )

    assert.match(
      assessmentSource,
      /handleModuleChange[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onFiltersChange/
    )

    assert.match(
      assessmentSource,
      /handleRefresh[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onRefresh/
    )

    assert.match(
      assessmentSource,
      /handleLessonSelect[\s\S]*confirmDiscardUnsavedChanges[\s\S]*onLessonSelect/
    )
  }
)
