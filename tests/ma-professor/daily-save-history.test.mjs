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
  const rows = new Map([['aula-1', { id: 'aula-1', summary: 'Antes', giaeStatus: 'pending' }]])
  const history = {
    operation: null,
    record(op) { this.operation = op }
  }
  const table = {
    name: 'lessons',
    async toArray() { return [...rows.values()].map(row => structuredClone(row)) },
    async get(id) { return rows.get(id) },
    async put(row) { rows.set(row.id, structuredClone(row)) },
    async delete(id) { rows.delete(id) }
  }
  const db = {
    tables: [table],
    table(name) { assert.equal(name, 'lessons'); return table },
    async transaction(_mode, _tables, callback) {
      const previous = structuredClone([...rows.entries()])
      try { return await callback() }
      catch (error) { rows.clear(); for (const [id, row] of previous) rows.set(id, row); throw error }
    }
  }
  return { rows, history, captureDailySave: makeHarness(db, history).captureDailySave }
}

test('desfaz e refaz uma gravação completa, incluindo o estado GIAE', async () => {
  const { rows, history, captureDailySave } = setup()
  const saved = await captureDailySave('Aula', async () => {
    rows.set('aula-1', { id: 'aula-1', summary: 'Depois', giaeStatus: 'submitted' })
    return true
  })
  assert.equal(saved, true)
  assert.equal(rows.get('aula-1').summary, 'Depois')
  await history.operation.undo()
  assert.deepEqual(rows.get('aula-1'), { id: 'aula-1', summary: 'Antes', giaeStatus: 'pending' })
  await history.operation.redo()
  assert.equal(rows.get('aula-1').giaeStatus, 'submitted')
})

test('rejeita conflito externo sem modificar o registo', async () => {
  const { rows, history, captureDailySave } = setup()
  await captureDailySave('Aula', async () => {
    rows.set('aula-1', { id: 'aula-1', summary: 'Depois', giaeStatus: 'pending' })
    return true
  })
  rows.set('aula-1', { id: 'aula-1', summary: 'Alterado noutra aba', giaeStatus: 'pending' })
  await assert.rejects(history.operation.undo(), /alterados entretanto/)
  assert.equal(rows.get('aula-1').summary, 'Alterado noutra aba')
})

test('não cria histórico quando a gravação falha ou não altera dados', async () => {
  const { history, captureDailySave } = setup()
  assert.equal(await captureDailySave('Aula', async () => false), false)
  assert.equal(history.operation, null)
  assert.equal(await captureDailySave('Aula', async () => true), true)
  assert.equal(history.operation, null)
})

test('recupera registos criados e eliminados pela gravação', async () => {
  const { rows, history, captureDailySave } = setup()
  await captureDailySave('Aula', async () => {
    rows.delete('aula-1')
    rows.set('aula-2', { id: 'aula-2', summary: 'Nova' })
    return true
  })
  await history.operation.undo()
  assert.equal(rows.has('aula-2'), false)
  assert.equal(rows.get('aula-1').summary, 'Antes')
  await history.operation.redo()
  assert.equal(rows.has('aula-1'), false)
  assert.equal(rows.get('aula-2').summary, 'Nova')
})
