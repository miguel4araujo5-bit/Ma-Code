import { maProfessorDb, openMAProfessorDatabase } from '../db'
import { schemeAssessmentProfile } from '../assessments/assessmentProfiles'
import { markDashboardDataDirty } from '../dashboard/dashboardRefreshSignal'
import type { AssessmentCriterion, AssessmentProfile, EntityId } from '../types'

export interface AbsenceCriterionSetting {
  criterion: AssessmentCriterion
  profile: AssessmentProfile
  teachingAssignmentId: EntityId
  schemeLabel: string
}

export async function loadAbsenceGradeSettings(academicYearId: EntityId) {
  await openMAProfessorDatabase()
  const [assignments, schemes, criteria, modules, groups] = await Promise.all([
    maProfessorDb.teachingAssignments.where('academicYearId').equals(academicYearId).toArray(),
    maProfessorDb.assessmentSchemes.where('academicYearId').equals(academicYearId).toArray(),
    maProfessorDb.assessmentCriteria.toArray(),
    maProfessorDb.modules.where('academicYearId').equals(academicYearId).toArray(),
    maProfessorDb.groups.where('academicYearId').equals(academicYearId).toArray()
  ])
  const professionalGroups = new Set(groups.filter(row => row.active && (row.educationType ?? 'professional') === 'professional').map(row => row.id))
  const activeAssignments = assignments.filter(row => row.active && professionalGroups.has(row.groupId))
  const assignmentIds = new Set(activeAssignments.map(row => row.id))
  const rows: AbsenceCriterionSetting[] = []
  for (const scheme of schemes.filter(row => row.active && assignmentIds.has(row.teachingAssignmentId))) {
    const module = scheme.moduleId ? modules.find(row => row.id === scheme.moduleId) : null
    if (scheme.scope === 'module' && !module?.active) continue
    for (const criterion of criteria.filter(row => row.active && row.schemeId === scheme.id).sort((a, b) => a.order - b.order)) {
      rows.push({ criterion, profile: schemeAssessmentProfile(scheme), teachingAssignmentId: scheme.teachingAssignmentId,
        schemeLabel: scheme.scope === 'module' ? `${module?.code ?? ''} · ${module?.name ?? scheme.name}` : 'Critérios gerais da disciplina' })
    }
  }
  return { assignments: activeAssignments, rows }
}

export async function saveAbsenceGradeSettings(academicYearId: EntityId, teachingAssignmentId: EntityId, profile: AssessmentProfile,
  entries: { criterionId: EntityId; grade: number | null; expectedUpdatedAt: string }[]) {
  await openMAProfessorDatabase()
  if (profile !== 'general' && profile !== 'acs') throw new Error('Selecione o perfil de avaliação.')
  if (new Set(entries.map(row => row.criterionId)).size !== entries.length) throw new Error('Um critério aparece mais do que uma vez.')
  for (const row of entries) {
    if (row.grade !== null && (!Number.isFinite(row.grade) || row.grade < 0 || row.grade > 20)) {
      throw new Error('A nota de falta deve estar entre 0 e 20. Deixe vazio para não contar na média.')
    }
  }
  await maProfessorDb.transaction('rw', maProfessorDb.tables, async () => {
    const configuration = await loadAbsenceGradeSettings(academicYearId)
    const allowed = new Map(configuration.rows.filter(row => row.teachingAssignmentId === teachingAssignmentId && row.profile === profile).map(row => [row.criterion.id, row.criterion]))
    const timestamp = new Date().toISOString()
    for (const entry of entries) {
      const criterion = allowed.get(entry.criterionId)
      if (!criterion || criterion.updatedAt !== entry.expectedUpdatedAt) throw new Error('Os critérios foram alterados entretanto. Reabra as definições antes de guardar.')
      if ((criterion.absenceGrade ?? null) !== entry.grade) {
        await maProfessorDb.assessmentCriteria.put({ ...criterion, absenceGrade: entry.grade, updatedAt: timestamp })
      }
    }
  })
  markDashboardDataDirty()
}
