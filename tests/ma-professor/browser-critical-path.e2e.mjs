import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = 4173
const BASE_URL = `http://${HOST}:${PORT}`
const EMAIL = 'e2e.professor@example.test'
const TOKEN = 'e2e-browser-session-token'
const ACTIVATION_PASSWORD = 'E2E-ACTIVATE'
const SUMMARY = 'Sumário E2E persistido após reload.'
const FIXED_NOW = '2026-09-21T09:30:00+01:00'

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

  await page.route('**/api/ma-professor/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    requests.push({ method: request.method(), path })

    if (path === '/api/ma-professor/access/activate') {
      return fulfilJson(route, {
        success: true,
        token: TOKEN,
        email: EMAIL,
        license
      })
    }

    if (path === '/api/ma-professor/access/account/verify') {
      return fulfilJson(route, {
        success: true,
        email: EMAIL,
        license
      })
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
  await waitText(page, 'UFCD ou módulo aplicado a 1 turma.')
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

  await page.reload({ waitUntil: 'domcontentloaded' })
  const reopened = await summaryEditor(page)
  assert.equal(await reopened.textarea.inputValue(), SUMMARY)

  const afterReload = await persistedLesson(page)
  assert.equal(afterReload.matchCount, 1)
  assert.equal(afterReload.duplicates, 1)
  assert.equal(afterReload.lesson?.summary, SUMMARY)
  assert.equal(afterReload.lesson?.status, 'taught')

  assert.ok(apiRequests.some(item =>
    item.path === '/api/ma-professor/access/activate'
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
}
