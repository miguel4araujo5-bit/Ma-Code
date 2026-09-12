import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const adapterSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationPdfImportAdapter.ts',
    import.meta.url
  ),
  'utf8'
)

const panelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/PlanificationPdfImportPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

test('normal planification panel reuses the established UFCD/module classifier', () => {
  assert.match(
    adapterSource,
    /export function moduleKindLabel\([\s\S]*?\? 'UFCD'[\s\S]*?: 'Módulo'/
  )

  assert.match(
    panelSource,
    /moduleKindLabel\(\s*row\.section\.code\s*\)/
  )

  assert.match(
    panelSource,
    /\{kind\} \{row\.section\.code \|\| 'sem código'\}/
  )

  assert.match(
    panelSource,
    /kind === 'UFCD'[\s\S]*?'Ignorar esta UFCD'[\s\S]*?kind === 'Módulo'[\s\S]*?'Ignorar este módulo'/
  )
})

test('normal planification panel no longer describes every section as a UFCD', () => {
  for (const staleText of [
    'Selecione pelo menos uma UFCD para importar.',
    'PDF ou Word → UFCD → revisão → importação',
    'disciplina, UFCD e os conteúdos',
    'todas as UFCD do documento',
    'Todas as UFCD deste documento',
    'Escolher turma, disciplina e UFCD…'
  ]) {
    assert.equal(
      panelSource.includes(staleText),
      false,
      `texto antigo ainda presente: ${staleText}`
    )
  }

  assert.match(
    panelSource,
    /Selecione pelo menos uma UFCD ou módulo para importar\./
  )
  assert.match(
    panelSource,
    /PDF ou Word → UFCD\/módulo → revisão → importação/
  )
  assert.match(
    panelSource,
    /Escolher turma, disciplina e UFCD\/módulo…/
  )
  assert.match(
    adapterSource,
    /Selecione pelo menos uma UFCD ou módulo para importar\./
  )
})
