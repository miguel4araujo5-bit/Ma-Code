import type {
  AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepository'

export interface UfcdFinalGradeExcelModel {
  rows: Array<Array<string | number | null>>
  merges: Array<{
    s: { r: number; c: number }
    e: { r: number; c: number }
  }>
  columnWidths: number[]
  percentageCells: Array<{ row: number; column: number }>
  twoDecimalCells: Array<{ row: number; column: number }>
  oneDecimalCells: Array<{ row: number; column: number }>
  integerCells: Array<{ row: number; column: number }>
  fileName: string
  sheetName: string
}

function safeFilePart(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function moduleLabel(snapshot: AssessmentWorkspaceSnapshot) {
  const module = snapshot.selectedModule
  if (!module) return ''
  const code = module.code.trim()
  return code ? `${code} ${module.name}`.trim() : module.name.trim()
}

function getConfirmedGrades(snapshot: AssessmentWorkspaceSnapshot) {
  return snapshot.studentRows.flatMap(row =>
    row.gradeSummary.confirmedFinalGrade === null
      ? []
      : [row.gradeSummary.confirmedFinalGrade]
  )
}

function bandCount(grades: number[], min: number, max: number) {
  return grades.filter(grade => grade >= min && grade <= max).length
}

function getCompletionDate(snapshot: AssessmentWorkspaceSnapshot) {
  if (
    snapshot.studentRows.length === 0 ||
    snapshot.studentRows.some(
      row => row.gradeSummary.confirmedFinalGrade === null
    )
  ) {
    return ''
  }

  const dates = snapshot.studentRows
    .flatMap(row =>
      row.finalGradeRecord?.confirmedAt
        ? [row.finalGradeRecord.confirmedAt]
        : []
    )
    .sort()

  const latest = dates.at(-1)
  if (!latest) return ''

  const date = new Date(latest)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date)
}

export function buildUfcdFinalGradeExcelModel(
  snapshot: AssessmentWorkspaceSnapshot
): UfcdFinalGradeExcelModel {
  if (
    !snapshot.selectedGroup ||
    !snapshot.selectedSubject ||
    !snapshot.selectedModule
  ) {
    throw new Error(
      'Selecione uma turma, disciplina e UFCD antes de exportar a grelha.'
    )
  }

  const criteria = snapshot.criteria
  const criteriaStartColumn = 3
  const acsColumn = criteriaStartColumn + criteria.length
  const automaticColumn = acsColumn + 1
  const selfAssessmentColumn = automaticColumn + 1
  const finalGradeColumn = selfAssessmentColumn + 1
  const signatureColumn = finalGradeColumn + 1
  const finalColumn = signatureColumn

  const rows: Array<Array<string | number | null>> = []
  const merges: UfcdFinalGradeExcelModel['merges'] = []
  const percentageCells: UfcdFinalGradeExcelModel['percentageCells'] = []
  const twoDecimalCells: UfcdFinalGradeExcelModel['twoDecimalCells'] = []
  const oneDecimalCells: UfcdFinalGradeExcelModel['oneDecimalCells'] = []
  const integerCells: UfcdFinalGradeExcelModel['integerCells'] = []

  rows.push(Array.from({ length: finalColumn + 1 }, () => ''))
  rows[0][0] = 'CÁLCULOS DE FINAL DE MÓDULO/UFCD'
  rows[0][3] = `CURSO: ${snapshot.selectedGroup.courseName || '—'}`
  rows[0][6] = `MÓDULO/UFCD: ${moduleLabel(snapshot)}`

  merges.push(
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 0, c: 3 }, e: { r: 0, c: 5 } },
    { s: { r: 0, c: 6 }, e: { r: 0, c: finalColumn } }
  )

  rows.push(Array.from({ length: finalColumn + 1 }, () => ''))
  rows[1][0] = `Disciplina: ${snapshot.selectedSubject.name}`
  rows[1][3] = `Ano: ${snapshot.selectedGroup.gradeLevel || '—'}`
  rows[1][5] = `Turma: ${snapshot.selectedGroup.name}`
  rows[1][7] = `Ano letivo: ${snapshot.academicYear.name}`

  merges.push(
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 1, c: 3 }, e: { r: 1, c: 4 } },
    { s: { r: 1, c: 5 }, e: { r: 1, c: 6 } },
    { s: { r: 1, c: 7 }, e: { r: 1, c: finalColumn } }
  )

  const weightsRow = Array.from(
    { length: finalColumn + 1 },
    () => '' as string | number
  )

  criteria.forEach((criterion, index) => {
    const column = criteriaStartColumn + index
    weightsRow[column] = criterion.weightPercent / 100
    percentageCells.push({ row: 2, column })
  })

  weightsRow[acsColumn] = 1
  percentageCells.push({ row: 2, column: acsColumn })
  rows.push(weightsRow)

  rows.push([
    'Nº Processo',
    'Nº',
    'Aluno / Domínio',
    ...criteria.map((_, index) => `D${index + 1}`),
    'ACS',
    'Nível Automático',
    'Autoavaliação',
    'Nível Final',
    'Assinatura do Formando'
  ])

  snapshot.studentRows.forEach(row => {
    const usesAcs = row.finalGradeRecord?.usesAcs ?? false
    const outputRow: Array<string | number | null> = [
      '',
      row.student.number,
      row.student.name
    ]

    criteria.forEach(criterion => {
      const breakdown = row.gradeSummary.criteria.find(
        current => current.criterionId === criterion.id
      )
      outputRow.push(usesAcs ? null : breakdown?.average ?? null)
    })

    outputRow.push(
      usesAcs ? row.gradeSummary.provisionalAverage : null,
      row.gradeSummary.provisionalAverage,
      row.finalGradeRecord?.selfAssessmentGrade ?? null,
      row.gradeSummary.confirmedFinalGrade,
      ''
    )

    const rowIndex = rows.length
    rows.push(outputRow)

    criteria.forEach((_, index) => {
      const column = criteriaStartColumn + index
      if (typeof outputRow[column] === 'number') {
        twoDecimalCells.push({ row: rowIndex, column })
      }
    })

    if (typeof outputRow[acsColumn] === 'number') {
      twoDecimalCells.push({ row: rowIndex, column: acsColumn })
    }
    if (typeof outputRow[automaticColumn] === 'number') {
      oneDecimalCells.push({ row: rowIndex, column: automaticColumn })
    }
    if (typeof outputRow[selfAssessmentColumn] === 'number') {
      integerCells.push({ row: rowIndex, column: selfAssessmentColumn })
    }
    if (typeof outputRow[finalGradeColumn] === 'number') {
      integerCells.push({ row: rowIndex, column: finalGradeColumn })
    }
  })

  const minimumStudentRows = 25
  while (
    rows.length <
    4 + Math.max(minimumStudentRows, snapshot.studentRows.length)
  ) {
    rows.push(Array.from({ length: finalColumn + 1 }, () => ''))
  }

  rows.push([])

  const grades = getConfirmedGrades(snapshot)
  const bands = [
    ['1 - 6', bandCount(grades, 1, 6)],
    ['7 - 9', bandCount(grades, 7, 9)],
    ['10 - 13', bandCount(grades, 10, 13)],
    ['14 - 17', bandCount(grades, 14, 17)],
    ['18 - 20', bandCount(grades, 18, 20)]
  ] as const
  const negative = grades.filter(grade => grade < 10).length
  const positive = grades.filter(grade => grade >= 10).length
  const evaluated = grades.length

  rows.push([
    'AVALIAÇÃO GLOBAL',
    ...bands.map(([label]) => label),
    'NEGATIVO',
    'POSITIVO'
  ])

  rows.push([
    'Nº',
    ...bands.map(([, count]) => count),
    negative,
    positive
  ])

  const summaryPercentRow = rows.length
  rows.push([
    '%',
    ...bands.map(([, count]) => evaluated === 0 ? 0 : count / evaluated),
    evaluated === 0 ? 0 : negative / evaluated,
    evaluated === 0 ? 0 : positive / evaluated
  ])

  for (let column = 1; column <= 7; column += 1) {
    percentageCells.push({ row: summaryPercentRow, column })
  }

  rows.push([])
  rows.push([
    'Formandos Avaliados',
    evaluated,
    '',
    'Data de Conclusão do Módulo',
    getCompletionDate(snapshot),
    '',
    '',
    'O/A Professor(a)'
  ])

  const moduleCode = safeFilePart(
    snapshot.selectedModule.code || snapshot.selectedModule.name
  ) || 'UFCD'
  const groupName = safeFilePart(snapshot.selectedGroup.name) || 'Turma'

  return {
    rows,
    merges,
    columnWidths: [
      13,
      8,
      34,
      ...criteria.map(() => 11),
      11,
      16,
      15,
      13,
      24
    ],
    percentageCells,
    twoDecimalCells,
    oneDecimalCells,
    integerCells,
    fileName: `Grelha-Avaliacao-${groupName}-${moduleCode}.xlsx`,
    sheetName: 'Grelha Final'
  }
}
