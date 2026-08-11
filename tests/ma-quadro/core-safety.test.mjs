import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
)

const repoRoot = path.resolve(
  __dirname,
  '../..'
)

async function transpileSource(
  relativePath
) {
  const absolutePath = path.join(
    repoRoot,
    relativePath
  )

  const source = await readFile(
    absolutePath,
    'utf8'
  )

  return ts.transpileModule(
    source,
    {
      compilerOptions: {
        target:
          ts.ScriptTarget.ES2020,
        module:
          ts.ModuleKind.ESNext,
        isolatedModules: true
      },
      fileName:
        absolutePath
    }
  ).outputText
}

function asDataModule(
  source
) {
  return `data:text/javascript;base64,${Buffer.from(
    source,
    'utf8'
  ).toString('base64')}`
}

const projectSource =
  await transpileSource(
    'src/lib/maQuadro/project.ts'
  )

const projectModuleUrl =
  asDataModule(
    projectSource
  )

const safetySource = (
  await transpileSource(
    'src/lib/maQuadro/projectSafety.ts'
  )
).replace(
  /from\s+['"]\.\/project['"]/g,
  `from '${projectModuleUrl}'`
)

const project = await import(
  projectModuleUrl
)

const safety = await import(
  asDataModule(
    safetySource
  )
)

function createValidProject() {
  return project.createBlankProject(
    1080,
    1080,
    'Projeto de teste',
    'social'
  )
}

test(
  'um projeto novo passa a validação de segurança',
  () => {
    const value =
      createValidProject()

    assert.equal(
      safety.validateMAQuadroProject(
        value
      ),
      true
    )
  }
)

test(
  'a normalização aceita e preserva um projeto válido',
  () => {
    const value =
      createValidProject()

    const normalized =
      safety.normalizeImportedMAQuadroProject(
        value
      )

    assert.ok(
      normalized
    )

    assert.equal(
      normalized.id,
      value.id
    )

    assert.equal(
      normalized.activePageId,
      value.activePageId
    )
  }
)

test(
  'projetos com dimensões perigosas são rejeitados',
  () => {
    const value =
      createValidProject()

    value.pages[0].width =
      8001

    assert.equal(
      safety.validateMAQuadroProject(
        value
      ),
      false
    )
  }
)

test(
  'projetos com páginas repetidas são rejeitados',
  () => {
    const value =
      createValidProject()

    value.pages.push({
      ...structuredClone(
        value.pages[0]
      ),
      name:
        'Página repetida'
    })

    assert.equal(
      safety.validateMAQuadroProject(
        value
      ),
      false
    )
  }
)

test(
  'objetos com maId repetido na mesma página são rejeitados',
  () => {
    const value =
      createValidProject()

    value.pages[0].canvasJson = {
      version: '7.4.0',
      objects: [
        {
          type: 'rect',
          maId: 'obj-1'
        },
        {
          type: 'textbox',
          maId: 'obj-1'
        }
      ]
    }

    assert.equal(
      safety.validateMAQuadroProject(
        value
      ),
      false
    )
  }
)

test(
  'a página ativa tem de existir no projeto',
  () => {
    const value =
      createValidProject()

    value.activePageId =
      'page-inexistente'

    assert.equal(
      safety.validateMAQuadroProject(
        value
      ),
      false
    )
  }
)

test(
  'designs legacy válidos são migrados antes da validação',
  () => {
    const normalized =
      safety.normalizeImportedMAQuadroProject({
        id: 'legacy-1',
        name:
          'Design antigo',
        width: 1200,
        height: 800,
        backgroundColor:
          '#FFFFFF',
        transparentBackground:
          false,
        canvasJson: {
          version: '5.0.0',
          objects: []
        },
        createdAt:
          '2026-08-01T10:00:00.000Z',
        updatedAt:
          '2026-08-01T10:00:00.000Z'
      })

    assert.ok(
      normalized
    )

    assert.equal(
      normalized.schemaVersion,
      2
    )

    assert.equal(
      normalized.pages.length,
      1
    )

    assert.equal(
      normalized.pages[0].width,
      1200
    )

    assert.equal(
      normalized.pages[0].height,
      800
    )
  }
)

test(
  'nomes de ficheiro são normalizados de forma previsível',
  () => {
    assert.equal(
      project.safeMAQuadroFileName(
        'Cartaz São João 2026!'
      ),
      'cartaz-sao-joao-2026'
    )

    assert.equal(
      project.safeMAQuadroFileName(
        '***'
      ),
      'design-ma-quadro'
    )
  }
)
