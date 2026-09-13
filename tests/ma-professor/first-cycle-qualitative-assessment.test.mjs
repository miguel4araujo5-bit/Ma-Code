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

const typesSource = read('types.ts')
const scaleSource = read(
  'assessments/regularAssessmentScale.ts'
)
const repositorySource = read(
  'assessments/assessmentWorkspaceRepository.ts'
)
const routerSource = read(
  'assessments/AssessmentWorkspaceView.tsx'
)
const firstCycleViewSource = read(
  'assessments/FirstCycleAssessmentWorkspaceView.tsx'
)
const csvSource = read('settings/csvExport.ts')

function transpile(
  source,
  fileName,
  module = ts.ModuleKind.ESNext
) {
  const result = ts.transpileModule(
    source,
    {
      fileName,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module,
        jsx: ts.JsxEmit.ReactJSX
      }
    }
  )

  const errors = (result.diagnostics || [])
    .filter(
      diagnostic =>
        diagnostic.category ===
          ts.DiagnosticCategory.Error
    )

  assert.equal(
    errors.length,
    0,
    errors
      .map(diagnostic =>
        ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n'
        )
      )
      .join('\n')
  )

  return result.outputText
}

const scaleRuntime = transpile(
  scaleSource,
  'regularAssessmentScale.ts'
)
const scale = await import(
  `data:text/javascript;base64,${Buffer.from(scaleRuntime).toString('base64')}`
)

const csvRuntime = transpile(
  csvSource,
  'csvExport.ts'
)
const csv = await import(
  `data:text/javascript;base64,${Buffer.from(csvRuntime).toString('base64')}`
)

test(
  'first-cycle contract exposes exactly the four qualitative mentions without a numeric conversion',
  () => {
    assert.deepEqual(
      [...scale.FIRST_CYCLE_QUALITATIVE_GRADES],
      [
        'Muito Bom',
        'Bom',
        'Suficiente',
        'Insuficiente'
      ]
    )

    for (const grade of scale.FIRST_CYCLE_QUALITATIVE_GRADES) {
      assert.equal(
        scale.isFirstCycleQualitativeGrade(
          grade
        ),
        true
      )
    }

    assert.equal(
      scale.isFirstCycleQualitativeGrade(
        'Excelente'
      ),
      false
    )

    assert.match(
      scaleSource,
      /não converte automaticamente médias numéricas em menções/
    )
  }
)

test(
  'qualitative fields are optional additions to the existing final-grade record',
  () => {
    assert.match(
      typesSource,
      /export type FirstCycleQualitativeGrade[\s\S]*'Muito Bom'[\s\S]*'Bom'[\s\S]*'Suficiente'[\s\S]*'Insuficiente'/
    )
    assert.match(
      typesSource,
      /qualitativeFinalGrade\?:\s*FirstCycleQualitativeGrade\s*\|\s*null/
    )
    assert.match(
      typesSource,
      /descriptiveAssessment\?:\s*string/
    )
    assert.doesNotMatch(
      typesSource,
      /qualitativeFinalGrades:/
    )
  }
)

test(
  'first-cycle workspace keeps regular assessment context and adds an explicit teacher-entered qualitative closure',
  () => {
    transpile(
      firstCycleViewSource,
      'FirstCycleAssessmentWorkspaceView.tsx'
    )
    transpile(
      routerSource,
      'AssessmentWorkspaceView.tsx'
    )

    assert.match(
      routerSource,
      /getSummativeAssessmentScale\(group\)[\s\S]*kind\s*===\s*['"]qualitative['"][\s\S]*FirstCycleAssessmentWorkspaceView/
    )
    assert.match(
      firstCycleViewSource,
      /<RegularAssessmentWorkspaceView[\s\S]*\.\.\.props/
    )
    assert.match(
      firstCycleViewSource,
      /FIRST_CYCLE_QUALITATIVE_GRADES\.map/
    )
    assert.match(
      firstCycleViewSource,
      /Apreciação descritiva/
    )
    assert.match(
      firstCycleViewSource,
      /não determina a menção a partir das médias das atividades/
    )
    assert.match(
      firstCycleViewSource,
      /hasMAProfessorDirtyDraftRecord/
    )
    assert.match(
      firstCycleViewSource,
      /useMAProfessorUnsavedWorkspaceProtection/
    )
    assert.match(
      firstCycleViewSource,
      /qualitativeFinalGrade:[\s\S]*descriptiveAssessment:/
    )
  }
)

test(
  'qualitative grade CSV exports mention and description while hiding legacy numeric placeholders',
  () => {
    const audit = {
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z'
    }

    const output = csv.exportGradesCsv({
      academicYears: [],
      teacherProfiles: [],
      subjects: [],
      assessmentSchemes: [],
      assessmentCriteria: [],
      planifications: [],
      planificationItems: [],
      weeklyScheduleSlots: [],
      schoolCalendarEvents: [],
      lessons: [],
      summarySuggestions: [],
      lessonAttendance: [],
      lessonAssessments: [],
      assessmentResults: [],
      learningRecoveries: [],
      settings: [],
      setupProgress: [],
      groups: [{
        id: 'group',
        academicYearId: 'year',
        name: '3.º A',
        courseName: '',
        gradeLevel: '3',
        educationType: 'regular',
        active: true,
        ...audit
      }],
      teachingAssignments: [{
        id: 'assignment',
        academicYearId: 'year',
        groupId: 'group',
        subjectId: 'subject',
        displayName: 'Português · 3.º A',
        active: true,
        ...audit
      }],
      modules: [{
        id: 'annual',
        academicYearId: 'year',
        teachingAssignmentId: 'assignment',
        code: '',
        name: 'Componente anual',
        plannedPeriods: 100,
        order: 1,
        plannedStartDate: null,
        plannedEndDate: null,
        regularAnnual: true,
        active: true,
        ...audit
      }],
      students: [{
        id: 'student',
        academicYearId: 'year',
        groupId: 'group',
        number: '1',
        name: 'Ana',
        active: true,
        notes: '',
        ...audit
      }],
      moduleFinalGrades: [{
        id: 'grade',
        academicYearId: 'year',
        teachingAssignmentId: 'assignment',
        moduleId: 'annual',
        studentId: 'student',
        calculatedAverage: 14.5,
        suggestedGrade: 15,
        selfAssessmentGrade: null,
        usesAcs: false,
        finalGrade: null,
        qualitativeFinalGrade: 'Muito Bom',
        descriptiveAssessment:
          'Revela autonomia e comunica com clareza.',
        confirmedAt:
          '2026-09-13T10:00:00.000Z',
        note: '',
        ...audit
      }]
    })

    assert.match(
      output,
      /"Menção qualitativa";"Apreciação descritiva"/
    )
    assert.match(
      output,
      /"Ana";"1";"Componente anual";"";"";"";"";"";"Muito Bom";"Revela autonomia e comunica com clareza\."/
    )
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
const compiledRoot = mkdtempSync(
  join(cache, 'first-cycle-assessment-')
)
writeFileSync(
  join(compiledRoot, 'package.json'),
  '{"type":"commonjs"}'
)

const require = createRequire(import.meta.url)
const compiled = new Set()

function compile(relative) {
  if (compiled.has(relative)) {
    return
  }

  compiled.add(relative)

  const source = readFileSync(
    join(root, relative),
    'utf8'
  )
  const code = transpile(
    source,
    relative,
    ts.ModuleKind.CommonJS
  )
  const target = join(
    compiledRoot,
    relative.replace(/\.tsx?$/, '.js')
  )

  mkdirSync(
    dirname(target),
    { recursive: true }
  )
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
        dependency.slice(
          root.length + 1
        )
      )
    }
  }
}

compile(
  base +
    'assessments/assessmentWorkspaceRepository.ts'
)

const {
  maProfessorDb
} = require(
  join(compiledRoot, base, 'db.js')
)
const {
  assessmentWorkspaceRepository
} = require(
  join(
    compiledRoot,
    base,
    'assessments/assessmentWorkspaceRepository.js'
  )
)

const audit = {
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z'
}

async function seedFirstCycle() {
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
    name: '3.º A',
    courseName: '',
    gradeLevel: '3',
    educationType: 'regular',
    active: true,
    ...audit
  })
  await maProfessorDb.subjects.add({
    id: 'subject',
    academicYearId: 'year',
    name: 'Português',
    shortName: 'PORT',
    code: '',
    active: true,
    ...audit
  })
  await maProfessorDb.teachingAssignments.add({
    id: 'assignment',
    academicYearId: 'year',
    groupId: 'group',
    subjectId: 'subject',
    displayName: 'Português · 3.º A',
    active: true,
    ...audit
  })
  await maProfessorDb.modules.add({
    id: 'annual',
    academicYearId: 'year',
    teachingAssignmentId: 'assignment',
    code: '',
    name: 'Componente anual',
    plannedPeriods: 100,
    order: 1,
    plannedStartDate: null,
    plannedEndDate: null,
    regularAnnual: true,
    active: true,
    ...audit
  })
  await maProfessorDb.students.add({
    id: 'student',
    academicYearId: 'year',
    groupId: 'group',
    number: '1',
    name: 'Ana',
    active: true,
    notes: '',
    ...audit
  })
}

after(async () => {
  await maProfessorDb.delete()
  rmSync(
    compiledRoot,
    {
      recursive: true,
      force: true
    }
  )

  if (originalWindow === undefined) {
    delete globalThis.window
  } else {
    globalThis.window = originalWindow
  }
})

test(
  'persistence accepts explicit first-cycle mention plus description without inventing a numeric final grade',
  async () => {
    await seedFirstCycle()

    await assessmentWorkspaceRepository
      .saveModuleFinalGrade({
        moduleId: 'annual',
        studentId: 'student',
        finalGrade: null,
        qualitativeFinalGrade: 'Bom',
        descriptiveAssessment:
          'Participa com interesse e consolidou as aprendizagens essenciais.'
      })

    const stored =
      await maProfessorDb
        .moduleFinalGrades
        .get(
          (
            await maProfessorDb
              .moduleFinalGrades
              .toArray()
          )[0].id
        )

    assert.equal(
      stored.qualitativeFinalGrade,
      'Bom'
    )
    assert.equal(
      stored.descriptiveAssessment,
      'Participa com interesse e consolidou as aprendizagens essenciais.'
    )
    assert.equal(stored.finalGrade, null)
    assert.equal(
      stored.selfAssessmentGrade,
      null
    )
    assert.ok(stored.confirmedAt)

    const workspace =
      await assessmentWorkspaceRepository
        .getWorkspace(
          'year',
          {
            teachingAssignmentId:
              'assignment',
            moduleId: 'annual'
          }
        )

    assert.equal(
      workspace.totals.confirmedGradeCount,
      1
    )
  }
)

test(
  'persistence refuses incomplete, invalid or numeric first-cycle closures',
  async () => {
    await seedFirstCycle()

    await assert.rejects(
      assessmentWorkspaceRepository
        .saveModuleFinalGrade({
          moduleId: 'annual',
          studentId: 'student',
          finalGrade: null,
          qualitativeFinalGrade: 'Muito Bom',
          descriptiveAssessment: '   '
        }),
      /apreciação descritiva/
    )

    await assert.rejects(
      assessmentWorkspaceRepository
        .saveModuleFinalGrade({
          moduleId: 'annual',
          studentId: 'student',
          finalGrade: null,
          qualitativeFinalGrade: 'Excelente',
          descriptiveAssessment:
            'Descrição.'
        }),
      /menção qualitativa válida/
    )

    await assert.rejects(
      assessmentWorkspaceRepository
        .saveModuleFinalGrade({
          moduleId: 'annual',
          studentId: 'student',
          finalGrade: 4
        }),
      /não pode ser guardada como nota numérica/
    )

    assert.equal(
      await maProfessorDb
        .moduleFinalGrades
        .count(),
      0
    )
  }
)

test(
  'qualitative persistence remains in the existing local store and adds no Cloudflare path or schema table',
  () => {
    assert.match(
      repositorySource,
      /maProfessorDb\.moduleFinalGrades/
    )
    assert.match(
      repositorySource,
      /qualitativeFinalGrade/
    )
    assert.match(
      repositorySource,
      /descriptiveAssessment/
    )
    assert.doesNotMatch(
      repositorySource,
      /fetch\(|snapshotApi|Durable Object|wrangler|cloudflare|workers ai/i
    )
  }
)
