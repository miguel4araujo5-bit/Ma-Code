import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const wrapperSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/ExtraLessonDialog.tsx',
    import.meta.url
  ),
  'utf8'
)

const baseSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/ExtraLessonDialogBase.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'extra lesson tracks only user interactions while preserving async suggestion updates in the base implementation',
  () => {
    assert.match(wrapperSource, /hasUserChanges/)
    assert.match(wrapperSource, /markUserChange/)
    assert.match(
      wrapperSource,
      /onChangeCapture=\{markUserChange\}/
    )
    assert.match(
      baseSource,
      /loadSelectionContext[\s\S]*setForm\(\(current\)[\s\S]*currentModuleStillExists/
    )
    assert.doesNotMatch(
      wrapperSource,
      /loadSelectionContext/
    )
  }
)

test(
  'form-changing buttons are captured without marking close, cancel or submit actions as new edits',
  () => {
    assert.match(wrapperSource, /handleUserActionCapture/)
    assert.match(
      wrapperSource,
      /onClickCapture=\{handleUserActionCapture\}/
    )
    assert.match(
      wrapperSource,
      /button\.type === 'submit'/
    )
    assert.match(
      wrapperSource,
      /ariaLabel === 'Fechar criação da aula extra'/
    )
    assert.match(wrapperSource, /text === 'Fechar'/)
    assert.match(wrapperSource, /text === 'Cancelar'/)
    assert.match(
      wrapperSource,
      /markUserChange\(\)/
    )
  }
)

test(
  'all existing close paths flow through one protected onClose callback',
  () => {
    assert.match(
      wrapperSource,
      /confirmDiscardExtraLessonChanges/
    )
    assert.match(wrapperSource, /requestClose/)
    assert.match(
      wrapperSource,
      /onClose=\{requestClose\}/
    )
    assert.match(
      baseSource,
      /event\.key === 'Escape'[\s\S]*onClose\(\)/
    )
    assert.match(
      baseSource,
      /event\.target === event\.currentTarget[\s\S]*onClose\(\)/
    )
    assert.ok(
      (baseSource.match(/onClick=\{onClose\}/g) ?? []).length >= 2,
      'header close and footer Cancelar must retain the shared onClose callback'
    )
  }
)

test(
  'browser close and navigation are protected only after the user changes the extra lesson',
  () => {
    assert.match(wrapperSource, /rootRef/)
    assert.match(
      wrapperSource,
      /useMAProfessorUnsavedWorkspaceProtection/
    )
    assert.match(
      wrapperSource,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUserChanges/
    )
    assert.match(wrapperSource, /ref=\{rootRef\}/)
  }
)

test(
  'successful creation clears the pending-change flag before handing the lesson back to the app',
  () => {
    assert.match(wrapperSource, /handleCreated/)
    assert.match(
      wrapperSource,
      /handleCreated[\s\S]*setHasUserChanges\(false\)[\s\S]*onCreated\(lesson\)/
    )
    assert.match(
      wrapperSource,
      /onCreated=\{handleCreated\}/
    )
  }
)
