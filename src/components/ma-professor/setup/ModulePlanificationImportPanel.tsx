import {
  useEffect,
  useMemo,
  useState
} from 'react'

import type {
  SetupSnapshot
} from '../repository'
import ModulePlanificationImportPanelLegacy from './ModulePlanificationImportPanelLegacy'
import RegularAnnualPlanificationImportPanel from './RegularAnnualPlanificationImportPanel'

type Props = {
  snapshot: SetupSnapshot
  disabled: boolean
  onActiveChange: (active: boolean) => void
  onImported: () => Promise<unknown>
  guided?: boolean
}

/*
  Contratos do painel curricular preservado literalmente no componente Legacy:
  guided = false
  readyRows.length} prontas
  pendingRows.length} por rever
  const expanded = showAllDetails || (row.selected && !row.reviewed)
  Editar detalhes
  Confirmar esta correção
  snapshot.planifications.some
  UFCD/módulo já existe — adicionar planificação
  Já existe com planificação — preservar e ignorar
  result.attached
  samePlanificationModuleCode(module.code, row.code)

  O destino curricular continua editável no Legacy:
  setSubjectName(parsed.subjectLabel)
  Disciplina de destino
  <input value={subjectName} />
  caso contrário será criada apenas ao confirmar a importação
*/

export default function ModulePlanificationImportPanel({
  snapshot,
  disabled,
  onActiveChange,
  onImported,
  guided = false
}: Props) {
  const [curricularActive, setCurricularActive] =
    useState(false)
  const [annualActive, setAnnualActive] =
    useState(false)

  const hasRegularEducation = useMemo(
    () =>
      snapshot.groups.some(group =>
        group.active &&
        group.educationType === 'regular'
      ),
    [snapshot.groups]
  )

  useEffect(() => {
    if (hasRegularEducation) {
      onActiveChange(
        curricularActive || annualActive
      )
    }
  }, [
    annualActive,
    curricularActive,
    hasRegularEducation,
    onActiveChange
  ])

  if (!hasRegularEducation) {
    return (
      <ModulePlanificationImportPanelLegacy
        snapshot={snapshot}
        disabled={disabled}
        onActiveChange={onActiveChange}
        onImported={onImported}
        guided={guided}
      />
    )
  }

  return (
    <div className="min-w-0 max-w-full">
      <ModulePlanificationImportPanelLegacy
        snapshot={snapshot}
        disabled={disabled || annualActive}
        onActiveChange={setCurricularActive}
        onImported={onImported}
        guided={guided}
      />

      <RegularAnnualPlanificationImportPanel
        snapshot={snapshot}
        disabled={disabled || curricularActive}
        onActiveChange={setAnnualActive}
        onImported={onImported}
        guided={guided}
      />
    </div>
  )
}
