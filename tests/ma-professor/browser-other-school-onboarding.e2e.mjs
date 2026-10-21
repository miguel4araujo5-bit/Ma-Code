import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = 4178
const BASE_URL = `http://${HOST}:${PORT}`
const FIXED_NOW = '2026-09-13T19:30:00+01:00'

const root = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

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


const server = startVite()
let browser
const errors = []
const blocked = []
const owner = 'calendar-trial@example.test'
const host = `<!doctype html><html><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
</script><script type="module" src="/@vite/client"></script><script type="module">
</script><script type="module" src="/tests/ma-professor/fixtures/other-school-host.tsx"></script></body></html>`
async function saved(page, email = owner) {
  return page.evaluate(async email => {
    const m = await import('/src/components/ma-professor/setup/otherSchoolScheduleDraftStorage.ts')
    const year = await window.__trialDb.academicYears.toArray()
    return m.readOtherSchoolScheduleDraft({ accountEmail: email, academicYearId: year[0].id })
  }, email)
}
try {
  await waitForVite(server)
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}) })
  const context = await browser.newContext({ locale: 'pt-PT', timezoneId: 'Europe/Lisbon', viewport: {width: 1500, height: 1000} })
  await context.addInitScript(() => {
    if (!localStorage.getItem('ma-professor-access-v1')) localStorage.setItem('ma-professor-access-v1', JSON.stringify({email:'calendar-trial@example.test', token:'fictitious-local-only', deviceId:'isolated-test', license:null}))
  })
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== BASE_URL || url.pathname.startsWith('/api/')) { blocked.push(url.origin + url.pathname); return route.abort() }
    if (url.pathname === '/__other-school') return route.fulfill({contentType:'text/html', body:host})
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(15000)
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'))
  await page.goto(`${BASE_URL}/__other-school`)
  await page.getByText('Indicar outra escola →', {exact:true}).click()
  await page.getByLabel('Escola ou agrupamento', {exact:true}).fill('Escola Profissional Fictícia')
  await page.getByRole('button', {name:'Continuar', exact:true}).click()
  await page.getByRole('button', {name:'Criar ano letivo e continuar', exact:true}).click()
  await page.getByRole('heading', {name:'Reveja o calendário da sua escola', exact:true}).waitFor()
  assert.equal(await page.getByText('Selecionar horário em PDF', {exact:true}).count(), 0)
  await page.getByRole('button', {name:'Acrescentar feriado', exact:true}).click()
  await page.getByLabel('Designação 17', {exact:true}).fill('Feriado municipal fictício')
  await page.getByLabel('Início 17', {exact:true}).fill('2027-03-19')
  await page.getByLabel('Fim 17', {exact:true}).fill('2027-03-19')
  await page.getByRole('button', {name:'Confirmar calendário e continuar', exact:true}).click()
  await page.getByText('Selecionar horário em PDF', {exact:true}).waitFor()
  assert.equal(await page.evaluate(() => window.__trialDb.schoolCalendarEvents.count()), 17)
  await page.reload()
  await page.getByText('Selecionar horário em PDF', {exact:true}).waitFor()
  assert.equal(await page.evaluate(() => window.__trialDb.schoolCalendarEvents.count()), 17)
  await page.getByRole('button', {name:'Continuar sem PDF', exact:true}).click()
  await page.getByRole('heading', {name:'Preencha o horário da sua escola', exact:true}).waitFor()
  await page.getByRole('button', {name:'Continuar para as disciplinas', exact:true}).waitFor()
  console.log('PASS calendar first, local holiday, reload and manual starts with groups')
  // Return to the import without changing the isolated data.
  await page.reload()
  await page.getByText('Selecionar horário em PDF', {exact:true}).waitFor()
  const { PDFDocument, StandardFonts } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const sheet = pdf.addPage([840, 600])
  const draw = (text,x,y) => sheet.drawText(text,{x,y,size:11,font})
  draw('Escola Profissional Ficticia - Horario de ensaio',30,560)
  ;['Segunda-feira','Terca-feira','Quarta-feira','Quinta-feira','Sexta-feira'].forEach((text,i) => draw(text,190+i*125,510))
  draw('09:00 - 09:50',30,455); draw('PORT 10.º A',190,455); draw('10.º B',315,455)
  draw('10:00 - 10:50',30,395); draw('PORT 10.º A',440,395)
  draw('Atividades do professor',30,330); draw('PORT - Portugues',30,310)
  const payload = {name:'fictional-schedule.pdf', mimeType:'application/pdf', buffer:Buffer.from(await pdf.save())}
  const scanned = await PDFDocument.create()
  scanned.addPage([600, 800])
  await page.locator('input[type=file]').first().setInputFiles({name:'scanned.pdf', mimeType:'application/pdf', buffer:Buffer.from(await scanned.save())})
  await page.getByText('Reveja o horário de scanned.pdf', {exact:true}).waitFor()
  await page.getByText('Rascunho guardado neste dispositivo.', {exact:true}).waitFor()
  assert.equal((await saved(page)).state.drafts.length, 0)
  assert.equal(await page.evaluate(() => window.__trialDb.weeklyScheduleSlots.count()), 0)
  assert.equal(await page.getByText(/Este PDF não contém texto selecionável/).count(), 0)
  await page.getByText('Escolher outro PDF',{exact:true}).locator('input').setInputFiles(payload)
  await page.getByRole('button',{name:'Cancelar',exact:true}).click()
  await page.getByText('Reveja o horário de scanned.pdf', {exact:true}).waitFor()
  await page.getByText('Escolher outro PDF',{exact:true}).locator('input').setInputFiles(payload)
  await page.getByRole('button',{name:'Sim',exact:true}).click()
  console.log('PASS scanned PDF continues into empty editable review; Cancel preserves it and Sim replaces it')
  await page.getByText('Reveja o horário de fictional-schedule.pdf', {exact:true}).waitFor()
  await page.getByText('Rascunho guardado neste dispositivo.', {exact:true}).waitFor()
  // Continue with real grid editing, persistence and the confirmation boundary.
  await runReview(page, context, payload)
  assert.deepEqual(errors, [])
  assert.deepEqual(blocked, [])
  console.log('PASS zero external/API calls and no page errors')
} catch(error) {
  console.error(error, errors, blocked)
  if (browser) for (const context of browser.contexts()) for (const page of context.pages()) console.error((await page.locator('body').innerText()).slice(-8000))
  process.exitCode = 1
} finally {
  await browser?.close()
  await stopVite(server.child)
}

async function runReview(p,c,payload) {
 for(let i=1;i<=3;i++) {
  await p.locator(`[data-schedule-block="pdf-unresolved-${i}"]`).getByRole('button',{name:'Componente letiva',exact:true}).click();
  await p.getByLabel('Turma',{exact:true}).fill(i===2?'10.º B':'10.º A');
  await p.getByLabel('Disciplina',{exact:true}).fill('PORT');
  await p.getByRole('button',{name:'Confirmar como disciplina',exact:true}).click();
 }
 await p.getByText('Rascunho guardado neste dispositivo.',{exact:true}).waitFor();
 assert.equal((await saved(p)).state.drafts.length,3);
 // Correct only one cell first.
 await p.locator('[data-schedule-block]').first().locator('button[aria-expanded]').click();
 await p.getByLabel('Disciplina',{exact:true}).fill('Português');
 await p.getByLabel('Curso',{exact:true}).click();
 await p.getByRole('button',{name:'Só esta célula',exact:true}).click();
 await p.getByText('Rascunho guardado neste dispositivo.',{exact:true}).waitFor();
 let state=(await saved(p)).state;assert.equal(state.drafts.filter(x=>x.subjectName==='Português').length,1);assert.equal(state.drafts.filter(x=>x.subjectName==='PORT').length,2);
 // Correct the other matching abbreviation with explicit propagation.
 await p.locator(`[data-schedule-block="${state.drafts.find(x=>x.subjectName==='PORT').id}"]`).locator('button[aria-expanded]').click();
 await p.getByLabel('Disciplina',{exact:true}).fill('Português');
 await p.getByLabel('Curso',{exact:true}).click();
 await p.getByRole('button',{name:'Todas com esta sigla neste horário',exact:true}).click();
 await p.getByText('Rascunho guardado neste dispositivo.',{exact:true}).waitFor();
 state=(await saved(p)).state;assert.ok(state.drafts.every(x=>x.subjectName==='Português'));
 // Switching mobile views and cancelling a replacement keeps every correction.
 await p.setViewportSize({width:390,height:844});
 await p.getByRole('button',{name:'Ver PDF original',exact:true}).click();
 await p.locator('object').waitFor({state:'visible'});
 await p.getByRole('button',{name:'Voltar à grelha',exact:true}).click();
 await p.getByText('Rascunho guardado neste dispositivo.',{exact:true}).waitFor();
 const beforeReplacement=(await saved(p)).state;
 await p.getByText('Escolher outro PDF',{exact:true}).locator('input').setInputFiles({...payload,name:'replacement.pdf'});
 await p.getByRole('dialog',{name:'Substituir a revisão atual'}).waitFor();
 await p.getByRole('button',{name:'Cancelar',exact:true}).click();
 assert.deepEqual((await saved(p)).state,beforeReplacement);
 await p.setViewportSize({width:1500,height:1000});
 await p.reload();
 await p.getByText('Reveja o horário de fictional-schedule.pdf' ,{exact:true}).waitFor();
 await p.getByText('Rascunho guardado neste dispositivo.',{exact:true}).waitFor();
 assert.match(await p.locator('object').getAttribute('data'),/^blob:/);
 state=(await saved(p)).state;assert.equal(state.drafts.length,3);assert.ok(state.drafts.every(x=>x.subjectName==='Português'));
 assert.equal(await p.evaluate(()=>window.__trialDb.weeklyScheduleSlots.count()),0);
 console.log('PASS one/all abbreviation choice + corrected draft/PDF reload + definitive timetable unchanged');
 await p.evaluate(()=>{const a=JSON.parse(localStorage.getItem('ma-professor-access-v1'));a.email='second-trial@example.test';localStorage.setItem('ma-professor-access-v1',JSON.stringify(a))});
 await p.reload();await p.getByText('Selecionar horário em PDF',{exact:true}).waitFor();assert.equal(await saved(p,'second-trial@example.test'),null);
 await p.evaluate(()=>{const a=JSON.parse(localStorage.getItem('ma-professor-access-v1'));a.email='calendar-trial@example.test';localStorage.setItem('ma-professor-access-v1',JSON.stringify(a))});
 await p.reload();await p.getByText('Reveja o horário de fictional-schedule.pdf',{exact:true}).waitFor();
 console.log('PASS different-account isolation and original-account resume');
 for(let i=0;i<3;i++){
  state=(await saved(p)).state;const pending=state.drafts.find(x=>!x.subjectConfirmed);if(!pending)break;
  await p.locator(`[data-schedule-block="${pending.id}"]`).locator('button[aria-expanded]').click();
  await p.getByRole('button',{name:'Confirmar como disciplina',exact:true}).click();
  await p.getByText('Rascunho guardado neste dispositivo.',{exact:true}).waitFor();
 }
 await p.getByRole('button',{name:'Confirmar 3 blocos',exact:true}).click();
 await p.getByText('Agora já conhecemos a estrutura do seu horário.',{exact:true}).waitFor();
 assert.equal(await p.evaluate(()=>window.__trialDb.weeklyScheduleSlots.count()),3);
 assert.equal(await saved(p),null);
 await p.reload();await p.getByText('Agora já conhecemos a estrutura do seu horário.',{exact:true}).waitFor();assert.equal(await p.evaluate(()=>window.__trialDb.weeklyScheduleSlots.count()),3);
 console.log('PASS whole confirmation -> 3 saved slots, draft removed, reload persists exactly 3');
}
