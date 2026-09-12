import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const calendarProductSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/CalendarProductWorkspace.tsx',
    import.meta.url
  ),
  'utf8'
)

const scheduleImportSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleImportAtomicRepository.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'Cargo UI exposes a real per-occurrence summary without assessment wording',
  () => {
    assert.match(
      calendarProductSource,
      /event\.type ===[\s\S]*'school_activity'[\s\S]*event\.scope ===[\s\S]*'all'[\s\S]*event\.title\.startsWith\([\s\S]*'Cargo · '/
    )
    assert.match(
      calendarProductSource,
      /\? 'Cargo'\s*:\s*'Evento escolar'/
    )
    assert.match(
      calendarProductSource,
      /\? 'Sumário'\s*:\s*'Descrição'/
    )
    assert.match(
      calendarProductSource,
      /\? 'Guardar sumário'\s*:\s*'Guardar descrição'/
    )
    assert.doesNotMatch(
      calendarProductSource,
      /Cargo \/ componente não letiva/
    )
    assert.match(
      calendarProductSource,
      /Este sumário pertence apenas a este bloco nesta data\. Alterá-lo não modifica as restantes semanas\./
    )
  }
)

test(
  'saving a Cargo summary updates only the selected calendar occurrence description',
  () => {
    assert.match(
      calendarProductSource,
      /await calendarRepository\.updateEvent\(\s*selectedEvent\.id,\s*\{\s*description:\s*eventText\s*\}\s*\)/
    )
    assert.match(
      calendarProductSource,
      /setEventText\(\s*eventRow\.event\.description\s*\)/
    )
  }
)

test(
  'schedule import creates independent Cargo occurrences without fake pedagogical links',
  () => {
    assert.match(
      scheduleImportSource,
      /for \(\s*const date of\s*getDutyDatesForSchool\(/
    )
    assert.match(
      scheduleImportSource,
      /const event: SchoolCalendarEvent = \{[\s\S]*type:\s*'school_activity'[\s\S]*scope:\s*'all'[\s\S]*groupId:\s*null[\s\S]*teachingAssignmentId:\s*null[\s\S]*description:\s*''[\s\S]*startDate:\s*date[\s\S]*endDate:\s*date[\s\S]*blocksLessons:\s*false/
    )
    assert.match(
      scheduleImportSource,
      /await maProfessorDb\s*\.schoolCalendarEvents\s*\.add\(event\)/
    )
  }
)
