import {
  type ComponentProps,
  useEffect,
  useMemo,
  useState
} from 'react'

import AssessmentCriteriaManagementPanel from './AssessmentCriteriaManagementPanel'

import type {
  UpdatedAssessmentCriteriaScheme
} from './assessmentCriteriaManagementRepository'

import BaseUfcdFinalGradeGrid from './UfcdFinalGradeGridBase'

export type {
  UfcdFinalGradeDraft
} from './UfcdFinalGradeGridBase'

type UfcdFinalGradeGridProps =
  ComponentProps<
    typeof BaseUfcdFinalGradeGrid
  >

function buildPersistedDraft(
  row: UfcdFinalGradeGridProps['snapshot']['studentRows'][number]
) {
  const confirmedGrade =
    row.gradeSummary
      .confirmedFinalGrade

  const suggestedGrade =
    row.gradeSummary
      .suggestedGrade

  const selfAssessmentGrade =
    row.finalGradeRecord
      ?.selfAssessmentGrade ??
    null

  return {
    finalGrade:
      confirmedGrade !== null
        ? String(confirmedGrade)
        : suggestedGrade !== null
          ? String(suggestedGrade)
          : '',
    selfAssessmentGrade:
      selfAssessmentGrade === null
        ? ''
        : String(selfAssessmentGrade),
    usesAcs:
      row.finalGradeRecord
        ?.usesAcs ??
      false
  }
}

export default function UfcdFinalGradeGrid(
  props: UfcdFinalGradeGridProps
) {
  const [
    criteriaOverride,
    setCriteriaOverride
  ] = useState<
    UpdatedAssessmentCriteriaScheme |
    null
  >(null)

  useEffect(() => {
    setCriteriaOverride(null)
  }, [
    props.snapshot.generatedAt,
    props.snapshot.scheme?.id
  ])

  const effectiveSnapshot =
    useMemo(
      () =>
        criteriaOverride
          ? {
              ...props.snapshot,
              scheme:
                criteriaOverride.scheme,
              criteria:
                criteriaOverride.criteria
            }
          : props.snapshot,
      [
        criteriaOverride,
        props.snapshot
      ]
    )

  const hasDirtyGradeDrafts =
    props.snapshot.studentRows.some(
      row => {
        const persisted =
          buildPersistedDraft(row)

        const current =
          props.gradeDrafts[
            row.student.id
          ] ?? persisted

        return (
          current.finalGrade !==
            persisted.finalGrade ||
          current.selfAssessmentGrade !==
            persisted.selfAssessmentGrade ||
          current.usesAcs !==
            persisted.usesAcs
        )
      }
    )

  return (
    <>
      {effectiveSnapshot.scheme &&
      effectiveSnapshot.criteria.length > 0 ? (
        <section className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 shadow-xl shadow-black/20">
          <AssessmentCriteriaManagementPanel
            snapshot={effectiveSnapshot}
            disabled={
              Boolean(props.loading) ||
              Boolean(
                props.savingStudentId
              ) ||
              hasDirtyGradeDrafts
            }
            onSaved={
              setCriteriaOverride
            }
          />
        </section>
      ) : null}

      <BaseUfcdFinalGradeGrid
        {...props}
        snapshot={effectiveSnapshot}
      />
    </>
  )
}
