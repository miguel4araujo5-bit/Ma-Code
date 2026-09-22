import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import { createCloudBackupWorkerHarness } from './cloud-backup-worker-harness.mjs'

import initOpaque, {
  createServerRegistrationResponse,
  createServerSetup,
  finishServerLogin,
  startServerLogin
} from '../../worker/vendor/ma-professor-opaque/opaque.js'

const HOST = '127.0.0.1'
const PORT = 4173
const BASE_URL = `http://${HOST}:${PORT}`
const EMAIL = 'e2e.professor@example.test'
const TOKEN = 'e2e-browser-session-token'
const ACTIVATION_PASSWORD = 'MP-E2E-ACTIVATE'
const PERSONAL_PASSWORD = 'E2E-personal-password-12B!'
const SUMMARY = 'Sumário E2E persistido após reload.'
const FIXED_NOW = '2026-09-21T09:30:00+01:00'

const root = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

await initOpaque({
  module_or_path:
    await readFile(
      join(
        root,
        'worker',
        'vendor',
        'ma-professor-opaque',
        'opaque_bg.wasm'
      )
    )
})

const opaqueServerSetup =
  createServerSetup()

const cloudWorker = await createCloudBackupWorkerHarness(EMAIL, TOKEN)

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

  return { child, logs: () => output }
}

async function waitForVite(server) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.child.exitCode !== null) {
      throw new Error(`Vite terminou antes de iniciar.\n${server.logs()}`)
    }

    try {
      const response = await fetch(`${BASE_URL}/`)
      if (response.ok) return
    } catch {
      // Ainda a iniciar.
    }

    await delay(250)
  }

  throw new Error(`Vite não ficou disponível.\n${server.logs()}`)
}

async function stopVite(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    delay(1500)
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

function fulfilJson(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body)
  })
}

async function installOfflineApi(page) {
  const requests = []
  let activated = false
  let registrationRecord = null
  let pendingEnrollment = null
  let pendingLogin = null

  await page.route('**/api/ma-professor/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    let body = {}

    if (
      request.method() === 'POST' &&
      request.postData()
    ) {
      try {
        body = request.postDataJSON()
      } catch {
        body = {}
      }
    }

    const bodyKeys =
      body &&
      typeof body === 'object' &&
      !Array.isArray(body)
        ? Object.keys(body)
        : []

    requests.push({
      method:
        request.method(),
      path,
      bodyKeys,
      plan: body.plan,
      requestedPlan: body.requestedPlan
    })

    for (
      const forbiddenKey of [
        'password',
        'accountPassword',
        'personalPassword'
      ]
    ) {
      assert.equal(
        bodyKeys.includes(
          forbiddenKey
        ),
        false,
        `O browser não pode enviar ${forbiddenKey} para ${path}.`
      )
    }

    if (
      path ===
        '/api/ma-professor/access/request' ||
      path === '/api/ma-professor/access/status'
    ) {
      if (path.endsWith('/request')) assert.equal(body.email, EMAIL)
      else assert.equal(body.token, TOKEN)

      return fulfilJson(route, {
        success: true,
        request: {
          email:
            EMAIL,
          status:
            'pending',
          requestedAt:
            '2026-09-01T00:00:00.000Z',
          approvedAt:
            null,
          rejectedAt:
            null,
          activatedAt:
            null
        },
        canActivate:
          false,
        message:
          'Pedido recebido.'
      })
    }

    if (
      path ===
        '/api/ma-professor/access/opaque/enroll/start'
    ) {
      assert.equal(
        body.email,
        EMAIL
      )
      if (body.accountRequest) {
        assert.equal(body.activationPassword, undefined)
        assert.equal(body.termsVersion, '2026-09-22')
      } else {
        assert.equal(body.activationPassword, ACTIVATION_PASSWORD)
        if (registrationRecord) return fulfilJson(route, { success: false, message: 'Já registada.' }, 409)
      }
      assert.equal(
        typeof body.registrationRequest,
        'string'
      )

      const started =
        createServerRegistrationResponse({
          serverSetup:
            opaqueServerSetup,
          userIdentifier:
            EMAIL,
          registrationRequest:
            body.registrationRequest
        })

      pendingEnrollment = {
        id:
          'e2e-enrollment',
        email:
          body.email,
        deviceId:
          body.deviceId
      }

      return fulfilJson(route, {
        success:
          true,
        enrollmentId:
          pendingEnrollment.id,
        registrationResponse:
          started.registrationResponse,
        expiresAt:
          '2099-12-31T23:59:59.999Z'
      })
    }

    if (
      path ===
        '/api/ma-professor/access/opaque/enroll/finish'
    ) {
      assert.ok(
        pendingEnrollment,
        'O finish de enrollment exige um start válido.'
      )
      assert.equal(
        body.enrollmentId,
        pendingEnrollment.id
      )
      assert.equal(
        body.email,
        pendingEnrollment.email
      )
      assert.equal(
        body.deviceId,
        pendingEnrollment.deviceId
      )
      assert.equal(
        typeof body.registrationRecord,
        'string'
      )

      registrationRecord =
        body.registrationRecord
      pendingEnrollment =
        null

      return fulfilJson(route, {
        success:
          true,
        message:
          'Registo OPAQUE concluído.'
      })
    }

    if (
      path ===
        '/api/ma-professor/access/activate'
    ) {
      assert.ok(
        registrationRecord,
        'A ativação só pode acontecer depois do enrollment OPAQUE. Sequência observada: ' +
          requests
            .map(item => item.path)
            .join(' -> ')
      )
      assert.equal(
        body.email,
        EMAIL
      )
      assert.equal(
        body.activationPassword,
        ACTIVATION_PASSWORD
      )

      activated = true

      return fulfilJson(route, {
        success:
          true,
        token:
          TOKEN,
        email:
          EMAIL,
        license
      })
    }

    if (
      path ===
        '/api/ma-professor/access/opaque/login/start'
    ) {
      assert.ok(
        registrationRecord,
        'O login OPAQUE exige um registration record.'
      )
      assert.equal(
        body.email,
        EMAIL
      )
      assert.equal(
        typeof body.startLoginRequest,
        'string'
      )

      const started =
        startServerLogin({
          serverSetup:
            opaqueServerSetup,
          userIdentifier:
            EMAIL,
          registrationRecord,
          startLoginRequest:
            body.startLoginRequest
        })

      pendingLogin = {
        id:
          'e2e-login',
        email:
          body.email,
        deviceId:
          body.deviceId,
        serverLoginState:
          started.serverLoginState
      }

      return fulfilJson(route, {
        success:
          true,
        loginId:
          pendingLogin.id,
        loginResponse:
          started.loginResponse,
        expiresAt:
          '2099-12-31T23:59:59.999Z'
      })
    }

    if (
      path ===
        '/api/ma-professor/access/opaque/login/finish'
    ) {
      assert.ok(
        pendingLogin,
        'O finish de login exige um start válido.'
      )
      assert.equal(
        body.loginId,
        pendingLogin.id
      )
      assert.equal(
        body.email,
        pendingLogin.email
      )
      assert.equal(
        body.deviceId,
        pendingLogin.deviceId
      )

      finishServerLogin({
        serverLoginState:
          pendingLogin.serverLoginState,
        finishLoginRequest:
          body.finishLoginRequest
      })

      pendingLogin =
        null

      return fulfilJson(route, {
        success:
          true,
        token:
          TOKEN,
        email:
          EMAIL,
        license: activated ? license : null
      })
    }

    if (
      path ===
        '/api/ma-professor/access/account/verify'
    ) {
      return fulfilJson(route, {
        success: true,
        email: EMAIL,
        license: activated ? license : null
      })
    }

    if (path === '/api/ma-professor/access/renew') {
      assert.equal(body.token, TOKEN)
      return fulfilJson(route, { success: true, license, message: 'Pedido de renovação registado.' })
    }

    if (path.startsWith('/api/ma-professor/cloud-backup/')) {
      const response = await cloudWorker.handle(new Request(`https://ma-code.pt${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://ma-code.pt' }, body: JSON.stringify(body)
      }))
      return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() })
    }

    if (path === '/api/ma-professor/sync/status') {
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
      path === '/api/ma-professor/access/operational-state' ||
      path === '/api/ma-professor/access/logout'
    ) {
      return fulfilJson(route, { success: true })
    }

    return fulfilJson(route, {
      success: true,
      request: {
        email: EMAIL,
        status: 'approved',
        requestedAt: '2026-09-01T00:00:00.000Z',
        approvedAt: '2026-09-01T00:00:00.000Z',
        rejectedAt: null,
        activatedAt: '2026-09-01T00:00:00.000Z'
      },
      canActivate: true,
      message: 'Resposta E2E local.'
    })
  })

  return requests
}

async function waitHeading(page, name) {
  await page.getByRole('heading', { name, exact: true }).waitFor({
    state: 'visible'
  })
}

async function waitText(page, text) {
  await page.getByText(text, { exact: true }).last().waitFor({
    state: 'visible'
  })
}

async function selectSchool(page) {
  await waitHeading(page, 'Em que escola leciona?')
  await page.getByRole('button', { name: /S\. Bento — Vizela/ }).click()
  await page.getByRole('heading', { name: /Vamos preparar o essencial/ }).waitFor({
    state: 'visible'
  })
}

async function configureMinimumSetup(page) {
  await page.getByRole('button', {
    name: 'Configuração avançada / editar manualmente',
    exact: true
  }).click()

  await waitHeading(page, 'Que turmas leciona?')
  await page.getByRole('button', { name: '11.º', exact: true }).click()
  await page.getByRole('button', { name: 'E', exact: true }).click()
  await page.getByRole('button', { name: 'Adicionar turma', exact: true }).click()
  await waitText(page, 'Turma adicionada.')
  await page.getByRole('button', {
    name: 'Continuar para as disciplinas',
    exact: true
  }).click()

  await waitHeading(page, 'Que disciplinas leciona?')
  await page.getByRole('button', { name: 'Área de Expressões', exact: true }).click()
  await page.getByRole('button', { name: 'Adicionar disciplina', exact: true }).click()
  await waitText(page, 'Disciplina adicionada.')
  await page.getByRole('button', {
    name: 'Continuar para UFCD / módulos',
    exact: true
  }).click()

  await waitHeading(page, 'UFCD / módulos')
  await page.getByPlaceholder('10389').fill('10385')
  await page.getByPlaceholder('Nome da UFCD ou módulo').fill('Expressão Dramática')
  await page.getByPlaceholder('25').fill('50')
  await page.getByRole('button', {
    name: 'Adicionar UFCD / módulo',
    exact: true
  }).click()
  await page.getByText('10385 — Expressão Dramática', { exact: true }).last().waitFor({ state: 'visible', timeout: 20_000 })
  await page.getByRole('button', {
    name: 'Continuar para o horário semanal',
    exact: true
  }).click()

  await waitHeading(page, 'Horário semanal')
  await page.getByLabel('Turma e disciplina').selectOption({
    label: 'AE · 11.º E'
  })
  await page.getByRole('button', { name: 'Segunda-feira', exact: true }).click()
  await page.getByRole('button', { name: 'Adicionar ao horário', exact: true }).click()
  await waitText(page, 'Bloco de horário adicionado com sucesso.')

  const openToday = page.getByRole('button', {
    name: 'Abrir aula de hoje',
    exact: true
  })
  await openToday.waitFor({ state: 'visible' })
  await openToday.click()
}

async function summaryEditor(page) {
  const label = page.getByText('Sumário', { exact: true }).last()
  await label.waitFor({ state: 'visible' })
  const section = label.locator('xpath=ancestor::section[1]')
  const textarea = section.locator('textarea').first()
  await textarea.waitFor({ state: 'visible' })
  return { section, textarea }
}

async function persistedLesson(page) {
  return page.evaluate(async expectedSummary => {
    const { openMAProfessorDatabase } = await import(
      '/src/components/ma-professor/db.ts'
    )
    const database = await openMAProfessorDatabase()
    const lessons = await database.lessons.toArray()
    const matches = lessons.filter(lesson => lesson.summary === expectedSummary)
    const lesson = matches[0] ?? null
    const duplicates = lesson
      ? lessons.filter(candidate =>
          candidate.date === lesson.date &&
          candidate.scheduleSlotId === lesson.scheduleSlotId &&
          candidate.teachingAssignmentId === lesson.teachingAssignmentId
        ).length
      : 0

    return {
      matchCount: matches.length,
      duplicates,
      lesson: lesson
        ? {
            date: lesson.date,
            status: lesson.status,
            origin: lesson.origin,
            scheduleSlotId: lesson.scheduleSlotId,
            summary: lesson.summary
          }
        : null
    }
  }, SUMMARY)
}

async function checkPaymentDialog(page, amount, width) {
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByText(amount, { exact: true }).waitFor({ state: 'visible' })
  await dialog.getByText('936 840 619', { exact: true }).waitFor({ state: 'visible' })
  assert.match(await dialog.innerText(), /confirmação por\s+email/)
  assert.match(await dialog.innerText(), /ativação é feita manualmente/)
  assert.equal(await dialog.locator('img[src="/mbway.svg"]').evaluate(image => image.complete && image.naturalWidth > 0), true)
  const bounds = await dialog.boundingBox()
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= 900)
  if (process.env.MA_ACCESS_SCREENSHOTS) {
    await page.screenshot({ path: `/tmp/ma-access-mbway-${width}.png` })
  }
  await dialog.getByRole('button', { name: 'OK', exact: true }).click()
}

async function diagnostic(page, apiRequests, pageErrors) {
  let body = '<body indisponível>'
  try {
    body = (await page.locator('body').innerText()).slice(0, 8000)
  } catch {
    // Mantém o fallback.
  }

  return JSON.stringify({
    url: page.url(),
    body,
    apiRequests,
    pageErrors
  }, null, 2)
}

const server = startVite()
let browser
let page
let apiRequests = []
const pageErrors = []

try {
  await waitForVite(server)

  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon'
  })
  page = await context.newPage()
  await page.clock.setFixedTime(new Date(FIXED_NOW))
  page.setDefaultTimeout(20_000)
  page.setDefaultNavigationTimeout(30_000)
  page.on('pageerror', error => pageErrors.push(error.message))
  apiRequests = await installOfflineApi(page)

  await page.goto(
    `${BASE_URL}/produtos/ma-professor`,
    {
      waitUntil:
        'domcontentloaded'
    }
  )

  await page
    .getByRole(
      'button',
      {
        name:
          'Pedir acesso gratuito',
        exact:
          true
      }
    )
    .first()
    .click()

  await waitHeading(
    page,
    'Pedir acesso'
  )

  await page
    .getByLabel(
      'Email',
      {
        exact:
          true
      }
    )
    .fill(
      EMAIL
    )

  await page
    .getByLabel(
      'Criar password',
      {
        exact:
          true
      }
    )
    .fill(
      PERSONAL_PASSWORD
    )

  await page
    .getByLabel(
      'Confirmar password',
      {
        exact:
          true
      }
    )
    .fill(
      PERSONAL_PASSWORD
    )

  await page
    .getByLabel(
      'Guardei a minha password num local seguro',
      {
        exact:
          true
      }
    )
    .check()

  await page
    .getByLabel(
      'Li a Informação de privacidade e aceito os Termos do MA-Professor',
      {
        exact:
          true
      }
    )
    .check()

  await page
    .getByRole(
      'button',
      {
        name:
          'Pedir acesso',
        exact:
          true
      }
    )
    .click()

  await waitHeading(
    page,
    'O pedido foi registado'
  )

  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
  await page.getByLabel('Password pessoal', { exact: true }).fill(PERSONAL_PASSWORD)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await waitHeading(page, 'A sua conta está autenticada.')
  await waitHeading(page, 'Quer abolir a espera?')
  await waitText(page, 'Pagamento por MB WAY')
  assert.equal(await page.getByRole('button', { name: 'Guardar', exact: true }).count(), 0)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitHeading(page, 'A sua conta está autenticada.')
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.locator('img[src="/mbway.svg"]').evaluate(image => {
      if (!image.complete || image.naturalWidth === 0) throw new Error('O logótipo MB WAY deve estar carregado.')
    })
    for (const [label, amount] of [['Selecionar 30 dias', '3,49 €'], ['Selecionar ano letivo', '15 €']]) {
      await page.getByRole('button').filter({ hasText: label }).click()
      await checkPaymentDialog(page, amount, width)
    }
  }
  await page.setViewportSize({ width: 1366, height: 900 })
  assert.deepEqual(apiRequests.filter(item => item.plan).map(item => item.plan), ['paid_30_days', 'school_year', 'paid_30_days', 'school_year'])

  await page.getByRole('button', { name: 'Terminar sessão', exact: true }).click()
  await page.getByRole('button', { name: 'Já tenho acesso', exact: true }).first().waitFor({ state: 'visible' })

  const activationUrl =
    `${BASE_URL}/produtos/ma-professor?acesso=ativar&email=${encodeURIComponent(EMAIL)}` +
    `#senha=${encodeURIComponent(ACTIVATION_PASSWORD)}`
  await page.goto(activationUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() =>
    !window.location.search.includes('acesso=ativar') &&
    !window.location.search.includes('email=') &&
    !window.location.hash.includes('senha=')
  )

  const cleanUrl = new URL(page.url())
  assert.equal(cleanUrl.searchParams.has('acesso'), false)
  assert.equal(cleanUrl.searchParams.has('email'), false)
  assert.equal(cleanUrl.hash, '')

  await waitHeading(
    page,
    'Ativar período de acesso'
  )

  await page
    .getByLabel(
      'Password pessoal',
      {
        exact:
          true
      }
    )
    .fill(
      PERSONAL_PASSWORD
    )

  await page
    .getByLabel(
      'Confirmar password pessoal',
      {
        exact:
          true
      }
    )
    .fill(
      PERSONAL_PASSWORD
    )

  await page
    .getByRole(
      'checkbox'
    )
    .check()

  await page
    .getByRole(
      'button',
      {
        name:
          'Ativar período',
        exact:
          true
      }
    )
    .click()

  await selectSchool(page)
  await configureMinimumSetup(page)

  const editor = await summaryEditor(page)
  await editor.textarea.fill(SUMMARY)
  await editor.section.getByRole('button', {
    name: 'Guardar',
    exact: true
  }).click()
  await waitText(page, 'Aula, sumário, faltas e avaliações guardados.')

  const first = await persistedLesson(page)
  assert.equal(first.matchCount, 1)
  assert.equal(first.duplicates, 1)
  assert.equal(first.lesson?.date, '2026-09-21')
  assert.equal(first.lesson?.status, 'taught')
  assert.equal(first.lesson?.origin, 'scheduled')
  assert.ok(first.lesson?.scheduleSlotId)

  // A real new account has no D1 profile. Its first backup must be born v3.
  const protectedCopy = await page.evaluate(async () => {
    const storage = await import('/src/components/ma-professor/access/accessStorage.ts')
    const service = await import('/src/components/ma-professor/sync/cloudBackupService.ts')
    const repository = await import('/src/components/ma-professor/settings/backupRepository.ts')
    const trust = await import('/src/components/ma-professor/sync/cloudBackupTrust.ts')
    const preference = await import('/src/components/ma-professor/sync/cloudBackupPreference.ts')
    const session = storage.readMAProfessorAccessSession()
    const result = await service.uploadAndVerifyCompatibleMAProfessorCloudBackup(session, await repository.createMAProfessorBackup())
    preference.writeCloudBackupPreference(session, 'enabled')
    trust.writeMAProfessorCloudBackupTrust(session, result)
    return await service.inspectMAProfessorCloudBackup(session)
  })
  assert.equal(protectedCopy.cryptoVersion, 3)
  assert.equal(protectedCopy.backup.found, true)

  await page.reload({ waitUntil: 'domcontentloaded' })
  const unlock = page.getByRole('complementary', { name: 'Desbloquear cópia protegida' })
  await unlock.waitFor({ state: 'visible' })
  const unsavedEditor = await summaryEditor(page)
  await unsavedEditor.textarea.fill('Edição local ainda por guardar.')
  await unlock.getByLabel('Password pessoal').fill('Wrong-password-123!')
  await unlock.getByRole('button', { name: 'Desbloquear cópia protegida', exact: true }).click()
  await unlock.getByRole('alert').waitFor({ state: 'visible' })
  assert.equal(await unlock.getByLabel('Password pessoal').inputValue(), '')
  await unlock.getByLabel('Password pessoal').fill(PERSONAL_PASSWORD)
  await unlock.getByRole('button', { name: 'Desbloquear cópia protegida', exact: true }).click()
  await unlock.waitFor({ state: 'hidden' })
  assert.equal(await unsavedEditor.textarea.inputValue(), 'Edição local ainda por guardar.', 'Reauthentication must preserve unsaved edits')
  await unsavedEditor.textarea.fill(SUMMARY)
  const restoredCopy = await page.evaluate(async () => {
    const storage = await import('/src/components/ma-professor/access/accessStorage.ts')
    const service = await import('/src/components/ma-professor/sync/cloudBackupService.ts')
    const session = storage.readMAProfessorAccessSession()
    const remote = await service.downloadCompatibleMAProfessorCloudBackup(session)
    return { summary: remote.backup.data.lessons.find(lesson => lesson.summary)?.summary,
      secretPersisted: JSON.stringify({ ...localStorage, ...sessionStorage }).includes(storage.readMAProfessorOpaqueExportKey(session.email)) }
  })
  assert.equal(restoredCopy.summary, SUMMARY)
  assert.equal(restoredCopy.secretPersisted, false)
  const reopened = await summaryEditor(page)
  assert.equal(await reopened.textarea.inputValue(), SUMMARY)

  const afterReload = await persistedLesson(page)
  assert.equal(afterReload.matchCount, 1)
  assert.equal(afterReload.duplicates, 1)
  assert.equal(afterReload.lesson?.summary, SUMMARY)
  assert.equal(afterReload.lesson?.status, 'taught')

  await page.evaluate(async () => {
    const {
      clearMAProfessorStoredAccess,
      readMAProfessorStoredAccess
    } = await import(
      '/src/components/ma-professor/access/accessStorage.ts'
    )

    const {
      logoutMAProfessorAccess
    } = await import(
      '/src/components/ma-professor/access/accessApi.ts'
    )

    const stored =
      readMAProfessorStoredAccess()

    if (!stored) {
      throw new Error(
        'A sessão E2E devia existir antes do logout.'
      )
    }

    await logoutMAProfessorAccess(
      stored.token,
      stored.deviceId
    )

    clearMAProfessorStoredAccess()
  })

  await page.reload({
    waitUntil:
      'domcontentloaded'
  })

  await page
    .getByRole(
      'button',
      {
        name:
          'Já tenho acesso',
        exact:
          true
      }
    )
    .first()
    .click()

  await waitHeading(
    page,
    'Aceder à sua conta MA-Professor'
  )

  await page
    .getByLabel(
      'Email',
      {
        exact:
          true
      }
    )
    .fill(
      EMAIL
    )

  await page
    .getByLabel(
      'Password pessoal',
      {
        exact:
          true
      }
    )
    .fill(
      PERSONAL_PASSWORD
    )

  await page
    .getByRole(
      'button',
      {
        name:
          'Entrar',
        exact:
          true
      }
    )
    .click()

  await page.waitForFunction(
    () =>
      Boolean(
        window.localStorage.getItem(
          'ma-professor-access-v1'
        )
      )
  )

  const afterOpaqueLogin =
    await persistedLesson(
      page
    )

  assert.equal(
    afterOpaqueLogin.matchCount,
    1
  )
  assert.equal(
    afterOpaqueLogin.duplicates,
    1
  )
  assert.equal(
    afterOpaqueLogin.lesson?.summary,
    SUMMARY
  )

  await page.getByRole('complementary', { name: 'Navegação completa do MA-Professor' })
    .getByRole('button').filter({ hasText: 'Definições' }).click()
  await page.getByRole('button', { name: 'Licença Acesso, validade e renovação', exact: true }).click()
  await waitHeading(page, 'Escolha o período de acesso')
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.getByRole('button').filter({ hasText: 'Continuar gratuitamente' }).click()
    await waitHeading(page, 'Pedido de acesso gratuito enviado')
    await page.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click()
    for (const [label, amount] of [['Apoio Fundador · 30 dias', '3,49 €'], ['Apoio Fundador · Ano letivo', '15 €']]) {
      await page.getByRole('button').filter({ hasText: label }).click()
      await checkPaymentDialog(page, amount, width)
    }
  }
  assert.deepEqual(apiRequests.filter(item => item.requestedPlan).map(item => item.requestedPlan), [
    'courtesy_30_days', 'paid_30_days', 'school_year',
    'courtesy_30_days', 'paid_30_days', 'school_year'
  ])

  assert.ok(apiRequests.some(item =>
    item.path === '/api/ma-professor/access/request'
  ))
  assert.ok(apiRequests.some(item =>
    item.path === '/api/ma-professor/access/opaque/enroll/start'
  ))
  assert.ok(apiRequests.some(item =>
    item.path === '/api/ma-professor/access/opaque/enroll/finish'
  ))
  assert.ok(apiRequests.some(item =>
    item.path === '/api/ma-professor/access/activate'
  ))
  assert.ok(apiRequests.some(item =>
    item.path === '/api/ma-professor/access/logout'
  ))
  assert.ok(apiRequests.some(item =>
    item.path === '/api/ma-professor/access/opaque/login/start'
  ))
  assert.ok(apiRequests.some(item =>
    item.path === '/api/ma-professor/access/opaque/login/finish'
  ))
  assert.ok(apiRequests.some(item =>
    item.path === '/api/ma-professor/access/account/verify'
  ))
  assert.deepEqual(pageErrors, [])

  console.log('MA-Professor browser critical path: OK')
} catch (error) {
  if (page) {
    console.error(
      'MA_PROFESSOR_E2E_DIAGNOSTIC=' +
      await diagnostic(page, apiRequests, pageErrors)
    )
  }
  console.error(server.logs())
  throw error
} finally {
  if (browser) await browser.close()
  await stopVite(server.child)
  cloudWorker.close()
}
