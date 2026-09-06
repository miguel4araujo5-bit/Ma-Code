import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  DailyWorkspaceRepository,
  lessonDraft,
  loadLesson,
  resetDailyState,
  studentDrafts
} from './daily-workflow-harness.mjs'

const dailyViewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const dailyPreparationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyScheduledLessonPreparation.ts',
    import.meta.url
  ),
  'utf8'
)

const productSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/MAProfessorProduct.tsx',
    import.meta.url
  ),
  'utf8'
)

function getSection(
  source,
  startMarker,
  endMarker
) {
  const start =
    source.indexOf(startMarker)
  const end =
    source.indexOf(
      endMarker,
      start
    )

  assert.notEqual(
    start,
    -1,
    `Não foi encontrado ${startMarker}`
  )
  assert.notEqual(
    end,
    -1,
    `Não foi encontrado ${endMarker}`
  )

  return source.slice(start, end)
}

test(
  'summary and attendance survive save and a fresh repository reload',
  { concurrency: false },
  async () => {
    const state =
      resetDailyState()
    const repository =
      new DailyWorkspaceRepository()

    await loadLesson(repository)

    await repository.saveLesson(
      lessonDraft({
        summary:
          'Sumário persistido para reabrir.',
        students:
          studentDrafts({
            brunoAbsent: true
          })
      })
    )

    assert.equal(
      state.transactions,
      1
    )

    const reopened =
      await loadLesson(
        new DailyWorkspaceRepository()
      )

    assert.equal(
      reopened.context.lessonRow.lesson.summary,
      'Sumário persistido para reabrir.'
    )
    assert.equal(
      reopened.context.lessonRow.lesson.status,
      'taught'
    )

    const bruno =
      reopened.students.find(
        row =>
          row.student.id ===
          'student-2'
      )

    assert.ok(bruno)
    assert.equal(
      bruno.attendanceStatus,
      'absent'
    )
    assert.equal(
      bruno.attendanceCode,
      'F'
    )
    assert.equal(
      bruno.attendanceNote,
      'Falta registada.'
    )
  }
)

test(
  'assessment and student results survive save and reload',
  { concurrency: false },
  async () => {
    resetDailyState()
    const repository =
      new DailyWorkspaceRepository()

    await loadLesson(repository)

    const saved =
      await repository.saveLesson(
        lessonDraft({
          summary:
            'Avaliação prática realizada.',
          students:
            studentDrafts({
              brunoAbsent: true,
              anaScore: 18,
              assessment: true
            }),
          assessment: {
            mode: 'new',
            assessmentId: null,
            criterionId:
              'criterion-1',
            title:
              'Exercício prático',
            activityType:
              'practical_work',
            description:
              'Aplicação dos conteúdos.'
          }
        })
      )

    assert.ok(saved.assessmentId)

    const reopened =
      await new DailyWorkspaceRepository()
        .getLessonWorkspace(
          'year-1',
          'lesson-1',
          saved.assessmentId
        )

    assert.equal(
      reopened.selectedAssessment?.title,
      'Exercício prático'
    )

    const ana =
      reopened.students.find(
        row =>
          row.student.id ===
          'student-1'
      )
    const bruno =
      reopened.students.find(
        row =>
          row.student.id ===
          'student-2'
      )

    assert.ok(ana)
    assert.ok(bruno)
    assert.equal(
      ana.assessmentStatus,
      'evaluated'
    )
    assert.equal(
      ana.assessmentScore,
      18
    )
    assert.equal(
      ana.assessmentNote,
      'Bom desempenho.'
    )
    assert.equal(
      bruno.assessmentStatus,
      'absent'
    )
    assert.equal(
      bruno.assessmentScore,
      null
    )
  }
)

test(
  'a stale second repository cannot overwrite a newer lesson',
  { concurrency: false },
  async () => {
    resetDailyState()

    const first =
      new DailyWorkspaceRepository()
    const second =
      new DailyWorkspaceRepository()

    await loadLesson(first)
    await loadLesson(second)

    await first.saveLesson(
      lessonDraft({
        summary:
          'Alteração guardada na primeira aba.'
      })
    )

    await assert.rejects(
      () =>
        second.saveLesson(
          lessonDraft({
            summary:
              'Alteração antiga da segunda aba.'
          })
        ),
      /alterada noutra aba ou janela/i
    )

    const reopened =
      await loadLesson(
        new DailyWorkspaceRepository()
      )

    assert.equal(
      reopened.context.lessonRow.lesson.summary,
      'Alteração guardada na primeira aba.'
    )
  }
)

test(
  'a stale Daily workspace cannot overwrite newer attendance when the lesson version did not change',
  { concurrency: false },
  async () => {
    const state =
      resetDailyState()

    state.lesson = {
      ...state.lesson,
      status: 'taught',
      summary: 'Sumário já guardado.'
    }

    const repository =
      new DailyWorkspaceRepository()

    await loadLesson(repository)

    state.attendance['student-2'] = {
      studentId: 'student-2',
      status: 'absent',
      code: 'F',
      note: 'Falta alterada noutra aba.'
    }

    await assert.rejects(
      () =>
        repository.saveLesson(
          lessonDraft({
            summary:
              'Sumário já guardado.',
            students:
              studentDrafts()
          })
        ),
      /assiduidade ou a avaliação.*outra aba ou janela/i
    )

    assert.equal(
      state.lesson.updatedAt,
      'v1'
    )
    assert.equal(
      state.attendance['student-2'].status,
      'absent'
    )
    assert.equal(
      state.attendance['student-2'].note,
      'Falta alterada noutra aba.'
    )
  }
)

test(
  'a taught lesson without a summary is rejected before persistence',
  { concurrency: false },
  async () => {
    const state =
      resetDailyState()
    const repository =
      new DailyWorkspaceRepository()

    await loadLesson(repository)

    await assert.rejects(
      () =>
        repository.saveLesson(
          lessonDraft({
            summary: '   '
          })
        ),
      /Indique o sumário/i
    )

    assert.equal(
      state.transactions,
      0
    )
    assert.equal(
      state.lesson.status,
      'planned'
    )
    assert.equal(
      state.lesson.summary,
      ''
    )
  }
)

test(
  'operational readiness preserves the valid year while Daily still waits for preparation',
  () => {
    assert.match(
      productSource,
      /ensureDailyScheduledLessonsForDate/
    )

    const refreshAcademicYear =
      getSection(
        productSource,
        'const refreshAcademicYear =',
        'useEffect(() => {'
      )

    const readinessPosition =
      refreshAcademicYear.indexOf(
        'isMAProfessorOperationallyReady('
      )
    const readyStatePosition =
      refreshAcademicYear.indexOf(
        'setOperationalReady('
      )
    const preparePosition =
      refreshAcademicYear.indexOf(
        'await ensureDailyScheduledLessonsForDate('
      )

    assert.ok(readinessPosition >= 0)
    assert.ok(readyStatePosition >= 0)
    assert.ok(preparePosition >= 0)
    assert.ok(
      readinessPosition < readyStatePosition &&
      readyStatePosition < preparePosition,
      'O estado válido do ano deve ser preservado antes de uma preparação diária que pode falhar.'
    )

    assert.match(
      productSource,
      /workspace ===[\s\S]*'daily'[\s\S]*academicYear &&[\s\S]*operationalReady &&[\s\S]*dailyPreparationReady &&[\s\S]*<DailyWorkspaceView/,
      'O Daily só pode montar depois de a preparação diária estar confirmada.'
    )
  }
)

test(
  'Daily schedule preparation is date-scoped and preserves the S. Bento preset ordering',
  () => {
    assert.match(
      dailyPreparationSource,
      /isSBentoSchoolName/
    )
    assert.match(
      dailyPreparationSource,
      /ensureInitialSchoolCalendar2026_2027/
    )
    assert.match(
      dailyPreparationSource,
      /preparedSBentoYears/
    )
    assert.match(
      dailyPreparationSource,
      /preparation\.applied/
    )
    assert.match(
      dailyPreparationSource,
      /scheduledLessonReconciliationRepository\.reconcile\(\{[\s\S]*dateFrom:\s*date,[\s\S]*dateTo:\s*date/
    )
  }
)

test(
  'internal date and lesson navigation saves dirty data before loading the target',
  () => {
    const saveGuard =
      getSection(
        dailyViewSource,
        'async function saveBeforeNavigation()',
        'navigationGuardRef.current'
      )

    assert.match(
      saveGuard,
      /return saveAll\(\{[\s\S]*reload:\s*false,[\s\S]*announce:\s*false/
    )

    const changeDate =
      getSection(
        dailyViewSource,
        'async function changeDate(',
        'async function selectLesson('
      )

    const savePosition =
      changeDate.indexOf(
        'await saveBeforeNavigation()'
      )
    const loadPosition =
      changeDate.lastIndexOf(
        'await loadDate('
      )

    assert.ok(savePosition >= 0)
    assert.ok(loadPosition >= 0)
    assert.ok(
      savePosition < loadPosition,
      'A navegação tem de guardar antes de carregar o destino.'
    )
    assert.match(
      changeDate,
      /!\(await saveBeforeNavigation\(\)\)/
    )
  }
)

test(
  'leaving Daily for another product workspace waits for the registered save guard',
  () => {
    const handleSelect =
      getSection(
        productSource,
        'const handleSelect =',
        'const handleDataChanged ='
      )

    const guardPosition =
      handleSelect.indexOf(
        'dailyNavigationGuardRef.current?.()'
      )
    const finalWorkspacePosition =
      handleSelect.lastIndexOf(
        'setWorkspace('
      )

    assert.ok(guardPosition >= 0)
    assert.ok(finalWorkspacePosition >= 0)
    assert.ok(
      guardPosition < finalWorkspacePosition,
      'O guard diário tem de correr antes da mudança de workspace.'
    )
    assert.match(
      handleSelect,
      /if \(!canLeave\) \{[\s\S]*return/
    )
  }
)
