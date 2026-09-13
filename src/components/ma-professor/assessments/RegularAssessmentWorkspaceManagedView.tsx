import {
  useEffect,
  useMemo,
  useState
} from 'react'

import RegularAssessmentCriteriaManagementPanel from './RegularAssessmentCriteriaManagementPanel'
import RegularAssessmentWorkspaceView, {
  type RegularAssessmentWorkspaceViewProps
} from './RegularAssessmentWorkspaceView'

import type {
  UpdatedAssessmentCriteriaScheme
} from './assessmentCriteriaManagementRepository'

export default function RegularAssessmentWorkspaceManagedView(
  props: RegularAssessmentWorkspaceViewProps
) {
  const [
    criteriaOverride,
    setCriteriaOverride
  ] = useState<
    UpdatedAssessmentCriteriaScheme | null
  >(null)

  useEffect(() => {
    setCriteriaOverride(null)
  }, [
    props.snapshot.generatedAt,
    props.snapshot.scheme?.id
  ])

  const effectiveSnapshot = useMemo(
    () =>
      criteriaOverride
        ? {
            ...props.snapshot,
            scheme: criteriaOverride.scheme,
            criteria: criteriaOverride.criteria
          }
        : props.snapshot,
    [
      criteriaOverride,
      props.snapshot
    ]
  )

  return (
    <>
      {effectiveSnapshot.scheme &&
      effectiveSnapshot.criteria.length > 0 ? (
        <RegularAssessmentCriteriaManagementPanel
          snapshot={effectiveSnapshot}
          disabled={Boolean(props.loading)}
          onSaved={setCriteriaOverride}
        />
      ) : null}

      <RegularAssessmentWorkspaceView
        {...props}
        snapshot={effectiveSnapshot}
      />
    </>
  )
}
