import { studentAssignmentAssessmentProfile } from '../assessments/assessmentProfiles'
import type { AssessmentProfile, EntityId, Student } from '../types'

interface Props {
  assignments: { id: EntityId; label: string }[]
  student?: Student
  profiles?: Record<EntityId, AssessmentProfile>
  disabled?: boolean
  onChange: (profiles: Record<EntityId, AssessmentProfile>) => void
}

export function StudentAssessmentProfileFields({ assignments, student, profiles = {}, disabled, onChange }: Props) {
  if (!assignments.length) return null
  return (
    <fieldset className="space-y-2 rounded-xl border border-emerald-200/15 p-3 lg:col-span-full" disabled={disabled}>
      <legend className="px-1 text-sm font-bold text-emerald-100">Critérios ACS por disciplina</legend>
      <p className="text-xs text-slate-400">Selecione apenas as disciplinas em que o aluno tem ACS.</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {assignments.map(assignment => (
          <label key={assignment.id} className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" className="h-4 w-4 rounded"
              checked={(profiles[assignment.id] ?? studentAssignmentAssessmentProfile(student, assignment.id)) === 'acs'}
              onChange={event => onChange({ ...profiles, [assignment.id]: event.target.checked ? 'acs' : 'general' })} />
            {assignment.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
