import {
  type ComponentProps,
  useEffect,
  useState
} from 'react'

import BaseUfcdFinalGradeGrid from './UfcdFinalGradeGridBase'
import UfcdCfpPreview from './UfcdCfpPreview'
import UfcdFinalGradeExcelImportPanel from './UfcdFinalGradeExcelImportPanel'

import {
  resolveModuleCompletionDate
} from './ufcdCompletionDate'

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
    completionDateReady,
    setCompletionDateReady
  ] = useState(false)

  useEffect(() => {
    let active = true

    setCompletionDateReady(false)

    void resolveModuleCompletionDate(
      props.snapshot.selectedModule
    )
      .catch(() => null)
      .finally(() => {
        if (active) {
          setCompletionDateReady(true)
        }
      })

    return () => {
      active = false
    }
  }, [
    props.snapshot.generatedAt,
    props.snapshot.selectedModule?.id,
    props.snapshot.selectedModule?.plannedPeriods
  ])

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
      <UfcdFinalGradeExcelImportPanel
        snapshot={props.snapshot}
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

      {props.snapshot.selectedGroup &&
      props.snapshot.selectedSubject &&
      props.snapshot.selectedModule &&
      props.snapshot.criteria.length > 0 &&
      props.snapshot.studentRows.length > 0 &&
      completionDateReady ? (
        <UfcdCfpPreview
          snapshot={props.snapshot}
          gradeDrafts={props.gradeDrafts}
          loading={props.loading}
          savingStudentId={
            props.savingStudentId
          }
          exportDisabled={
            importerDisabled
          }
          onDraftChange={
            props.onDraftChange
          }
          onSaveStudent={
            props.onSaveStudent
          }
        />
      ) : null}
    </>
  )
}
