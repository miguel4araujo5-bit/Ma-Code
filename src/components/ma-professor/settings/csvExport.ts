import type { MAProfessorBackupData } from '../types'

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined
    ? ''
    : String(value)

  return `"${text.replace(/"/g, '""')}"`
}

function createCsv(
  headers: string[],
  rows: unknown[][]
) {
  return `\uFEFF${[
    headers,
    ...rows
  ]
    .map(row => row.map(escapeCsv).join(';'))
    .join('\r\n')}`
}

export function downloadTextFile(
  fileName: string,
  content: string,
  type = 'text/plain;charset=utf-8'
) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function exportStudentsCsv(
  data: MAProfessorBackupData
) {
  const groupById = new Map(
    data.groups.map(group => [group.id, group])
  )

  return createCsv(
    [
      'Ano letivo',
      'Turma',
      'Curso',
      'Número',
      'Aluno',
      'Ativo',
      'Notas'
    ],
    data.students.map(student => {
      const group = groupById.get(student.groupId)
      const year = data.academicYears.find(
        item => item.id === student.academicYearId
      )

      return [
        year?.name,
        group?.name,
        group?.courseName,
        student.number,
        student.name,
        student.active ? 'Sim' : 'Não',
        student.notes
      ]
    })
  )
}

export function exportLessonsCsv(
  data: MAProfessorBackupData
) {
  const assignmentById = new Map(
    data.teachingAssignments.map(item => [item.id, item])
  )
  const groupById = new Map(
    data.groups.map(item => [item.id, item])
  )
  const subjectById = new Map(
    data.subjects.map(item => [item.id, item])
  )
  const moduleById = new Map(
    data.modules.map(item => [item.id, item])
  )

  return createCsv(
    [
      'Data',
      'Início',
      'Fim',
      'Turma',
      'Disciplina',
      'UFCD/Módulo',
      'Tempos',
      'Estado',
      'Conta para progresso',
      'Sumário',
      'GIAE',
      'Notas'
    ],
    [...data.lessons]
      .sort((left, right) =>
        `${left.date} ${left.startTime}`.localeCompare(
          `${right.date} ${right.startTime}`
        )
      )
      .map(lesson => {
        const assignment = assignmentById.get(
          lesson.teachingAssignmentId
        )
        const group = assignment
          ? groupById.get(assignment.groupId)
          : null
        const subject = assignment
          ? subjectById.get(assignment.subjectId)
          : null
        const module = moduleById.get(lesson.moduleId)

        return [
          lesson.date,
          lesson.startTime,
          lesson.endTime,
          group?.name,
          subject?.name,
          [module?.code, module?.name].filter(Boolean).join(' · '),
          lesson.periodCount,
          lesson.status,
          lesson.countTowardProgress ? 'Sim' : 'Não',
          lesson.summary,
          lesson.giaeStatus,
          lesson.notes
        ]
      })
  )
}

export function exportAttendanceCsv(
  data: MAProfessorBackupData
) {
  const lessonById = new Map(
    data.lessons.map(item => [item.id, item])
  )
  const studentById = new Map(
    data.students.map(item => [item.id, item])
  )
  const moduleById = new Map(
    data.modules.map(item => [item.id, item])
  )

  return createCsv(
    [
      'Data',
      'Aluno',
      'Número',
      'UFCD/Módulo',
      'Presença',
      'Código',
      'Nota'
    ],
    data.lessonAttendance.map(attendance => {
      const lesson = lessonById.get(attendance.lessonId)
      const student = studentById.get(attendance.studentId)
      const module = lesson
        ? moduleById.get(lesson.moduleId)
        : null

      return [
        lesson?.date,
        student?.name,
        student?.number,
        [module?.code, module?.name].filter(Boolean).join(' · '),
        attendance.status === 'present' ? 'Presente' : 'Faltou',
        attendance.code,
        attendance.note
      ]
    })
  )
}

export function exportGradesCsv(
  data: MAProfessorBackupData
) {
  const studentById = new Map(
    data.students.map(item => [item.id, item])
  )
  const moduleById = new Map(
    data.modules.map(item => [item.id, item])
  )

  return createCsv(
    [
      'Aluno',
      'Número',
      'UFCD/Módulo',
      'Média calculada',
      'Nota sugerida',
      'Nota final',
      'Confirmada em',
      'Nota'
    ],
    data.moduleFinalGrades.map(grade => {
      const student = studentById.get(grade.studentId)
      const module = moduleById.get(grade.moduleId)

      return [
        student?.name,
        student?.number,
        [module?.code, module?.name].filter(Boolean).join(' · '),
        grade.calculatedAverage,
        grade.suggestedGrade,
        grade.finalGrade,
        grade.confirmedAt,
        grade.note
      ]
    })
  )
}
