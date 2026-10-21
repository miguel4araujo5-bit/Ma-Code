import { maProfessorDb, openMAProfessorDatabase } from '../db'
import { maProfessorRepository } from '../repository'
import { isSBentoSchoolName } from '../setup/schoolDutyDatePolicy'
import type { AcademicYear, SchoolCalendarEvent } from '../types'
import { calendarRepository, type SchoolCalendarEventDraft } from './calendarRepository'

export type OtherSchoolCalendarRow = SchoolCalendarEventDraft & { id?: string }

// Mainland reference, explicitly reviewed by the teacher before any write.
// Despacho 8368/2024, annex II; Portaria 235-A/2018, article 44.
// The 21 September amendment (10430/2026) is for científico-humanísticos.
const NATIONAL_2026_2027: Array<[SchoolCalendarEventDraft['type'], string, string, string?]> = [
  ['holiday', 'Implantação da República', '2026-10-05'],
  ['holiday', 'Todos os Santos', '2026-11-01'],
  ['holiday', 'Restauração da Independência', '2026-12-01'],
  ['holiday', 'Nossa Senhora da Conceição', '2026-12-08'],
  ['school_break', 'Interrupção de Natal', '2026-12-16', '2026-12-31'],
  ['holiday', 'Natal', '2026-12-25'],
  ['holiday', 'Ano Novo', '2027-01-01'],
  ['school_break', 'Interrupção de Carnaval', '2027-02-08', '2027-02-10'],
  ['school_break', 'Interrupção da Páscoa', '2027-03-22', '2027-04-02'],
  ['holiday', 'Sexta-Feira Santa', '2027-03-26'],
  ['holiday', 'Páscoa', '2027-03-28'],
  ['holiday', 'Dia da Liberdade', '2027-04-25'],
  ['holiday', 'Dia do Trabalhador', '2027-05-01'],
  ['holiday', 'Corpo de Deus', '2027-05-27'],
  ['holiday', 'Dia de Portugal', '2027-06-10'],
  ['holiday', 'Assunção de Nossa Senhora', '2027-08-15']
]

export function getOtherSchoolCalendarBase(year: AcademicYear): OtherSchoolCalendarRow[] {
  if (year.name.replace(/\s/g, '').replace('-', '/') !== '2026/2027') return []
  return NATIONAL_2026_2027
    .map(([type, title, startDate, endDate]) => ({
      academicYearId: year.id, type, title, startDate, endDate: endDate ?? startDate,
      scope: 'all' as const, blocksLessons: true,
      description: 'Base nacional 2026/2027 — revista e confirmada pelo professor.'
    }))
    .filter(event => event.startDate >= year.startDate && event.endDate <= year.endDate)
}

export function calendarReviewFingerprint(events: SchoolCalendarEvent[]) {
  return JSON.stringify([...events].sort((a, b) => a.id.localeCompare(b.id)))
}

export async function confirmOtherSchoolCalendar(input: {
  academicYearId: string
  startDate: string
  endDate: string
  rows: OtherSchoolCalendarRow[]
  expectedEvents: SchoolCalendarEvent[]
}) {
  await openMAProfessorDatabase()
  await maProfessorDb.transaction('rw', [
    maProfessorDb.academicYears, maProfessorDb.schoolCalendarEvents,
    maProfessorDb.teacherProfiles, maProfessorDb.groups, maProfessorDb.teachingAssignments
  ], async () => {
    const year = await maProfessorDb.academicYears.get(input.academicYearId)
    const profile = await maProfessorDb.teacherProfiles.get('local-profile')
    if (!year || year.otherSchoolCalendarReview !== 'pending' ||
      !profile?.schoolName.trim() || isSBentoSchoolName(profile.schoolName)) {
      throw new Error('Esta revisão não se aplica ao ano letivo atual. Volte a abrir a configuração.')
    }
    const currentEvents = await maProfessorDb.schoolCalendarEvents
      .where('academicYearId').equals(year.id).toArray()
    if (calendarReviewFingerprint(currentEvents) !== calendarReviewFingerprint(input.expectedEvents)) {
      throw new Error('O calendário foi alterado noutra janela. Volte a abrir a revisão antes de confirmar.')
    }
    const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
    if (!validDate(input.startDate) || !validDate(input.endDate) || input.startDate > input.endDate) {
      throw new Error('Verifique as datas do ano letivo.')
    }
    const knownIds = new Set(currentEvents.map(event => event.id))
    const editedIds = input.rows.flatMap(row => row.id ? [row.id] : [])
    if (new Set(editedIds).size !== editedIds.length || editedIds.some(id => !knownIds.has(id)) ||
      input.rows.some(row => row.academicYearId !== year.id)) {
      throw new Error('Os eventos devem pertencer ao ano letivo em revisão.')
    }
    // A single transaction: validation/storage failure leaves the pending year
    // and every previous event untouched, including edits from another window.
    await maProfessorDb.academicYears.put({
      ...year, startDate: input.startDate, endDate: input.endDate,
      otherSchoolCalendarReview: 'confirmed', updatedAt: new Date().toISOString()
    })
    const retainedIds = new Set(editedIds)
    for (const event of currentEvents) {
      if (!retainedIds.has(event.id)) await calendarRepository.deleteEvent(event.id)
    }
    for (const row of input.rows) {
      if (row.id) {
        await calendarRepository.updateEvent(row.id, {
          title: row.title, startDate: row.startDate, endDate: row.endDate,
          blocksLessons: row.blocksLessons
        })
      } else {
        await calendarRepository.createEvent(row)
      }
    }
  })
  return maProfessorRepository.getSetupSnapshot(input.academicYearId)
}
