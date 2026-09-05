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

const appSource = await readFile(
  new URL(
    '../../src/components/ma-professor/MAProfessorApp.tsx',
    import.meta.url
  ),
  'utf8'
)

const menuSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/ProductMenuWorkspace.tsx',
    import.meta.url
  ),
  'utf8'
)

const productSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/MAProfessorProduct.tsx',
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
  'planifications preserve unrelated unsaved edits across snapshot refreshes and guard destructive navigation',
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
      /beforeunload/
    )
    assert.match(
      planificationSource,
      /onNavigationGuardChange/
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
  }
)

test(
  'assessment grades preserve other dirty students across one-student saves and guard filters',
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
      /beforeunload/
    )
    assert.match(
      assessmentSource,
      /onNavigationGuardChange/
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
  }
)

test(
  'management workspace navigation waits for the active unsaved-work guard',
  () => {
    assert.match(
      appSource,
      /workspaceNavigationGuardRef/
    )
    assert.match(
      appSource,
      /handleWorkspaceNavigationGuardChange/
    )

    const start = appSource.indexOf(
      'async function handleWorkspaceChange('
    )

    assert.ok(start >= 0)

    const section = appSource.slice(
      start,
      appSource.indexOf(
        'function handleCalendarModeChange(',
        start
      )
    )

    const guardPosition = section.indexOf(
      'workspaceNavigationGuardRef.current'
    )
    const workspacePosition = section.indexOf(
      'setActiveWorkspace('
    )

    assert.ok(guardPosition >= 0)
    assert.ok(workspacePosition >= 0)
    assert.ok(
      guardPosition < workspacePosition,
      'O guard tem de correr antes da troca de workspace.'
    )

    assert.match(
      appSource,
      /AssessmentWorkspaceView[\s\S]*onNavigationGuardChange=\{[\s\S]*handleWorkspaceNavigationGuardChange/
    )
    assert.match(
      appSource,
      /PlanificationWorkspaceView[\s\S]*onNavigationGuardChange=\{[\s\S]*handleWorkspaceNavigationGuardChange/
    )
  }
)

test(
  'unsaved management work is also guarded when leaving the nested menu or top-level product workspace',
  () => {
    assert.match(
      menuSource,
      /managementNavigationGuardRef/
    )
    assert.match(
      menuSource,
      /handleManagementBack/
    )
    assert.match(
      menuSource,
      /MAProfessorApp[\s\S]*onNavigationGuardChange/
    )

    assert.match(
      productSource,
      /activeNavigationGuardRef/
    )
    assert.match(
      productSource,
      /handleNavigationGuardChange/
    )

    const start = productSource.indexOf(
      'const handleSelect ='
    )
    const end = productSource.indexOf(
      'const handleDataChanged =',
      start
    )
    const section = productSource.slice(
      start,
      end
    )

    const guardPosition = section.indexOf(
      'activeNavigationGuardRef.current'
    )
    const finalWorkspacePosition = section.lastIndexOf(
      'setWorkspace('
    )

    assert.ok(guardPosition >= 0)
    assert.ok(finalWorkspacePosition >= 0)
    assert.ok(
      guardPosition < finalWorkspacePosition,
      'O guard global tem de correr antes de sair do workspace atual.'
    )
  }
)
