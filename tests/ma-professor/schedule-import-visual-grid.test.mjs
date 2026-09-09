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
    startTime: '09:20',
    endTime: '10:10',
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

const updates = []

async function render() {
  await act(async () => {
    rootView.render(
      createElement(ScheduleImportVisualGrid, {
        lessons,
        duties,
        onUpdateLesson: (id, changes) =>
          updates.push({ kind: 'lesson', id, changes }),
        onUpdateDuty: (id, changes) =>
          updates.push({ kind: 'duty', id, changes })
      })
    )
  })
}

function buttonWithText(text) {
  return [...container.querySelectorAll('button')]
    .find(button => button.textContent.includes(text))
}

after(async () => {
  await act(async () => {
    rootView.unmount()
  })
  dom.window.close()
  rmSync(output, { recursive: true, force: true })
})

test('visual review mirrors a school timetable with weekdays, time rows and imported context', async () => {
  await render()

  const text = container.textContent

  for (const day of ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']) {
    assert.match(text, new RegExp(day))
  }

  assert.doesNotMatch(text, /Sábado|Domingo/)
  assert.match(text, /08:30/)
  assert.match(text, /09:20/)
  assert.match(text, /Área de Expressões/)
  assert.match(text, /10\.º D/)
  assert.match(text, /Técnico de Apoio Psicossocial/)
  assert.match(text, /Co PCE/)
  assert.match(text, /Disciplina por confirmar/)
  assert.match(text, /Excluída da importação/)
})

test('clicking a lesson opens editable review without bypassing ambiguous-subject confirmation', async () => {
  await render()

  const ambiguous = buttonWithText('AP')
  assert.ok(ambiguous)

  await act(async () => {
    ambiguous.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    )
  })

  assert.match(container.textContent, /Rever aula/)
  assert.match(container.textContent, /Turma/)
  assert.match(container.textContent, /Disciplina/)
  assert.match(container.textContent, /Curso/)
  assert.match(
    container.textContent,
    /Confirme apenas depois de verificar/
  )

  const confirm =
    buttonWithText('Confirmar como disciplina')
  assert.ok(confirm)
  assert.equal(confirm.disabled, true)

  const includeCheckbox =
    [...container.querySelectorAll('input[type="checkbox"]')]
      .find(input =>
        input.parentElement?.textContent.includes(
          'Incluir esta aula na importação'
        )
      )

  assert.ok(includeCheckbox)
  assert.equal(includeCheckbox.checked, false)

  await act(async () => {
    includeCheckbox.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    )
  })

  assert.deepEqual(updates.at(-1), {
    kind: 'lesson',
    id: 'lesson-b',
    changes: {
      included: true
    }
  })
})

test('confirmed lesson can be selected and its course field is exposed for correction', async () => {
  await render()

  const lesson =
    buttonWithText('Área de Expressões')
  assert.ok(lesson)

  await act(async () => {
    lesson.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    )
  })

  const courseInput =
    [...container.querySelectorAll('input')]
      .find(input =>
        input.value === 'Técnico de Apoio Psicossocial'
      )

  assert.ok(courseInput)

  await act(async () => {
    const setter =
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        'value'
      ).set
    setter.call(courseInput, 'Outro curso')
    courseInput.dispatchEvent(
      new Event('input', { bubbles: true })
    )
    courseInput.dispatchEvent(
      new Event('change', { bubbles: true })
    )
  })

  assert.ok(
    updates.some(update =>
      update.kind === 'lesson' &&
      update.id === 'lesson-a' &&
      update.changes.courseName === 'Outro curso'
    )
  )
})
