import {
  type ComponentProps,
  useEffect,
  useState
} from 'react'

import BaseUfcdFinalGradeGrid from './UfcdFinalGradeGridBase'
import UfcdCfpPreview from './UfcdCfpPreview'
import UfcdFinalGradeExcelImportPanel from './UfcdFinalGradeExcelImportPanel'
import GIAEGradeCsvExport from './GIAEGradeCsvExport'

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
      row.assessmentProfile === 'acs' || row.finalGradeRecord?.usesAcs === true
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

  const roundingRows = props.snapshot.selectedGroup?.educationType === 'regular' ? [] :
    props.snapshot.studentRows.filter(row => {
      const summary = row.gradeSummary
      const current = props.gradeDrafts[row.student.id] ?? buildPersistedDraft(row)
      return !row.recoveryPending && summary.allActiveCriteriaAssessed &&
        summary.confirmedFinalGrade !== null && summary.suggestedGrade !== null &&
        current.finalGrade.trim() !== String(summary.suggestedGrade)
    })

  return (
    <>
      {roundingRows.length > 0 ? (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
          <p role="status" className="font-bold">{roundingRows.length === 1 ? 'Existe 1 nota final diferente' : `Existem ${roundingRows.length} notas finais diferentes`} da sugestão de arredondamento atual.</p>
          <p className="mt-2 leading-6">O PDF, o Excel e o CSV usam as notas finais guardadas. Aplique a regra à turma, reveja as notas e clique em «Guardar / confirmar» antes de emitir novamente.</p>
          <button type="button" disabled={Boolean(props.loading) || Boolean(props.savingStudentId)}
            onClick={() => {
              for (const row of roundingRows) props.onDraftChange(row.student.id, { finalGrade: String(row.gradeSummary.suggestedGrade) })
            }}
            className="mt-3 rounded-xl border border-amber-200/30 bg-amber-300/10 px-4 py-2.5 text-sm font-bold text-amber-50 disabled:opacity-40">Aplicar arredondamento à turma</button>
        </div>
      ) : null}

      <GIAEGradeCsvExport
        snapshot={props.snapshot}
        disabled={Boolean(props.loading) || Boolean(props.savingStudentId)}
        hasUnsavedChanges={hasDirtyGradeDrafts}
      />

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
