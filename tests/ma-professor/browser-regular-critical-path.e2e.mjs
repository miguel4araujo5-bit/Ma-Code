import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = 4175
const BASE_URL = `http://${HOST}:${PORT}`
const FIXED_NOW = '2026-09-13T21:00:00+01:00'

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
      REGULAR_ANNUAL_COMPONENT_NAME,
      syncRegularAnnualComponentsInCurrentContext
    } = await import(
      '/src/components/ma-professor/curriculum/regularAnnualComponentRepository.ts'
    )

    const {
      resetMAProfessorDatabase
    } = await import(
      '/src/components/ma-professor/settings/backupRepository.ts'
    )

    await openMAProfessorDatabase()
    await resetMAProfessorDatabase()

    const timestamp =
      '2026-09-07T08:00:00.000Z'

    const academicYear = {
      id: 'regular-e2e-year',
      name: '2026/2027',
      startDate: '2026-09-07',
      endDate: '2026-09-18',
      active: true,
      setupCompletedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const regularGroup = {
      id: 'regular-e2e-group',
      academicYearId: academicYear.id,
      name: '7.º A',
      courseName: '',
      gradeLevel: '7.º',
      educationType: 'regular',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const explicitRegularGroup = {
      id: 'regular-e2e-explicit-group',
      academicYearId: academicYear.id,
      name: '5.º B',
      courseName: '',
      gradeLevel: '5.º',
      educationType: 'regular',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const professionalGroup = {
      id: 'regular-e2e-professional-group',
      academicYearId: academicYear.id,
      name: '11.º E',
      courseName: 'TAP',
      gradeLevel: '11.º',
      educationType: 'professional',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const subjects = [
      {
        id: 'regular-e2e-subject',
        academicYearId: academicYear.id,
        name: 'Português',
        shortName: 'PORT',
        code: 'PORT',
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: 'regular-e2e-explicit-subject',
        academicYearId: academicYear.id,
        name: 'Teatro',
        shortName: 'TEA',
        code: 'TEA',
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: 'regular-e2e-professional-subject',
        academicYearId: academicYear.id,
        name: 'Área de Expressões',
        shortName: 'AE',
        code: 'AE',
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]

    const assignments = [
      {
        id: 'regular-e2e-assignment',
        academicYearId: academicYear.id,
        groupId: regularGroup.id,
        subjectId: subjects[0].id,
        displayName: 'PORT · 7.º A',
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: 'regular-e2e-explicit-assignment',
        academicYearId: academicYear.id,
        groupId: explicitRegularGroup.id,
        subjectId: subjects[1].id,
        displayName: 'TEA · 5.º B',
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: 'regular-e2e-professional-assignment',
        academicYearId: academicYear.id,
        groupId: professionalGroup.id,
        subjectId: subjects[2].id,
        displayName: 'AE · 11.º E',
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]

    const scheduleSlots = [
      {
        id: 'regular-e2e-slot-mon',
        academicYearId: academicYear.id,
        teachingAssignmentId: assignments[0].id,
        weekday: 1,
        startTime: '09:00',
        endTime: '10:40',
        periodCount: 2,
        validFrom: academicYear.startDate,
        validUntil: academicYear.endDate,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: 'regular-e2e-slot-wed',
        academicYearId: academicYear.id,
        teachingAssignmentId: assignments[0].id,
        weekday: 3,
        startTime: '11:00',
        endTime: '11:50',
        periodCount: 1,
        validFrom: academicYear.startDate,
        validUntil: academicYear.endDate,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: 'regular-e2e-explicit-slot',
        academicYearId: academicYear.id,
        teachingAssignmentId: assignments[1].id,
        weekday: 2,
        startTime: '10:00',
        endTime: '10:50',
        periodCount: 1,
        validFrom: academicYear.startDate,
        validUntil: academicYear.endDate,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: 'regular-e2e-professional-slot',
        academicYearId: academicYear.id,
        teachingAssignmentId: assignments[2].id,
        weekday: 1,
        startTime: '14:00',
        endTime: '14:50',
        periodCount: 1,
        validFrom: academicYear.startDate,
        validUntil: academicYear.endDate,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]

    const explicitModule = {
      id: 'regular-e2e-explicit-module',
      academicYearId: academicYear.id,
      teachingAssignmentId: assignments[1].id,
      code: 'TEA-1',
      name: 'Unidade explícita',
      plannedPeriods: 10,
      order: 1,
      plannedStartDate: academicYear.startDate,
      plannedEndDate: academicYear.endDate,
      active: true,
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
        await maProfessorDb.groups.bulkPut([
          regularGroup,
          explicitRegularGroup,
          professionalGroup
        ])
        await maProfessorDb.subjects.bulkPut(
          subjects
        )
        await maProfessorDb.teachingAssignments.bulkPut(
          assignments
        )
        await maProfessorDb.weeklyScheduleSlots.bulkPut(
          scheduleSlots
        )
        await maProfessorDb.modules.put(
          explicitModule
        )
      }
    )

    const initialSync =
      await syncRegularAnnualComponentsInCurrentContext(
        academicYear.id
      )

    const modulesAfterInitialSync =
      await maProfessorDb.modules
        .where('academicYearId')
        .equals(academicYear.id)
        .toArray()

    const annualComponent =
      modulesAfterInitialSync.find(
        module =>
          module.teachingAssignmentId ===
            assignments[0].id &&
          module.regularAnnual === true
      ) ?? null

    const professionalModules =
      modulesAfterInitialSync.filter(
        module =>
          module.teachingAssignmentId ===
          assignments[2].id
      )

    if (!annualComponent) {
      throw new Error(
        'O componente anual regular E2E não foi criado.'
      )
    }

    await maProfessorDb.schoolCalendarEvents.put({
      id: 'regular-e2e-holiday',
      academicYearId: academicYear.id,
      type: 'holiday',
      scope: 'all',
      groupId: null,
      teachingAssignmentId: null,
      title: 'Feriado E2E',
      description: '',
      startDate: '2026-09-09',
      endDate: '2026-09-09',
      blocksLessons: true,
      createdAt: timestamp,
      updatedAt: timestamp
    })

    const blockedSync =
      await syncRegularAnnualComponentsInCurrentContext(
        academicYear.id
      )

    const afterHoliday =
      await maProfessorDb.modules.get(
        annualComponent.id
      )

    await maProfessorDb.lessons.put({
      id: 'regular-e2e-taught-lesson',
      academicYearId: academicYear.id,
      teachingAssignmentId: assignments[0].id,
      moduleId: annualComponent.id,
      scheduleSlotId: null,
      origin: 'extra',
      status: 'taught',
      date: '2026-09-10',
      startTime: '09:00',
      endTime: '14:50',
      periodCount: 7,
      countTowardProgress: true,
      plannedActivity: 'Aula regular E2E',
      summary: 'Aula regular E2E concluída.',
      summarySource: 'manual',
      planificationItemIds: [],
      giaeStatus: 'pending',
      giaeSubmittedAt: null,
      notes: '',
      createdAt: timestamp,
      updatedAt: timestamp
    })

    const taughtFloorSync =
      await syncRegularAnnualComponentsInCurrentContext(
        academicYear.id
      )

    const afterTaughtFloor =
      await maProfessorDb.modules.get(
        annualComponent.id
      )

    const finalModules =
      await maProfessorDb.modules
        .where('academicYearId')
        .equals(academicYear.id)
        .toArray()

    return {
      annualName:
        REGULAR_ANNUAL_COMPONENT_NAME,
      initialSync,
      blockedSync,
      taughtFloorSync,
      annualComponent,
      afterHoliday,
      afterTaughtFloor,
      professionalModuleCount:
        professionalModules.length,
      explicitModuleCount:
        finalModules.filter(
          module =>
            module.teachingAssignmentId ===
            assignments[1].id
        ).length,
      regularAnnualModuleCount:
        finalModules.filter(
          module =>
            module.teachingAssignmentId ===
              assignments[0].id &&
            module.regularAnnual === true
        ).length
    }
  })

  assert.equal(
    result.initialSync.created.length,
    1
  )
  assert.ok(
    result.initialSync.created.includes(
      result.annualComponent.id
    )
  )
  assert.ok(
    result.initialSync.skippedExplicitAssignments.includes(
      'regular-e2e-explicit-assignment'
    )
  )
  assert.equal(
    result.annualComponent.name,
    result.annualName
  )
  assert.equal(
    result.annualComponent.code,
    ''
  )
  assert.equal(
    result.annualComponent.regularAnnual,
    true
  )
  assert.equal(
    result.annualComponent.plannedPeriods,
    6
  )
  assert.equal(
    result.professionalModuleCount,
    0
  )
  assert.equal(
    result.blockedSync.updated.length,
    1
  )
  assert.equal(
    result.afterHoliday?.id,
    result.annualComponent.id
  )
  assert.equal(
    result.afterHoliday?.plannedPeriods,
    5
  )
  assert.equal(
    result.taughtFloorSync.updated.length,
    1
  )
  assert.equal(
    result.afterTaughtFloor?.plannedPeriods,
    7
  )
  assert.equal(
    result.regularAnnualModuleCount,
    1
  )
  assert.equal(
    result.explicitModuleCount,
    1
  )

  assert.deepEqual(
    pageErrors,
    []
  )

  console.log(
    'MA-Professor regular browser critical path: OK'
  )
} catch (error) {
  if (page) {
    try {
      console.error(
        'MA_PROFESSOR_REGULAR_E2E_DIAGNOSTIC=' +
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
