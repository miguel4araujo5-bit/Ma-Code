import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import 'fake-indexeddb/auto'

const root = resolve(new URL('../..', import.meta.url).pathname)
mkdirSync(join(root, 'node_modules/.cache'), { recursive: true })
const output = mkdtempSync(join(root, 'node_modules/.cache/other-school-calendar-'))
const bundle = await build({
  stdin: { contents: `
    export { maProfessorDb as db } from './src/components/ma-professor/db';
    export { maProfessorRepository as repository } from './src/components/ma-professor/repository';
    export * from './src/components/ma-professor/calendar/otherSchoolCalendar';
    export * from './src/components/ma-professor/setup/otherSchoolScheduleDraftStorage';
    export { createMAProfessorBackup, restoreMAProfessorBackup, validateMAProfessorBackup, resetMAProfessorDatabase } from './src/components/ma-professor/settings/backupRepository';
  `, resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external'
})
writeFileSync(join(output, 'runtime.cjs'), bundle.outputFiles[0].text)
globalThis.window = { indexedDB: globalThis.indexedDB }
const runtime = createRequire(import.meta.url)(join(output, 'runtime.cjs'))
const { db, repository, getOtherSchoolCalendarBase, confirmOtherSchoolCalendar } = runtime
after(async () => { await db.delete(); rmSync(output, { recursive: true, force: true }); delete globalThis.window })

test('Other school calendar: atomic confirmation, repeat safety, old backup and S. Bento preservation', async () => {
  await db.delete()
  await db.open()
  await repository.saveTeacherProfile({ displayName: 'Professor fictício', schoolName: 'Escola fictícia' })
  const year = await repository.createAcademicYear({ name: '2026/2027', startDate: '2026-09-01', endDate: '2027-08-31', active: true, otherSchoolCalendarReview: 'pending' })
  const rows = getOtherSchoolCalendarBase(year)
  assert.equal(rows.length, 16)
  assert.ok(!rows.some(row => /Vizela|São Bento/.test(row.title)))
  assert.equal(await db.schoolCalendarEvents.count(), 0)
  const input = { academicYearId: year.id, startDate: '2026-09-14', endDate: year.endDate, rows, expectedEvents: [] }
  await assert.rejects(confirmOtherSchoolCalendar({ ...input, rows: [...rows, { ...rows[0], title: 'Data inválida', startDate: '2027-02-30', endDate: '2027-02-30' }] }))
  assert.equal(await db.schoolCalendarEvents.count(), 0)
  assert.equal((await db.academicYears.get(year.id)).otherSchoolCalendarReview, 'pending')
  const local = { ...rows[0], title: 'Feriado local fictício', startDate: '2027-03-19', endDate: '2027-03-19' }
  await confirmOtherSchoolCalendar({ ...input, rows: [...rows, local] })
  assert.equal(await db.schoolCalendarEvents.count(), 17)
  assert.equal((await db.academicYears.get(year.id)).startDate, '2026-09-14')
  assert.equal((await db.academicYears.get(year.id)).otherSchoolCalendarReview, 'confirmed')
  const confirmed = await db.schoolCalendarEvents.toArray()
  await assert.rejects(confirmOtherSchoolCalendar(input))
  assert.deepEqual(await db.schoolCalendarEvents.toArray(), confirmed)

  // Old records and backups have no opt-in field; no migration is required.
  const backup = await runtime.createMAProfessorBackup()
  delete backup.data.academicYears[0].otherSchoolCalendarReview
  assert.equal(runtime.validateMAProfessorBackup(backup).valid, true)
  await runtime.restoreMAProfessorBackup(backup)
  assert.equal((await db.academicYears.get(year.id)).otherSchoolCalendarReview, undefined)
  assert.deepEqual(await db.schoolCalendarEvents.toArray(), confirmed)
  await assert.rejects(confirmOtherSchoolCalendar(input))
  assert.deepEqual(await db.schoolCalendarEvents.toArray(), confirmed)

  // Explicit isolation: even an erroneously marked S. Bento year cannot be seeded.
  await repository.saveTeacherProfile({ displayName: 'Professor fictício', schoolName: 'Agrupamento de Escolas de S. Bento, Vizela' })
  await db.academicYears.update(year.id, { otherSchoolCalendarReview: 'pending' })
  await assert.rejects(confirmOtherSchoolCalendar({ ...input, expectedEvents: confirmed }))
  assert.deepEqual(await db.schoolCalendarEvents.toArray(), confirmed)

  // A stale preview cannot replace events written from a different window.
  await repository.saveTeacherProfile({ displayName: 'Professor fictício', schoolName: 'Escola fictícia' })
  await assert.rejects(confirmOtherSchoolCalendar(input))
  assert.deepEqual(await db.schoolCalendarEvents.toArray(), confirmed)
  assert.equal(getOtherSchoolCalendarBase({ ...year, name: '2030/2031' }).length, 0)
  const scope = {accountEmail:'fictitious@example.test', academicYearId:year.id}
  await runtime.saveOtherSchoolScheduleDraft(scope, {drafts:[]}, new File(['pdf'], 'fictitious.pdf'), 0)
  await runtime.resetMAProfessorDatabase()
  assert.equal(await runtime.readOtherSchoolScheduleDraft(scope), null)
  assert.equal(await db.schoolCalendarEvents.count(), 0)
})
