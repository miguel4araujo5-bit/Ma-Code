import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { chromium } from 'playwright'

const TEST_EMAIL =
  'e2e.professor@example.test'
const TEST_TOKEN =
  'e2e-browser-session-token'
const TEST_SUMMARY =
  'Sumário E2E persistido após reload.'
const ACTIVATION_PASSWORD =
  'E2E-ACTIVATE'
const HOST =
  '127.0.0.1'
const PORT =
  4173
const BASE_URL =
  `http://${HOST}:${PORT}`

const root = join(
  dirname(
    fileURLToPath(
      import.meta.url
    )
  ),
  '..',
  '..'
)

const license = {
  email: TEST_EMAIL,
  plan: 'beta_30_days',
  status: 'active',
  validFrom:
    '2026-01-01T00:00:00.000Z',
  validUntil:
    '2099-12-31T23:59:59.999Z',
  daysRemaining: 9999,
  renewalRequestedAt: null
}

function startVite() {
  const viteBin = join(
    root,
    'node_modules',
    'vite',
    'bin',
    'vite.js'
  )

  const output = []

  const child = spawn(
    process.execPath,
    [
      viteBin,
      '--host',
      HOST,
      '--port',
      String(PORT),
      '--strictPort'
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        BROWSER: 'none'
      },
      stdio: [
        'ignore',
        'pipe',
        'pipe'
      ]
    }
  )

  const capture = chunk => {
    output.push(
      chunk.toString()
    )

    if (output.length > 80) {
      output.shift()
    }
  }

  child.stdout.on(
    'data',
    capture
  )
  child.stderr.on(
    'data',
    capture
  )

  return {
    child,
    logs: () =>
      output.join('')
  }
}

async function waitForVite(
  child,
  logs
) {
  for (
    let attempt = 0;
    attempt < 80;
    attempt += 1
  ) {
    if (
      child.exitCode !== null
    ) {
      throw new Error(
        `O servidor Vite terminou antes de ficar disponível.\n${logs()}`
      )
    }

    try {
      const response =
        await fetch(
          `${BASE_URL}/`
        )

      if (response.ok) {
        return
      }
    } catch {
      // O servidor ainda está a iniciar.
    }

    await delay(250)
  }

  throw new Error(
    `O servidor Vite não ficou disponível.\n${logs()}`
  )
}

async function stopVite(
  child
) {
  if (
    child.exitCode !== null
  ) {
    return
  }

  child.kill('SIGTERM')

  await Promise.race([
    new Promise(resolve =>
      child.once(
        'exit',
        resolve
      )
    ),
    delay(1500)
  ])

  if (
    child.exitCode === null
  ) {
    child.kill('SIGKILL')
  }
}

function jsonResponse(
  route,
  body,
  status = 200
) {
  return route.fulfill({
    status,
    contentType:
      'application/json; charset=utf-8',
    body:
      JSON.stringify(body)
  })
}

async function installOfflineApi(
  page
) {
  const requests = []

  await page.route(
    '**/api/ma-professor/**',
    async route => {
      const request =
        route.request()
      const url =
        new URL(
          request.url()
        )

      requests.push({
        method:
          request.method(),
        path:
          url.pathname
      })

      switch (
        url.pathname
      ) {
        case '/api/ma-professor/access/activate':
          return jsonResponse(
            route,
            {
              success: true,
              token:
                TEST_TOKEN,
              email:
                TEST_EMAIL,
              license
            }
          )

        case '/api/ma-professor/access/account/verify':
          return jsonResponse(
            route,
            {
              success: true,
              email:
                TEST_EMAIL,
              license
            }
          )

        case '/api/ma-professor/sync/status':
          return jsonResponse(
            route,
            {
              success: true,
              databaseReady: true,
              profileExists: false,
              serverRevision: 0,
              cryptoVersion: null,
              updatedAt: null
            }
          )

        case '/api/ma-professor/access/operational-state':
          return jsonResponse(
            route,
            {
              success: true
            }
          )

        case '/api/ma-professor/access/logout':
          return jsonResponse(
            route,
            {
              success: true
            }
          )

        default:
          return jsonResponse(
            route,
            {
              success: true,
              e2eOffline: true
            }
          )
      }
    }
  )

  return requests
}

async function waitForText(
  page,
  text
) {
  const locator =
    page.getByText(
      text,
      {
        exact: true
      }
    )

  await locator.waitFor({
    state: 'visible'
  })

  return locator
}

async function configureMinimumOperationalSetup(
  page
) {
  await page
    .getByRole(
      'button',
      {
        name:
          'Configuração avançada / editar manualmente',
        exact: true
      }
    )
    .click()

  await waitForText(
    page,
    'Passo 2 de 9'
  )

  await page
    .getByRole(
      'button',
      {
        name: '11.º',
        exact: true
      }
    )
    .click()

  await page
    .getByRole(
      'button',
      {
        name: 'E',
        exact: true
      }
    )
    .click()

  await page
    .getByRole(
      'button',
      {
        name:
          'Adicionar turma',
        exact: true
      }
    )
    .click()

  await waitForText(
    page,
    'Turma adicionada.'
  )

  await page
    .getByRole(
      'button',
      {
        name:
          'Continuar para as disciplinas',
        exact: true
      }
    )
    .click()

  await waitForText(
    page,
    'Passo 3 de 9'
  )

  await page
    .getByRole(
      'button',
      {
        name:
          'Área de Expressões',
        exact: true
      }
    )
    .click()

  await page
    .getByRole(
      'button',
      {
        name:
          'Adicionar disciplina',
        exact: true
      }
    )
    .click()

  await waitForText(
    page,
    'Disciplina adicionada.'
  )

  await page
    .getByRole(
      'button',
      {
        name:
          'Continuar para UFCD / módulos',
        exact: true
      }
    )
    .click()

  await waitForText(
    page,
    'Passo 4 de 9'
  )

  await page
    .getByPlaceholder(
      '10389'
    )
    .fill(
      '10385'
    )

  await page
    .getByPlaceholder(
      'Nome da UFCD ou módulo'
    )
    .fill(
      'Expressão Dramática'
    )

  await page
    .getByPlaceholder(
      '25'
    )
    .fill(
      '50'
    )

  await page
    .getByRole(
      'button',
      {
        name:
          'Adicionar UFCD / módulo',
        exact: true
      }
    )
    .click()

  await waitForText(
    page,
    'UFCD ou módulo aplicado a 1 turma.'
  )

  await page
    .getByRole(
      'button',
      {
        name:
          'Continuar para o horário semanal',
        exact: true
      }
    )
    .click()

  await waitForText(
    page,
    'Passo 5 de 9'
  )

  await page
    .getByLabel(
      'Turma e disciplina'
    )
    .selectOption({
      label:
        'AE · 11.º E'
    })

  const weekdayLabel =
    await page.evaluate(
      () => {
        const labels = [
          'Domingo',
          'Segunda-feira',
          'Terça-feira',
          'Quarta-feira',
          'Quinta-feira',
          'Sexta-feira',
          'Sábado'
        ]

        return labels[
          new Date().getDay()
        ]
      }
    )

  await page
    .getByRole(
      'button',
      {
        name:
          weekdayLabel,
        exact: true
      }
    )
    .click()

  await page
    .getByRole(
      'button',
      {
        name:
          'Adicionar ao horário',
        exact: true
      }
    )
    .click()

  await waitForText(
    page,
    'Bloco de horário adicionado com sucesso.'
  )

  await page
    .getByRole(
      'button',
      {
        name:
          'Abrir aula de hoje',
        exact: true
      }
    )
    .waitFor({
      state: 'visible'
    })

  await page
    .getByRole(
      'button',
      {
        name:
          'Abrir aula de hoje',
        exact: true
      }
    )
    .click()
}

async function getSummaryEditor(
  page
) {
  const heading =
    page.getByText(
      'Sumário',
      {
        exact: true
      }
    )

  await heading.waitFor({
    state: 'visible'
  })

  const section =
    heading.locator(
      'xpath=ancestor::section[1]'
    )

  const textarea =
    section
      .locator('textarea')
      .first()

  await textarea.waitFor({
    state: 'visible'
  })

  return {
    section,
    textarea
  }
}

async function readPersistedLesson(
  page
) {
  return page.evaluate(
    async expectedSummary => {
      const {
        openMAProfessorDatabase
      } =
        await import(
          '/src/components/ma-professor/db.ts'
        )

      const database =
        await openMAProfessorDatabase()

      const lessons =
        await database.lessons
          .toArray()

      const matching =
        lessons.filter(
          lesson =>
            lesson.summary ===
            expectedSummary
        )

      const lesson =
        matching[0] ??
        null

      const duplicates =
        lesson
          ? lessons.filter(
              candidate =>
                candidate.date ===
                  lesson.date &&
                candidate.scheduleSlotId ===
                  lesson.scheduleSlotId &&
                candidate.teachingAssignmentId ===
                  lesson.teachingAssignmentId
            ).length
          : 0

      return {
        matchCount:
          matching.length,
        duplicates,
        lesson:
          lesson
            ? {
                status:
                  lesson.status,
                origin:
                  lesson.origin,
                scheduleSlotId:
                  lesson.scheduleSlotId,
                summary:
                  lesson.summary
              }
            : null
      }
    },
    TEST_SUMMARY
  )
}

const server =
  startVite()
let browser = null

try {
  await waitForVite(
    server.child,
    server.logs
  )

  browser =
    await chromium.launch({
      headless: true
    })

  const context =
    await browser.newContext({
      locale: 'pt-PT',
      timezoneId:
        'Europe/Lisbon'
    })

  const page =
    await context.newPage()

  page.setDefaultTimeout(
    20_000
  )
  page.setDefaultNavigationTimeout(
    30_000
  )

  const pageErrors = []

  page.on(
    'pageerror',
    error => {
      pageErrors.push(
        error.message
      )
    }
  )

  const apiRequests =
    await installOfflineApi(
      page
    )

  const activationUrl =
    `${BASE_URL}/produtos/ma-professor?acesso=ativar&email=${encodeURIComponent(
      TEST_EMAIL
    )}#senha=${encodeURIComponent(
      ACTIVATION_PASSWORD
    )}`

  await page.goto(
    activationUrl,
    {
      waitUntil:
        'domcontentloaded'
    }
  )

  await page
    .getByRole(
      'heading',
      {
        name:
          /Vamos preparar o essencial/
      }
    )
    .waitFor({
      state: 'visible'
    })

  await page.waitForFunction(
    () =>
      !window.location.search.includes(
        'acesso=ativar'
      ) &&
      !window.location.search.includes(
        'email='
      ) &&
      !window.location.hash.includes(
        'senha='
      )
  )

  const cleanUrl =
    new URL(
      page.url()
    )

  assert.equal(
    cleanUrl.searchParams.has(
      'acesso'
    ),
    false,
    'Os dados de ativação devem ser removidos do URL depois de utilizados.'
  )
  assert.equal(
    cleanUrl.searchParams.has(
      'email'
    ),
    false,
    'O email de ativação não deve permanecer no URL.'
  )
  assert.equal(
    cleanUrl.hash,
    '',
    'A password de ativação não deve permanecer no fragmento do URL.'
  )

  await configureMinimumOperationalSetup(
    page
  )

  const {
    section,
    textarea
  } =
    await getSummaryEditor(
      page
    )

  await textarea.fill(
    TEST_SUMMARY
  )

  await section
    .getByRole(
      'button',
      {
        name: 'Guardar',
        exact: true
      }
    )
    .click()

  await waitForText(
    page,
    'Aula, sumário, faltas e avaliações guardados.'
  )

  const firstPersistence =
    await readPersistedLesson(
      page
    )

  assert.equal(
    firstPersistence.matchCount,
    1,
    'O primeiro sumário deve existir uma única vez no IndexedDB real do browser.'
  )
  assert.equal(
    firstPersistence.duplicates,
    1,
    'Guardar o primeiro sumário não pode duplicar a aula prevista.'
  )
  assert.equal(
    firstPersistence.lesson?.status,
    'taught'
  )
  assert.equal(
    firstPersistence.lesson?.origin,
    'scheduled'
  )
  assert.ok(
    firstPersistence.lesson?.scheduleSlotId,
    'A aula guardada deve manter a ligação ao bloco do horário.'
  )

  await page.reload({
    waitUntil:
      'domcontentloaded'
  })

  const reopened =
    await getSummaryEditor(
      page
    )

  assert.equal(
    await reopened.textarea.inputValue(),
    TEST_SUMMARY,
    'O sumário deve reaparecer depois de recarregar a aplicação.'
  )

  const afterReload =
    await readPersistedLesson(
      page
    )

  assert.equal(
    afterReload.matchCount,
    1
  )
  assert.equal(
    afterReload.duplicates,
    1,
    'Reabrir a aplicação não pode materializar uma segunda aula para o mesmo bloco e data.'
  )
  assert.equal(
    afterReload.lesson?.summary,
    TEST_SUMMARY
  )
  assert.equal(
    afterReload.lesson?.status,
    'taught'
  )

  assert.ok(
    apiRequests.some(
      request =>
        request.path ===
        '/api/ma-professor/access/activate'
    ),
    'O percurso deve passar pela ativação real da interface.'
  )

  assert.ok(
    apiRequests.every(
      request =>
        request.path.startsWith(
          '/api/ma-professor/'
        )
    ),
    'Todas as chamadas MA-Professor devem permanecer dentro do mock local do teste.'
  )

  assert.deepEqual(
    pageErrors,
    [],
    `A página não deve produzir erros JavaScript no percurso crítico.\n${pageErrors.join('\n')}`
  )

  console.log(
    'MA-Professor browser critical path: OK'
  )
} catch (error) {
  console.error(
    server.logs()
  )
  throw error
} finally {
  if (browser) {
    await browser.close()
  }

  await stopVite(
    server.child
  )
}
