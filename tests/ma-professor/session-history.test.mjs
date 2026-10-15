import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'

const source = await readFile(resolve('src/components/ma-professor/history/sessionHistory.ts'), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const { SessionHistory } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

test('regista, desfaz e refaz operações confirmadas', async () => {
  const history = new SessionHistory(50)
  let value = 1
  history.record({ label: 'Sumário', undo: async () => { value = 0 }, redo: async () => { value = 1 } })
  assert.equal(history.getState().canUndo, true)
  assert.equal(await history.undo(), true)
  assert.equal(value, 0)
  assert.equal(history.getState().canRedo, true)
  assert.equal(await history.redo(), true)
  assert.equal(value, 1)
})

test('nova operação invalida refazer e respeita limite', async () => {
  const history = new SessionHistory(2)
  const op = { label: 'Teste', undo: async () => {}, redo: async () => {} }
  history.record(op)
  history.record(op)
  history.record(op)
  await history.undo()
  await history.undo()
  assert.equal(await history.undo(), false)
  history.record(op)
  assert.equal(history.getState().canRedo, false)
})

test('erro de escrita mantém a operação no histórico', async () => {
  const history = new SessionHistory()
  history.record({ label: 'Falha', undo: async () => { throw Error('Conflito') }, redo: async () => {} })
  await assert.rejects(history.undo(), /Conflito/)
  assert.equal(history.getState().canUndo, true)
  assert.equal(history.getState().canRedo, false)
  assert.equal(history.getState().busy, false)
})

test('não aceita operação concorrente e notifica observadores', async () => {
  const history = new SessionHistory()
  let release
  let changes = 0
  history.subscribe(() => { changes++ })
  history.record({
    label: 'Assíncrona',
    undo: () => new Promise(resolve => { release = resolve }),
    redo: async () => {}
  })
  const pending = history.undo()
  assert.equal(history.getState().busy, true)
  assert.equal(await history.redo(), false)
  assert.throws(() => history.record({ label: 'Outra', undo: async () => {}, redo: async () => {} }))
  release()
  assert.equal(await pending, true)
  assert.ok(changes >= 3)
})

test('falha de navegação não duplica reversões', async () => {
  const history = new SessionHistory()
  let count = 0
  history.record({
    label: 'Aula',
    undo: async () => { count++ },
    redo: async () => {},
    navigate: () => { throw Error('Vista indisponível') }
  })
  assert.equal(await history.undo(), true)
  assert.equal(count, 1)
  assert.equal(history.getState().canRedo, true)
})


test('não transporta operações entre contas ou anos letivos', () => {
  const history = new SessionHistory()
  const op = { label: 'Sumário', undo: async () => {}, redo: async () => {} }
  history.setScope('professor-a:2026')
  history.record(op)
  history.setScope('professor-a:2026')
  assert.equal(history.getState().canUndo, true)
  history.setScope('professor-b:2026')
  assert.equal(history.getState().canUndo, false)
  history.record(op)
  history.setScope('professor-b:2027')
  assert.equal(history.getState().canUndo, false)
})

test('guardar um aluno remove apenas os seus rascunhos e conserva outras notas e operações guardadas', async () => {
  const history = new SessionHistory()
  const operation = (label, draftKey) => ({ label, draftKey, undo: async () => {}, redo: async () => {} })
  history.record(operation('Aluno A', 'module:a:'))
  history.record(operation('Aluno B', 'module:b:'))
  history.record(operation('Guardar A'))
  history.discardDrafts('module:a:')
  assert.equal(history.getState().undoLabel, 'Guardar A')
  await history.undo()
  assert.equal(history.getState().undoLabel, 'Aluno B')
  await history.undo()
  assert.equal(history.getState().canUndo, false)
  history.discardDrafts('module:')
  assert.equal(history.getState().redoLabel, 'Guardar A')
})

test('uma nota escrita com várias teclas é desfeita numa só operação sem juntar alunos diferentes', async () => {
  const history = new SessionHistory()
  let a = '', b = ''
  history.record({ label: 'A', draftKey: 'a', mergeKey: 'field:1', undo: async () => { a = '' }, redo: async () => { a = '1' } }); a = '1'
  history.record({ label: 'A', draftKey: 'a', mergeKey: 'field:1', undo: async () => { a = '1' }, redo: async () => { a = '18' } }); a = '18'
  history.record({ label: 'B', draftKey: 'b', mergeKey: 'field:1', undo: async () => { b = '' }, redo: async () => { b = '12' } }); b = '12'
  await history.undo(); assert.equal(b, ''); assert.equal(a, '18')
  await history.undo(); assert.equal(a, ''); assert.equal(history.getState().canUndo, false)
  await history.redo(); assert.equal(a, '18')
})
