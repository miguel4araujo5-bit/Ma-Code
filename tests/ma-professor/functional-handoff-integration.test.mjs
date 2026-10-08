import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { mkdir, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { unzipSync, strFromU8 } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import 'fake-indexeddb/auto'
globalThis.window = { indexedDB: globalThis.indexedDB }

// Exercise real repositories and IndexedDB transactions, not mocked persistence.
await mkdir(resolve('node_modules/.tmp'), { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.tmp/handoff-'))
const bundled = resolve(temp, 'runtime.mjs')
await build({ stdin: { contents: `
export * from './src/components/ma-professor/db'
export * from './src/components/ma-professor/lessons/ufcdProgress'
export * from './src/components/ma-professor/lessons/ufcdProgressRepository'
export * from './src/components/ma-professor/lessons/ufcdCompletionProjection'
export * from './src/components/ma-professor/lessons/scheduledLessonReconciliation'
export * from './src/components/ma-professor/lessons/lessonRepository'
export * from './src/components/ma-professor/calendar/extraLessonRepository'
export * from './src/components/ma-professor/attendance/attendanceRepository'
export * from './src/components/ma-professor/attendance/attendancePeriodMetrics'
export * from './src/components/ma-professor/assessments/assessmentWorkspaceRepository'
export * from './src/components/ma-professor/assessments/ufcdCfpModel'
export * from './src/components/ma-professor/assessments/ufcdFinalGradeExcelExport'
export * from './src/components/ma-professor/assessments/ufcdCfpPdfExport'
export * from './src/components/ma-professor/groups/groupsWorkspaceRepository'
export * from './src/components/ma-professor/repository'
export * from './src/components/ma-professor/settings/backupRepository'
export * from './src/components/ma-professor/daily/dailyDraftStorage'
`, resolveDir: process.cwd(), loader: 'ts' }, bundle:true, platform:'node', format:'esm', packages:'external', outfile:bundled })
const api = await import(pathToFileURL(bundled).href)
const db=api.maProfessorDb
const stamp='2026-09-01T08:00:00.000Z'
const audit={createdAt:stamp,updatedAt:stamp}
const year={...audit,id:'y',name:'2026/2027',startDate:'2026-09-01',endDate:'2027-07-31',active:true}
const group={...audit,id:'g',academicYearId:'y',name:'10 D',courseName:'TAP',gradeLevel:'10',educationType:'professional',active:true}
const subject={...audit,id:'s',academicYearId:'y',name:'Expressões',shortName:'AE',active:true}
const assignment={...audit,id:'a',academicYearId:'y',groupId:'g',subjectId:'s',displayName:'AE',active:true}
const module=(id='b',order=1,plannedPeriods=30)=>({...audit,id,academicYearId:'y',teachingAssignmentId:'a',code:id,name:id,order,plannedPeriods,plannedStartDate:null,plannedEndDate:null,active:true})
const student=(id='one',number='1')=>({...audit,id,academicYearId:'y',groupId:'g',number,name:id,active:true,notes:'',membershipPeriods:[{startDate:'2026-09-01',endDate:null}]})
const lesson=(id,extras={})=>({...audit,id,academicYearId:'y',teachingAssignmentId:'a',moduleId:'b',scheduleSlotId:null,origin:'extra',status:'taught',date:'2026-09-14',startTime:'09:00',endTime:'09:50',periodCount:1,countTowardProgress:true,plannedActivity:'',summary:'Sumário',summarySource:'manual',planificationItemIds:[],giaeStatus:'submitted',giaeSubmittedAt:stamp,notes:'',...extras})
const absence=(id,lessonId,studentId='one')=>({...audit,id,lessonId,studentId,status:'absent',code:'F',note:''})
const recoveryInput={academicYearId:'y',teachingAssignmentId:'a',moduleId:'b',studentId:'one'}
async function seedAssessments() {
 await db.assessmentSchemes.put({...audit,id:'scheme',academicYearId:'y',teachingAssignmentId:'a',moduleId:null,scope:'subject',name:'Critérios',active:true})
 await db.assessmentCriteria.put({...audit,id:'criterion',schemeId:'scheme',name:'Desempenho',weightPercent:100,order:1,active:true})
 await db.lessonAssessments.put({...audit,id:'assess',academicYearId:'y',lessonId:'l',teachingAssignmentId:'a',moduleId:'b',criterionId:'criterion',title:'Atividade',activityType:'practical_work',description:'',absentScore:0,exemptScore:0})
 await db.assessmentResults.put({...audit,id:'result',assessmentId:'assess',studentId:'one',status:'evaluated',score:15,note:''})
}
beforeEach(async()=>{
 await db.open()
 await db.transaction('rw',db.tables,async()=>{for(const table of db.tables) await table.clear()})
 await db.academicYears.put(year);await db.groups.put(group);await db.subjects.put(subject);await db.teachingAssignments.put(assignment)
 await db.modules.bulkPut([module(),module('c',2),module('d',3,60)])
 await db.students.bulkPut([student(),student('two','2')]);await api.ensureDefaultMAProfessorSettings()
})
after(async()=>{db.close(); await rm(temp,{recursive:true,force:true})})

test('only submitted lessons affect progress, attendance and assessment; unticking preserves evidence',async()=>{
 await db.lessons.put(lesson('l'));await db.lessonAttendance.put(absence('f','l'));await seedAssessments()
 let snapshot=await api.assessmentWorkspaceRepository.getWorkspace('y',{teachingAssignmentId:'a',moduleId:'b'})
 assert.equal(snapshot.studentRows[0].gradeSummary.provisionalAverage,15)
 assert.equal((await api.attendanceRepository.getStudentModuleAbsenceSummary('b','one')).annualAbsencePeriods,1)
 await api.lessonRepository.markGIAEPendingExplicit('l',stamp)
 const pending=await db.lessons.get('l')
 assert.equal(api.lessonCountsTowardUfcdProgress(pending),false)
 assert.equal((await api.attendanceRepository.getStudentModuleAbsenceSummary('b','one')).annualAbsencePeriods,0)
 snapshot=await api.assessmentWorkspaceRepository.getWorkspace('y',{teachingAssignmentId:'a',moduleId:'b'})
 assert.equal(snapshot.studentRows[0].gradeSummary.provisionalAverage,null)
 assert.equal(await db.assessmentResults.count(),1); assert.equal((await db.lessonAttendance.get('f')).status,'absent')
 await api.lessonRepository.markGIAESubmittedExplicit('l',pending.updatedAt)
 assert.equal((await api.assessmentWorkspaceRepository.getWorkspace('y',{moduleId:'b',teachingAssignmentId:'a'})).studentRows[0].gradeSummary.provisionalAverage,15)
})

test('numbering follows submission chronology, and early C periods do not displace unfinished B',()=>{
 const lessons=[lesson('1'),lesson('2',{moduleId:'c',date:'2026-09-15'}),lesson('3',{date:'2026-09-16'})]
 let progress=api.buildUfcdModuleProgress([module(),module('c',2)],lessons)
 assert.equal(api.selectCurrentUfcd([module(),module('c',2)],progress).id,'b')
 assert.equal(progress[1].periodsRemaining,29)
 assert.equal(api.getLessonNumbering(lessons[2],lessons).lessonNumber,'3')
 lessons[0].giaeStatus='pending'
 assert.equal(api.getLessonNumbering(lessons[0],lessons).lessonNumber,null)
 assert.equal(api.getLessonNumbering(lessons[2],lessons).lessonNumber,'2')
 assert.equal(api.getLessonNumbering(lessons[2],lessons).hasUnsubmittedLessons,true)
})

test('projection allocates cumulative periods even when one cell crosses a module boundary',()=>{
 const modules=[module('b',1,30),module('c',2,60),module('d',3,30)]
 const futureLessons=Array.from({length:70},(_,i)=>({date:new Date(Date.UTC(2026,9,3+i)).toISOString().slice(0,10),startTime:'09:00',periodCount:2}))
 const result=api.projectSequentialUfcdCompletionDates({modules,progress:[],actualCompletionDateByModuleId:new Map(),futureLessons})
 assert.deepEqual(result.modules.map(row=>row.estimatedCompletionDate),[futureLessons[14].date,futureLessons[44].date,futureLessons[59].date])
 const split=api.projectSequentialUfcdCompletionDates({modules:[module('b',1,1),module('c',2,1)],progress:[],actualCompletionDateByModuleId:new Map(),futureLessons:[futureLessons[0]]})
 assert.deepEqual(split.modules.map(row=>row.estimatedCompletionDate),[futureLessons[0].date,futureLessons[0].date])
})

test('projection continues beyond timetable/year, respects blocked dates, and adds no persisted lessons',async()=>{
 const today=api.todayISO()
 await db.academicYears.update('y',{startDate:'2026-01-01',endDate:today})
 await db.weeklyScheduleSlots.put({...audit,id:'slot',academicYearId:'y',teachingAssignmentId:'a',weekday:1,startTime:'09:00',endTime:'09:50',periodCount:1,validFrom:'2026-01-01',validUntil:today,active:true})
 const projection=await api.ufcdProgressRepository.getAssignmentCompletionProjection('a')
 assert.ok(projection.disciplineCompletionDate>today)
 assert.equal(await db.lessons.count(),0)
 const firstCompletion=projection.modules[0].estimatedCompletionDate
 await db.schoolCalendarEvents.put({...audit,id:'blocked',academicYearId:'y',title:'Interrupção',description:'',type:'school_break',scope:'all',groupId:null,teachingAssignmentId:null,startDate:firstCompletion,endDate:firstCompletion,blocksLessons:true})
 const later=await api.ufcdProgressRepository.getAssignmentCompletionProjection('a')
 assert.ok(later.modules[0].estimatedCompletionDate>firstCompletion)
})

test('discipline threshold distinguishes two periods remaining, exact ten percent and excess',()=>{
 const level=(absencePeriods)=>api.getAttendanceWarningLevel({plannedPeriods:120,absencePeriods,nextLessonPeriods:1,warningPercent:8,recoveryThresholdPercent:10})
 assert.deepEqual([9,10,11,12,13].map(level),['regular','warning','warning','limit_reached','recovery_required'])
 assert.equal(api.getAttendanceWarningLevel({plannedPeriods:99,absencePeriods:10,nextLessonPeriods:1,warningPercent:8,recoveryThresholdPercent:10}),'recovery_required')
})

test('recovery requires date, grade and explicit valid selection; commits removal and final grade atomically',async()=>{
 await db.lessons.bulkPut([lesson('l'),lesson('l2',{date:'2026-09-15'})]);await db.lessonAttendance.bulkPut([absence('f','l'),absence('f2','l2'),absence('other','l','two')])
 await seedAssessments()
 const rec=await api.attendanceRepository.createLearningRecovery(recoveryInput)
 assert.equal((await db.lessonAttendance.get('f')).status,'absent')
 assert.equal((await api.assessmentWorkspaceRepository.getWorkspace('y',{moduleId:'b',teachingAssignmentId:'a'})).studentRows[0].gradeSummary.confirmedFinalGrade,null)
 await assert.rejects(api.attendanceRepository.updateLearningRecovery(rec.id,{status:'completed'}))
 await assert.rejects(api.attendanceRepository.updateLearningRecovery(rec.id,{status:'completed',recoveryDate:'2026-10-02',recoveryGrade:16,selectedAbsenceIds:['other']}))
 assert.equal((await db.lessonAttendance.get('f')).status,'absent');assert.equal((await db.learningRecoveries.get(rec.id)).status,'pending')
 const completed=await api.attendanceRepository.updateLearningRecovery(rec.id,{status:'completed',recoveryDate:'2026-10-02',recoveryGrade:16,selectedAbsenceIds:['f']})
 assert.equal(completed.removedAbsences[0].date,'2026-09-14')
 assert.equal((await db.lessonAttendance.get('f')).status,'present');assert.equal((await db.lessonAttendance.get('f2')).status,'absent');assert.equal((await db.lessonAttendance.get('other')).status,'absent')
 assert.equal(await db.assessmentResults.count(),1)
 const snapshot=await api.assessmentWorkspaceRepository.getWorkspace('y',{moduleId:'b',teachingAssignmentId:'a'})
 assert.equal(snapshot.studentRows[0].gradeSummary.confirmedFinalGrade,16)
 const individual={...snapshot,recoveryEmission:{date:completed.recoveryDate},studentRows:snapshot.studentRows.filter(row=>row.student.id==='one')}
 const model=api.buildUfcdCfpModel(individual);assert.equal(model.rows.length,1);assert.match(model.moduleLabel,/Recuperação de assiduidade/)
 await db.lessonAttendance.update('f',{status:'absent',updatedAt:'2026-10-03T12:00:00Z'})
 assert.equal((await api.attendanceRepository.listRecoverableAbsences('a','one')).length,2)
 db.close();await db.open();assert.equal((await db.learningRecoveries.get(rec.id)).recoveryGrade,16)
})

test('manual recovery without absences accepts date/grade but invents no school records',async()=>{
 const completed=await api.attendanceRepository.createLearningRecovery({...recoveryInput,status:'completed',recoveryDate:'2026-10-02',recoveryGrade:14})
 assert.equal(completed.status,'completed');assert.deepEqual(completed.removedAbsences,[])
 assert.equal(await db.lessonAttendance.count(),0);assert.equal(await db.assessmentResults.count(),0)
 assert.equal((await api.assessmentWorkspaceRepository.getWorkspace('y',{teachingAssignmentId:'a',moduleId:'b'})).studentRows[0].gradeSummary.confirmedFinalGrade,14)
})

test('two consecutive one-period cells advance to the next UFCD immediately at the boundary',()=>{
 const slots=[
  {...audit,id:'slot-1',academicYearId:'y',teachingAssignmentId:'a',weekday:1,startTime:'09:00',endTime:'09:50',periodCount:1,validFrom:'2026-09-01',validUntil:'2027-07-31',active:true},
  {...audit,id:'slot-2',academicYearId:'y',teachingAssignmentId:'a',weekday:1,startTime:'10:00',endTime:'10:50',periodCount:1,validFrom:'2026-09-01',validUntil:'2027-07-31',active:true}
 ]
 const result=api.planScheduledLessonReconciliation({academicYear:year,assignments:[assignment],slots,modules:[module('b',1,1),module('c',2,1)],events:[],lessons:[],relatedLessonIds:new Set(),dateFrom:'2026-09-14',dateTo:'2026-09-14'})
 assert.deepEqual(result.createLessons.map(row=>row.moduleId),['b','c'])
})

test('from-here permutation swaps the recurring cells atomically from the selected week',async()=>{
 const slotA={...audit,id:'slot-a',academicYearId:'y',teachingAssignmentId:'a',weekday:1,startTime:'09:00',endTime:'09:50',periodCount:1,validFrom:'2026-09-01',validUntil:'2027-07-31',active:true}
 const slotB={...audit,id:'slot-b',academicYearId:'y',teachingAssignmentId:'a',weekday:2,startTime:'10:00',endTime:'10:50',periodCount:1,validFrom:'2026-09-01',validUntil:'2027-07-31',active:true}
 await db.weeklyScheduleSlots.bulkPut([slotA,slotB])
 await db.lessons.bulkPut([
  lesson('p1',{origin:'scheduled',scheduleSlotId:'slot-a',date:'2026-09-14',startTime:'09:00',endTime:'09:50',summary:'Sumário preservado',plannedActivity:'Atividade preservada',notes:'Nota preservada',planificationItemIds:['plan-1'],status:'planned',giaeStatus:'pending',giaeSubmittedAt:null}),
  lesson('p2',{origin:'scheduled',scheduleSlotId:'slot-a',date:'2026-09-21',startTime:'09:00',endTime:'09:50',summary:'',status:'planned',giaeStatus:'pending',giaeSubmittedAt:null}),
  lesson('s1',{origin:'scheduled',scheduleSlotId:'slot-b',date:'2026-09-15',startTime:'10:00',endTime:'10:50',summary:'',status:'planned',giaeStatus:'pending',giaeSubmittedAt:null}),
  lesson('s2',{origin:'scheduled',scheduleSlotId:'slot-b',date:'2026-09-22',startTime:'10:00',endTime:'10:50',summary:'',status:'planned',giaeStatus:'pending',giaeSubmittedAt:null})
 ])
 await db.lessonAttendance.put(absence('p1-f','p1'))
 await db.lessonAssessments.put({...audit,id:'p1-assess',academicYearId:'y',lessonId:'p1',teachingAssignmentId:'a',moduleId:'b',criterionId:'criterion-preserved',title:'Avaliação preservada',activityType:'practical_work',description:'',absentScore:0,exemptScore:0})
 await api.lessonRepository.moveLessonWithScope('p1',{date:'2026-09-15',startTime:'10:00',endTime:'10:50'},stamp,'from_here',{id:'s1',updatedAt:stamp})
 assert.deepEqual([(await db.lessons.get('p1')).date,(await db.lessons.get('p2')).date],['2026-09-15','2026-09-22'])
 assert.deepEqual([(await db.lessons.get('s1')).date,(await db.lessons.get('s2')).date],['2026-09-14','2026-09-21'])
 const preserved=await db.lessons.get('p1')
 assert.equal(preserved.summary,'Sumário preservado')
 assert.equal(preserved.plannedActivity,'Atividade preservada')
 assert.equal(preserved.notes,'Nota preservada')
 assert.deepEqual(preserved.planificationItemIds,['plan-1'])
 assert.equal((await db.lessonAttendance.get('p1-f')).lessonId,'p1')
 assert.equal((await db.lessonAssessments.get('p1-assess')).lessonId,'p1')
 assert.equal((await db.weeklyScheduleSlots.get('slot-a')).validUntil,'2026-09-13')
 assert.equal((await db.weeklyScheduleSlots.get('slot-b')).validUntil,'2026-09-13')
 assert.equal(await db.weeklyScheduleSlots.count(),4)
 assert.equal(await db.lessons.count(),4)
})

test('scoped schedule change aborts completely when any affected lesson is submitted',async()=>{
 const slotA={...audit,id:'slot-a',academicYearId:'y',teachingAssignmentId:'a',weekday:1,startTime:'09:00',endTime:'09:50',periodCount:1,validFrom:'2026-09-01',validUntil:'2027-07-31',active:true}
 const slotB={...audit,id:'slot-b',academicYearId:'y',teachingAssignmentId:'a',weekday:2,startTime:'10:00',endTime:'10:50',periodCount:1,validFrom:'2026-09-01',validUntil:'2027-07-31',active:true}
 await db.weeklyScheduleSlots.bulkPut([slotA,slotB])
 await db.lessons.bulkPut([
  lesson('p1',{origin:'scheduled',scheduleSlotId:'slot-a',date:'2026-09-14',startTime:'09:00',endTime:'09:50',summary:'',status:'planned',giaeStatus:'pending',giaeSubmittedAt:null}),
  lesson('p2',{origin:'scheduled',scheduleSlotId:'slot-a',date:'2026-09-21',startTime:'09:00',endTime:'09:50'}),
  lesson('p0',{origin:'scheduled',scheduleSlotId:'slot-a',date:'2026-09-07',startTime:'09:00',endTime:'09:50'}),
  lesson('s1',{origin:'scheduled',scheduleSlotId:'slot-b',date:'2026-09-15',startTime:'10:00',endTime:'10:50',summary:'',status:'planned',giaeStatus:'pending',giaeSubmittedAt:null}),
  lesson('s2',{origin:'scheduled',scheduleSlotId:'slot-b',date:'2026-09-22',startTime:'10:00',endTime:'10:50'})
 ])
 const before=await db.lessons.toArray()
 await assert.rejects(api.lessonRepository.moveLessonWithScope('p1',{date:'2026-09-15',startTime:'10:00',endTime:'10:50'},stamp,'from_here',{id:'s1',updatedAt:stamp}),error=>{
  assert.ok(error instanceof api.LessonMoveBlockedError)
  assert.deepEqual(error.lessons.map(row=>row.id),['p2','s2'])
  assert.deepEqual(error.lessons[0],{id:'p2',date:'2026-09-21',startTime:'09:00',endTime:'09:50'})
  return true
 })
 await assert.rejects(api.lessonRepository.moveLessonWithScope('p1',{date:'2026-09-15',startTime:'10:00',endTime:'10:50'},stamp,'whole_schedule',{id:'s1',updatedAt:stamp}),error=>{
  assert.deepEqual(error.lessons.map(row=>row.id),['p0','p2','s2'])
  return true
 })
 assert.deepEqual(await db.lessons.toArray(),before)
 assert.equal((await db.lessons.get('p1')).date,'2026-09-14')
 assert.equal((await db.weeklyScheduleSlots.get('slot-a')).validUntil,'2027-07-31')
 assert.equal(await db.weeklyScheduleSlots.count(),2)
})

test('submitted lessons cannot move or change module; swapping keeps both lessons and evidence',async()=>{
 await db.lessons.bulkPut([lesson('l'),lesson('other',{date:'2026-09-15',giaeStatus:'pending',giaeSubmittedAt:null})]);await db.lessonAttendance.put(absence('f','l'))
 await assert.rejects(api.lessonRepository.updateLesson('l',{moduleId:'c'}),/retire primeiro/)
 await assert.rejects(api.lessonRepository.moveLesson('l',{date:'2026-09-15',startTime:'09:00',endTime:'09:50'},stamp),/retire primeiro/)
 await api.lessonRepository.markGIAEPendingExplicit('l',stamp)
 await assert.rejects(api.lessonRepository.updateLesson('l',{moduleId:'c'}),/faltas/)
 const first=await db.lessons.get('l');const other=await db.lessons.get('other')
 const moved=await api.lessonRepository.moveLesson('l',{date:other.date,startTime:other.startTime,endTime:other.endTime},first.updatedAt,{id:other.id,updatedAt:other.updatedAt})
 assert.equal(moved.date,'2026-09-15');assert.equal((await db.lessons.get('other')).date,'2026-09-14');assert.equal(await db.lessons.count(),2);assert.equal((await db.lessonAttendance.get('f')).lessonId,'l')
})

test('deleting one student requires ELIMINAR and removes only that student records',async()=>{
 await db.lessons.put(lesson('l'));await seedAssessments();await db.lessonAttendance.bulkPut([absence('f','l'),absence('other','l','two')])
 await api.attendanceRepository.createLearningRecovery(recoveryInput)
 await assert.rejects(api.groupsWorkspaceRepository.deleteStudent('one','APAGAR'))
 await api.groupsWorkspaceRepository.deleteStudent('one','ELIMINAR')
 assert.equal(await db.students.get('one'),undefined);assert.ok(await db.students.get('two'))
 assert.equal(await db.assessmentResults.count(),0);assert.equal(await db.learningRecoveries.count(),0);assert.equal(await db.lessonAttendance.count(),1)
 assert.equal(await db.lessonAssessments.count(),1);assert.equal(await db.lessons.count(),1)
})

test('reordering preserves the position of every module with submitted lessons',async()=>{
 await db.lessons.put(lesson('l',{moduleId:'c'}))
 await assert.rejects(api.maProfessorRepository.moveUnstartedModule('c',1,stamp),/lições submetidas/)
 await api.maProfessorRepository.moveUnstartedModule('b',1,stamp)
 assert.equal((await db.modules.get('c')).order,2);assert.equal((await db.modules.get('b')).order,3);assert.equal((await db.modules.get('d')).order,1)
})


test('new optional recovery and move fields survive JSON backup validation and restore',async()=>{
 await db.lessons.put(lesson('l',{giaeStatus:'pending',giaeSubmittedAt:null,scheduleOriginalPosition:{date:'2026-09-07',startTime:'09:00'}}))
 const recovery=await api.attendanceRepository.createLearningRecovery({...recoveryInput,status:'completed',recoveryDate:'2026-10-02',recoveryGrade:17})
 await db.modules.update('b',{lastEmissionFingerprint:'emitted-fingerprint'})
 const backup=JSON.parse(JSON.stringify(await api.createMAProfessorBackup()))
 const validation=api.validateMAProfessorBackup(backup)
 assert.equal(validation.valid,true,JSON.stringify(validation.issues))
 await api.restoreMAProfessorBackup(backup)
 assert.deepEqual((await db.lessons.get('l')).scheduleOriginalPosition,{date:'2026-09-07',startTime:'09:00'})
 assert.equal((await db.learningRecoveries.get(recovery.id)).recoveryGrade,17)
 assert.deepEqual((await db.learningRecoveries.get(recovery.id)).removedAbsences,[])
 assert.equal((await db.modules.get('b')).lastEmissionFingerprint,'emitted-fingerprint')
})

test('move uses only date/time; submitted destinations and stale versions roll back both lessons',async()=>{
 await db.lessons.bulkPut([lesson('l',{giaeStatus:'pending',giaeSubmittedAt:null}),lesson('other',{date:'2026-09-15'})])
 const destination={date:'2026-09-15',startTime:'09:00',endTime:'09:50'}
 await assert.rejects(api.lessonRepository.moveLesson('l',destination,stamp,{id:'other',updatedAt:stamp}),/submetidas/)
 assert.equal((await db.lessons.get('l')).date,'2026-09-14')
 await api.lessonRepository.markGIAEPendingExplicit('other',stamp)
 await assert.rejects(api.lessonRepository.moveLesson('l',destination,stamp,{id:'other',updatedAt:stamp}),/alterada/)
 const moved=await api.lessonRepository.moveLesson('l',{...destination,date:'2026-09-16',moduleId:'c',summary:'must not leak',giaeStatus:'submitted'},stamp)
 assert.equal(moved.moduleId,'b');assert.equal(moved.summary,'Sumário');assert.equal(moved.giaeStatus,'pending')
})

test('an anticipated scheduled lesson reserves its original occurrence instead of being recreated',async()=>{
 const slot={...audit,id:'slot',academicYearId:'y',teachingAssignmentId:'a',weekday:1,startTime:'09:00',endTime:'09:50',periodCount:1,validFrom:'2026-09-01',validUntil:'2027-07-31',active:true}
 await db.weeklyScheduleSlots.put(slot)
 await db.lessons.put(lesson('future',{origin:'scheduled',scheduleSlotId:'slot',date:'2026-10-12',summary:'',plannedActivity:'',notes:'',status:'planned',giaeStatus:'pending',giaeSubmittedAt:null,planificationItemIds:[]}))
 const anticipated=await api.extraLessonRepository.createExtraLesson({
  academicYearId:'y',teachingAssignmentId:'a',moduleId:'b',date:'2026-10-05',startTime:'11:00',endTime:'11:50',periodCount:1,status:'planned',countTowardProgress:true,plannedActivity:'',summary:'',summarySource:'manual',planificationItemIds:[],notes:'',giaeStatus:'pending'
 })
 assert.equal(anticipated.id,'future')
 assert.equal(anticipated.origin,'scheduled')
 assert.equal(anticipated.scheduleSlotId,'slot')
 assert.deepEqual(anticipated.scheduleOriginalPosition,{date:'2026-10-12',startTime:'09:00'})
 const result=api.planScheduledLessonReconciliation({academicYear:year,assignments:[assignment],slots:[slot],modules:[module()],events:[],lessons:[anticipated],relatedLessonIds:new Set(),dateFrom:'2026-10-12',dateTo:'2026-10-18'})
 assert.equal(result.createLessons.length,0)
 assert.ok(result.preservedLessonIds.includes('future'))
})

test('reconciliation leaves future timetable cells empty once the planned discipline load is exhausted',()=>{
 const slot={...audit,id:'slot',academicYearId:'y',teachingAssignmentId:'a',weekday:1,startTime:'09:00',endTime:'09:50',periodCount:1,validFrom:'2026-09-01',validUntil:'2027-07-31',active:true}
 const completed=lesson('done',{date:'2026-09-14',moduleId:'b',periodCount:1})
 const result=api.planScheduledLessonReconciliation({academicYear:year,assignments:[assignment],slots:[slot],modules:[module('b',1,1)],events:[],lessons:[completed],relatedLessonIds:new Set(),dateFrom:'2026-09-21',dateTo:'2026-09-21'})
 assert.equal(result.createLessons.length,0)
 assert.equal(result.createdOutsidePlannedCapacity,1)
})

test('a moved scheduled occurrence is preserved across reconciliation of its original week',async()=>{
 const slot={...audit,id:'slot',academicYearId:'y',teachingAssignmentId:'a',weekday:1,startTime:'09:00',endTime:'09:50',periodCount:1,validFrom:'2026-09-01',validUntil:'2027-07-31',active:true}
 const moved=lesson('l',{origin:'scheduled',scheduleSlotId:'slot',date:'2026-09-22',summary:'',status:'planned',giaeStatus:'pending',giaeSubmittedAt:null,scheduleOriginalPosition:{date:'2026-09-14',startTime:'09:00'}})
 const result=api.planScheduledLessonReconciliation({academicYear:year,assignments:[assignment],slots:[slot],modules:[module()],events:[],lessons:[moved],relatedLessonIds:new Set(),dateFrom:'2026-09-14',dateTo:'2026-09-20'})
 assert.equal(result.createLessons.length,0);assert.equal(result.deleteLessonIds.length,0)
})


test('real exports preserve the full XLSM, keep pending final cells blank, and emit one recovery PDF page',async()=>{
 await db.lessons.put(lesson('l'));await seedAssessments()
 const pending=await api.attendanceRepository.createLearningRecovery(recoveryInput)
 const downloads=[]
 const blobs=new Map()
 const originalCreate=URL.createObjectURL, originalRevoke=URL.revokeObjectURL, originalFetch=globalThis.fetch, originalDocument=globalThis.document
 URL.createObjectURL=blob=>{const id='blob:'+blobs.size;blobs.set(id,blob);return id}
 URL.revokeObjectURL=()=>{}
 window.setTimeout=()=>0
 globalThis.document={body:{appendChild(){}},createElement:()=>({href:'',download:'',click(){downloads.push({name:this.download,blob:blobs.get(this.href)})},remove(){}})}
 globalThis.fetch=async path=>{assert.equal(path,'/ma-professor/templates/Grelha_Avaliacao_UFCD_UC_Modelo.xlsm');return new Response(await readFile(resolve('public'+path)))}
 try {
  const snapshot=await api.assessmentWorkspaceRepository.getWorkspace('y',{teachingAssignmentId:'a',moduleId:'b'})
  assert.equal(snapshot.studentRows[0].recoveryPending,true)
  await api.exportUfcdFinalGradeExcel(snapshot)
  const files=unzipSync(new Uint8Array(await downloads[0].blob.arrayBuffer()))
  assert.ok(files['xl/vbaProject.bin'])
  const workbook=strFromU8(files['xl/workbook.xml'])
  assert.ok((workbook.match(/<sheet /g)||[]).length>1)
  const sheetEntry=['xl/worksheets/sheet14.xml', files['xl/worksheets/sheet14.xml']]
  assert.ok(sheetEntry)
  const pendingCell=strFromU8(sheetEntry[1]).match(/<c\b[^>]*\br="BW12"[^>]*(?:\/>|>[\s\S]*?<\/c>)/)?.[0]??''
  assert.doesNotMatch(pendingCell,/<f[ >]|<v[ >]/)
  await api.attendanceRepository.updateLearningRecovery(pending.id,{status:'completed',recoveryDate:'2026-10-02',recoveryGrade:16,selectedAbsenceIds:[]})
  const completed=await api.assessmentWorkspaceRepository.getWorkspace('y',{teachingAssignmentId:'a',moduleId:'b'})
  const individual={...completed,recoveryEmission:{date:'2026-10-02'},studentRows:completed.studentRows.filter(row=>row.student.id==='one')}
  await api.exportUfcdFinalGradeExcel(individual)
  await api.exportUfcdCfpPdf(individual)
  const individualFiles=unzipSync(new Uint8Array(await downloads[1].blob.arrayBuffer()))
  const allXml=Object.entries(individualFiles).filter(([path])=>path.endsWith('.xml')).map(([,bytes])=>strFromU8(bytes)).join('\n')
  assert.match(allXml,/Recuperação de assiduidade/);assert.match(allXml,/02\/10\/2026/)
  const finalSheet=strFromU8(individualFiles[sheetEntry[0]])
  assert.match(finalSheet,/<c\b[^>]*\br="BW12"[^>]*>[\s\S]*?<v>16<\/v>/)
  const pdfBytes=new Uint8Array(await downloads[2].blob.arrayBuffer())
  assert.equal((await PDFDocument.load(pdfBytes)).getPageCount(),1)
  if(process.env.HANDOFF_EXPORT_PREVIEW) await writeFile(resolve('../recovery-validation.pdf'),pdfBytes)
 } finally {
  URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;globalThis.fetch=originalFetch;globalThis.document=originalDocument
 }
})

test('emission fingerprint notices assessment edits but ignores pupil name/number corrections',async()=>{
 await db.lessons.put(lesson('l'));await seedAssessments()
 const snapshot=await api.assessmentWorkspaceRepository.getWorkspace('y',{teachingAssignmentId:'a',moduleId:'b'})
 const fingerprint=api.getUfcdEmissionFingerprint(snapshot)
 await db.students.update('one',{name:'Nome corrigido',number:'9'})
 assert.equal(api.getUfcdEmissionFingerprint(await api.assessmentWorkspaceRepository.getWorkspace('y',{teachingAssignmentId:'a',moduleId:'b'})),fingerprint)
 await db.assessmentResults.update('result',{score:18,updatedAt:'2026-10-03T12:00:00.000Z'})
 assert.notEqual(api.getUfcdEmissionFingerprint(await api.assessmentWorkspaceRepository.getWorkspace('y',{teachingAssignmentId:'a',moduleId:'b'})),fingerprint)
})


test('a manually selected UFCD remains local to that saved lesson when reopening',async()=>{
 await db.lessons.bulkPut([lesson('manual',{status:'planned',summary:'',giaeStatus:'pending',giaeSubmittedAt:null}),lesson('next',{date:'2026-09-15',moduleId:'c',status:'planned',summary:'',giaeStatus:'pending',giaeSubmittedAt:null})])
 await api.lessonRepository.updateLesson('manual',{moduleId:'c'})
 await api.ufcdProgressRepository.ensureLessonUsesCurrentUfcd('manual')
 await api.ufcdProgressRepository.ensureLessonUsesCurrentUfcd('next')
 assert.equal((await db.lessons.get('manual')).moduleId,'c')
 assert.equal((await db.lessons.get('next')).moduleId,'b')
})


test('student deletion removes saved daily drafts for that pupil without losing classmates or lesson work',async()=>{
 const draftStudent=id=>({studentId:id,attendanceStatus:'absent',attendanceCode:'F',attendanceNote:'',assessmentStatus:'evaluated',assessmentScoreText:'14',assessmentNote:''})
 const students=[draftStudent('one'),draftStudent('two')]
 await api.saveMAProfessorDailyDraft({accountEmail:'teacher@example.test',academicYearId:'y',lessonId:'l',date:'2026-09-14',baseSavedSignature:JSON.stringify({students}),draftSignature:JSON.stringify({students}),assessmentIdToDelete:null,lesson:{...lesson('l'),periodCount:'1'},assessment:{choice:'none',criterionId:'',title:'',activityType:'other',description:''},students})
 await api.groupsWorkspaceRepository.deleteStudent('one','ELIMINAR')
 const remaining=await api.readMAProfessorDailyDraft('teacher@example.test','y','l')
 assert.deepEqual(remaining.students.map(row=>row.studentId),['two'])
 assert.deepEqual(JSON.parse(remaining.draftSignature).students.map(row=>row.studentId),['two'])
 assert.equal(remaining.lesson.summary,'Sumário')
 await api.clearMAProfessorDailyDrafts()
})

test('dashboard and planification consume the same cumulative completion projection',async()=>{
 await db.weeklyScheduleSlots.put({...audit,id:'slot',academicYearId:'y',teachingAssignmentId:'a',weekday:1,startTime:'09:00',endTime:'09:50',periodCount:1,validFrom:'2026-09-01',validUntil:'2027-07-31',active:true})
 const modules=await db.modules.toArray()
 const snapshot={academicYear:year,referenceDate:api.todayISO(),assignments:[{assignment,modules:modules.map(module=>({module,progress:{}}))}],totals:{}}
 const actual=await api.ufcdProgressRepository.applyActualProgressToDashboard(snapshot)
 const projection=await api.ufcdProgressRepository.getAssignmentCompletionProjection('a')
 assert.deepEqual(actual.assignments[0].modules.map(row=>row.progress.estimatedCompletionDate),projection.modules.map(row=>row.estimatedCompletionDate))
 assert.equal(actual.totals.periodsTaught,0)
 assert.ok(projection.disciplineCompletionDate>year.endDate)
})
