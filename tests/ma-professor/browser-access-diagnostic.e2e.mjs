import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = 4173
const BASE_URL = `http://${HOST}:${PORT}`
const EMAIL = 'e2e.professor@example.test'
const TOKEN = 'e2e-browser-session-token'

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

const vite = spawn(
  process.execPath,
  [
    join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host', HOST,
    '--port', String(PORT),
    '--strictPort'
  ],
  {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe']
  }
)

let viteOutput = ''
vite.stdout.on('data', chunk => {
  viteOutput += chunk.toString()
})
vite.stderr.on('data', chunk => {
  viteOutput += chunk.toString()
})

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/`)
      if (response.ok) return
    } catch {
      // Ainda a iniciar.
    }
    await delay(250)
  }
  throw new Error(`Vite indisponível.\n${viteOutput}`)
}

function json(route, body) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body)
  })
}

let browser

try {
  await waitForServer()
  browser = await chromium.launch({ headless: true })

  const context = await browser.newContext({
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon'
  })
  const page = await context.newPage()
  const requests = []
  const errors = []
  const consoleMessages = []

  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    consoleMessages.push(`${message.type()}: ${message.text()}`)
  })

  await page.route('**/api/ma-professor/**', async route => {
    const path = new URL(route.request().url()).pathname
    requests.push(path)

    if (path === '/api/ma-professor/access/activate') {
      return json(route, {
        success: true,
        token: TOKEN,
        email: EMAIL,
        license
      })
    }

    if (path === '/api/ma-professor/access/account/verify') {
      return json(route, {
        success: true,
        email: EMAIL,
        license
      })
    }

    if (path === '/api/ma-professor/sync/status') {
      return json(route, {
        success: true,
        databaseReady: true,
        profileExists: false,
        serverRevision: 0,
        cryptoVersion: null,
        updatedAt: null
      })
    }

    return json(route, {
      success: true,
      request: {
        email: EMAIL,
        status: 'approved',
        requestedAt: null,
        approvedAt: '2026-09-01T00:00:00.000Z',
        rejectedAt: null,
        activatedAt: '2026-09-01T00:00:00.000Z'
      },
      canActivate: true,
      message: 'E2E local'
    })
  })

  await page.goto(
    `${BASE_URL}/produtos/ma-professor?acesso=ativar&email=${encodeURIComponent(EMAIL)}#senha=E2E-ACTIVATE`,
    { waitUntil: 'domcontentloaded' }
  )

  await delay(4000)

  const snapshot = await page.evaluate(() => ({
    url: window.location.href,
    body: document.body.innerText.slice(0, 8000),
    localStorage: Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index)
        return key ? [key, localStorage.getItem(key)] : ['', null]
      }).filter(([key]) => key)
    )
  }))

  console.log('E2E_ACCESS_DIAGNOSTIC=' + JSON.stringify({
    snapshot,
    requests,
    errors,
    consoleMessages
  }))

  assert.match(
    snapshot.body,
    /Vamos preparar o essencial/,
    'A interface deve atravessar a ativação e chegar ao onboarding.'
  )
} finally {
  if (browser) await browser.close()
  if (vite.exitCode === null) vite.kill('SIGTERM')
}
