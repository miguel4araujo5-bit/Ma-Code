import { studentAssignmentAssessmentProfile } from '../assessments/assessmentProfiles'
import { previewStudentAssessmentProfileChanges, type StudentAssessmentProfileUpdate } from './studentAssessmentProfileRepository'
import type { AssessmentProfile, EntityId, Student } from '../types'

export async function confirmStudentAssessmentProfileUpdate(
  student: Student | undefined, profiles: Record<EntityId, AssessmentProfile> | undefined
): Promise<StudentAssessmentProfileUpdate | null> {
  if (!profiles) return {}
  if (!student) return { assessmentProfilesByAssignment: profiles }
  const changes = Object.fromEntries(Object.entries(profiles).filter(([id, profile]) =>
    profile !== studentAssignmentAssessmentProfile(student, id)))
  if (!Object.keys(changes).length) return {}
  const preview = await previewStudentAssessmentProfileChanges(student.id, changes)
  if (!preview.units.length) return {}
  const details = preview.units.map(unit => {
    const module = unit.currentModule
    return `${unit.label}: critérios ${unit.profile === 'acs' ? 'ACS' : 'gerais'}${module ? ` — ${module.code} · ${module.name}` : ' — próximas unidades'}`
  }).join('\n')
  const warning = preview.units.some(unit => unit.currentModule)
    ? 'Esta ação vai eliminar todas as avaliações deste aluno, nas disciplinas indicadas, desde o início da UFCD/UC/módulo em curso. Terá de voltar a registar essas avaliações.'
    : 'Esta alteração aplica-se às próximas UFCD/UC/módulos das disciplinas indicadas.'
  if (!window.confirm(`${student.name}\n\n${details}\n\n${warning}\n\nAs unidades concluídas anteriormente, as outras disciplinas, as faltas e os vistos do programa oficial não serão alterados.\n\nPretende continuar?`)) return null
  return { assessmentProfilesByAssignment: changes, assessmentProfileChangeConfirmation: preview.confirmation }
}
