import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const project = fileURLToPath(new URL('../../', import.meta.url))
await mkdir(join(project, 'node_modules/.cache'), { recursive: true })
const temporary = await mkdtemp(join(project, 'node_modules/.cache/support-pagination-'))
const dom = new JSDOM('<div id="root"></div>', { url: 'https://audit.example.test' })
const originals = new Map()
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
  originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}

const ticket = { id: 'ticket-a', accountId: 'audit-account', category: 'technical', subject: 'Pedido de teste', status: 'new', context: { appVersion: null, screen: null, browser: null, os: null }, createdAt: '2026-09-29T10:00:00Z', updatedAt: '2026-09-29T10:00:00Z', closedAt: null }
const newer = { id: 'new', authorRole: 'professor', body: 'Mensagem recente', createdAt: '2026-09-29T10:00:00Z' }
const older = { ...newer, id: 'old', body: 'Mensagem anterior', createdAt: '2026-09-28T10:00:00Z' }
const cursor = { createdAt: 1, id: 'cursor-a' }
let requests = []
globalThis.__supportPagination = {
  list: async () => ({ success: true, tickets: [ticket] }),
  detail: async (id, before) => {
    requests.push({ id, before })
    return { success: true, ticket, messages: before ? [older] : [newer], nextCursor: before ? null : cursor }
  }
}

let root
try {
  for (const variant of ['professor', 'admin']) {
    requests = []
    const source = variant === 'professor'
      ? "export { SupportTicketPanel as Component } from './src/components/ma-professor/support/SupportTicketPanel'"
      : "export { default as Component } from './src/components/admin/ma-professor/MAProfessorSupportTickets'"
    const result = await build({
      stdin: { contents: source, resolveDir: project, loader: 'ts' }, jsx: 'automatic', platform: 'node', format: 'cjs', bundle: true, write: false, packages: 'external',
      plugins: [{ name: 'support-api-fixture', setup(builder) {
        builder.onResolve({ filter: /supportTicketClient$|maProfessorSupportTicketAdminApi$/ }, args => ({ path: args.path, namespace: 'support-fixture' }))
        builder.onLoad({ filter: /.*/, namespace: 'support-fixture' }, () => ({ loader: 'js', contents: `
          export const listSupportTickets = () => globalThis.__supportPagination.list()
          export const listAdminSupportTickets = listSupportTickets
          export const getSupportTicket = (...args) => globalThis.__supportPagination.detail(...args)
          export const getAdminSupportTicket = getSupportTicket
          export const createSupportTicket = async () => { throw new Error('unexpected create') }
          export const replySupportTicket = async () => { throw new Error('unexpected reply') }
          export const replyAdminSupportTicket = replySupportTicket
          export const setAdminSupportTicketStatus = async () => { throw new Error('unexpected status') }
        ` }))
      } }]
    })
    const path = join(temporary, `${variant}.cjs`)
    await writeFile(path, result.outputFiles[0].text)
    const { Component } = createRequire(import.meta.url)(path)
    root = createRoot(document.getElementById('root'))
    await act(async () => root.render(React.createElement(Component)))
    const button = [...document.querySelectorAll('button')].find(item => item.textContent.includes('Pedido de teste'))
    assert.ok(button, `${variant}: pedido disponível`)
    await act(async () => button.click())
    assert.equal(requests.length, 1)
    assert.equal(requests[0].before, undefined)
    assert.ok(document.body.textContent.includes('Mensagem recente'))
    assert.ok(!document.body.textContent.includes('Mensagem anterior'))
    const loadOlder = [...document.querySelectorAll('button')].find(item => item.textContent.includes('Carregar mensagens anteriores'))
    assert.ok(loadOlder, `${variant}: continuação disponível`)
    await act(async () => loadOlder.click())
    assert.deepEqual(requests[1], { id: ticket.id, before: cursor })
    const text = document.body.textContent
    assert.ok(text.indexOf('Mensagem anterior') < text.indexOf('Mensagem recente'))
    assert.equal(document.querySelectorAll('button').length > 0, true)
    assert.ok(!text.includes('Carregar mensagens anteriores'))
    assert.equal(requests.length, 2, 'apenas páginas explicitamente pedidas')
    await act(async () => root.unmount())
    root = null
    console.log(`Support pagination UI ${variant}: OK`)
  }
} finally {
  if (root) await act(async () => root.unmount())
  dom.window.close()
  delete globalThis.__supportPagination
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
  await rm(temporary, { recursive: true, force: true })
}
