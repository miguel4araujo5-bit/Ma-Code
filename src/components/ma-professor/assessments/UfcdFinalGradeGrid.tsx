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
import UfcdCfpPreview from './UfcdCfpPreview'
import UfcdFinalGradeExcelImportPanel from './UfcdFinalGradeExcelImportPanel'

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

  const importerDisabled =
    Boolean(props.loading) ||
    Boolean(props.savingStudentId) ||
    hasDirtyGradeDrafts

  return (
    <>
      {effectiveSnapshot.scheme &&
      effectiveSnapshot.criteria.length > 0 ? (
        <section className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 shadow-xl shadow-black/20">
          <AssessmentCriteriaManagementPanel
            snapshot={effectiveSnapshot}
            disabled={
              importerDisabled
            }
            onSaved={
              setCriteriaOverride
            }
          />
        </section>
      ) : null}

      <UfcdFinalGradeExcelImportPanel
        snapshot={effectiveSnapshot}
        disabled={importerDisabled}
        onApplyDraft={(
          studentId,
          changes
        ) =>
          props.onDraftChange(
            studentId,
            changes
          )
        }
      />

      {effectiveSnapshot.selectedGroup &&
      effectiveSnapshot.selectedSubject &&
      effectiveSnapshot.selectedModule &&
      effectiveSnapshot.criteria.length > 0 &&
      effectiveSnapshot.studentRows.length > 0 ? (
        <UfcdCfpPreview
          snapshot={effectiveSnapshot}
          disabled={importerDisabled}
        />
      ) : null}

      <style>{
        '.ma-professor-cfp-editor > section > div:first-child button { display: none; }'
      }</style>

      <div className="ma-professor-cfp-editor">
        <BaseUfcdFinalGradeGrid
          {...props}
          snapshot={effectiveSnapshot}
        />
      </div>
    </>
  )
}
