import assert from 'node:assert/strict'
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import * as ts from 'typescript'

const read = path =>
  readFile(
    new URL(
      `../../${path}`,
      import.meta.url
    ),
    'utf8'
  )

const [
  clientSource,
  dialogSource,
  boundarySource,
  preloadSource,
  panelSource,
  settingsSource,
  productSource,
  mainSource,
  workerSource,
  workerEntrySource,
  migrationSource
] = await Promise.all([
  read('src/components/ma-professor/support/problemReportClient.ts'),
  read('src/components/ma-professor/support/ProblemReportDialog.tsx'),
  read('src/components/ma-professor/support/MAProfessorErrorBoundary.tsx'),
  read('src/components/ma-professor/support/preloadRecovery.ts'),
  read('src/components/ma-professor/support/ProblemReportPanel.tsx'),
  read('src/components/ma-professor/settings/SettingsWorkspaceView.tsx'),
  read('src/components/ma-professor/product/MAProfessorProduct.tsx'),
  read('src/main.tsx'),
  read('worker/maProfessorProblemReport.ts'),
  read('worker/entry.ts'),
  read('migrations/ma-professor/0003_problem_report_rate_limit.sql')
])

test(
  'problem reporting stays passive and outside pedagogical storage',
  () => {
    assert.doesNotMatch(
      clientSource,
      /indexedDB|maProfessorDb|Dexie|localStorage|location\.search|location\.hash/i
    )

    assert.match(
      clientSource,
      /window\.location\.pathname/
    )

    assert.match(
      clientSource,
      /method:\s*'POST'/
    )

    assert.match(
      dialogSource,
      /Nenhum dado escolar, ficheiro, conteúdo do IndexedDB ou password é incluído automaticamente/
    )

    assert.match(
      dialogSource,
      /Não inclua nomes de alunos, emails, números de identificação ou outros dados pessoais/
    )

    assert.doesNotMatch(
      boundarySource,
      /fetch\s*\(/
    )

    assert.match(
      boundarySource,
      /componentDidCatch/
    )

    assert.match(
      boundarySource,
      /Reportar problema/
    )

    assert.match(
      panelSource,
      /Nada é enviado automaticamente/
    )
  }
)

test(
  'deploy recovery reloads at most once before letting the fatal error surface',
  () => {
    assert.match(
      preloadSource,
      /vite:preloadError/
    )

    assert.match(
      preloadSource,
      /sessionStorage/
    )

    assert.match(
      preloadSource,
      /event\.preventDefault\(\)/
    )

    assert.match(
      preloadSource,
      /window\.location\.reload\(\)/
    )

    assert.match(
      preloadSource,
      /O erro segue o fluxo normal e cai no ErrorBoundary[\s\S]*return false/
    )
  }
)

test(
  'MA-Professor alone gets the root error boundary and settings keep their existing order',
  () => {
    assert.match(
      mainSource,
      /path ===[\s\n]*'\/produtos\/ma-professor'/
    )

    assert.match(
      mainSource,
      /isMAProfessorProductPath \? \([\s\S]*<MAProfessorErrorBoundary>[\s\S]*<RootContent \/>[\s\S]*<\/MAProfessorErrorBoundary>[\s\S]*\) : \([\s\S]*<RootContent \/>/
    )

    assert.match(
      settingsSource,
      /id:[\s\n]*'search'[\s\S]*id:[\s\n]*'configuration'[\s\S]*id:[\s\n]*'license'[\s\S]*id:[\s\n]*'support'/
    )

    assert.match(
      settingsSource,
      /Diagnóstico e suporte/
    )

    assert.match(
      productSource,
      /data-ma-professor-screen=/
    )

    assert.match(
      productSource,
      /menuNavigationRequest[\s\S]*\.target/
    )
  }
)

test(
  'server report endpoint is isolated from the access Durable Object and persists only rate-limit metadata',
  () => {
    assert.doesNotMatch(
      workerSource,
      /MA_PROFESSOR_ACCESS|DurableObject|IndexedDB|maProfessorDb/
    )

    assert.match(
      workerSource,
      /CF-Connecting-IP/
    )

    assert.match(
      workerSource,
      /SHA-256/
    )

    assert.match(
      workerSource,
      /MAX_BODY_BYTES/
    )

    assert.match(
      workerSource,
      /origin_hash/
    )

    assert.match(
      workerSource,
      /GLOBAL_MAX_REPORTS/
    )

    assert.match(
      workerSource,
      /RESEND_EMAIL_API_URL/
    )

    assert.match(
      workerEntrySource,
      /isMAProfessorProblemReportApiPath/
    )

    assert.match(
      workerEntrySource,
      /handleMAProfessorProblemReportApiRequest/
    )

    assert.match(
      migrationSource,
      /CREATE TABLE IF NOT EXISTS ma_professor_problem_report_rate_limits/
    )

    assert.doesNotMatch(
      migrationSource,
      /student|aluno|email\s+TEXT|message\s+TEXT|error\s+TEXT|screen\s+TEXT|browser\s+TEXT|ip\s+TEXT/i
    )
  }
)

async function loadWorker() {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'ma-professor-report-'
      )
    )

  const transpiled =
    ts.transpileModule(
      workerSource,
      {
        fileName:
          'maProfessorProblemReport.ts',

        compilerOptions: {
          module:
            ts.ModuleKind.ESNext,

          target:
            ts.ScriptTarget.ES2022
        },

        reportDiagnostics:
          true
      }
    )

  const errors =
    (
      transpiled.diagnostics ||
      []
    )
      .filter(
        diagnostic =>
          diagnostic.category ===
            ts.DiagnosticCategory.Error
      )

  assert.equal(
    errors.length,
    0,
    errors
      .map(
        diagnostic =>
          ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            '\n'
          )
      )
      .join(
        '\n'
      )
  )

  const target =
    join(
      directory,
      'maProfessorProblemReport.mjs'
    )

  await writeFile(
    target,
    transpiled.outputText,
    'utf8'
  )

  const module =
    await import(
      pathToFileURL(
        target
      ).href
    )

  return {
    module,
    cleanup:
      () =>
        rm(
          directory,
          {
            recursive:
              true,

            force:
              true
          }
        )
  }
}

function createDb(
  insertChanges = 1
) {
  const statements = []

  return {
    statements,

    binding: {
      prepare(sql) {
        let values = []

        return {
          bind(...bound) {
            values =
              bound

            return this
          },

          async run() {
            statements.push({
              sql,
              values
            })

            if (
              /INSERT INTO ma_professor_problem_report_rate_limits/
                .test(
                  sql
                )
            ) {
              return {
                success:
                  true,

                meta: {
                  changes:
                    insertChanges
                }
              }
            }

            return {
              success:
                true,

              meta: {
                changes:
                  0
              }
            }
          }
        }
      }
    }
  }
}

function makeReportRequest(
  body,
  extraHeaders = {}
) {
  return new Request(
    'https://ma-code.pt/api/ma-professor/problem-report',
    {
      method:
        'POST',

      headers: {
        Origin:
          'https://ma-code.pt',

        'CF-Connecting-IP':
          '203.0.113.44',

        'Content-Type':
          'application/json',

        ...extraHeaders
      },

      body:
        JSON.stringify(
          body
        )
    }
  )
}

test(
  'accepted report emails only the reviewed fields and strips URL secrets',
  {
    concurrency:
      false
  },
  async () => {
    const {
      module,
      cleanup
    } =
      await loadWorker()

    const database =
      createDb()

    const originalFetch =
      globalThis.fetch

    let outboundBody = ''

    globalThis.fetch =
      async (
        _input,
        init
      ) => {
        outboundBody =
          String(
            init?.body ||
              ''
          )

        return new Response(
          JSON.stringify({
            id:
              'mail-1'
          }),
          {
            status:
              200,

            headers: {
              'Content-Type':
                'application/json'
            }
          }
        )
      }

    try {
      const response =
        await module
          .handleMAProfessorProblemReportApiRequest(
            makeReportRequest({
              error:
                'Erro inesperado: TypeError',

              version:
                'index-build123.js',

              screen:
                '/produtos/ma-professor?token=VERY_SECRET#private',

              browser:
                'Safari',

              occurredAt:
                '2026-09-23T08:20:00.000Z',

              message:
                'Ao abrir as definições.',

              indexedDB:
                'SHOULD_NEVER_LEAVE',

              studentName:
                'ALUNO_SECRETO'
            }),

            {
              MA_PROFESSOR_DB:
                database.binding,

              RESEND_API_KEY_MA_PROFESSOR:
                'test-key'
            }
          )

      assert.equal(
        response.status,
        200
      )

      assert.equal(
        (
          await response.json()
        ).success,
        true
      )

      assert.match(
        outboundBody,
        /Erro inesperado: TypeError/
      )

      assert.match(
        outboundBody,
        /index-build123\.js/
      )

      assert.match(
        outboundBody,
        /\/produtos\/ma-professor/
      )

      assert.match(
        outboundBody,
        /Ao abrir as definições\./
      )

      assert.doesNotMatch(
        outboundBody,
        /VERY_SECRET|SHOULD_NEVER_LEAVE|ALUNO_SECRETO|203\.0\.113\.44/
      )

      assert.ok(
        database.statements.some(
          entry =>
            /INSERT INTO ma_professor_problem_report_rate_limits/
              .test(
                entry.sql
              )
        )
      )
    } finally {
      globalThis.fetch =
        originalFetch

      await cleanup()
    }
  }
)

test(
  'rate-limited and cross-origin reports never send an email',
  {
    concurrency:
      false
  },
  async () => {
    const {
      module,
      cleanup
    } =
      await loadWorker()

    const originalFetch =
      globalThis.fetch

    let sends = 0

    globalThis.fetch =
      async () => {
        sends += 1

        return new Response(
          '{}',
          {
            status:
              200
          }
        )
      }

    const body = {
      error:
        'Erro inesperado no MA-Professor.',

      version:
        'index-build123.js',

      screen:
        '/produtos/ma-professor',

      browser:
        'Safari',

      occurredAt:
        '2026-09-23T08:20:00.000Z'
    }

    try {
      const limited =
        await module
          .handleMAProfessorProblemReportApiRequest(
            makeReportRequest(
              body
            ),

            {
              MA_PROFESSOR_DB:
                createDb(
                  0
                ).binding,

              RESEND_API_KEY_MA_PROFESSOR:
                'test-key'
            }
          )

      assert.equal(
        limited.status,
        429
      )

      const crossOrigin =
        await module
          .handleMAProfessorProblemReportApiRequest(
            makeReportRequest(
              body,
              {
                Origin:
                  'https://example.com'
              }
            ),

            {
              MA_PROFESSOR_DB:
                createDb().binding,

              RESEND_API_KEY_MA_PROFESSOR:
                'test-key'
            }
          )

      assert.equal(
        crossOrigin.status,
        403
      )

      assert.equal(
        sends,
        0
      )
    } finally {
      globalThis.fetch =
        originalFetch

      await cleanup()
    }
  }
)
