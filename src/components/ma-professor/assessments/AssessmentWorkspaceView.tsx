import type {
  EntityId
} from '../types'

import ProfessionalAssessmentWorkspaceView from './ProfessionalAssessmentWorkspaceView'
import RegularAssessmentWorkspaceView from './RegularAssessmentWorkspaceView'

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
        <RegularAssessmentWorkspaceView
          {...props}
        />
      )
    : (
        <ProfessionalAssessmentWorkspaceView
          {...props}
        />
      )
}
