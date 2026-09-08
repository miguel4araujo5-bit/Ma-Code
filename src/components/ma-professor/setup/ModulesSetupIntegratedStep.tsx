import type {
  SetupSnapshot
} from '../repository'

import ModulesPlanificationPdfImportPanel from './ModulesPlanificationPdfImportPanel'
import ModulesSetupStep from './ModulesSetupStep'

type ModulesSetupIntegratedStepProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (snapshot: SetupSnapshot) => void
  onCompleted: (snapshot: SetupSnapshot) => void
}

export default function ModulesSetupIntegratedStep({
  snapshot,
  onSnapshotChange,
  onCompleted
}: ModulesSetupIntegratedStepProps) {
  return (
    <div className="space-y-6">
      <ModulesPlanificationPdfImportPanel
        snapshot={snapshot}
        onSnapshotChange={onSnapshotChange}
      />

      <ModulesSetupStep
        snapshot={snapshot}
        onSnapshotChange={onSnapshotChange}
        onCompleted={onCompleted}
      />
    </div>
  )
}
