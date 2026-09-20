import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
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

  assert.equal(
    errors.length,
    0,
    errors.map(item =>
      ts.flattenDiagnosticMessageText(
        item.messageText,
        '\n'
      )
    ).join('\n')
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const temporalSafetySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonTemporalSafety.ts',
    import.meta.url
  ),
  'utf8'
)

const lessonRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const dailyRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const dailyWorkspaceViewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const attendanceRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/attendance/attendanceRepositoryBase.ts',
    import.meta.url
  ),
  'utf8'
)

const assessmentRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/assessmentRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const temporalSafetyModule = await import(
  transpile(temporalSafetySource)
)

const {
  assertLessonNotTaughtInFuture,
  isFutureLessonDate,
  resolveLessonStatusForDate,
  resolveLessonStatusFromEvidence
} = temporalSafetyModule

test(
  'future lesson dates are distinguished from today and past dates',
  () => {
    const referenceDate = '2026-09-06'

    assert.equal(
      isFutureLessonDate(
        '2026-09-07',
        referenceDate
      ),
      true
    )
    assert.equal(
      isFutureLessonDate(
        '2026-09-06',
        referenceDate
      ),
      false
    )
    assert.equal(
      isFutureLessonDate(
        '2026-09-05',
        referenceDate
      ),
      false
    )
  }
)

test(
  'legacy date helper preserves the status requested by the professor',
  () => {
    const referenceDate = '2026-09-06'

    assert.equal(
      resolveLessonStatusForDate(
        '2026-09-07',
        'taught',
        referenceDate
      ),
      'taught'
    )
    assert.equal(
      resolveLessonStatusForDate(
        '2026-09-06',
        'taught',
        referenceDate
      ),
      'taught'
    )
    assert.equal(
      resolveLessonStatusForDate(
        '2026-09-05',
        'taught',
        referenceDate
      ),
      'taught'
    )
    assert.equal(
      resolveLessonStatusForDate(
        '2026-09-07',
        'cancelled',
        referenceDate
      ),
      'cancelled'
    )
  }
)

test(
  'summary and GIAE evidence determine whether the lesson is planned or taught',
  () => {
    const today = '2026-09-06'

    assert.equal(
      resolveLessonStatusFromEvidence(
        '2026-09-05',
        'planned',
        'Sumário.',
        'pending',
        today
      ),
      'taught',
      'Uma aula passada com sumário deve contar como dada.'
    )

    assert.equal(
      resolveLessonStatusFromEvidence(
        today,
        'planned',
        'Sumário.',
        'pending',
        today
      ),
      'taught',
      'Uma aula de hoje com sumário deve contar imediatamente como dada.'
    )

    assert.equal(
      resolveLessonStatusFromEvidence(
        '2026-09-07',
        'taught',
        'Sumário preparado.',
        'pending',
        today
      ),
      'planned',
      'Uma aula futura com sumário mas sem submissão no GIAE deve continuar planeada.'
    )

    assert.equal(
      resolveLessonStatusFromEvidence(
        '2026-09-07',
        'planned',
        'Sumário preparado.',
        'submitted',
        today
      ),
      'taught',
      'Uma aula futura explicitamente submetida no GIAE deve passar a dada.'
    )

    assert.equal(
      resolveLessonStatusFromEvidence(
        '2026-09-07',
        'taught',
        '',
        'submitted',
        today
      ),
      'planned',
      'Sem sumário a aula não pode ser dada.'
    )

    assert.equal(
      resolveLessonStatusFromEvidence(
        '2026-09-07',
        'cancelled',
        'Sumário.',
        'submitted',
        today
      ),
      'cancelled'
    )
  }
)

test(
  'Daily explains future-summary behaviour without changing the temporal rule',
  () => {
    assert.match(
      dailyWorkspaceViewSource,
      /lessonIsFuture[\s\S]*Aula futura: guardar o sumário mantém-na planeada até ser marcada como submetida no GIAE\./
    )
    assert.match(
      dailyWorkspaceViewSource,
      /Ao guardar o sumário, a aula fica registada como realizada\./
    )
    assert.match(
      dailyWorkspaceViewSource,
      /sm:flex-1 sm:pr-3/
    )
    assert.match(
      dailyWorkspaceViewSource,
      /flex shrink-0 flex-wrap items-center justify-end gap-2/
    )
    assert.doesNotMatch(
      dailyWorkspaceViewSource,
      /Ao escrever[\s\S]*um sumário,[\s\S]*a aula passa[\s\S]*a dada quando[\s\S]*guardar\./
    )
  }
)

test(
  'future dates no longer reject a taught status at the legacy assertion layer',
  () => {
    assert.doesNotThrow(() =>
      assertLessonNotTaughtInFuture(
        '2026-09-07',
        'taught',
        '2026-09-06'
      )
    )

    assert.doesNotThrow(() =>
      assertLessonNotTaughtInFuture(
        '2026-09-06',
        'taught',
        '2026-09-06'
      )
    )
  }
)

test(
  'lesson repository applies the evidence rule on create and update',
  () => {
    assert.match(
      lessonRepositorySource,
      /override async createLesson\([\s\S]*resolveLessonStatusFromEvidence\(/s
    )
    assert.match(
      lessonRepositorySource,
      /override async updateLesson\([\s\S]*const nextStatus =[\s\S]*resolveLessonStatusFromEvidence\(/s
    )
    assert.match(
      lessonRepositorySource,
      /markGIAESubmittedExplicit\(/
    )

    const submittedStart =
      lessonRepositorySource.indexOf(
        'override async markGIAESubmitted('
      )
    const manyStart =
      lessonRepositorySource.indexOf(
        'override async markManyGIAESubmitted(',
        submittedStart
      )

    assert.ok(
      submittedStart >= 0 &&
      manyStart > submittedStart
    )

    assert.match(
      lessonRepositorySource.slice(
        submittedStart,
        manyStart
      ),
      /markGIAESubmittedExplicit\(/s
    )

    assert.match(
      lessonRepositorySource.slice(
        submittedStart,
        manyStart
      ),
      /assertLessonNotTaughtInFuture\(\s*lesson\.date,\s*lesson\.status\s*\)/s
    )

    assert.match(
      lessonRepositorySource.slice(
        manyStart
      ),
      /assertLessonNotTaughtInFuture\(\s*lesson\.date,\s*lesson\.status\s*\)/s
    )
  }
)

test(
  'Daily keeps using the central repository without future-date attendance or assessment bypasses',
  () => {
    const saveStart =
      dailyRepositorySource.indexOf(
        'async saveLesson('
      )
    const describeStart =
      dailyRepositorySource.indexOf(
        'describeError(',
        saveStart
      )
    const saveBody =
      dailyRepositorySource.slice(
        saveStart,
        describeStart
      )

    assert.match(
      saveBody,
      /const effectiveStatus =[\s\S]*resolveLessonStatusForDate\(/s
    )
    assert.doesNotMatch(
      saveBody,
      /aula futura não pode ser marcada como submetida no GIAE/i
    )
    assert.doesNotMatch(
      saveBody,
      /aula futura ainda não pode receber faltas/i
    )
    assert.doesNotMatch(
      saveBody,
      /hasFutureAttendanceInput/
    )
    assert.match(
      saveBody,
      /status:\s*currentEffectiveStatus/s
    )
  }
)

test(
  'Daily persists attendance for any non-cancelled lesson with a saved summary, including future planned lessons',
  () => {
    const attendanceGuard =
      dailyRepositorySource.indexOf(
        "updated.status !==\n            'cancelled'"
      )
    const attendanceSave =
      dailyRepositorySource.indexOf(
        'attendanceRepository.saveLessonAttendance(',
        attendanceGuard
      )
    const assessmentMode =
      dailyRepositorySource.indexOf(
        "input.assessment\n            .mode === 'none'",
        attendanceSave
      )
    const assessmentCreate =
      dailyRepositorySource.indexOf(
        'assessmentRepository.createLessonAssessment(',
        assessmentMode
      )

    assert.ok(
      attendanceGuard >= 0,
      'A assiduidade deve depender apenas de a aula não estar cancelada.'
    )
    assert.match(
      dailyRepositorySource.slice(
        attendanceGuard,
        attendanceSave
      ),
      /updated\.summary\.trim\(\)/
    )
    assert.ok(
      attendanceSave > attendanceGuard,
      'A assiduidade deve ser guardada quando existe sumário, mesmo que a aula futura permaneça planeada.'
    )
    assert.ok(
      assessmentMode > attendanceSave &&
      assessmentCreate > assessmentMode,
      'A avaliação deve continuar depois do bloco de assiduidade.'
    )
    assert.match(
      dailyRepositorySource,
      /effectiveStatus ===[\s\S]*'cancelled'[\s\S]*Não é possível guardar uma avaliação numa aula cancelada/i
    )
  }
)

test(
  'attendance requires a saved summary instead of a taught status, while cancelled lessons remain protected',
  () => {
    assert.match(
      attendanceRepositorySource,
      /async saveLessonAttendance\([\s\S]*lesson\.status ===[\s\S]*'cancelled'[\s\S]*Não é possível guardar assiduidade numa aula cancelada/i
    )
    assert.match(
      attendanceRepositorySource,
      /!lesson\.summary\.trim\(\)[\s\S]*Guarde primeiro o sumário da aula antes de registar faltas/i
    )
    assert.doesNotMatch(
      attendanceRepositorySource,
      /lesson\.status !==[\s\S]{0,80}'taught'[\s\S]{0,180}assiduidade só pode/i
    )

    assert.match(
      assessmentRepositorySource,
      /async createLessonAssessment\([\s\S]*context\.lesson\.status ===[\s\S]*'cancelled'[\s\S]*Não é possível registar uma avaliação numa aula cancelada/i
    )
    assert.match(
      assessmentRepositorySource,
      /async updateLessonAssessment\([\s\S]*lesson\.status ===[\s\S]*'cancelled'[\s\S]*Não é possível alterar uma avaliação de uma aula cancelada/i
    )
    assert.match(
      assessmentRepositorySource,
      /async saveAssessmentResults\([\s\S]*lesson\.status ===[\s\S]*'cancelled'[\s\S]*Não é possível guardar classificações numa aula cancelada/i
    )
  }
)


test(
  'manual GIAE submission can activate a future lesson and manual pending restores it to planned',
  () => {
    assert.match(
      lessonRepositorySource,
      /async markGIAESubmittedExplicit\([\s\S]*status:\s*'taught'[\s\S]*giaeStatus:\s*'submitted'/s
    )

    assert.match(
      lessonRepositorySource,
      /async markGIAEPendingExplicit\([\s\S]*isFutureLessonDate\([\s\S]*pending\.date[\s\S]*status:[\s\S]*'planned'/s
    )
  }
)
