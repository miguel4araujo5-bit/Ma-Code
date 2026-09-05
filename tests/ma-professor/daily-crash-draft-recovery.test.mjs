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

const draftStorageSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyDraftStorage.ts',
    import.meta.url
  ),
  'utf8'
)

const dailyViewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceView.tsx',
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

const draftStorageModule = await import(
  transpile(draftStorageSource)
)

test(
  'daily crash drafts use a dedicated IndexedDB and never plaintext localStorage',
  () => {
    assert.match(
      draftStorageSource,
      /ma-professor-daily-drafts/
    )
    assert.match(
      draftStorageSource,
      /indexedDB\.open/
    )
    assert.doesNotMatch(
      draftStorageSource,
      /localStorage|sessionStorage/
    )
    assert.doesNotMatch(
      draftStorageSource,
      /MA_PROFESSOR_DATABASE_NAME|ma-professor['"]/,
      'Os rascunhos não devem alterar nem reutilizar o schema da base pedagógica principal.'
    )
  }
)

test(
  'daily draft identity is scoped by account, academic year and lesson',
  () => {
    const first =
      draftStorageModule.createMAProfessorDailyDraftId(
        ' Professor@Example.PT ',
        'year-1',
        'lesson-1'
      )

    assert.equal(
      first,
      draftStorageModule.createMAProfessorDailyDraftId(
        'professor@example.pt',
        'year-1',
        'lesson-1'
      )
    )

    assert.notEqual(
      first,
      draftStorageModule.createMAProfessorDailyDraftId(
        'other@example.pt',
        'year-1',
        'lesson-1'
      )
    )

    assert.notEqual(
      first,
      draftStorageModule.createMAProfessorDailyDraftId(
        'professor@example.pt',
        'year-2',
        'lesson-1'
      )
    )

    assert.notEqual(
      first,
      draftStorageModule.createMAProfessorDailyDraftId(
        'professor@example.pt',
        'year-1',
        'lesson-2'
      )
    )
  }
)

test(
  'automatic draft recovery is allowed only when persisted data still match the draft base',
  () => {
    assert.equal(
      draftStorageModule.shouldAutoRestoreMAProfessorDailyDraft(
        {
          baseSavedSignature: 'persisted-v1',
          draftSignature: 'draft-v2'
        },
        'persisted-v1'
      ),
      true
    )

    assert.equal(
      draftStorageModule.shouldAutoRestoreMAProfessorDailyDraft(
        {
          baseSavedSignature: 'persisted-v1',
          draftSignature: 'draft-v2'
        },
        'persisted-v3'
      ),
      false,
      'Uma alteração persistida noutra aba não pode ser substituída automaticamente por um rascunho antigo.'
    )

    assert.equal(
      draftStorageModule.shouldAutoRestoreMAProfessorDailyDraft(
        {
          baseSavedSignature: 'persisted-v1',
          draftSignature: 'persisted-v1'
        },
        'persisted-v1'
      ),
      false,
      'Um rascunho sem diferenças não precisa de recuperação.'
    )
  }
)

test(
  'Daily receives the authenticated account identity for draft isolation',
  () => {
    assert.match(
      productSource,
      /useMAProfessorAccess/
    )
    assert.match(
      productSource,
      /accountEmail=\{[\s\S]*session\.email[\s\S]*\}/
    )
    assert.match(
      dailyViewSource,
      /accountEmail:\s*string/
    )
  }
)

test(
  'Daily restores only a safe matching draft, persists dirty edits and clears the draft after save',
  () => {
    assert.match(
      dailyViewSource,
      /readMAProfessorDailyDraft/
    )
    assert.match(
      dailyViewSource,
      /shouldAutoRestoreMAProfessorDailyDraft/
    )
    assert.match(
      dailyViewSource,
      /saveMAProfessorDailyDraft/
    )
    assert.match(
      dailyViewSource,
      /deleteMAProfessorDailyDraft/
    )

    const saveSectionStart =
      dailyViewSource.indexOf(
        'async function saveAll('
      )
    const navigationSectionStart =
      dailyViewSource.indexOf(
        'async function saveBeforeNavigation()',
        saveSectionStart
      )

    assert.ok(saveSectionStart >= 0)
    assert.ok(navigationSectionStart > saveSectionStart)

    const saveSection =
      dailyViewSource.slice(
        saveSectionStart,
        navigationSectionStart
      )

    const repositorySave =
      saveSection.indexOf(
        'await dailyWorkspaceRepository.saveLesson('
      )
    const draftDelete =
      saveSection.indexOf(
        'deleteMAProfessorDailyDraft',
        repositorySave
      )

    assert.ok(repositorySave >= 0)
    assert.ok(
      draftDelete > repositorySave,
      'O rascunho só pode ser eliminado depois de a gravação pedagógica ter sido concluída.'
    )
  }
)

test(
  'Daily attempts an immediate draft persistence when the document becomes hidden',
  () => {
    assert.match(
      dailyViewSource,
      /visibilitychange/
    )
    assert.match(
      dailyViewSource,
      /document\.visibilityState\s*===\s*['"]hidden['"][\s\S]*persistCurrentDailyDraft/
    )
  }
)
