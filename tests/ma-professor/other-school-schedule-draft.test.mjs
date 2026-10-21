import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import 'fake-indexeddb/auto'
import Dexie from 'dexie'

const root = resolve(new URL('../..', import.meta.url).pathname)
mkdirSync(join(root, 'node_modules/.cache'), { recursive: true })
const output = mkdtempSync(join(root, 'node_modules/.cache/other-school-draft-'))
const bundle = await build({
  entryPoints: [join(root, 'src/components/ma-professor/setup/otherSchoolScheduleDraftStorage.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external'
})
writeFileSync(join(output, 'runtime.cjs'), bundle.outputFiles[0].text)
const { readOtherSchoolScheduleDraft: read, saveOtherSchoolScheduleDraft: save, deleteOtherSchoolScheduleDraft: remove, clearOtherSchoolScheduleDrafts: clear } = createRequire(import.meta.url)(join(output, 'runtime.cjs'))
after(async () => { await Dexie.delete('ma-professor-other-school-schedule-drafts'); rmSync(output, { recursive: true, force: true }) })

test('schedule drafts preserve original PDF and corrections and isolate account/year with revision checks', async () => {
  const alice = { accountEmail: 'alice@example.test', academicYearId: 'year-fictitious' }
  const bob = { ...alice, accountEmail: 'bob@example.test' }
  const anotherYear = { ...alice, academicYearId: 'year-another' }
  const pdf = new File(['%PDF-1.7 fictitious local document'], 'horario.pdf', { type: 'application/pdf' })
  const state = { fileName: pdf.name, drafts: [{ id: 'slot', subjectName: 'Português', groupName: '10.º A' }], expectedFingerprint: 'fictitious' }
  assert.equal(await save(alice, state, pdf, 0), 1)
  const restored = await read(alice)
  assert.deepEqual(restored.state, state)
  assert.equal(await restored.originalPdf.text(), await pdf.text())
  assert.equal(await read(bob), null)
  assert.equal(await read(anotherYear), null)
  const replacement = new File(['replacement content'], 'replacement.pdf', {type:'application/pdf'})
  await assert.rejects(save(alice, { drafts: [] }, replacement, 0))
  assert.equal(await (await read(alice)).originalPdf.text(), await pdf.text())
  await assert.rejects(remove(alice, 0))
  assert.deepEqual((await read(alice)).state, state)
  await assert.rejects(save({ ...alice, accountEmail: '' }, state, pdf, 0))
  assert.equal(await save(alice, { ...state, reviewView: 'pdf' }, null, 1), 2)
  await remove(alice, 2)
  assert.equal(await read(alice), null)
  await save(alice, state, replacement, 0)
  await save(bob, state, pdf, 0)
  await clear()
  assert.equal(await read(alice), null)
  assert.equal(await read(bob), null)
})
