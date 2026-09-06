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
  resolveLessonStatusForDate
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
  'future preparation stays planned while today past and cancellation keep their normal status',
  () => {
    const referenceDate = '2026-09-06'

    assert.equal(
      resolveLessonStatusForDate(
        '2026-09-07',
        'taught',
        referenceDate
      ),
      'planned'
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
  'explicit future GIAE/taught guard still rejects invalid submitted-state paths',
  () => {
    assert.throws(
      () =>
        assertLessonNotTaughtInFuture(
          '2026-09-07',
          'taught',
          '2026-09-06'
        ),
      /aula futura não pode ser marcada como dada/i
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
  'lesson repository normalizes future taught writes and guards GIAE individual and bulk submission',
  () => {
    assert.match(
      lessonRepositorySource,
      /override async createLesson\([\s\S]*resolveLessonStatusForDate\(/s
    )
    assert.match(
      lessonRepositorySource,
      /override async updateLesson\([\s\S]*const nextStatus =[\s\S]*resolveLessonStatusForDate\(/s
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
  'Daily future preparation rejects GIAE attendance and assessment input before persistence',
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
      /const futurePreparation =[\s\S]*isFutureLessonDate\(/s
    )
    assert.match(
      saveBody,
      /const effectiveStatus =[\s\S]*resolveLessonStatusForDate\(/s
    )
    assert.match(
      saveBody,
      /futurePreparation &&[\s\S]*input\.giaeStatus ===[\s\S]*'submitted'[\s\S]*aula futura não pode ser marcada como submetida no GIAE/i
    )
    assert.match(
      saveBody,
      /futurePreparation &&[\s\S]*input\.assessment\.mode !==[\s\S]*'none'[\s\S]*aula futura ainda não pode receber avaliações/i
    )
    assert.match(
      saveBody,
      /futurePreparation &&[\s\S]*hasFutureAttendanceOrAssessmentInput\([\s\S]*aula futura ainda não pode receber faltas ou classificações/i
    )
    assert.match(
      saveBody,
      /status:\s*currentEffectiveStatus/s
    )
  }
)

test(
  'Daily only persists attendance and assessments after the normalized lesson is actually taught',
  () => {
    const updatedStatusGuard =
      dailyRepositorySource.indexOf(
        "updated.status !==\n          'taught'"
      )
    const attendanceSave =
      dailyRepositorySource.indexOf(
        'attendanceRepository.saveLessonAttendance(',
        updatedStatusGuard
      )
    const assessmentCreate =
      dailyRepositorySource.indexOf(
        'assessmentRepository.createLessonAssessment(',
        attendanceSave
      )

    assert.ok(
      updatedStatusGuard >= 0,
      'Deve existir saída antecipada quando a aula normalizada não está dada.'
    )
    assert.ok(
      attendanceSave > updatedStatusGuard,
      'A assiduidade só deve ser guardada depois da verificação do estado efetivo.'
    )
    assert.ok(
      assessmentCreate > attendanceSave,
      'A avaliação deve ficar atrás da mesma barreira de estado efetivo.'
    )
  }
)

test(
  'attendance and assessment repositories already require a taught lesson',
  () => {
    assert.match(
      attendanceRepositorySource,
      /async saveLessonAttendance\([\s\S]*lesson\.status !==[\s\S]*'taught'[\s\S]*assiduidade só pode ser guardada depois de a aula ser marcada como dada/i
    )

    assert.match(
      assessmentRepositorySource,
      /async createLessonAssessment\([\s\S]*context\.lesson\.status !==[\s\S]*'taught'[\s\S]*avaliação só pode ser registada depois de a aula ser marcada como dada/i
    )
  }
)
