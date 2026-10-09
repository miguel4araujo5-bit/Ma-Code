import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8')
const [
  view, editor, lessonRepo, lessonBase, dailyRepo, draft, backup,
  forecast, reconciliation, calendarLabels
] = await Promise.all([
  read('src/components/ma-professor/daily/DailyWorkspaceView.tsx'),
  read('src/components/ma-professor/calendar/LessonEditorDialogBase.tsx'),
  read('src/components/ma-professor/lessons/lessonRepository.ts'),
  read('src/components/ma-professor/lessons/lessonRepositoryBase.ts'),
  read('src/components/ma-professor/daily/dailyWorkspaceRepository.ts'),
  read('src/components/ma-professor/daily/dailyDraftStorage.ts'),
  read('src/components/ma-professor/settings/backupValidation.ts'),
  read('src/components/ma-professor/lessons/ufcdProgressRepository.ts'),
  read('src/components/ma-professor/lessons/scheduledLessonReconciliation.ts'),
  read('src/components/ma-professor/calendar/calendarWorkspaceRepositoryBase.ts')
])

function extractFunction(source, name) {
  const file = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node
    ts.forEachChild(node, visit)
  }
  visit(file)
  assert.ok(found, 'A função ' + name + ' existe')
  return found.getText(file)
}
const action = extractFunction(view, 'toggleLessonNotHeld')
const code = ts.transpileModule(action, {
  compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true
})
assert.equal((code.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)

async function run(lesson, { dirty = false, persistError = null, reload = true } = {}) {
  const saved = []
  const feedback = []
  let notifications = 0
  const selectedLesson = { context: { lessonRow: { lesson } } }
  const savingRef = { current: false }
  const hasUnsavedChanges = dirty
  const date = lesson.date
  const setSaving = () => {}
  const setError = value => { if (value) feedback.push('erro: ' + value) }
  const setSuccess = value => { if (value) feedback.push(value) }
  const lessonRepository = {
    async updateLesson(...args) {
      if (persistError) throw persistError
      saved.push(args)
    }
  }
  const loadDate = async () => reload
  const notifySaved = async () => { notifications++ }
  const dailyWorkspaceRepository = { describeError: error => error.message }
  const fn = new Function(
    'selectedLesson', 'savingRef', 'hasUnsavedChanges',
    'setSaving', 'setError', 'setSuccess', 'lessonRepository',
    'loadDate', 'notifySaved', 'dailyWorkspaceRepository', 'date',
    code.outputText + '; return toggleLessonNotHeld;'
  )(
    selectedLesson, savingRef, hasUnsavedChanges, setSaving, setError,
    setSuccess, lessonRepository, loadDate, notifySaved, dailyWorkspaceRepository, date
  )
  await fn()
  return { saved, feedback, notifications, saving: savingRef.current }
}

const lesson = {
  id: 'l-1', date: '2026-10-09', updatedAt: '2026-10-09T10:00:00Z',
  status: 'planned', giaeStatus: 'pending', countTowardProgress: true
}

test('marcar não realizada num clique grava estado individual e não contabiliza o tempo', async () => {
  const r = await run(lesson)
  assert.equal(r.saved.length, 1)
  assert.deepEqual(r.saved[0], [
    'l-1',
    {
      status: 'cancelled',
      countTowardProgress: false,
      nonRealizationReason: null,
      nonRealizationDetails: ''
    },
    { expectedUpdatedAt: lesson.updatedAt }
  ])
  assert.equal(r.notifications, 1)
  assert.equal(r.saving, false)
})

test('desfazer repõe Planeada e não inventa uma nova aula', async () => {
  const r = await run({ ...lesson, status: 'cancelled', countTowardProgress: false })
  assert.equal(r.saved.length, 1)
  assert.equal(r.saved[0][0], 'l-1')
  assert.equal(r.saved[0][1].status, 'planned')
  assert.equal(r.saved[0][1].countTowardProgress, true)
})

test('visto GIAE e rascunhos não são removidos silenciosamente', async () => {
  const submitted = await run({ ...lesson, giaeStatus: 'submitted' })
  assert.equal(submitted.saved.length, 0)
  assert.match(submitted.feedback.join(' '), /Retire primeiro o visto/)
  const dirty = await run(lesson, { dirty: true })
  assert.equal(dirty.saved.length, 0)
  assert.match(dirty.feedback.join(' '), /Guarde primeiro/)
  assert.match(lessonRepo, /cancelsLesson && latest\.giaeStatus === 'submitted'/)
})

test('falha ao guardar não assinala como concluído', async () => {
  const r = await run(lesson, { persistError: new Error('Registo protegido') })
  assert.equal(r.saved.length, 0)
  assert.equal(r.notifications, 0)
  assert.match(r.feedback.join(' '), /Registo protegido/)
})

test('motivo facultativo e independente das notas privadas está nos dois editores', () => {
  for (const source of [editor, view]) {
    assert.match(source, /Motivo \(facultativo\)/)
    assert.match(source, /value="teacher_absence"/)
    assert.match(source, /value="strike"/)
    assert.match(source, /value="other"/)
    assert.match(source, /nonRealizationDetails/)
  }
  assert.match(lessonBase, /nonRealizationReason/)
  assert.match(lessonBase, /nonRealizationDetails/)
  assert.match(dailyRepo, /nonRealizationReason: input\.nonRealizationReason/)
  assert.match(draft, /nonRealizationReason\?:/)
  assert.match(backup, /value\.nonRealizationReason/)
})

test('ocorrências não realizadas não desaparecem da previsão nem da grelha', () => {
  assert.match(reconciliation, /lesson\.status ===\s*'planned'/)
  assert.match(forecast, /lesson\.status !==\s*'cancelled'/)
  assert.match(view, /Aula não realizada/)
  assert.match(view, /border-rose-300\/55 bg-rose-300\/20/)
  assert.match(calendarLabels, /'Aula não realizada'/)
})

test('código modificado compila sintaticamente', async () => {
  for (const [path, source] of [
    ['view.tsx', view], ['editor.tsx', editor],
    ['lessonRepo.ts', lessonRepo], ['lessonBase.ts', lessonBase],
    ['dailyRepo.ts', dailyRepo], ['draft.ts', draft], ['backup.ts', backup]
  ]) {
    const out = ts.transpileModule(source, {
      fileName: path,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      reportDiagnostics: true
    })
    assert.equal((out.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0, path)
  }
})
