import { sanitizeFileName } from '../../../lib/maPdf/fileUtils'
import type { AssessmentWorkspaceSnapshot } from './assessmentWorkspaceRepository'

export interface GIAEGradeCsvRow {
  studentId: string
  studentNumber: string
  studentName: string
  processNumber: string
  grade: number
}

export function buildGIAEGradeCsvExport(snapshot: AssessmentWorkspaceSnapshot) {
  const group = snapshot.selectedGroup
  const subject = snapshot.selectedSubject
  const module = snapshot.selectedModule
  if (!group || !subject || !module) {
    throw new Error('Selecione a turma, a disciplina e o módulo/UC/UFCD antes de exportar as notas.')
  }

  const processNumber = (row: AssessmentWorkspaceSnapshot['studentRows'][number]) =>
    typeof row.student.processNumber === 'string' ? row.student.processNumber.trim() : ''
  const processKey = (value: string) => value.replace(/^0+(?=\d)/, '')
  const processCounts = new Map<string, number>()
  for (const row of snapshot.studentRows) {
    const value = processNumber(row)
    if (/^\d+$/.test(value)) {
      const key = processKey(value)
      processCounts.set(key, (processCounts.get(key) ?? 0) + 1)
    }
  }

  const rows: GIAEGradeCsvRow[] = []
  const omittedRows: Array<{ studentId: string; studentName: string; reason: string }> = []
  for (const row of snapshot.studentRows) {
    const value = processNumber(row)
    const grade = row.gradeSummary.confirmedFinalGrade
    let reason = ''
    if (row.recoveryPending) reason = 'Avaliação pendente por recuperação'
    else if (grade === null || grade === undefined) reason = 'Sem classificação final guardada'
    else if (!Number.isInteger(grade) || grade < 0 || grade > 20) reason = 'Classificação final inválida'
    else if (!value) reason = 'Sem n.º de processo — preencha-o na ficha do aluno em Turmas'
    else if (!/^\d+$/.test(value)) reason = 'O n.º de processo deve conter apenas algarismos'
    else if ((processCounts.get(processKey(value)) ?? 0) > 1) reason = 'N.º de processo repetido na turma'

    if (reason) {
      omittedRows.push({ studentId: row.student.id, studentName: row.student.name, reason })
    } else {
      rows.push({ studentId: row.student.id, studentNumber: row.student.number,
        studentName: row.student.name, processNumber: value, grade: grade! })
    }
  }

  // The GIAE import applies to the unit selected in the school program.
  // Do not export private notes, draft grades or automatic suggestions.
  const csv = ['N_PROCESSO,AVALIACAO,ALINEA,SINTESE',
    ...rows.map(row => `${row.processNumber},${row.grade},,""`), ''].join('\r\n')
  const fileName = sanitizeFileName(
    `Notas-GIAE-${group.name}-${subject.shortName || subject.name}-${module.code || module.name}`
  ) + '.csv'
  return { rows, omittedRows, csv, fileName }
}
