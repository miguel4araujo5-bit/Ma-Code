import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as ts from 'typescript'

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })
  const errors = (output.diagnostics || []).filter(
    item => item.category === ts.DiagnosticCategory.Error
  )
  assert.equal(errors.length, 0)
  return `data:text/javascript;base64,${Buffer.from(output.outputText).toString('base64')}`
}

const assessmentUrl = transpile(`
  const s=()=>globalThis.__dailyState; const c=structuredClone;
  export const assessmentRepository={
    async getLessonAssessmentWorkspace(){return {assessments:c(s().assessments),criteria:c(s().criteria),students:c(s().students)}},
    async getAssessmentRegister(id){const r=s().results[id]||{};return {rows:s().students.map(student=>({student:c(student),result:r[student.id]?c(r[student.id]):null}))}},
    async createLessonAssessment(input){const x=s();x.nextAssessment+=1;const assessment={id:'assessment-'+x.nextAssessment,...c(input),updatedAt:'a1'};const criterion=x.criteria.find(v=>v.id===input.criterionId);x.assessments.push({assessment,criterion:c(criterion)});return c(assessment)},
    async updateLessonAssessment(id,changes){const item=s().assessments.find(v=>v.assessment.id===id);item.assessment={...item.assessment,...c(changes),updatedAt:'a2'};item.criterion=c(s().criteria.find(v=>v.id===item.assessment.criterionId));return c(item.assessment)},
    async saveAssessmentResults(id,entries){s().results[id]=Object.fromEntries(entries.map(v=>[v.studentId,{...c(v),assessmentId:id}]))},
    async deleteLessonAssessment(id){const x=s();x.assessments=x.assessments.filter(v=>v.assessment.id!==id);delete x.results[id]}
  };
`)

const assessmentWorkspaceUrl = transpile(`
  export const assessmentWorkspaceRepository={async getWorkspace(){return {studentRows:globalThis.__dailyState.students.map(student=>({student:structuredClone(student),gradeSummary:{provisionalAverage:null}}))}}};
`)

const attendanceUrl = transpile(`
  const s=()=>globalThis.__dailyState; const c=structuredClone;
  export const attendanceRepository={
    async getLessonAttendanceRegister(lessonId){return {lessonId,rows:s().students.map(student=>{const e=s().attendance[student.id];return {student:c(student),attendance:e?c(e):null,effectiveStatus:e?.status||'present',effectiveCode:e?.code||'',effectiveNote:e?.note||''}})}},
    async saveLessonAttendance(lessonId,entries){s().attendance=Object.fromEntries(entries.map(v=>[v.studentId,{...c(v),lessonId}]))},
    async listModuleAbsenceSummaries(){return []}
  };
`)

const lessonUrl = transpile(`
  const s=()=>globalThis.__dailyState; const c=structuredClone;
  function tick(){s().version+=1;return 'v'+s().version}
  export const lessonRepository={
    async getLesson(id){return s().lesson.id===id?c(s().lesson):null},
    async updateLesson(id,changes){s().lesson={...s().lesson,...c(changes),updatedAt:tick()};return c(s().lesson)},
    async markGIAESubmitted(){s().lesson={...s().lesson,giaeStatus:'submitted',updatedAt:tick()};return c(s().lesson)},
    async markGIAEPending(){s().lesson={...s().lesson,giaeStatus:'pending',updatedAt:tick()};return c(s().lesson)}
  };
`)

const temporalSafetyUrl = transpile(`
  export function isFutureLessonDate(){return false}
  export function resolveLessonStatusForDate(_date,status){return status}
`)

const calendarUrl = transpile(`
  export const calendarWorkspaceRepository={
    async getLessonEditorContext(){const x=globalThis.__dailyState;return {lessonRow:{lesson:structuredClone(x.lesson),assignment:{id:'assignment-1'},module:{id:'module-1',code:'M1',name:'Módulo 1'},group:{id:'group-1',name:'10.º D'},subject:{id:'subject-1',name:'Animação',shortName:'AE'}}}},
    async getWorkspace(){throw new Error('Calendário fora deste teste.')}
  };
`)

const dbUrl = transpile(`
  const s=()=>globalThis.__dailyState; const c=structuredClone;
  const listWhere=(read,key)=>({where(field){return {equals(value){return {async toArray(){return c(read().filter(item=>item[field]===value))}}}}}});
  export const maProfessorDb={
    tables:[],
    lessons:{async get(id){const x=s();return x.lesson.id===id?c(x.lesson):null}},
    weeklyScheduleSlots:{where(){return {equals(){return {async toArray(){return c(s().scheduleSlots||[])}}}}}},
    lessonAttendance:listWhere(()=>Object.values(s().attendance),'lessonId'),
    lessonAssessments:{
      async get(id){const item=s().assessments.find(v=>v.assessment.id===id);return item?c(item.assessment):undefined},
      ...listWhere(()=>s().assessments.map(v=>v.assessment),'lessonId')
    },
    assessmentResults:listWhere(()=>Object.values(s().results).flatMap(group=>Object.values(group)),'assessmentId'),
    async transaction(_m,_t,callback){s().transactions+=1;return callback()}
  };
`)

const source = await readFile(
  new URL('../../src/components/ma-professor/daily/dailyWorkspaceRepository.ts', import.meta.url),
  'utf8'
)

const runtime = source
  .replaceAll("'../assessments/assessmentRepository'", `'${assessmentUrl}'`)
  .replaceAll("'../assessments/assessmentWorkspaceRepository'", `'${assessmentWorkspaceUrl}'`)
  .replaceAll("'../attendance/attendanceRepository'", `'${attendanceUrl}'`)
  .replaceAll("'../calendar/calendarWorkspaceRepository'", `'${calendarUrl}'`)
  .replaceAll("'../lessons/lessonRepository'", `'${lessonUrl}'`)
  .replaceAll("'../lessons/lessonTemporalSafety'", `'${temporalSafetyUrl}'`)
  .replaceAll("'../db'", `'${dbUrl}'`)

const module = await import(transpile(runtime))
export const DailyWorkspaceRepository = module.DailyWorkspaceRepository

export function resetDailyState() {
  globalThis.__dailyState = {
    version: 1,
    transactions: 0,
    nextAssessment: 0,
    lesson: {id:'lesson-1',academicYearId:'year-1',teachingAssignmentId:'assignment-1',date:'2026-09-07',origin:'extra',scheduleSlotId:null,status:'planned',startTime:'09:00',endTime:'10:00',periodCount:1,countTowardProgress:true,plannedActivity:'',summary:'',summarySource:'manual',planificationItemIds:[],notes:'',giaeStatus:'pending',updatedAt:'v1'},
    scheduleSlots: [],
    students: [{id:'student-1',groupId:'group-1',number:1,name:'Ana'},{id:'student-2',groupId:'group-1',number:2,name:'Bruno'}],
    criteria: [{id:'criterion-1',name:'Desempenho'}],
    attendance: {},
    assessments: [],
    results: {}
  }
  return globalThis.__dailyState
}

export function studentDrafts({brunoAbsent=false,anaScore=null,assessment=false}={}) {
  return [
    {studentId:'student-1',attendanceStatus:'present',attendanceCode:'',attendanceNote:'',assessmentStatus:assessment&&anaScore!==null?'evaluated':'not_evaluated',assessmentScore:anaScore,assessmentNote:assessment&&anaScore!==null?'Bom desempenho.':''},
    {studentId:'student-2',attendanceStatus:brunoAbsent?'absent':'present',attendanceCode:brunoAbsent?'F':'',attendanceNote:brunoAbsent?'Falta registada.':'',assessmentStatus:assessment&&brunoAbsent?'absent':'not_evaluated',assessmentScore:null,assessmentNote:''}
  ]
}

export function lessonDraft({summary='Exploração dos conteúdos da aula.',students=studentDrafts(),assessment=null}={}) {
  return {lessonId:'lesson-1',status:'taught',startTime:'09:00',endTime:'10:00',periodCount:1,countTowardProgress:true,plannedActivity:'Atividade prevista.',summary,summarySource:'manual',planificationItemIds:[],notes:'Nota pedagógica.',giaeStatus:'pending',students,assessment:assessment||{mode:'none',assessmentId:null,criterionId:'criterion-1',title:'',activityType:'practical_work',description:''}}
}

export function loadLesson(repository) {
  return repository.getLessonWorkspace('year-1','lesson-1')
}
