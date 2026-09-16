import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = 4175
const BASE_URL = `http://${HOST}:${PORT}`
const EMAIL = 'cloud.restore.e2e@example.test'
const TOKEN = 'cloud-restore-e2e-token'
const DEVICE_ID = 'iphone-cloud-restore-e2e'
const FIXED_NOW = '2026-09-16T10:30:00+01:00'
const REMOTE_UPDATED_AT = '2026-09-16T09:00:00.000Z'

const root = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

const license = {
  email: EMAIL,
  plan: 'beta_30_days',
  status: 'active',
  validFrom: '2026-01-01T00:00:00.000Z',
  validUntil: '2099-12-31T23:59:59.999Z',
  daysRemaining: 9999,
  renewalRequestedAt: null
}

function startVite() {
  const child = spawn(
    process.execPath,
    [
      join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
      '--host', HOST,
      '--port', String(PORT),
      '--strictPort'
    ],
    {
      cwd: root,
      env: { ...process.env, BROWSER: 'none' },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )

  let output = ''
  const capture = chunk => {
    output += chunk.toString()
    if (output.length > 20_000) output = output.slice(-20_000)
  }

  child.stdout.on('data', capture)
  child.stderr.on('data', capture)

  return {
    child,
    logs: () => output
  }
}

async function waitForVite(server) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.child.exitCode !== null) {
      throw new Error(
        `Vite terminou antes de iniciar.\n${server.logs()}`
      )
    }

    try {
      const response = await fetch(`${BASE_URL}/`)
      if (response.ok) return
    } catch {
      // Ainda a iniciar.
    }

    await delay(250)
  }

  throw new Error(
    `Vite não ficou disponível.\n${server.logs()}`
  )
}

async function stopVite(child) {
  if (child.exitCode !== null) return

  child.kill('SIGTERM')

  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    delay(1500)
  ])

  if (child.exitCode === null) {
    child.kill('SIGKILL')
  }
}

function fulfilJson(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body)
  })
}

const server = startVite()
let browser
let page
const pageErrors = []
const apiRequests = []

let remoteEncrypted = null
let serverRevision = 0
let recordRevision = 0
let allowPush = true

const backupKey = Buffer.alloc(32, 37).toString('base64')

try {
  await waitForVite(server)

  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
    viewport: {
      width: 390,
      height: 844
    },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3
  })

  page = await context.newPage()
  await page.clock.setFixedTime(
    new Date(FIXED_NOW)
  )
  page.setDefaultTimeout(25_000)
  page.setDefaultNavigationTimeout(30_000)
  page.on(
    'pageerror',
    error => pageErrors.push(error.message)
  )

  await page.route(
    '**/api/ma-professor/**',
    async route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      apiRequests.push({
        method: request.method(),
        path
      })

      if (
        path ===
        '/api/ma-professor/cloud-backup/status'
      ) {
        return fulfilJson(route, {
          success: true,
          serverRevision,
          cryptoVersion: 1,
          updatedAt: REMOTE_UPDATED_AT,
          backup: {
            found: Boolean(remoteEncrypted),
            recordRevision:
              remoteEncrypted
                ? recordRevision
                : null,
            updatedAt:
              remoteEncrypted
                ? REMOTE_UPDATED_AT
                : null,
            ciphertextBytes:
              remoteEncrypted
                ? Buffer.from(
                    remoteEncrypted.ciphertext,
                    'base64'
                  ).byteLength
                : null
          }
        })
      }

      if (
        path ===
        '/api/ma-professor/cloud-backup/key'
      ) {
        return fulfilJson(route, {
          success: true,
          cryptoVersion: 1,
          keyAlgorithm: 'AES-256-GCM',
          key: backupKey
        })
      }

      if (
        path ===
        '/api/ma-professor/cloud-backup/push'
      ) {
        if (!allowPush) {
          return fulfilJson(
            route,
            {
              success: false,
              message:
                'Teste bloqueou uma escrita automática inesperada depois de preparar a cópia remota.'
            },
            409
          )
        }

        const body =
          request.postDataJSON()

        assert.equal(
          body.expectedServerRevision,
          serverRevision
        )
        assert.equal(
          body.recordId,
          'database-v1'
        )
        assert.ok(body.encrypted)

        remoteEncrypted =
          structuredClone(
            body.encrypted
          )
        serverRevision += 1
        recordRevision += 1

        return fulfilJson(route, {
          success: true,
          serverRevision,
          recordRevision,
          updatedAt: REMOTE_UPDATED_AT
        })
      }

      if (
        path ===
        '/api/ma-professor/cloud-backup/get'
      ) {
        if (!remoteEncrypted) {
          return fulfilJson(route, {
            success: true,
            found: false,
            recordId: 'database-v1',
            serverRevision
          })
        }

        return fulfilJson(route, {
          success: true,
          found: true,
          recordId: 'database-v1',
          serverRevision,
          recordRevision,
          updatedAt: REMOTE_UPDATED_AT,
          encrypted: remoteEncrypted
        })
      }

      if (
        path ===
        '/api/ma-professor/access/account/verify'
      ) {
        return fulfilJson(route, {
          success: true,
          email: EMAIL,
          license
        })
      }

      if (
        path ===
        '/api/ma-professor/sync/status'
      ) {
        return fulfilJson(route, {
          success: true,
          databaseReady: true,
          profileExists: false,
          serverRevision: 0,
          cryptoVersion: null,
          updatedAt: null
        })
      }

      if (
        path ===
          '/api/ma-professor/access/operational-state' ||
        path ===
          '/api/ma-professor/access/logout'
      ) {
        return fulfilJson(route, {
          success: true
        })
      }

      return fulfilJson(route, {
        success: true,
        request: {
          email: EMAIL,
          status: 'approved',
          requestedAt:
            '2026-09-01T00:00:00.000Z',
          approvedAt:
            '2026-09-01T00:00:00.000Z',
          rejectedAt: null,
          activatedAt:
            '2026-09-01T00:00:00.000Z'
        },
        canActivate: true,
        message: 'Resposta E2E local.'
      })
    }
  )

  await page.goto(
    `${BASE_URL}/`,
    {
      waitUntil: 'domcontentloaded'
    }
  )

  const prepared =
    await page.evaluate(
      async ({
        email,
        token,
        deviceId,
        license
      }) => {
        const {
          maProfessorDb,
          openMAProfessorDatabase
        } = await import(
          '/src/components/ma-professor/db.ts'
        )

        const {
          createMAProfessorBackup,
          resetMAProfessorDatabase
        } = await import(
          '/src/components/ma-professor/settings/backupRepository.ts'
        )

        const {
          uploadAndVerifyMAProfessorCloudBackup
        } = await import(
          '/src/components/ma-professor/sync/cloudBackupService.ts'
        )

        const {
          saveMAProfessorAccessSession
        } = await import(
          '/src/components/ma-professor/access/accessStorage.ts'
        )

        await openMAProfessorDatabase()
        await resetMAProfessorDatabase()

        const timestamp =
          '2026-09-01T08:00:00.000Z'

        const academicYear = {
          id: 'cloud-restore-year',
          name: '2026/2027',
          startDate: '2026-09-01',
          endDate: '2027-08-31',
          active: true,
          setupCompletedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp
        }

        const group = {
          id: 'cloud-restore-group',
          academicYearId:
            academicYear.id,
          name: '11.º E',
          courseName: 'TAP',
          gradeLevel: '11.º',
          educationType: 'professional',
          active: true,
          createdAt: timestamp,
          updatedAt: timestamp
        }

        const subject = {
          id: 'cloud-restore-subject',
          academicYearId:
            academicYear.id,
          name: 'Área de Expressões',
          shortName: 'AE',
          code: 'AE',
          active: true,
          createdAt: timestamp,
          updatedAt: timestamp
        }

        const assignment = {
          id: 'cloud-restore-assignment',
          academicYearId:
            academicYear.id,
          groupId: group.id,
          subjectId: subject.id,
          displayName: 'AE · 11.º E',
          active: true,
          createdAt: timestamp,
          updatedAt: timestamp
        }

        const module = {
          id: 'cloud-restore-module',
          academicYearId:
            academicYear.id,
          teachingAssignmentId:
            assignment.id,
          code: '10385',
          name: 'Expressão Dramática',
          plannedPeriods: 50,
          order: 1,
          plannedStartDate:
            '2026-09-01',
          plannedEndDate:
            '2027-02-28',
          active: true,
          createdAt: timestamp,
          updatedAt: timestamp
        }

        const scheduleSlot = {
          id: 'cloud-restore-slot',
          academicYearId:
            academicYear.id,
          teachingAssignmentId:
            assignment.id,
          weekday: 3,
          startTime: '09:00',
          endTime: '09:50',
          periodCount: 1,
          validFrom:
            academicYear.startDate,
          validUntil:
            academicYear.endDate,
          active: true,
          createdAt: timestamp,
          updatedAt: timestamp
        }

        await maProfessorDb.transaction(
          'rw',
          maProfessorDb.tables,
          async () => {
            await maProfessorDb.academicYears
              .put(academicYear)
            await maProfessorDb.groups
              .put(group)
            await maProfessorDb.subjects
              .put(subject)
            await maProfessorDb.teachingAssignments
              .put(assignment)
            await maProfessorDb.modules
              .put(module)
            await maProfessorDb.weeklyScheduleSlots
              .put(scheduleSlot)
          }
        )

        const session = {
          token,
          email,
          deviceId,
          checkedAt:
            new Date().toISOString(),
          license
        }

        saveMAProfessorAccessSession(
          session
        )

        const backup =
          await createMAProfessorBackup()

        const uploaded =
          await uploadAndVerifyMAProfessorCloudBackup(
            session,
            backup
          )

        await resetMAProfessorDatabase()

        return {
          uploaded,
          localYearsAfterReset:
            await maProfessorDb.academicYears
              .count()
        }
      },
      {
        email: EMAIL,
        token: TOKEN,
        deviceId: DEVICE_ID,
        license
      }
    )

  assert.equal(
    prepared.localYearsAfterReset,
    0,
    'O teste deve começar o restauro com o iPhone sem o ano letivo local.'
  )
  assert.equal(
    prepared.uploaded.recordRevision,
    1
  )
  assert.ok(remoteEncrypted)

  allowPush = false

  await page.goto(
    `${BASE_URL}/produtos/ma-professor`,
    {
      waitUntil: 'domcontentloaded'
    }
  )

  const securityButton =
    page
      .locator('header')
      .getByRole(
        'button',
        {
          name: 'Segurança',
          exact: true
        }
      )

  await securityButton.waitFor({
    state: 'visible'
  })
  await securityButton.click()

  const prepareRestore =
    page.getByRole(
      'button',
      {
        name:
          'Decifrar e preparar restauro',
        exact: true
      }
    )

  await prepareRestore.waitFor({
    state: 'visible'
  })
  await prepareRestore.click()

  await page
    .getByText(
      'Cópia pronta a restaurar',
      {
        exact: true
      }
    )
    .waitFor({
      state: 'visible'
    })

  await page
    .getByPlaceholder(
      'Escreva RESTAURAR'
    )
    .fill('RESTAURAR')

  await page
    .getByRole(
      'button',
      {
        name: 'Restaurar cópia',
        exact: true
      }
    )
    .click()

  await page
    .getByText(
      'Cópia online restaurada com sucesso. Este dispositivo ficou alinhado para futuras cópias automáticas.',
      {
        exact: true
      }
    )
    .waitFor({
      state: 'visible'
    })

  const restored =
    await page.evaluate(
      async () => {
        const {
          maProfessorDb
        } = await import(
          '/src/components/ma-professor/db.ts'
        )

        const {
          maProfessorRepository
        } = await import(
          '/src/components/ma-professor/repository.ts'
        )

        const {
          isMAProfessorOperationallyReady
        } = await import(
          '/src/components/ma-professor/setup/setupReadiness.ts'
        )

        const activeYear =
          await maProfessorRepository
            .getActiveAcademicYear()

        const setup =
          activeYear
            ? await maProfessorRepository
                .getSetupSnapshot(
                  activeYear.id
                )
            : null

        return {
          academicYears:
            await maProfessorDb.academicYears
              .count(),
          scheduleSlots:
            await maProfessorDb.weeklyScheduleSlots
              .count(),
          activeYearName:
            activeYear?.name ?? null,
          operationalReady:
            setup
              ? isMAProfessorOperationallyReady(
                  setup
                )
              : false
        }
      }
    )

  assert.deepEqual(
    restored,
    {
      academicYears: 1,
      scheduleSlots: 1,
      activeYearName: '2026/2027',
      operationalReady: true
    }
  )

  const todayButton =
    page
      .locator('header')
      .getByRole(
        'button',
        {
          name: 'Hoje',
          exact: true
        }
      )

  await todayButton.click()
  await assert.doesNotReject(
    () =>
      todayButton.waitFor({
        state: 'visible'
      })
  )
  await page.waitForFunction(() => {
    const buttons =
      Array.from(
        document.querySelectorAll(
          'header button'
        )
      )

    return buttons.some(
      button =>
        button.textContent
          ?.includes('Hoje') &&
        button.getAttribute(
          'aria-current'
        ) === 'page'
    )
  })

  const calendarButton =
    page
      .locator('header')
      .getByRole(
        'button',
        {
          name: 'Calendário',
          exact: true
        }
      )

  await calendarButton.click()
  await page.waitForFunction(() => {
    const buttons =
      Array.from(
        document.querySelectorAll(
          'header button'
        )
      )

    return buttons.some(
      button =>
        button.textContent
          ?.includes('Calendário') &&
        button.getAttribute(
          'aria-current'
        ) === 'page'
    )
  })

  assert.ok(
    apiRequests.some(
      item =>
        item.path ===
        '/api/ma-professor/cloud-backup/push'
    )
  )
  assert.ok(
    apiRequests.filter(
      item =>
        item.path ===
        '/api/ma-professor/cloud-backup/get'
    ).length >= 2,
    'O fluxo deve voltar a descarregar a cópia no momento do restauro para validar a revisão.'
  )
  assert.deepEqual(
    pageErrors,
    []
  )

  console.log(
    'MA-Professor mobile cloud restore E2E: OK'
  )
} catch (error) {
  if (page) {
    try {
      console.error(
        'MA_PROFESSOR_CLOUD_RESTORE_E2E_BODY=' +
        (await page.locator('body').innerText()).slice(
          0,
          12000
        )
      )
    } catch {
      // Mantém o erro original.
    }
  }

  console.error(server.logs())
  throw error
} finally {
  if (browser) {
    await browser.close()
  }

  await stopVite(server.child)
}
