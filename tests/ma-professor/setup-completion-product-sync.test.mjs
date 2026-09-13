import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/product/ProductMenuWorkspace.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'product menu observes persisted setup completion and refreshes outer state',
  () => {
    assert.match(
      source,
      /import\s*\{\s*liveQuery\s*\}\s*from\s*'dexie'/,
      'A sincronização deve reutilizar Dexie liveQuery, já usado no MA-Professor.'
    )

    assert.match(
      source,
      /if\s*\(\s*!academicYear\s*\|\|\s*setupCompleted\s*\)\s*\{\s*return\s*\}/,
      'A observação só deve existir enquanto há um ano ativo ainda não concluído no estado exterior.'
    )

    assert.match(
      source,
      /liveQuery\(\s*\(\)\s*=>\s*maProfessorRepository\.getAcademicYear\(\s*academicYear\.id\s*\)\s*\)/,
      'A conclusão deve ser observada diretamente no ano letivo persistido.'
    )

    assert.match(
      source,
      /!persistedYear\?\.setupCompletedAt/,
      'O menu só deve reagir depois de setupCompletedAt existir na base de dados.'
    )

    assert.match(
      source,
      /setSection\(\s*'home'\s*\)/,
      'Depois da conclusão persistida, o utilizador deve regressar ao menu normal.'
    )

    assert.match(
      source,
      /onDataChanged\(\)/,
      'Depois da conclusão persistida, o estado exterior do produto deve ser atualizado.'
    )

    assert.match(
      source,
      /subscription\.unsubscribe\(\)/,
      'A subscrição reativa deve ser desmontada com o componente/effect.'
    )
  }
)

test(
  'completed setup can be reopened for corrections without resetting completion',
  () => {
    assert.match(
      source,
      /id: 'configuration',[\s\S]*title: 'Corrigir configuração inicial'/,
      'O menu deve disponibilizar uma entrada explícita para corrigir a configuração já concluída.'
    )

    assert.match(
      source,
      /section !== 'configuration'[\s\S]*getSetupSnapshot\(academicYear\.id\)/,
      'A edição deve carregar o snapshot persistido do mesmo ano letivo.'
    )

    assert.match(
      source,
      /section === 'configuration'[\s\S]*<SetupWizard[\s\S]*snapshot=\{configurationSnapshot\}[\s\S]*onSnapshotChange=\{setConfigurationSnapshot\}/,
      'A correção deve reutilizar o mesmo assistente sobre os dados existentes.'
    )

    assert.match(
      source,
      /A configuração continua concluída enquanto corrige os dados\./,
      'A interface deve explicar que corrigir dados não reinicia o onboarding.'
    )

    assert.doesNotMatch(
      source,
      /setupCompletedAt\s*:\s*null/,
      'Reabrir a configuração nunca deve apagar a marca de conclusão.'
    )
  }
)