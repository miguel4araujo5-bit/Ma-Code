import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test, { after } from 'node:test'
import ts from 'typescript'
import 'fake-indexeddb/auto'

const root = resolve(
  new URL('../..', import.meta.url).pathname
)
const base = 'src/components/ma-professor/'
const read = path =>
  readFileSync(
    join(root, base, path),
    'utf8'
  )

const attemptsSource =
  read('attendance/learningRecoveryAttempts.ts')
const repositorySource =
  read('attendance/attendanceRepository.ts')
const productSource =
  read('product/AttendanceProductWorkspace.tsx')
const panelSource =
  read('attendance/RecoveryAttemptsPanel.tsx')

const attemptsRuntime = ts.transpileModule(
  attemptsSource,
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022
    }
  }
).outputText

const attempts = await import(
  `data:text/javascript;base64,${Buffer.from(attemptsRuntime).toString('base64')}`
)

const audit = {
  createdAt: '2026-09-13T00:00:00.000Z',
  updatedAt: '2026-09-13T00:00:00.000Z'
}

function recovery(
  id,
  index,
  status = 'completed',
  outcome = 'unsuccessful'
) {
  return {
    id,
    academicYearId: 'year',
    teachingAssignmentId: 'assignment',
    moduleId: 'module',
    studentId: 'student',
    triggeredAt: `2026-09-${String(index).padStart(2, '0')}T10:00:00.000Z`,
    lessonCountAtTrigger: 10,
    absenceCountAtTrigger: 2,
    absencePercentAtTrigger: 20,
    contents: '',
    activity: 'Ficha',
    plannedDate: null,
    status,
    result: status === 'completed' ? 'Resultado' : '',
    completedAt:
      status === 'completed'
        ? `2026-09-${String(index).padStart(2, '0')}T11:00:00.000Z`
        : null,
    outcome,
    referredToExamAt: null,
    ...audit
  }
}

test(
  'attempt summary only allows the next attempt after an unsuccessful completion',
  () => {
    const first = recovery('r1', 1)
    let summary =
      attempts.summarizeLearningRecoveryAttempts([
        first
      ])

    assert.equal(summary.attemptCount, 1)
    assert.equal(summary.canCreateNextAttempt, true)
    assert.equal(summary.nextAttemptNumber, 2)
    assert.equal(summary.canReferToExam, false)

    summary =
      attempts.summarizeLearningRecoveryAttempts([
        {
          ...first,
          outcome: 'successful'
        }
      ])

    assert.equal(summary.hasSuccessfulAttempt, true)
    assert.equal(summary.canCreateNextAttempt, false)

    summary =
      attempts.summarizeLearningRecoveryAttempts([
        {
          ...first,
          status: 'in_progress',
          outcome: null
        }
      ])

    assert.equal(summary.hasActiveAttempt, true)
    assert.equal(summary.canCreateNextAttempt, false)
  }
)

test(
  'three unsuccessful attempts unlock exam referral and never a fourth attempt',
  () => {
    const summary =
      attempts.summarizeLearningRecoveryAttempts([
        recovery('r1', 1),
        recovery('r2', 2),
        recovery('r3', 3)
      ])

    assert.equal(summary.attemptCount, 3)
    assert.equal(summary.canCreateNextAttempt, false)
    assert.equal(summary.nextAttemptNumber, null)
    assert.equal(summary.canReferToExam, true)
  }
)

test(
  'exam referral becomes terminal once recorded',
  () => {
    const summary =
      attempts.summarizeLearningRecoveryAttempts([
        recovery('r1', 1),
        recovery('r2', 2),
        {
          ...recovery('r3', 3),
          referredToExamAt:
            '2026-09-13T12:00:00.000Z'
        }
      ])

    assert.equal(
      summary.referredToExamAt,
      '2026-09-13T12:00:00.000Z'
    )
    assert.equal(summary.canReferToExam, false)
    assert.equal(summary.canCreateNextAttempt, false)
  }
)

const originalWindow = globalThis.window
globalThis.window = {
  indexedDB: globalThis.indexedDB
}

const cache = join(
  root,
  'node_modules',
  '.cache'
)
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(
  join(cache, 'recovery-attempts-')
)
writeFileSync(
  join(output, 'package.json'),
  '{"type":"commonjs"}'
)

const require = createRequire(import.meta.url)
const compiled = new Set()

function compile(relative) {
  if (compiled.has(relative)) return
  compiled.add(relative)

  const source = readFileSync(
    join(root, relative),
    'utf8'
  )
  const code = ts.transpileModule(
    source,
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX
      }
    }
  ).outputText

  const target = join(
    output,
    relative.replace(/\.tsx?$/, '.js')
  )
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, code)

  for (
    const match of code.matchAll(
      /require\(["'](\.[^"']+)["']\)/g
    )
  ) {
    const dependencyBase = resolve(
      dirname(join(root, relative)),
      match[1]
    )
    const dependency =
      existsSync(dependencyBase + '.ts')
        ? dependencyBase + '.ts'
        : dependencyBase + '.tsx'

    if (existsSync(dependency)) {
      compile(
        dependency.slice(root.length + 1)
      )
    }
  }
}

compile(
  base + 'attendance/attendanceRepository.ts'
)

const {
  maProfessorDb
} = require(
  join(output, base, 'db.js')
)
const {
  attendanceRepository
} = require(
  join(
    output,
    base,
    'attendance/attendanceRepository.js'
  )
)

async function seed() {
  await maProfessorDb.delete()
  await maProfessorDb.open()

  await maProfessorDb.academicYears.add({
    id: 'year',
    name: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    active: true,
    setupCompletedAt: null,
    ...audit
  })

  await maProfessorDb.groups.add({
    id: 'group',
    academicYearId: 'year',
    name: '11.º E',
    courseName: 'TAP',
    gradeLevel: '11',
    educationType: 'professional',
    active: true,
    ...audit
  })

  await maProfessorDb.subjects.add({
    id: 'subject',
    academicYearId: 'year',
    name: 'Área de Expressões',
    shortName: 'AE',
    code: '',
    active: true,
    ...audit
  })

  await maProfessorDb.teachingAssignments.add({
    id: 'assignment',
    academicYearId: 'year',
    groupId: 'group',
    subjectId: 'subject',
    displayName: 'Área de Expressões · 11.º E',
    active: true,
    ...audit
  })

  await maProfessorDb.modules.add({
    id: 'module',
    academicYearId: 'year',
    teachingAssignmentId: 'assignment',
    code: '10385',
    name: 'UFCD 10385',
    plannedPeriods: 30,
    order: 1,
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2027-06-30',
    active: true,
    ...audit
  })

  await maProfessorDb.students.add({
    id: 'student',
    academicYearId: 'year',
    groupId: 'group',
    number: '1',
    name: 'Aluno Teste',
    active: true,
    notes: '',
    ...audit
  })
}

async function createAttempt() {
  return attendanceRepository.createLearningRecovery({
    academicYearId: 'year',
    teachingAssignmentId: 'assignment',
    moduleId: 'module',
    studentId: 'student',
    status: 'pending'
  })
}

async function failAttempt(current) {
  await attendanceRepository.updateLearningRecovery(
    current.id,
    {
      activity: 'Ficha de recuperação',
      result: 'Não atingiu os objetivos.',
      status: 'completed'
    }
  )

  return attendanceRepository.setLearningRecoveryOutcome(
    current.id,
    'unsuccessful'
  )
}

after(async () => {
  await maProfessorDb.delete()
  rmSync(output, {
    recursive: true,
    force: true
  })

  if (originalWindow === undefined) {
    delete globalThis.window
  } else {
    globalThis.window = originalWindow
  }
})

test(
  'repository enforces three attempts and only then accepts exam referral',
  async () => {
    await seed()

    const first = await createAttempt()

    await assert.rejects(
      () => createAttempt(),
      /tentativa anterior/
    )

    await failAttempt(first)

    const second = await createAttempt()
    await failAttempt(second)

    await assert.rejects(
      () =>
        attendanceRepository.referLearningRecoveryToExam(
          'module',
          'student'
        ),
      /três tentativas/
    )

    const third = await createAttempt()
    await failAttempt(third)

    await assert.rejects(
      () => createAttempt(),
      /três tentativas/
    )

    const referred =
      await attendanceRepository.referLearningRecoveryToExam(
        'module',
        'student'
      )

    assert.equal(referred.id, third.id)
    assert.ok(referred.referredToExamAt)

    const persisted =
      await maProfessorDb.learningRecoveries
        .get(third.id)

    assert.ok(persisted.referredToExamAt)
  }
)

test(
  'a successful attempt closes the sequence',
  async () => {
    await seed()

    const first = await createAttempt()
    await attendanceRepository.updateLearningRecovery(
      first.id,
      {
        activity: 'Ficha de recuperação',
        result: 'Objetivos atingidos.',
        status: 'completed'
      }
    )
    await attendanceRepository.setLearningRecoveryOutcome(
      first.id,
      'successful'
    )

    await assert.rejects(
      () => createAttempt(),
      /concluída com sucesso/
    )
  }
)

test(
  'automatic synchronization never creates follow-up attempts after history already exists',
  () => {
    assert.match(
      repositorySource,
      /if \(history\.length > 0\) \{\s*return null\s*\}/
    )
    assert.match(
      repositorySource,
      /MAX_LEARNING_RECOVERY_ATTEMPTS/
    )
  }
)

test(
  'product exposes structured attempt outcomes and exam referral without a remote persistence path',
  () => {
    assert.match(
      productSource,
      /RecoveryAttemptsPanel/
    )
    assert.match(
      productSource,
      /setLearningRecoveryOutcome/
    )
    assert.match(
      productSource,
      /referLearningRecoveryToExam/
    )
    assert.match(
      panelSource,
      /Iniciar tentativa/
    )
    assert.match(
      panelSource,
      /Encaminhar para exame/
    )

    const combined = [
      attemptsSource,
      repositorySource,
      productSource,
      panelSource
    ].join('\n')

    assert.doesNotMatch(
      combined,
      /fetch\(|snapshotApi|Durable Object|wrangler|cloudflare|workers ai/i
    )
  }
)
