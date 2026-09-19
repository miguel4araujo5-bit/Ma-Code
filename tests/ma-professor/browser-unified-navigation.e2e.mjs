import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = 4175
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
  await waitText(page, '10385 — Expressão Dramática')
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
const evidence = []
const destinations = [
  'Sumários / GIAE', 'Avaliações', 'Planificações',
  'Turmas e alunos', 'Faltas e recuperações', 'Horários',
  'Definições'
]

function primary(page) {
  return page.getByRole('navigation', { name: 'Navegação principal do MA-Professor', exact: true })
}

async function openDestination(page, label, width) {
  let navigation
  if (width < 1280) {
    await page.getByRole('button', { name: 'Abrir navegação completa do MA-Professor' }).click()
    navigation = page.getByRole('dialog', { name: 'Navegação completa do MA-Professor' })
  } else {
    navigation = page.getByRole('complementary', { name: 'Navegação completa do MA-Professor' })
  }
  await navigation.getByRole('button').filter({ hasText: label }).click()
}

async function assertSingleNavigation(page) {
  assert.equal(await page.getByRole('navigation', { name: 'Navegação do MA-Professor', exact: true }).count(), 0)
  assert.equal(await page.getByRole('navigation', { name: 'Navegação móvel do MA-Professor', exact: true }).count(), 0)
  assert.equal(await page.locator('button[title="Em breve"]').count(), 0)
}

try {
  await waitForVite(server)
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ locale: 'pt-PT', timezoneId: 'Europe/Lisbon', viewport: { width: 1366, height: 900 } })
  page = await context.newPage()
  await page.clock.setFixedTime(new Date(FIXED_NOW))
  page.setDefaultTimeout(20_000)
  page.on('pageerror', error => pageErrors.push(error.message))
  apiRequests = await installOfflineApi(page)
  await page.goto(`${BASE_URL}/produtos/ma-professor?acesso=ativar&email=${encodeURIComponent(EMAIL)}#senha=${encodeURIComponent(ACTIVATION_PASSWORD)}`)
  await selectSchool(page)
  await openDestination(page, 'Definições', 1366)
  await page.getByRole('button', { name: /Segurança e recuperação/ }).click()
  await page.getByRole('button', { name: 'Escolher cópia do dispositivo' }).waitFor()
  await primary(page).getByRole('button', { name: 'Menu', exact: false }).click()
  await configureMinimumSetup(page)

  const editor = await summaryEditor(page)
  await editor.textarea.fill(SUMMARY)
  await editor.section.getByRole('button', { name: 'Guardar', exact: true }).click()
  await waitText(page, 'Aula, sumário, faltas e avaliações guardados.')
  assert.equal((await persistedLesson(page)).matchCount, 1)
  evidence.push('onboarding, segurança em Definições antes da conclusão, sumário guardado')

  // Complete the fixture after testing real onboarding; no production data or API is used.
  await page.evaluate(async () => {
    const { openMAProfessorDatabase } = await import('/src/components/ma-professor/db.ts')
    const db = await openMAProfessorDatabase()
    const year = (await db.academicYears.toArray()).find(item => item.active)
    const completedAt = new Date().toISOString()
    await db.academicYears.update(year.id, { setupCompletedAt: completedAt })
    await db.setupProgress.where('academicYearId').equals(year.id).modify({
      completedAt, currentStep: 'confirmation',
      completedSteps: ['academic_year', 'groups', 'subjects', 'modules', 'weekly_schedule', 'assessment_criteria', 'planifications', 'students', 'confirmation']
    })
  })
  await page.reload()
  assert.equal(await (await summaryEditor(page)).textarea.inputValue(), SUMMARY)

  // A failed save must keep the Daily editor and its draft on screen.
  const draftEditor = await summaryEditor(page)
  const navigationDraft = SUMMARY + ' Alteração antes de navegar.'
  await draftEditor.textarea.fill(navigationDraft)
  await page.evaluate(async () => {
    const { dailyWorkspaceRepository } = await import('/src/components/ma-professor/daily/dailyWorkspaceRepository.ts')
    window.__originalSaveLesson = dailyWorkspaceRepository.saveLesson
    dailyWorkspaceRepository.saveLesson = async () => { throw new Error('Falha de gravação simulada no teste') }
  })
  page.once('dialog', dialog => dialog.dismiss())
  await openDestination(page, 'Sumários / GIAE', 1366)
  assert.equal(await draftEditor.textarea.inputValue(), navigationDraft)
  assert.equal(await primary(page).getByRole('button', { name: /Hoje/ }).getAttribute('aria-current'), 'page')
  await page.evaluate(async () => {
    const { dailyWorkspaceRepository } = await import('/src/components/ma-professor/daily/dailyWorkspaceRepository.ts')
    dailyWorkspaceRepository.saveLesson = window.__originalSaveLesson
    delete window.__originalSaveLesson
  })
  await openDestination(page, 'Sumários / GIAE', 1366)
  await page.getByRole('heading', { name: 'Sumários / GIAE', exact: true }).waitFor()
  const autoSaved = await page.evaluate(async expected => {
    const { openMAProfessorDatabase } = await import('/src/components/ma-professor/db.ts')
    const db = await openMAProfessorDatabase()
    return (await db.lessons.toArray()).some(lesson => lesson.summary === expected)
  }, navigationDraft)
  assert.equal(autoSaved, true)
  await primary(page).getByRole('button', { name: /Hoje/ }).click()
  const resetEditor = await summaryEditor(page)
  await resetEditor.textarea.fill(SUMMARY)
  await resetEditor.section.getByRole('button', { name: 'Guardar', exact: true }).click()
  await waitText(page, 'Aula, sumário, faltas e avaliações guardados.')
  evidence.push('navegação bloqueada quando a gravação falha; gravação automática ao sair quando recupera')

  for (const width of [1366, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const label of destinations) {
      await openDestination(page, label, width)
      const heading = label === 'Horários' ? 'Horário e calendário escolar' : label
      await page.getByRole('heading', { name: heading, exact: true }).first().waitFor()
      await assertSingleNavigation(page)
      if (label === 'Sumários / GIAE') await page.getByRole('button', { name: 'Exportar sumários', exact: true }).waitFor()
      if (label === 'Restaurar dados') await page.getByRole('button', { name: 'Escolher cópia do dispositivo' }).waitFor()
      if (width >= 1280) {
        const selected = page.getByRole('complementary', { name: 'Navegação completa do MA-Professor' }).getByRole('button').filter({ hasText: label })
        assert.equal(await selected.getAttribute('aria-current'), 'page')
      }
      await primary(page).getByRole('button', { name: 'Menu', exact: false }).click()
      await waitHeading(page, 'Tudo o que não precisa todos os dias.')
      // Cards and sidebar must open the same destination using the same state.
      await page.getByRole('main').getByRole('button', { name: label, exact: true }).click()
      await page.getByRole('heading', { name: heading, exact: true }).first().waitFor()
      await page.getByRole('button', { name: '← Menu', exact: true }).click()
      await waitHeading(page, 'Tudo o que não precisa todos os dias.')
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
    assert.equal(overflow, false, `menu overflow at ${width}`)
    if (process.env.MA_NAVIGATION_SCREENSHOTS) {
      await page.screenshot({ path: `${process.env.MA_NAVIGATION_SCREENSHOTS}/navigation-${width}.png`, fullPage: true })
    }
    evidence.push(`todos os destinos pela barra lateral e pelo Menu: ${width}px`)
    console.log(evidence.at(-1))
  }

  // Restore is intentionally absent from the sidebar and remains reachable from Menu.
  await page.setViewportSize({ width: 390, height: 900 })
  await page.getByRole('button', { name: 'Abrir navegação completa do MA-Professor' }).click()
  const mobileNavigation = page.getByRole('dialog', { name: 'Navegação completa do MA-Professor' })
  assert.equal(
    await mobileNavigation.getByRole('button').filter({ hasText: 'Restaurar dados' }).count(),
    0
  )
  await mobileNavigation.getByRole('button', { name: 'Fechar navegação' }).click()

  await openDestination(page, 'Definições', 390)
  await primary(page).getByRole('button', { name: 'Menu', exact: false }).click()
  await waitHeading(page, 'Tudo o que não precisa todos os dias.')
  await page.getByRole('main').getByRole('button', { name: 'Restaurar dados', exact: true }).click()
  await page.getByRole('button', { name: 'Escolher cópia do dispositivo' }).waitFor()
  await openDestination(page, 'Definições', 390)
  await page.getByRole('button', { name: /Perfil e regras/ }).waitFor()
  await page.getByRole('button', { name: /Corrigir configuração inicial/ }).click()
  await waitHeading(page, 'Corrigir configuração')
  await page.getByRole('button', { name: '← Menu', exact: true }).click()
  await waitHeading(page, 'Tudo o que não precisa todos os dias.')
  evidence.push('Corrigir configuração inicial dentro de Definições, entre Pesquisa e Licença')

  await page.setViewportSize({ width: 1366, height: 900 })
  await primary(page).getByRole('button', { name: 'Calendário', exact: false }).click()
  await page.getByRole('button', { name: '+ Aula extra', exact: true }).click()
  const extra = page.getByRole('dialog', { name: 'Criar nova aula', exact: true })
  await extra.waitFor()
  await extra.getByPlaceholder('Conteúdos, atividade ou trabalho previsto para a aula.').fill('Aula extra de navegação')
  page.once('dialog', dialog => dialog.dismiss())
  await extra.getByRole('button', { name: 'Fechar criação da aula extra' }).click()
  assert.equal(await extra.isVisible(), true, 'cancelled discard must retain the extra lesson')
  await extra.getByRole('button', { name: 'Criar aula extra', exact: true }).click()
  await extra.waitFor({ state: 'hidden' })
  const extraCount = await page.evaluate(async () => {
    const { openMAProfessorDatabase } = await import('/src/components/ma-professor/db.ts')
    const db = await openMAProfessorDatabase()
    return (await db.lessons.toArray()).filter(item => item.origin === 'extra').length
  })
  assert.equal(extraCount, 1)
  evidence.push('aula extra no calendário único, proteção do rascunho e persistência')

  await primary(page).getByRole('button', { name: 'Hoje', exact: false }).click()
  await page.getByText('Painel do ano letivo', { exact: true }).waitFor()
  assert.equal(
    await page.getByRole('complementary', { name: 'Navegação completa do MA-Professor' })
      .getByRole('button')
      .filter({ hasText: 'Visão geral' })
      .count(),
    0
  )
  assert.equal((await persistedLesson(page)).matchCount, 1)
  await page.reload()
  assert.equal((await persistedLesson(page)).matchCount, 1)
  assert.deepEqual(pageErrors, [])
  console.log('MA-Professor unified navigation: OK\n' + evidence.join('\n'))
} catch (error) {
  if (page) console.error('MA_NAVIGATION_DIAGNOSTIC=' + await diagnostic(page, apiRequests, pageErrors))
  console.error(server.logs())
  throw error
} finally {
  if (browser) await browser.close()
  await stopVite(server.child)
}
