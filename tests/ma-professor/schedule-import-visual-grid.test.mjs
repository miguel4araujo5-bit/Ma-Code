import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import {
  dirname,
  join,
  resolve
} from 'node:path'
import test, { after } from 'node:test'
import ts from 'typescript'
import { JSDOM } from 'jsdom'

const root =
  resolve(new URL('../..', import.meta.url).pathname)
const cache =
  join(root, 'node_modules', '.cache')
mkdirSync(cache, { recursive: true })
const output =
  mkdtempSync(join(cache, 'schedule-visual-grid-'))
writeFileSync(
  join(output, 'package.json'),
  '{"type":"commonjs"}'
)

const require = createRequire(import.meta.url)
const compiled = new Set()

function compile(relative) {
  if (compiled.has(relative)) return
  compiled.add(relative)

  const source =
    readFileSync(join(root, relative), 'utf8')
  const code =
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX
      }
    }).outputText
  const target =
    join(output, relative.replace(/\.tsx?$/, '.js'))

  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, code)

  for (const match of code.matchAll(/require\(["'](\.[^"']+)["']\)/g)) {
    const dependencyBase =
      resolve(dirname(join(root, relative)), match[1])
    const dependency =
      existsSync(dependencyBase + '.ts')
        ? dependencyBase + '.ts'
        : dependencyBase + '.tsx'

    compile(dependency.slice(root.length + 1))
  }
}

const relative =
  'src/components/ma-professor/setup/ScheduleImportVisualGrid.tsx'
compile(relative)

const dom =
  new JSDOM('<div id="root"></div>', {
    url: 'https://example.test'
  })

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Event = dom.window.Event
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const {
  createElement,
  act
} = require('react')
const {
  createRoot
} = require('react-dom/client')
const ScheduleImportVisualGrid =
  require(
    join(output, relative.replace(/\.tsx$/, '.js'))
  ).default

const container =
  document.getElementById('root')
const rootView = createRoot(container)

const lessons = [
  {
    id: 'lesson-a',
    included: true,
    weekday: 1,
    startTime: '08:30',
    endTime: '09:20',
    periodCount: 1,
    groupName: '10.º D',
    courseName: 'Técnico de Apoio Psicossocial',
    subjectName: 'Área de Expressões',
    subjectConfirmed: true
  },
  {
    id: 'lesson-b',
    included: false,
    weekday: 3,
    startTime: '09:25',
    endTime: '10:15',
    periodCount: 1,
    groupName: '11.º E',
    courseName: 'Técnico de Apoio Psicossocial',
    subjectName: 'AP',
    subjectConfirmed: false
  }
]

const duties = [
  {
    id: 'duty-a',
    included: true,
    weekday: 2,
    startTime: '08:30',
    endTime: '09:20',
    name: 'Co PCE'
  }
]

const unresolved = [
  {
    id: 'unknown-a',
    weekday: 5,
    startTime: '10:30',
    endTime: '11:20',
    periodCount: 1,
    rawText: 'Projeto Individual',
    reason: 'Classificação insuficiente.'
  }
]

const sourceTimeRows = [
  { startTime: '07:35', endTime: '08:25' },
  { startTime: '08:30', endTime: '09:20' },
  { startTime: '09:25', endTime: '10:15' },
  { startTime: '10:30', endTime: '11:20' },
  { startTime: '12:20', endTime: '13:10' }
]

const updates = []

async function render() {
  updates.length = 0

  await act(async () => {
    rootView.render(
      createElement(ScheduleImportVisualGrid, {
        lessons,
        duties,
        unresolved,
        sourceTimeRows,
        onUpdateLesson: (id, changes) =>
          updates.push({ kind: 'lesson-update', id, changes }),
        onUpdateDuty: (id, changes) =>
          updates.push({ kind: 'duty-update', id, changes }),
        onLessonAsDuty: id =>
          updates.push({ kind: 'lesson-as-duty', id }),
        onDutyAsLesson: id =>
          updates.push({ kind: 'duty-as-lesson', id }),
        onUnresolvedAsLesson: id =>
          updates.push({ kind: 'unknown-as-lesson', id }),
        onUnresolvedAsDuty: id =>
          updates.push({ kind: 'unknown-as-duty', id }),
        onIgnoreUnresolved: id =>
          updates.push({ kind: 'ignore-unknown', id })
      })
    )
  })
}

function block(id) {
  return container.querySelector(`[data-schedule-block="${id}"]`)
}

function buttonInside(element, text) {
  return [...element.querySelectorAll('button')]
    .find(button => button.textContent.includes(text))
}

after(async () => {
  await act(async () => {
    rootView.unmount()
  })
  dom.window.close()
  rmSync(output, { recursive: true, force: true })
})

test('weekly review preserves source time rows including empty rows and keeps every occupied block in the grid', async () => {
  await render()

  const text = container.textContent

  for (const day of ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']) {
    assert.match(text, new RegExp(day))
  }

  assert.doesNotMatch(text, /Sábado|Domingo/)
  assert.match(text, /07:35/)
  assert.match(text, /08:25/)
  assert.match(text, /12:20/)
  assert.match(text, /13:10/)
  assert.match(text, /Área de Expressões/)
  assert.match(text, /Co PCE/)
  assert.match(text, /Projeto Individual/)
  assert.match(text, /Componente letiva/)
  assert.match(text, /Cargo/)
  assert.equal(
    container.querySelectorAll('[data-schedule-cell]').length,
    sourceTimeRows.length * 5
  )
})

test('clicking a lesson expands its editor inside the same timetable cell', async () => {
  await render()

  const article = block('lesson-a')
  assert.ok(article)
  const opener = buttonInside(article, 'Área de Expressões')
  assert.ok(opener)

  await act(async () => {
    opener.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    )
  })

  const editor = article.querySelector('.schedule-import-inline-editor')
  assert.ok(editor)
  assert.match(editor.textContent, /Turma/)
  assert.match(editor.textContent, /Disciplina/)
  assert.match(editor.textContent, /Curso/)
  assert.equal(
    container.querySelectorAll(':scope > .schedule-import-inline-editor').length,
    0
  )
})

test('a teaching block can be reclassified directly to Cargo from its own cell', async () => {
  await render()

  const article = block('lesson-a')
  const cargo = buttonInside(article, 'Cargo')
  assert.ok(cargo)

  await act(async () => {
    cargo.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    )
  })

  assert.deepEqual(updates.at(-1), {
    kind: 'lesson-as-duty',
    id: 'lesson-a'
  })
})

test('a duty can be reclassified directly to Componente letiva from its own cell', async () => {
  await render()

  const article = block('duty-a')
  const teaching = buttonInside(article, 'Componente letiva')
  assert.ok(teaching)

  await act(async () => {
    teaching.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    )
  })

  assert.deepEqual(updates.at(-1), {
    kind: 'duty-as-lesson',
    id: 'duty-a'
  })
})

test('unresolved occupied cells are classified in the weekly grid instead of a separate review panel', async () => {
  await render()

  const article = block('unknown-a')
  assert.ok(article)
  assert.match(article.textContent, /Escolha o tipo/)

  const teaching = buttonInside(article, 'Componente letiva')
  assert.ok(teaching)

  await act(async () => {
    teaching.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    )
  })

  assert.deepEqual(updates.at(-1), {
    kind: 'unknown-as-lesson',
    id: 'unknown-a'
  })
})

test('ambiguous subjects remain explicitly confirmable inside the cell editor', async () => {
  await render()

  const article = block('lesson-b')
  const opener = buttonInside(article, 'AP')
  assert.ok(opener)

  await act(async () => {
    opener.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    )
  })

  assert.match(article.textContent, /Disciplina por confirmar/)
  const confirm = buttonInside(article, 'Confirmar como disciplina')
  assert.ok(confirm)
  assert.equal(confirm.disabled, true)

  const includeCheckbox = article.querySelector('input[type="checkbox"]')
  assert.ok(includeCheckbox)
  assert.equal(includeCheckbox.checked, false)

  await act(async () => {
    includeCheckbox.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    )
  })

  assert.deepEqual(updates.at(-1), {
    kind: 'lesson-update',
    id: 'lesson-b',
    changes: {
      included: true
    }
  })
})
