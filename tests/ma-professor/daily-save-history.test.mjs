import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile('src/components/ma-professor/history/dailySaveHistory.ts', 'utf8')
const transpiled = ts.transpileModule(source.replace(/^import .*$/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText.replace(/export /g, '')
const makeHarness = new Function('maProfessorDb', 'maProfessorHistory',
  transpiled + '\nreturn { captureDailySave };')

function setup() {
  const rows = new Map([['aula-1', { id: 'aula-1', moduleId: 'mod-1', summary: 'Antes', giaeStatus: 'pending' }]])
  const history = { operation: null, record(op) { this.operation = op } }
  const tableNames = ['lessons', 'planifications', 'lessonAttendance', 'lessonAssessments',
    'assessmentResults', 'learningRecoveries', 'moduleFinalGrades', 'planificationItems']
  const tables = new Map(tableNames.map(name => [name, new Map()]))
  tables.set('lessons', rows)
  const db = {}
  for (const name of tableNames) {
    const data = tables.get(name)
    db[name] = {
      name,
      async get(id) { return data.get(id) },
      async put(row) { data.set(row.id, structuredClone(row)) },
      async delete(id) { data.delete(id) },
      where(field) {
        return {
          equals(value) { return { async toArray() {
            return [...data.values()].filter(row => row[field] === value).map(row => structuredClone(row))
          } } },
          anyOf(values) { return { async toArray() {
            return [...data.values()].filter(row => values.includes(row[field])).map(row => structuredClone(row))
          } } }
        }
      }
    }
  }
  db.tables = tableNames.map(name => db[name])
  db.table = name => db[name]
  db.transaction = async (_mode, _tables, callback) => {
    const previous = new Map([...tables].map(([name, data]) => [name, structuredClone([...data])]))
    try { return await callback() }
    catch (error) {
      for (const [name, entries] of previous) {
        tables.get(name).clear()
        for (const [id, row] of entries) tables.get(name).set(id, row)
      }
      throw error
    }
  }
  return { rows, tables, history, captureDailySave: makeHarness(db, history).captureDailySave }
}

test('desfaz e refaz uma gravação completa, incluindo o estado GIAE', async () => {
  const { rows, history, captureDailySave } = setup()
  const saved = await captureDailySave('Aula', async () => {
    rows.set('aula-1', { id: 'aula-1', moduleId: 'mod-1', summary: 'Depois', giaeStatus: 'submitted' })
    return true
  }, undefined, 'aula-1')
  assert.equal(saved, true)
  assert.equal(rows.get('aula-1').summary, 'Depois')
  await history.operation.undo()
  assert.deepEqual(rows.get('aula-1'), { id: 'aula-1', moduleId: 'mod-1', summary: 'Antes', giaeStatus: 'pending' })
  await history.operation.redo()
  assert.equal(rows.get('aula-1').giaeStatus, 'submitted')
})

test('rejeita conflito externo sem modificar o registo', async () => {
  const { rows, history, captureDailySave } = setup()
  await captureDailySave('Aula', async () => {
    rows.set('aula-1', { id: 'aula-1', summary: 'Depois', giaeStatus: 'pending' })
    return true
  }, undefined, 'aula-1')
  rows.set('aula-1', { id: 'aula-1', summary: 'Alterado noutra aba', giaeStatus: 'pending' })
  await assert.rejects(history.operation.undo(), /alterados entretanto/)
  assert.equal(rows.get('aula-1').summary, 'Alterado noutra aba')
})

test('não cria histórico quando a gravação falha ou não altera dados', async () => {
  const { history, captureDailySave } = setup()
  assert.equal(await captureDailySave('Aula', async () => false, undefined, 'aula-1'), false)
  assert.equal(history.operation, null)
  assert.equal(await captureDailySave('Aula', async () => true, undefined, 'aula-1'), true)
  assert.equal(history.operation, null)
})

test('recupera alterações a registos existentes', async () => {
  const { rows, history, captureDailySave } = setup()
  await captureDailySave('Aula', async () => {
    rows.set('aula-1', { id: 'aula-1', moduleId: 'mod-1', summary: 'Nova' })
    return true
  }, undefined, 'aula-1')
  await history.operation.undo()
  assert.equal(rows.get('aula-1').summary, 'Antes')
  await history.operation.redo()
  assert.equal(rows.get('aula-1').summary, 'Nova')
})
