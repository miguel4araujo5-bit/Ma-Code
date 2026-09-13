import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const panelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/ModulePlanificationImportPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

// Mantém o texto da revisão alinhado com o comportamento atómico já coberto
// pelos testes de persistência de módulos existentes.
test(
  'setup planification import reports the real action for existing modules',
  () => {
    assert.match(
      panelSource,
      /snapshot\.planifications\.some/
    )
    assert.match(
      panelSource,
      /UFCD\/módulo já existe — adicionar planificação/
    )
    assert.match(
      panelSource,
      /Já existe com planificação — preservar e ignorar/
    )
    assert.match(
      panelSource,
      /result\.attached/
    )
    assert.doesNotMatch(
      panelSource,
      /UFCD já existentes no destino serão ignoradas, incluindo a respetiva planificação/
    )
  }
)
