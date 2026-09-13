import type {
  EntityId
} from '../types'

import ProfessionalAssessmentWorkspaceView from './ProfessionalAssessmentWorkspaceView'
import RegularAssessmentWorkspaceManagedView from './RegularAssessmentWorkspaceManagedView'

import type {
  AssessmentWorkspaceFilters,
  AssessmentWorkspaceSnapshot,
  SaveModuleFinalGradeInput
} from './assessmentWorkspaceRepository'

interface AssessmentWorkspaceViewProps {
  snapshot: AssessmentWorkspaceSnapshot
  loading?: boolean
  error?: string
  onRefresh?: () => void
  onFiltersChange: (
    filters: AssessmentWorkspaceFilters
  ) => void
  onLessonSelect?: (
    lessonId: EntityId
  ) => void
  onSaveFinalGrade: (
    input: SaveModuleFinalGradeInput
  ) => Promise<void> | void
}

export default function AssessmentWorkspaceView(
  props: AssessmentWorkspaceViewProps
) {
  return props.snapshot.selectedGroup
    ?.educationType === 'regular'
    ? (
        <RegularAssessmentWorkspaceManagedView
          {...props}
        />
      )
    : (
        <ProfessionalAssessmentWorkspaceView
          {...props}
        />
      )
}
