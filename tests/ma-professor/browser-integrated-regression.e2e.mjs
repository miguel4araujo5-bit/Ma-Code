import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = 4174
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
let page
const pageErrors = []

try {
  await waitForVite(server)

  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon'
  })

  page = await context.newPage()
  await page.clock.setFixedTime(
    new Date(FIXED_NOW)
  )
  page.setDefaultTimeout(20_000)
  page.on(
    'pageerror',
    error => pageErrors.push(error.message)
  )

  await page.goto(
    `${BASE_URL}/`,
    { waitUntil: 'domcontentloaded' }
  )

  const result = await page.evaluate(async () => {
    const {
      maProfessorDb,
      openMAProfessorDatabase
    } = await import(
      '/src/components/ma-professor/db.ts'
    )

    const {
      attendanceRepository
    } = await import(
      '/src/components/ma-professor/attendance/attendanceRepository.ts'
    )

    const {
      recoveryAssessmentRepository
    } = await import(
      '/src/components/ma-professor/attendance/recoveryAssessmentRepository.ts'
    )

    const {
      dailyCriteriaGridRepository
    } = await import(
      '/src/components/ma-professor/daily/dailyCriteriaGridRepository.ts'
    )

    const {
      assessmentWorkspaceRepository
    } = await import(
      '/src/components/ma-professor/assessments/assessmentWorkspaceRepository.ts'
    )

    const {
      giaeExplicitSubmissionRepository
    } = await import(
      '/src/components/ma-professor/giaeExplicitSubmissionRepository.ts'
    )

    const {
      createMAProfessorBackup,
      resetMAProfessorDatabase,
      restoreMAProfessorBackup,
      validateMAProfessorBackup
    } = await import(
      '/src/components/ma-professor/settings/backupRepository.ts'
    )

    await openMAProfessorDatabase()
    await resetMAProfessorDatabase()

    const timestamp =
      '2026-09-08T09:00:00.000Z'

    const academicYear = {
      id: 'e2e-year',
      name: '2026/2027',
      startDate: '2026-09-01',
      endDate: '2027-08-31',
      active: true,
      setupCompletedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const group = {
      id: 'e2e-group',
      academicYearId: academicYear.id,
      name: '11.º E',
      courseName: 'TAP',
      gradeLevel: '11.º',
      educationType: 'professional',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const subject = {
      id: 'e2e-subject',
      academicYearId: academicYear.id,
      name: 'Área de Expressões',
      shortName: 'AE',
      code: 'AE',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const assignment = {
      id: 'e2e-assignment',
      academicYearId: academicYear.id,
      groupId: group.id,
      subjectId: subject.id,
      displayName: 'AE · 11.º E',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const module = {
      id: 'e2e-module',
      academicYearId: academicYear.id,
      teachingAssignmentId: assignment.id,
      code: '10385',
      name: 'Expressão Dramática',
      plannedPeriods: 10,
      order: 1,
      plannedStartDate: '2026-09-01',
      plannedEndDate: '2027-02-28',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const studentA = {
      id: 'e2e-student-a',
      academicYearId: academicYear.id,
      groupId: group.id,
      number: '1',
      name: 'Ana E2E',
      active: true,
      notes: '',
      membershipPeriods: [
        {
          startDate: academicYear.startDate,
          endDate: null
        }
      ],
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const studentB = {
      id: 'e2e-student-b',
      academicYearId: academicYear.id,
      groupId: group.id,
      number: '2',
      name: 'Bruno E2E',
      active: true,
      notes: '',
      membershipPeriods: [
        {
          startDate: academicYear.startDate,
          endDate: null
        }
      ],
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const scheme = {
      id: 'e2e-scheme',
      academicYearId: academicYear.id,
      teachingAssignmentId: assignment.id,
      moduleId: module.id,
      scope: 'module',
      name: 'Critérios E2E',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const criteria = [
      {
        id: 'e2e-criterion-1',
        schemeId: scheme.id,
        name: 'D1',
        description: '',
        weightPercent: 60,
        order: 1,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: 'e2e-criterion-2',
        schemeId: scheme.id,
        name: 'D2',
        description: '',
        weightPercent: 20,
        order: 2,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: 'e2e-criterion-3',
        schemeId: scheme.id,
        name: 'D3',
        description: '',
        weightPercent: 20,
        order: 3,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]

    const planification = {
      id: 'e2e-planification',
      academicYearId: academicYear.id,
      teachingAssignmentId: assignment.id,
      moduleId: module.id,
      title: 'Planificação E2E',
      description: '',
      active: true,
      sourceDocumentName: 'planificacao-e2e.xlsx',
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const planificationItem = {
      id: 'e2e-planification-item',
      planificationId: planification.id,
      order: 1,
      content: 'Expressão corporal',
      activity: 'Exercício prático',
      objectives: 'Aplicar técnicas de expressão.',
      resources: '',
      evaluation: '',
      suggestedSummary: 'Expressão corporal e exercício prático.',
      sourceDocumentName: 'planificacao-e2e.xlsx',
      status: 'used',
      usedLessonId: 'e2e-lesson-taught',
      usedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const taughtLesson = {
      id: 'e2e-lesson-taught',
      academicYearId: academicYear.id,
      teachingAssignmentId: assignment.id,
      moduleId: module.id,
      scheduleSlotId: null,
      origin: 'extra',
      status: 'taught',
      date: '2026-09-08',
      startTime: '09:00',
      endTime: '09:50',
      periodCount: 1,
      countTowardProgress: true,
      plannedActivity: 'Exercício prático',
      summary: 'Expressão corporal e exercício prático.',
      summarySource: 'planification',
      planificationItemIds: [
        planificationItem.id
      ],
      giaeStatus: 'pending',
      giaeSubmittedAt: null,
      notes: '',
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const futureLesson = {
      id: 'e2e-lesson-future',
      academicYearId: academicYear.id,
      teachingAssignmentId: assignment.id,
      moduleId: module.id,
      scheduleSlotId: null,
      origin: 'extra',
      status: 'planned',
      date: '2026-09-22',
      startTime: '09:00',
      endTime: '09:50',
      periodCount: 1,
      countTowardProgress: true,
      plannedActivity: 'Avaliação preparada antecipadamente',
      summary: 'Avaliação preparada antecipadamente.',
      summarySource: 'manual',
      planificationItemIds: [],
      giaeStatus: 'pending',
      giaeSubmittedAt: null,
      notes: '',
      createdAt: timestamp,
      updatedAt: timestamp
    }

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.tables,
      async () => {
        await maProfessorDb.academicYears.put(
          academicYear
        )
        await maProfessorDb.groups.put(group)
        await maProfessorDb.subjects.put(subject)
        await maProfessorDb.teachingAssignments.put(
          assignment
        )
        await maProfessorDb.modules.put(module)
        await maProfessorDb.students.bulkPut([
          studentA,
          studentB
        ])
        await maProfessorDb.assessmentSchemes.put(
          scheme
        )
        await maProfessorDb.assessmentCriteria.bulkPut(
          criteria
        )
        await maProfessorDb.planifications.put(
          planification
        )
        await maProfessorDb.planificationItems.put(
          planificationItem
        )
        await maProfessorDb.lessons.bulkPut([
          taughtLesson,
          futureLesson
        ])
      }
    )

    const submittedLesson =
      await giaeExplicitSubmissionRepository
        .markSubmitted({
          lessonId: taughtLesson.id,
          expectedUpdatedAt:
            taughtLesson.updatedAt
        })

    await attendanceRepository
      .saveLessonAttendance(
        taughtLesson.id,
        [
          {
            studentId: studentA.id,
            status: 'present'
          },
          {
            studentId: studentB.id,
            status: 'absent',
            code: 'F',
            note: 'Falta E2E'
          }
        ],
        {
          fillMissingAsPresent: true,
          synchronizeRecoveries: true
        }
      )

    const attendanceSummaries =
      await attendanceRepository
        .listModuleAbsenceSummaries(
          module.id
        )

    const automaticRecovery =
      (
        await maProfessorDb.learningRecoveries
          .where('moduleId')
          .equals(module.id)
          .toArray()
      ).find(
        recovery =>
          recovery.studentId ===
          studentB.id
      )

    if (!automaticRecovery) {
      throw new Error(
        'A recuperação automática E2E não foi criada.'
      )
    }

    const taughtLessonForAssessment =
      await maProfessorDb.lessons.get(
        taughtLesson.id
      )

    if (!taughtLessonForAssessment) {
      throw new Error(
        'A aula dada E2E deixou de existir.'
      )
    }

    await dailyCriteriaGridRepository
      .saveLessonGrid({
        lesson: taughtLessonForAssessment,
        summary:
          taughtLessonForAssessment.summary,
        activity: 'Trabalho prático E2E',
        rows: [
          {
            studentId: studentA.id,
            attendanceStatus: 'present',
            scores: {
              'e2e-criterion-1': '10',
              'e2e-criterion-2': '20',
              'e2e-criterion-3': '20'
            }
          },
          {
            studentId: studentB.id,
            attendanceStatus: 'absent',
            scores: {}
          }
        ]
      })

    const futureLessonForAssessment =
      await maProfessorDb.lessons.get(
        futureLesson.id
      )

    if (!futureLessonForAssessment) {
      throw new Error(
        'A aula futura E2E deixou de existir.'
      )
    }

    await dailyCriteriaGridRepository
      .saveLessonGrid({
        lesson: futureLessonForAssessment,
        summary:
          futureLessonForAssessment.summary,
        activity: 'Avaliação futura E2E',
        rows: [
          {
            studentId: studentA.id,
            attendanceStatus: 'present',
            scores: {
              'e2e-criterion-1': '12',
              'e2e-criterion-2': '12',
              'e2e-criterion-3': '12'
            }
          }
        ]
      })

    const workspaceBeforeRecovery =
      await assessmentWorkspaceRepository
        .getWorkspace(
          academicYear.id,
          {
            teachingAssignmentId:
              assignment.id,
            moduleId: module.id
          }
        )

    await attendanceRepository
      .updateLearningRecovery(
        automaticRecovery.id,
        {
          activity:
            'Atividade de recuperação E2E',
          result:
            'Recuperação concluída E2E',
          status: 'completed'
        }
      )

    await recoveryAssessmentRepository
      .saveAssessment(
        automaticRecovery.id,
        {
          'e2e-criterion-1': 18,
          'e2e-criterion-2': 16,
          'e2e-criterion-3': 14
        }
      )

    const workspaceAfterRecovery =
      await assessmentWorkspaceRepository
        .getWorkspace(
          academicYear.id,
          {
            teachingAssignmentId:
              assignment.id,
            moduleId: module.id
          }
        )

    await assessmentWorkspaceRepository
      .saveModuleFinalGrade({
        moduleId: module.id,
        studentId: studentA.id,
        finalGrade: 13,
        selfAssessmentGrade: 13,
        usesAcs: false,
        note: 'Fecho E2E'
      })

    const backup =
      await createMAProfessorBackup()

    const backupValidation =
      validateMAProfessorBackup(
        backup
      )

    const countsBeforeReset = {
      students:
        await maProfessorDb.students.count(),
      lessons:
        await maProfessorDb.lessons.count(),
      attendance:
        await maProfessorDb.lessonAttendance.count(),
      assessments:
        await maProfessorDb.lessonAssessments.count(),
      assessmentResults:
        await maProfessorDb.assessmentResults.count(),
      recoveries:
        await maProfessorDb.learningRecoveries.count(),
      finalGrades:
        await maProfessorDb.moduleFinalGrades.count(),
      planifications:
        await maProfessorDb.planifications.count(),
      planificationItems:
        await maProfessorDb.planificationItems.count()
    }

    await resetMAProfessorDatabase()

    const countsAfterReset = {
      students:
        await maProfessorDb.students.count(),
      lessons:
        await maProfessorDb.lessons.count(),
      recoveries:
        await maProfessorDb.learningRecoveries.count(),
      finalGrades:
        await maProfessorDb.moduleFinalGrades.count()
    }

    await restoreMAProfessorBackup(
      backup
    )

    const restoredLesson =
      await maProfessorDb.lessons.get(
        taughtLesson.id
      )

    const restoredFutureLesson =
      await maProfessorDb.lessons.get(
        futureLesson.id
      )

    const restoredRecovery =
      await maProfessorDb.learningRecoveries.get(
        automaticRecovery.id
      )

    const restoredFinalGrade =
      (
        await maProfessorDb.moduleFinalGrades
          .where('[moduleId+studentId]')
          .equals([
            module.id,
            studentA.id
          ])
          .toArray()
      )[0] ?? null

    const restoredWorkspace =
      await assessmentWorkspaceRepository
        .getWorkspace(
          academicYear.id,
          {
            teachingAssignmentId:
              assignment.id,
            moduleId: module.id
          }
        )

    const row = (
      workspace,
      studentId
    ) =>
      workspace.studentRows.find(
        item =>
          item.student.id === studentId
      ) ?? null

    const absence = studentId =>
      attendanceSummaries.find(
        summary =>
          summary.studentId ===
          studentId
      ) ?? null

    const persistedResults =
      await maProfessorDb.assessmentResults
        .toArray()

    return {
      submittedLesson: {
        status:
          submittedLesson.giaeStatus,
        submittedAt:
          submittedLesson.giaeSubmittedAt
      },
      attendance: {
        studentA:
          absence(studentA.id),
        studentB:
          absence(studentB.id)
      },
      workspaceBeforeRecovery: {
        studentA:
          row(
            workspaceBeforeRecovery,
            studentA.id
          )?.gradeSummary ?? null,
        studentB:
          row(
            workspaceBeforeRecovery,
            studentB.id
          )?.gradeSummary ?? null
      },
      workspaceAfterRecovery: {
        studentA:
          row(
            workspaceAfterRecovery,
            studentA.id
          )?.gradeSummary ?? null,
        studentB:
          row(
            workspaceAfterRecovery,
            studentB.id
          )?.gradeSummary ?? null,
        classAverage:
          workspaceAfterRecovery
            .totals.classAverage
      },
      futureLesson: {
        status:
          restoredFutureLesson?.status ?? null,
        assessmentCount:
          restoredWorkspace.activities.filter(
            activity =>
              activity.lesson.id ===
              futureLesson.id
          ).length
      },
      absenceAssessmentResults:
        persistedResults.filter(
          item =>
            item.studentId ===
              studentB.id &&
            item.status === 'absent'
        ).length,
      backup: {
        valid:
          backupValidation.valid,
        errors:
          backupValidation.issues.filter(
            issue =>
              issue.severity === 'error'
          ),
        countsBeforeReset,
        countsAfterReset,
        restored: {
          lessonGiaeStatus:
            restoredLesson?.giaeStatus ?? null,
          lessonSummary:
            restoredLesson?.summary ?? null,
          futureLessonStatus:
            restoredFutureLesson?.status ?? null,
          recoveryStatus:
            restoredRecovery?.status ?? null,
          recoveryScores:
            restoredRecovery
              ?.assessmentScores ?? null,
          recoveryRecordedAt:
            restoredRecovery
              ?.assessmentRecordedAt ?? null,
          finalGrade:
            restoredFinalGrade?.finalGrade ?? null,
          selfAssessmentGrade:
            restoredFinalGrade
              ?.selfAssessmentGrade ?? null,
          planificationItems:
            await maProfessorDb.planificationItems.count(),
          students:
            await maProfessorDb.students.count(),
          lessons:
            await maProfessorDb.lessons.count(),
          attendance:
            await maProfessorDb.lessonAttendance.count(),
          assessments:
            await maProfessorDb.lessonAssessments.count(),
          assessmentResults:
            await maProfessorDb.assessmentResults.count(),
          recoveries:
            await maProfessorDb.learningRecoveries.count(),
          finalGrades:
            await maProfessorDb.moduleFinalGrades.count()
        },
        restoredWorkspace: {
          studentA:
            row(
              restoredWorkspace,
              studentA.id
            )?.gradeSummary ?? null,
          studentB:
            row(
              restoredWorkspace,
              studentB.id
            )?.gradeSummary ?? null,
          classAverage:
            restoredWorkspace
              .totals.classAverage
        }
      }
    }
  })

  assert.equal(
    result.submittedLesson.status,
    'submitted'
  )
  assert.ok(
    result.submittedLesson.submittedAt
  )

  assert.equal(
    result.attendance.studentA?.absencePercent,
    0
  )
  assert.equal(
    result.attendance.studentB?.absencePercent,
    10
  )
  assert.equal(
    result.attendance.studentB?.warningLevel,
    'recovery_required'
  )
  assert.ok(
    result.attendance.studentB?.recoveryId
  )

  assert.equal(
    result.workspaceBeforeRecovery
      .studentA?.provisionalAverage,
    13
  )
  assert.equal(
    result.workspaceBeforeRecovery
      .studentA?.suggestedGrade,
    13
  )
  assert.equal(
    result.workspaceBeforeRecovery
      .studentB?.provisionalAverage,
    null
  )
  assert.equal(
    result.workspaceBeforeRecovery
      .studentB?.suggestedGrade,
    null
  )

  assert.equal(
    result.absenceAssessmentResults,
    3
  )
  assert.equal(
    result.futureLesson.status,
    'planned'
  )
  assert.equal(
    result.futureLesson.assessmentCount,
    3
  )

  assert.equal(
    result.workspaceAfterRecovery
      .studentA?.provisionalAverage,
    13
  )
  assert.equal(
    result.workspaceAfterRecovery
      .studentB?.provisionalAverage,
    16.8
  )
  assert.deepEqual(
    result.workspaceAfterRecovery
      .studentB?.criteria.map(
        criterion =>
          criterion.average
      ),
    [18, 16, 14]
  )
  assert.equal(
    result.workspaceAfterRecovery
      .studentB?.suggestedGrade,
    null
  )
  assert.equal(
    result.workspaceAfterRecovery
      .classAverage,
    14.9
  )

  assert.equal(
    result.backup.valid,
    true
  )
  assert.deepEqual(
    result.backup.errors,
    []
  )
  assert.deepEqual(
    result.backup.countsBeforeReset,
    {
      students: 2,
      lessons: 2,
      attendance: 2,
      assessments: 6,
      assessmentResults: 9,
      recoveries: 1,
      finalGrades: 1,
      planifications: 1,
      planificationItems: 1
    }
  )
  assert.deepEqual(
    result.backup.countsAfterReset,
    {
      students: 0,
      lessons: 0,
      recoveries: 0,
      finalGrades: 0
    }
  )

  assert.equal(
    result.backup.restored.lessonGiaeStatus,
    'submitted'
  )
  assert.equal(
    result.backup.restored.lessonSummary,
    'Expressão corporal e exercício prático.'
  )
  assert.equal(
    result.backup.restored.futureLessonStatus,
    'planned'
  )
  assert.equal(
    result.backup.restored.recoveryStatus,
    'completed'
  )
  assert.deepEqual(
    result.backup.restored.recoveryScores,
    {
      'e2e-criterion-1': 18,
      'e2e-criterion-2': 16,
      'e2e-criterion-3': 14
    }
  )
  assert.ok(
    result.backup.restored.recoveryRecordedAt
  )
  assert.equal(
    result.backup.restored.finalGrade,
    13
  )
  assert.equal(
    result.backup.restored.selfAssessmentGrade,
    13
  )
  assert.equal(
    result.backup.restored.planificationItems,
    1
  )
  assert.equal(
    result.backup.restored.students,
    2
  )
  assert.equal(
    result.backup.restored.lessons,
    2
  )
  assert.equal(
    result.backup.restored.attendance,
    2
  )
  assert.equal(
    result.backup.restored.assessments,
    6
  )
  assert.equal(
    result.backup.restored.assessmentResults,
    9
  )
  assert.equal(
    result.backup.restored.recoveries,
    1
  )
  assert.equal(
    result.backup.restored.finalGrades,
    1
  )

  assert.equal(
    result.backup.restoredWorkspace
      .studentA?.provisionalAverage,
    13
  )
  assert.equal(
    result.backup.restoredWorkspace
      .studentB?.provisionalAverage,
    16.8
  )
  assert.equal(
    result.backup.restoredWorkspace
      .classAverage,
    14.9
  )

  assert.deepEqual(
    pageErrors,
    []
  )

  console.log(
    'MA-Professor browser integrated regression: OK'
  )
} catch (error) {
  if (page) {
    try {
      console.error(
        'MA_PROFESSOR_INTEGRATED_E2E_DIAGNOSTIC=' +
        JSON.stringify(
          {
            url: page.url(),
            body: (
              await page.locator('body').innerText()
            ).slice(0, 8000),
            pageErrors
          },
          null,
          2
        )
      )
    } catch {
      // Mantém o erro original.
    }
  }

  console.error(server.logs())
  throw error
} finally {
  if (browser) {
    await browser.close()
  }

  await stopVite(server.child)
}
