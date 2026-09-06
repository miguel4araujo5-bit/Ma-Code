import assert from 'node:assert/strict'
import {
  webcrypto
} from 'node:crypto'
import {
  readFile
} from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const adapterSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/planifications/planificationPdfImportAdapter.ts',
      import.meta.url
    ),
    'utf8'
  )

const panelSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/planifications/PlanificationPdfImportPanel.tsx',
      import.meta.url
    ),
    'utf8'
  )

const workspaceSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/planifications/PlanificationWorkspaceView.tsx',
      import.meta.url
    ),
    'utf8'
  )

if (!globalThis.crypto) {
  Object.defineProperty(
    globalThis,
    'crypto',
    {
      value: webcrypto,
      configurable: true
    }
  )
}

function dataUrl(value) {
  return `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`
}

function transpile(value, filename) {
  return ts.transpileModule(
    value,
    {
      fileName: filename,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022
      }
    }
  ).outputText
}

const sharedState = {
  setup: null,
  destinationStates: new Map(),
  destinationCalls: [],
  commits: []
}

globalThis.__planificationPdfAdapterHarness =
  sharedState

const repositoryUrl =
  dataUrl(`
    export const maProfessorRepository = {
      async getSetupSnapshot(academicYearId) {
        const state = globalThis.__planificationPdfAdapterHarness
        assertYear(state.setup, academicYearId)
        return state.setup
      }
    }

    function assertYear(setup, academicYearId) {
      if (!setup || setup.academicYear.id !== academicYearId) {
        throw new Error('unexpected academic year')
      }
    }
  `)

const importRepositoryUrl =
  dataUrl(`
    export const planificationImportRepository = {
      async getPlanificationImportDestinationState(input) {
        const state = globalThis.__planificationPdfAdapterHarness
        state.destinationCalls.push({ ...input })
        const result = state.destinationStates.get(input.moduleId)
        if (!result) {
          throw new Error('destination state missing')
        }
        return result
      },

      async commitPlanificationImportBatch(input) {
        const state = globalThis.__planificationPdfAdapterHarness
        state.commits.push(structuredClone(input))
        return {
          results: input.entries.map(entry => ({
            moduleId: entry.moduleId,
            action:
              entry.mode === 'create'
                ? 'created'
                : entry.mode === 'append'
                  ? 'appended'
                  : 'skipped'
          }))
        }
      }
    }
  `)

const runtimeSource =
  transpile(
    adapterSource,
    'planificationPdfImportAdapter.ts'
  )
    .replaceAll(
      "'../planificationImportRepository'",
      `'${importRepositoryUrl}'`
    )
    .replaceAll(
      '"../planificationImportRepository"',
      `"${importRepositoryUrl}"`
    )
    .replaceAll(
      "'../repository'",
      `'${repositoryUrl}'`
    )
    .replaceAll(
      '"../repository"',
      `"${repositoryUrl}"`
    )

const adapter =
  await import(
    dataUrl(runtimeSource)
  )

function makeFile(
  name,
  text
) {
  const bytes =
    new TextEncoder()
      .encode(text)

  return {
    name,
    async arrayBuffer() {
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset +
          bytes.byteLength
      )
    }
  }
}

function section({
  code = '0349',
  name = 'UFCD de teste',
  pages = [2, 3],
  contents = 'Bloco A\nBloco B'
} = {}) {
  return {
    sourceDocumentName:
      'planificacao.pdf',
    sourcePages:
      pages,
    code,
    name,
    durationHours: 25,
    plannedLessons: 30,
    periodLabel: '1.º período',
    contentsText: contents,
    objectivesText: 'Objetivo A',
    methodologyText: 'Metodologia A',
    resourcesText: 'Recurso A',
    evaluationText: 'Avaliação A',
    warnings: []
  }
}

function configureSetup() {
  sharedState.setup = {
    academicYear: {
      id: 'year-1'
    },
    groups: [
      {
        id: 'group-1',
        name: '11.º D',
        active: true
      },
      {
        id: 'group-2',
        name: '12.º E',
        active: true
      },
      {
        id: 'group-3',
        name: '10.º D',
        active: true
      }
    ],
    subjects: [
      {
        id: 'subject-1',
        name: 'Área de Expressões',
        shortName: 'AE',
        active: true
      }
    ],
    teachingAssignments: [
      {
        id: 'assignment-1',
        academicYearId: 'year-1',
        groupId: 'group-1',
        subjectId: 'subject-1',
        active: true
      },
      {
        id: 'assignment-2',
        academicYearId: 'year-1',
        groupId: 'group-2',
        subjectId: 'subject-1',
        active: true
      },
      {
        id: 'assignment-3',
        academicYearId: 'year-1',
        groupId: 'group-3',
        subjectId: 'subject-1',
        active: true
      }
    ],
    modules: [
      {
        id: 'module-1',
        academicYearId: 'year-1',
        teachingAssignmentId: 'assignment-1',
        code: '0349',
        name: 'UFCD de teste',
        active: true
      },
      {
        id: 'module-2',
        academicYearId: 'year-1',
        teachingAssignmentId: 'assignment-2',
        code: '0349',
        name: 'UFCD de teste',
        active: true
      },
      {
        id: 'module-3',
        academicYearId: 'year-1',
        teachingAssignmentId: 'assignment-3',
        code: '4271',
        name: 'Oficina de expressão dramática',
        active: true
      }
    ]
  }

  sharedState.destinationStates =
    new Map([
      [
        'module-1',
        {
          hasActivePlanification: false,
          stateFingerprint: 'fingerprint-1'
        }
      ],
      [
        'module-2',
        {
          hasActivePlanification: true,
          stateFingerprint: 'fingerprint-2'
        }
      ],
      [
        'module-3',
        {
          hasActivePlanification: true,
          stateFingerprint: 'fingerprint-3'
        }
      ]
    ])

  sharedState.destinationCalls = []
  sharedState.commits = []
}

test('adapter loads every concrete module destination and keeps identical textual UFCD codes isolated by moduleId', async () => {
  configureSetup()

  const destinations =
    await adapter
      .loadPlanificationPdfImportDestinations(
        'year-1'
      )

  assert.equal(
    destinations.length,
    3
  )

  const code0349 =
    destinations.filter(
      destination =>
        destination.code === '0349'
    )

  assert.equal(
    code0349.length,
    2
  )
  assert.notEqual(
    code0349[0].moduleId,
    code0349[1].moduleId
  )
  assert.notEqual(
    code0349[0].teachingAssignmentId,
    code0349[1].teachingAssignmentId
  )
  assert.deepEqual(
    new Set(
      code0349.map(
        destination =>
          destination.stateFingerprint
      )
    ),
    new Set([
      'fingerprint-1',
      'fingerprint-2'
    ])
  )
  assert.equal(
    sharedState.destinationCalls.length,
    3
  )
})

test('PDF SHA-256 depends on bytes rather than the filename', async () => {
  const first =
    await adapter
      .sha256PlanificationPdf(
        makeFile(
          'planificacao-original.pdf',
          'mesmos bytes'
        )
      )

  const renamed =
    await adapter
      .sha256PlanificationPdf(
        makeFile(
          'renomeada.pdf',
          'mesmos bytes'
        )
      )

  assert.equal(
    first,
    renamed
  )
  assert.match(
    first,
    /^[a-f0-9]{64}$/
  )
})

test('content lines become ordered thematic blocks without inventing sessions or summary text', () => {
  assert.deepEqual(
    adapter.splitPlanificationContentBlocks(
      'Tema A\nTema B\nTema A\n  Tema C  '
    ),
    [
      'Tema A',
      'Tema B',
      'Tema C'
    ]
  )
})

test('confirmed PDF sections are sent once through the official atomic batch with create append and skip', async () => {
  configureSetup()

  const destinations =
    await adapter
      .loadPlanificationPdfImportDestinations(
        'year-1'
      )

  const byModule =
    new Map(
      destinations.map(
        destination => [
          destination.moduleId,
          destination
        ]
      )
    )

  const file =
    makeFile(
      'planificacao.pdf',
      'conteudo binario do pdf'
    )

  const result =
    await adapter
      .commitPlanificationPdfImport(
        file,
        [
          {
            section:
              section({
                contents:
                  'Tema A\nTema B'
              }),
            sectionOrdinal: 1,
            destination:
              byModule.get('module-1'),
            mode: 'create',
            content:
              'Tema A\nTema B',
            objectives:
              'Objetivo A',
            activity:
              'Metodologia A',
            resources:
              'Recurso A',
            evaluation:
              'Avaliação A',
            expectedStateFingerprint:
              'fingerprint-1'
          },
          {
            section:
              section({
                contents:
                  'Tema C'
              }),
            sectionOrdinal: 2,
            destination:
              byModule.get('module-2'),
            mode: 'append',
            content: 'Tema C',
            objectives: '',
            activity: '',
            resources: '',
            evaluation: '',
            expectedStateFingerprint:
              'fingerprint-2'
          },
          {
            section:
              section({
                code: '4271',
                name:
                  'Oficina de expressão dramática',
                pages: [4],
                contents:
                  'Conteúdo ignorado'
              }),
            sectionOrdinal: 3,
            destination:
              byModule.get('module-3'),
            mode: 'skip',
            content:
              'Conteúdo ignorado',
            objectives: '',
            activity: '',
            resources: '',
            evaluation: '',
            expectedStateFingerprint:
              'fingerprint-3'
          }
        ]
      )

  assert.equal(
    sharedState.commits.length,
    1
  )

  const batch =
    sharedState.commits[0]

  assert.equal(
    batch.confirmed,
    true
  )
  assert.equal(
    batch.document.name,
    'planificacao.pdf'
  )
  assert.match(
    batch.document.sha256,
    /^[a-f0-9]{64}$/
  )
  assert.equal(
    batch.entries.length,
    3
  )

  assert.deepEqual(
    batch.entries.map(
      entry => [
        entry.teachingAssignmentId,
        entry.moduleId,
        entry.mode,
        entry.expectedStateFingerprint
      ]
    ),
    [
      [
        'assignment-1',
        'module-1',
        'create',
        'fingerprint-1'
      ],
      [
        'assignment-2',
        'module-2',
        'append',
        'fingerprint-2'
      ],
      [
        'assignment-3',
        'module-3',
        'skip',
        'fingerprint-3'
      ]
    ]
  )

  assert.deepEqual(
    batch.entries[0].items.map(
      item =>
        item.content
    ),
    [
      'Tema A',
      'Tema B'
    ]
  )
  assert.equal(
    batch.entries[0].items[0]
      .suggestedSummary,
    ''
  )
  assert.deepEqual(
    batch.entries[2].items,
    []
  )
  assert.equal(
    batch.entries[0]
      .academicYearId,
    'year-1'
  )
  assert.equal(
    byModule.get('module-1').code,
    '0349'
  )
  assert.equal(
    'durationHours' in
      batch.entries[0],
    false
  )
  assert.equal(
    'plannedLessons' in
      batch.entries[0],
    false
  )

  assert.deepEqual(
    result.results.map(
      item => item.action
    ),
    [
      'created',
      'appended',
      'skipped'
    ]
  )
})

test('Agent 3 integration has no direct persistence path and blocks PDF import while manual planification drafts are dirty', () => {
  assert.doesNotMatch(
    adapterSource,
    /maProfessorDb\.|\.planifications\.(?:add|put|bulkAdd|bulkPut)|\.planificationItems\.(?:add|put|bulkAdd|bulkPut)/
  )
  assert.match(
    adapterSource,
    /getPlanificationImportDestinationState\s*\(/
  )
  assert.match(
    adapterSource,
    /commitPlanificationImportBatch\s*\(/
  )
  assert.doesNotMatch(
    panelSource,
    /maProfessorDb\.|createPlanification\s*\(|addPlanificationItem\s*\(/
  )
  assert.match(
    panelSource,
    /suggestedSummary:\s*''/
  )
  assert.doesNotMatch(
    panelSource,
    /replace|delete\s*\+\s*recreate|plannedPeriods\s*[:=]/i
  )
  assert.match(
    workspaceSource,
    /disabled=\{\s*busy\s*\|\|\s*hasPlanificationUnsavedChanges\s*\}/
  )
  assert.match(
    workspaceSource,
    /onImported=\{\s*handleRefresh\s*\}/
  )
})
