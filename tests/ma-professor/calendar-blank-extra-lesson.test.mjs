import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const calendarSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/CalendarProductWorkspace.tsx',
    import.meta.url
  ),
  'utf8'
)

const dialogSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/ExtraLessonDialogBase.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'blank calendar space reuses the existing extra-lesson action without stealing interactive clicks',
  () => {
    assert.match(
      calendarSource,
      /function handleCalendarBlankSpaceClick/
    )
    assert.match(
      calendarSource,
      /button, a, input, select, textarea, label/
    )
    assert.match(
      calendarSource,
      /button\[aria-label\^="Adicionar aula extra em "\]/
    )
    assert.match(
      calendarSource,
      /addLessonButton\.click\(\)/
    )
    assert.match(
      calendarSource,
      /onClick=\{handleCalendarBlankSpaceClick\}/
    )
  }
)

test(
  'the reused extra-lesson dialog still lets the teacher choose assignment and UFCD or UC unit',
  () => {
    assert.match(
      dialogSource,
      /Turma e disciplina/
    )
    assert.match(
      dialogSource,
      /value=\{form\.teachingAssignmentId\}/
    )
    assert.match(
      dialogSource,
      /value=\{form\.moduleId\}/
    )
    assert.match(
      dialogSource,
      /Selecione uma UFCD ou módulo\./
    )
  }
)
