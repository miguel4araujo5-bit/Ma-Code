import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
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
  workerSource,
  adminWrapperSource,
  entrySource,
  clientSource,
  panelSource,
  adminClientSource,
  adminPanelSource,
  adminPageSource,
  migrationSource
] = await Promise.all([
  read('worker/maProfessorSupportTickets.ts'),
  read('worker/maProfessorAdminSupport.ts'),
  read('worker/entry.ts'),
  read('src/components/ma-professor/support/supportTicketClient.ts'),
  read('src/components/ma-professor/support/SupportTicketPanel.tsx'),
  read('src/lib/admin/maProfessorSupportTicketAdminApi.ts'),
  read('src/components/admin/ma-professor/MAProfessorSupportTickets.tsx'),
  read('src/pages/MAProfessorAdminPage.tsx'),
  read('migrations/ma-professor/0004_support_tickets.sql')
])

function assertTranspiles(
  source,
  fileName
) {
  const output =
    ts.transpileModule(
      source,
      {
        fileName,
        compilerOptions: {
          module:
            ts.ModuleKind.ESNext,
          target:
            ts.ScriptTarget.ES2022,
          jsx:
            ts.JsxEmit.ReactJSX
        },
        reportDiagnostics: true
      }
    )

  const errors =
    (output.diagnostics || [])
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
      .join('\n')
  )
}

test(
  'support ticket worker derives account identity from the verified access session',
  () => {
    assert.match(
      workerSource,
      /ACCESS_VERIFY_PATH\s*=\s*['"]\/api\/ma-professor\/access\/verify['"]/
    )

    assert.match(
      workerSource,
      /verifyAccessSession\([\s\S]*MA_PROFESSOR_ACCESS\.idFromName/[m]
    )

    assert.match(
      workerSource,
      /createAccountId\([\s\n]*result\.license\.email/
    )

    assert.doesNotMatch(
      workerSource,
      /accountId:\s*normalizeText\(body\.|email:\s*normalizeText\(body\./
    )

    assert.match(
      workerSource,
      /AND account_id = \?/
    )
  }
)

test(
  'professor client sends only explicit support text, session proof and whitelisted technical context',
  () => {
    assert.match(
      clientSource,
      /readMAProfessorStoredAccess/
    )

    assert.match(
      clientSource,
      /token:\s*access\.token/
    )

    assert.match(
      clientSource,
      /deviceId:\s*access\.deviceId/
    )

    assert.match(
      clientSource,
      /appVersion:/
    )

    assert.match(
      clientSource,
      /screen:/
    )

    assert.match(
      clientSource,
      /browser:/
    )

    assert.match(
      clientSource,
      /os:/
    )

    assert.doesNotMatch(
      clientSource,
      /indexedDB|maProfessorDb|Dexie|repository|student|aluno|assessment|attendance|summary|planification/i
    )

    assert.doesNotMatch(
      clientSource,
      /FormData|multipart\/form-data|type=["']file["']/i
    )
  }
)

test(
  'support UI warns about personal data and keeps technical crash reporting separate',
  () => {
    assert.match(
      panelSource,
      /não recebe automaticamente alunos, turmas, avaliações, faltas, sumários, planificações, ficheiros, IndexedDB ou passwords/i
    )

    assert.match(
      panelSource,
      /Não inclua nomes de alunos, classificações, emails de terceiros, números de identificação, dados de saúde, passwords/i
    )

    assert.match(
      adminPanelSource,
      /Não existem anexos nem recolha automática de IndexedDB/
    )

    assert.match(
      adminPageSource,
      /MAProfessorSupportTickets/
    )
  }
)

test(
  'admin support routes reuse the existing MA-Code admin session and origin guard',
  () => {
    assert.match(
      adminWrapperSource,
      /maProfessorAdminAtomicApproval/
    )

    assert.match(
      adminWrapperSource,
      /buildAdminProbe\(request\)/
    )

    assert.match(
      adminWrapperSource,
      /!authResponse\.ok/
    )

    assert.match(
      adminWrapperSource,
      /request\.method !== 'GET'[\s\S]*!isAllowedBrowserRequest\(request\)/
    )

    assert.match(
      adminClientSource,
      /credentials:\s*'include'/
    )
  }
)

test(
  'support storage is isolated and has no attachments or pedagogical columns',
  () => {
    assert.match(
      migrationSource,
      /CREATE TABLE IF NOT EXISTS ma_professor_support_tickets/
    )

    assert.match(
      migrationSource,
      /CREATE TABLE IF NOT EXISTS ma_professor_support_messages/
    )

    assert.match(
      migrationSource,
      /account_id TEXT NOT NULL/
    )

    assert.doesNotMatch(
      migrationSource,
      /student_id|student_name|class_id|grade_value|attendance_id|lesson_id|planification_id|backup_data|opaque_key|export_key/i
    )

    assert.doesNotMatch(
      workerSource,
      /FormData|multipart\/form-data|file_bytes|attachment_url|attachment_id/i
    )
  }
)

test(
  'support routes are additive and do not replace access, backup or problem-report routes',
  () => {
    assert.match(
      entrySource,
      /isMAProfessorSupportTicketsApiPath/
    )

    assert.match(
      entrySource,
      /handleMAProfessorSupportTicketsApiRequest/
    )

    assert.match(
      entrySource,
      /isMAProfessorProblemReportApiPath/
    )

    assert.match(
      entrySource,
      /isMAProfessorAccessApiPath/
    )

    assert.match(
      entrySource,
      /isMAProfessorCloudBackupApiPath/
    )

    assert.doesNotMatch(
      workerSource,
      /OPAQUE|exportKey|cloud-backup|wrapped_master_key|recovery_kdf/i
    )
  }
)

test(
  'new support sources transpile without changing existing persistence code',
  () => {
    assertTranspiles(
      workerSource,
      'maProfessorSupportTickets.ts'
    )
    assertTranspiles(
      adminWrapperSource,
      'maProfessorAdminSupport.ts'
    )
    assertTranspiles(
      panelSource,
      'SupportTicketPanel.tsx'
    )
    assertTranspiles(
      adminPanelSource,
      'MAProfessorSupportTickets.tsx'
    )
  }
)
