import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/access/ProductIntroPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'MA-Professor presentation covers regular subjects as well as UFCD and modules',
  () => {
    assert.match(
      source,
      /disciplinas regulares, UFCD ou módulos/
    )
    assert.match(
      source,
      /avaliações de período, de disciplina, de UFCD ou módulo e finais/
    )
    assert.match(
      source,
      /aula, turma, disciplina e componente curricular/
    )
  }
)
