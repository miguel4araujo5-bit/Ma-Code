import type {
  EntityId
} from '../types'

import FirstCycleAssessmentWorkspaceView from './FirstCycleAssessmentWorkspaceView'
import ProfessionalAssessmentWorkspaceView from './ProfessionalAssessmentWorkspaceView'
import RegularAssessmentWorkspaceView from './RegularAssessmentWorkspaceView'

import type {
  AssessmentWorkspaceFilters,
  AssessmentWorkspaceSnapshot,
  SaveModuleFinalGradeInput
} from './assessmentWorkspaceRepository'

import {
  getSummativeAssessmentScale
} from './regularAssessmentScale'

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
  const group =
    props.snapshot.selectedGroup

  if (
    group?.educationType !== 'regular'
  ) {
    return (
      <ProfessionalAssessmentWorkspaceView
        {...props}
      />
    )
  }

  return getSummativeAssessmentScale(group)
    .kind === 'qualitative'
    ? (
        <FirstCycleAssessmentWorkspaceView
          {...props}
        />
      )
    : (
        <RegularAssessmentWorkspaceView
          {...props}
        />
      )
}
