import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const project = fileURLToPath(new URL('../../', import.meta.url))
await mkdir(join(project, 'node_modules/.cache'), { recursive: true })
const temporary = await mkdtemp(join(project, 'node_modules/.cache/daily-planification-'))
const fixtures = {
  'AccessGate.tsx': "export function useMAProfessorAccess(){return {session:{email:'planification@example.test'}}}",
  'db.ts': 'export const maProfessorDb = {}',
  'assessmentProfiles.ts': 'export function canRestoreStudentAssessmentDraft(){return true}',
  'ufcdCfpModel.ts': 'export function getUfcdEmissionFingerprint(){return ""}',
  'ufcdFinalGradeExcelExport.ts': 'export async function exportUfcdFinalGradeExcel(){}',
  'ufcdCfpPdfExport.ts': 'export async function exportUfcdCfpPdf(){}',
  'backupRepository.ts': 'export async function createMAProfessorBackup(){}',
  'giaeExplicitSubmissionRepository.ts': 'export const giaeExplicitSubmissionRepository={}',
  'scheduleWorkspaceRepository.ts': 'export const scheduleWorkspaceRepository={}',
  'dailyDraftStorage.ts': 'export async function readMAProfessorDailyDraft(){return null}; export async function saveMAProfessorDailyDraft(){}; export async function deleteMAProfessorDailyDraft(){}; export function shouldAutoRestoreMAProfessorDailyDraft(){return false}',
  'dailyCriteriaGridRepository.ts': 'export const dailyCriteriaGridRepository={async getLessonGrid(){return null}}; export function calculateDailyCriteriaAverage(){return null}; export function normalizeDailyCriterionScoreInput(x){return x}; export function parseDailyCriterionScore(x){return Number(x)}',
  'lessonRepository.ts': `export const lessonRepository={async getAvailablePlanificationItems(moduleId,lessonId){
    const f=globalThis.__planificationUiFixture;
    f.reads.push({moduleId,lessonId});
    if(f.loadItems) return f.loadItems(moduleId);
    return structuredClone(f.items.filter(i=>i.moduleId===moduleId&&i.status==='planned'&&!i.usedLessonId));
  }}`,
  'dailyWorkspaceRepository.ts': `export const dailyWorkspaceRepository={
    async getDateWorkspace(){return globalThis.__planificationUiFixture.workspace()},
    async saveLesson(input){const f=globalThis.__planificationUiFixture; f.saves.push(structuredClone(input));
      f.lesson={...f.lesson,...structuredClone(input),id:input.lessonId,updatedAt:'v'+(f.saves.length+1)};
      for(const item of f.items) if(input.planificationItemIds.includes(item.id)&&input.status==='taught') {item.status='used'; item.usedLessonId=input.lessonId}
      return {lesson:structuredClone(f.lesson)};
    },describeError(error){return error.message}
  }`
}
const bundle = await build({
  entryPoints: [join(project, 'src/components/ma-professor/daily/DailyWorkspaceView.tsx')],
  jsx: 'automatic', platform: 'node', format: 'cjs', bundle: true,
  write: false, packages: 'external',
  plugins: [{name:'daily-services-fixture', setup(builder) {
    builder.onLoad({filter:/\.(ts|tsx)$/}, args => {
      const content=fixtures[args.path.split('/').at(-1)]
      return content ? {loader:'js',contents:content} : undefined
    })
  }}]
})
const modulePath = join(temporary, 'view.cjs')
await writeFile(modulePath, bundle.outputFiles[0].text)
const View = createRequire(import.meta.url)(modulePath).default
test.after(() => rm(temporary, {recursive:true,force:true}))

async function setup(t, changes={}) {
  const dom = new JSDOM('<div id="root"></div>', {url:'https://example.test'})
  const originals = new Map()
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})) {
    originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key))
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})
  }
  const fixture = {
    reads:[],saves:[],
    lesson:{id:'lesson-1',academicYearId:'year-1',teachingAssignmentId:'assignment-1',moduleId:'module-1',date:'2026-09-07',startTime:'09:00',endTime:'09:50',periodCount:1,status:'planned',countTowardProgress:true,summary:'Texto existente.',plannedActivity:'',summarySource:'manual',planificationItemIds:[],notes:'',giaeStatus:'pending',scheduleSlotId:null,updatedAt:'v1'},
    items:[1,2,3].map(n=>({id:'item-'+n,moduleId:'module-1',order:n,content:'Conteúdo '+n,activity:'Atividade '+n,suggestedSummary:'Sugestão '+n,status:'planned',usedLessonId:null})),
    ...changes
  }
  fixture.workspace = () => {
    const row={lesson:structuredClone(fixture.lesson),group:{name:'10.º D'},subject:{name:'Animação',shortName:'AE'},module:{id:fixture.lesson.moduleId,name:'Módulo de teste',code:'M1'},assignment:{id:'assignment-1'}}
    return {date:fixture.lesson.date,weekStartDate:fixture.lesson.date,weekEndDate:fixture.lesson.date,previousWeekDate:null,nextWeekDate:null,weekDays:[],lessons:[row],selectedLessonId:fixture.lesson.id,selectedLesson:{context:{lessonRow:row,assignmentModules:[row.module],previousLessonTemplate:null,nextPlanificationItem:null},students:[],assessmentWorkspace:{criteria:[],assessments:[],students:[]}}}
  }
  globalThis.__planificationUiFixture=fixture
  const {createRoot}=createRequire(import.meta.url)('react-dom/client')
  const root=createRoot(document.getElementById('root'))
  const render=()=>act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(View,{academicYearId:'year-1',initialDate:fixture.lesson.date,initialLessonId:fixture.lesson.id}))))
  t.after(async()=>{
    await act(async()=>root.unmount())
    delete globalThis.__planificationUiFixture
    dom.window.close()
    for(const [key,descriptor] of originals) {
      if(descriptor) Object.defineProperty(globalThis,key,descriptor)
      else delete globalThis[key]
    }
  })
  await render()
  const group=()=>document.querySelector('[aria-label="Planificação do sumário"]')
  const editor=()=>document.querySelector('textarea[aria-label="Sumário da aula"]')
  const ghost=()=>editor().parentElement.querySelector('[aria-hidden="true"]')?.textContent ?? ''
  const button=label=>group().querySelector(`[aria-label="Item ${label} da planificação"]`)
  const add=()=>[...group().querySelectorAll('button')].find(b=>b.textContent==='Adicionar')
  const click=button=>act(async()=>button.click())
  return {fixture,dom,root,render,group,editor,ghost,button,add,click}
}

test('Today places the planification controls above the summary; navigation changes only the ghost suggestion',async t=>{
  const ui=await setup(t)
  assert.ok(ui.group().compareDocumentPosition(ui.editor()) & ui.dom.window.Node.DOCUMENT_POSITION_FOLLOWING)
  assert.equal(ui.ghost(),'Sugestão 1')
  assert.equal(ui.button('anterior').disabled,true)
  await ui.click(ui.button('seguinte'))
  assert.equal(ui.ghost(),'Sugestão 2')
  await ui.click(ui.button('anterior'))
  assert.equal(ui.ghost(),'Sugestão 1')
  assert.equal(ui.editor().value,'Texto existente.')
  assert.equal(ui.fixture.saves.length,0)
  assert.ok(ui.fixture.items.every(i=>i.status==='planned'&&!i.usedLessonId))
  assert.ok(ui.fixture.reads.every(r=>r.moduleId==='module-1'&&r.lessonId==='lesson-1'))
})

test('Adicionar appends on a new line and advances; all selected item IDs reach the explicit save together',async t=>{
  const ui=await setup(t)
  await ui.click(ui.add())
  assert.equal(ui.editor().value,'Texto existente.\nSugestão 1')
  assert.equal(ui.ghost(),'Sugestão 2')
  await ui.click(ui.add())
  assert.equal(ui.editor().value,'Texto existente.\nSugestão 1\nSugestão 2')
  assert.equal(ui.ghost(),'Sugestão 3')
  assert.equal(ui.fixture.saves.length,0)
  assert.ok(ui.fixture.items.every(i=>i.status==='planned'))
  const save=[...ui.editor().closest('section').querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar')
  await ui.click(save)
  assert.equal(ui.fixture.saves.length,1)
  assert.deepEqual(ui.fixture.saves[0].planificationItemIds,['item-1','item-2'])
  assert.equal(ui.fixture.saves[0].summary,ui.editor().value)
  assert.equal(ui.ghost(),'Sugestão 3')
})

test('adding the last suggestion does not duplicate or wrap it; skipped earlier items remain accessible',async t=>{
  const ui=await setup(t)
  await ui.click(ui.button('seguinte'))
  await ui.click(ui.button('seguinte'))
  await ui.click(ui.add())
  assert.equal(ui.ghost(),'')
  assert.equal(ui.add().disabled,true)
  await ui.click(ui.button('anterior'))
  assert.equal(ui.ghost(),'Sugestão 2')
  await ui.click(ui.add())
  assert.equal(ui.editor().value,'Texto existente.\nSugestão 3\nSugestão 2')
})

test('a module without available planification leaves the summary editable and the controls inactive',async t=>{
  const ui=await setup(t,{items:[]})
  assert.equal(ui.ghost(),'')
  assert.equal(ui.add().disabled,true)
  assert.equal(ui.button('anterior').disabled,true)
  assert.equal(ui.button('seguinte').disabled,true)
  assert.equal(ui.editor().disabled,false)
})

test('a cancelled lesson keeps the non-realization control visible and disables planification insertion',async t=>{
  const ui=await setup(t)
  ui.fixture.lesson={...ui.fixture.lesson,id:'cancelled-lesson',status:'cancelled'}
  await ui.render()
  assert.equal(ui.ghost(),'')
  assert.equal(ui.editor().disabled,true)
  assert.equal(ui.add().disabled,true)
  assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent==='Voltar a planeada'))
})

test('a late response from a previous lesson cannot show or insert an item from another module',async t=>{
  const pending=[]
  const ui=await setup(t,{loadItems:moduleId=>new Promise(resolve=>pending.push({moduleId,resolve}))})
  assert.equal(ui.add().disabled,true)
  ui.fixture.lesson={...ui.fixture.lesson,id:'lesson-2',moduleId:'module-2'}
  await ui.render()
  await act(async()=>{
    for(const request of pending.filter(r=>r.moduleId==='module-2')) request.resolve([{id:'other-item',moduleId:'module-2',content:'Outra UFCD',suggestedSummary:'Sugestão da outra UFCD',activity:'',status:'planned',usedLessonId:null}])
  })
  assert.equal(ui.ghost(),'Sugestão da outra UFCD')
  await act(async()=>{
    for(const request of pending.filter(r=>r.moduleId==='module-1')) request.resolve(ui.fixture.items)
  })
  assert.equal(ui.ghost(),'Sugestão da outra UFCD')
  await ui.click(ui.add())
  assert.equal(ui.editor().value,'Texto existente.\nSugestão da outra UFCD')
  assert.equal(ui.fixture.saves.length,0)
})
