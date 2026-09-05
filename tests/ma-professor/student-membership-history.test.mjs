import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const membershipSource = await readFile(
  new URL(
    '../../src/components/ma-professor/students/studentMembership.ts',
    import.meta.url
  ),
  'utf8'
)

const typesSource = await readFile(
  new URL(
    '../../src/components/ma-professor/types.ts',
    import.meta.url
  ),
  'utf8'
)

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/repository.ts',
    import.meta.url
  ),
  'utf8'
)

const attendanceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/attendance/attendanceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const assessmentSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/assessmentRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const assessmentWorkspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/assessmentWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const dbSource = await readFile(
  new URL(
    '../../src/components/ma-professor/db.ts',
    import.meta.url
  ),
  'utf8'
)

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

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

test(
  'Student has optional temporal membership periods without a database schema bump',
  () => {
    assert.match(
      typesSource,
      /export interface StudentMembershipPeriod[\s\S]*startDate:\s*ISODate[\s\S]*endDate:\s*ISODate\s*\|\s*null/
    )

    assert.match(
      typesSource,
      /export interface Student[\s\S]*membershipPeriods\?:\s*StudentMembershipPeriod\[\]/
    )

    assert.match(
      dbSource,
      /MA_PROFESSOR_DATABASE_VERSION\s*=\s*1/
    )
  }
)

test(
  'membership helper handles entry, exit, re-entry and legacy students conservatively',
  async () => {
    const module = await import(
      transpile(membershipSource)
    )

    const structured = {
      id: 'student-1',
      academicYearId: 'year-1',
      groupId: 'group-1',
      number: '1',
      name: 'Ana',
      active: true,
      notes: '',
      membershipPeriods: [
        {
          startDate: '2026-09-15',
          endDate: '2026-10-31'
        },
        {
          startDate: '2026-11-10',
          endDate: null
        }
      ],
      createdAt: '2026-09-15T08:00:00.000Z',
      updatedAt: '2026-11-10T08:00:00.000Z'
    }

    assert.equal(
      module.isStudentMemberOnDate(
        structured,
        '2026-09-14'
      ),
      false
    )

    assert.equal(
      module.isStudentMemberOnDate(
        structured,
        '2026-09-15'
      ),
      true
    )

    assert.equal(
      module.isStudentMemberOnDate(
        structured,
        '2026-10-31'
      ),
      true
    )

    assert.equal(
      module.isStudentMemberOnDate(
        structured,
        '2026-11-01'
      ),
      false
    )

    assert.equal(
      module.isStudentMemberOnDate(
        structured,
        '2026-11-10'
      ),
      true
    )

    const legacyActive = {
      ...structured,
      membershipPeriods: undefined,
      active: true
    }

    const legacyInactive = {
      ...structured,
      membershipPeriods: undefined,
      active: false
    }

    assert.equal(
      module.isStudentMemberOnDate(
        legacyActive,
        '2026-09-01'
      ),
      true
    )

    assert.equal(
      module.isStudentMemberOnDate(
        legacyInactive,
        '2026-09-01'
      ),
      false
    )
  }
)

test(
  'new students persist an explicit membership start while existing students keep their history',
  () => {
    assert.match(
      repositorySource,
      /export interface StudentDraft[\s\S]*membershipStartDate\?:\s*ISODate/
    )

    assert.match(
      repositorySource,
      /membershipPeriods:\s*\[[\s\S]*startDate:[\s\S]*endDate:\s*null[\s\S]*\]/
    )

    assert.match(
      repositorySource,
      /if\s*\(\s*current\s*\)[\s\S]*membershipPeriods:\s*current\.membershipPeriods/
    )
  }
)

test(
  'attendance uses membership on the lesson date instead of current active state',
  () => {
    assert.match(
      attendanceSource,
      /isStudentMemberOnDate/
    )

    assert.match(
      attendanceSource,
      /lesson\.date/
    )

    assert.match(
      attendanceSource,
      /taughtLessons\s*=\s*lessons\.filter\([\s\S]*isStudentMemberOnDate\([\s\S]*lesson\.date/
    )

    assert.match(
      attendanceSource,
      /existingByStudent|attendanceByStudent/
    )
  }
)

test(
  'assessment registers use membership on the lesson date and preserve historical results',
  () => {
    assert.match(
      assessmentSource,
      /isStudentMemberOnDate/
    )

    assert.match(
      assessmentSource,
      /lesson\.date/
    )

    assert.match(
      assessmentSource,
      /existingResults/
    )

    assert.match(
      assessmentSource,
      /idsToDelete[\s\S]*studentById\.has/
    )
  }
)

test(
  'assessment workspace judges each activity against students who belonged to the class on that lesson date',
  () => {
    assert.match(
      assessmentWorkspaceSource,
      /isStudentMemberOnDate/
    )

    assert.match(
      assessmentWorkspaceSource,
      /lesson\.date/
    )

    assert.match(
      assessmentWorkspaceSource,
      /activityStudents|studentsForActivity|membersForLesson/
    )
  }
)
