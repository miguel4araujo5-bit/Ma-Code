import type {
  ParsedPlanificationPdfDocument,
  ParsedPlanificationPdfSection,
  PlanificationPdfDestinationMatch
} from './planificationPdfParser'

export type PlanificationImportMode =
  | 'create'
  | 'skip'
  | 'append'

export interface PlanificationImportObservedItemVersion {
  id: string
  updatedAt: string
  status: string
  usedLessonId: string | null
  usedAt: string | null
}

export interface PlanificationImportDestinationObservation {
  academicYearId: string
  teachingAssignmentId: string
  moduleId: string
  code: string
  name: string
  label: string
  activePlanification: {
    id: string
    updatedAt: string
  } | null
  itemVersions: PlanificationImportObservedItemVersion[]
}

export interface PlanificationImportDestinationFingerprint {
  academicYearId: string
  teachingAssignmentId: string
  moduleId: string
  activePlanificationId: string | null
  activePlanificationUpdatedAt: string | null
  itemVersions: PlanificationImportObservedItemVersion[]
}

export interface PlanificationImportDraftFields {
  content: string
  objectives: string
  activity: string
  resources: string
  evaluation: string
  suggestedSummary: string
  sourceDocumentName: string
  sourcePages: number[]
}

export interface PlanificationImportPreviewRow {
  id: string
  section: ParsedPlanificationPdfSection
  candidateModuleIds: string[]
  selectedModuleId: string | null
  excluded: boolean
  mode: PlanificationImportMode | null
  fingerprint: PlanificationImportDestinationFingerprint | null
  draft: PlanificationImportDraftFields
  warnings: string[]
}

export interface PlanificationImportPreviewValidation {
  valid: boolean
  errors: string[]
}

export interface PlanificationImportPreviewConfirmationRow {
  previewRowId: string
  academicYearId: string
  teachingAssignmentId: string
  moduleId: string
  mode: PlanificationImportMode
  fingerprint: PlanificationImportDestinationFingerprint
  draft: PlanificationImportDraftFields
}

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line =>
      line
        .trim()
        .replace(/\s+/g, ' ')
    )
    .filter(Boolean)
    .join('\n')
}

function cloneItemVersions(
  values: PlanificationImportObservedItemVersion[]
) {
  return [...values]
    .map(value => ({
      ...value
    }))
    .sort(
      (left, right) =>
        left.id.localeCompare(
          right.id,
          'pt-PT',
          {
            numeric: true,
            sensitivity: 'base'
          }
        )
    )
}

export function createPlanificationImportDestinationFingerprint(
  destination: PlanificationImportDestinationObservation
): PlanificationImportDestinationFingerprint {
  return {
    academicYearId:
      destination.academicYearId,
    teachingAssignmentId:
      destination.teachingAssignmentId,
    moduleId:
      destination.moduleId,
    activePlanificationId:
      destination.activePlanification
        ?.id ?? null,
    activePlanificationUpdatedAt:
      destination.activePlanification
        ?.updatedAt ?? null,
    itemVersions:
      cloneItemVersions(
        destination.itemVersions
      )
  }
}

function defaultModeForDestination(
  destination:
    | PlanificationImportDestinationObservation
    | null
): PlanificationImportMode | null {
  if (!destination) {
    return null
  }

  return destination.activePlanification
    ? null
    : 'create'
}

function defaultDraft(
  section: ParsedPlanificationPdfSection
): PlanificationImportDraftFields {
  return {
    content:
      normalizeText(
        section.contentsText
      ),
    objectives:
      normalizeText(
        section.objectivesText
      ),
    activity:
      normalizeText(
        section.methodologyText
      ),
    resources:
      normalizeText(
        section.resourcesText
      ),
    evaluation:
      normalizeText(
        section.evaluationText
      ),
    suggestedSummary: '',
    sourceDocumentName:
      section.sourceDocumentName,
    sourcePages:
      [...section.sourcePages]
  }
}

function createRowId(
  section: ParsedPlanificationPdfSection,
  ordinal: number
) {
  return [
    section.sourceDocumentName,
    section.code || 'sem-codigo',
    section.sourcePages.join('-') || 'sem-pagina',
    String(ordinal + 1)
  ].join('::')
}

export function createPlanificationImportPreviewRows(
  documents: ParsedPlanificationPdfDocument[],
  matchesByDocument:
    PlanificationPdfDestinationMatch[][],
  destinations:
    PlanificationImportDestinationObservation[]
): PlanificationImportPreviewRow[] {
  const destinationByModuleId =
    new Map(
      destinations.map(
        destination => [
          destination.moduleId,
          destination
        ]
      )
    )

  const rows:
    PlanificationImportPreviewRow[] = []

  documents.forEach(
    (
      document,
      documentIndex
    ) => {
      const matches =
        matchesByDocument[
          documentIndex
        ] ?? []

      document.sections.forEach(
        (
          section,
          sectionIndex
        ) => {
          const match =
            matches[
              sectionIndex
            ] ?? null

          const automaticModuleId =
            match
              ?.automaticDestinationId ??
            (
              match
                ?.candidates
                .length === 1
                ? match
                    .candidates[0]
                    .moduleId
                : null
            )

          const destination =
            automaticModuleId
              ? destinationByModuleId.get(
                  automaticModuleId
                ) ?? null
              : null

          rows.push({
            id:
              createRowId(
                section,
                rows.length
              ),
            section,
            candidateModuleIds:
              match
                ?.candidates
                .map(
                  candidate =>
                    candidate.moduleId
                ) ?? [],
            selectedModuleId:
              destination
                ?.moduleId ?? null,
            excluded: false,
            mode:
              defaultModeForDestination(
                destination
              ),
            fingerprint:
              destination
                ? createPlanificationImportDestinationFingerprint(
                    destination
                  )
                : null,
            draft:
              defaultDraft(
                section
              ),
            warnings: [
              ...section.warnings,
              ...(
                match
                  ?.warnings ?? []
              )
            ]
          })
        }
      )
    }
  )

  return rows
}

export function selectPlanificationImportDestination(
  row: PlanificationImportPreviewRow,
  moduleId: string | null,
  destinations:
    PlanificationImportDestinationObservation[]
): PlanificationImportPreviewRow {
  const destination =
    moduleId
      ? destinations.find(
          candidate =>
            candidate.moduleId ===
            moduleId
        ) ?? null
      : null

  return {
    ...row,
    selectedModuleId:
      destination
        ?.moduleId ?? null,
    mode:
      defaultModeForDestination(
        destination
      ),
    fingerprint:
      destination
        ? createPlanificationImportDestinationFingerprint(
            destination
          )
        : null
  }
}

export function setPlanificationImportMode(
  row: PlanificationImportPreviewRow,
  mode: PlanificationImportMode | null,
  destinations:
    PlanificationImportDestinationObservation[]
): PlanificationImportPreviewRow {
  if (!row.selectedModuleId) {
    return {
      ...row,
      mode: null,
      fingerprint: null
    }
  }

  const destination =
    destinations.find(
      candidate =>
        candidate.moduleId ===
        row.selectedModuleId
    ) ?? null

  if (!destination) {
    return {
      ...row,
      selectedModuleId: null,
      mode: null,
      fingerprint: null
    }
  }

  if (
    destination.activePlanification
  ) {
    if (
      mode !== 'skip' &&
      mode !== 'append'
    ) {
      return {
        ...row,
        mode: null
      }
    }

    return {
      ...row,
      mode
    }
  }

  return {
    ...row,
    mode: 'create'
  }
}

export function setPlanificationImportExcluded(
  row: PlanificationImportPreviewRow,
  excluded: boolean
): PlanificationImportPreviewRow {
  return {
    ...row,
    excluded
  }
}

export function updatePlanificationImportDraft(
  row: PlanificationImportPreviewRow,
  changes:
    Partial<PlanificationImportDraftFields>
): PlanificationImportPreviewRow {
  return {
    ...row,
    draft: {
      ...row.draft,
      ...changes,
      sourceDocumentName:
        changes.sourceDocumentName ===
        undefined
          ? row.draft
              .sourceDocumentName
          : changes
              .sourceDocumentName,
      sourcePages:
        changes.sourcePages ===
        undefined
          ? row.draft
              .sourcePages
          : [
              ...changes.sourcePages
            ]
    }
  }
}

function hasMeaningfulDraft(
  draft: PlanificationImportDraftFields
) {
  return Boolean(
    draft.content.trim() ||
      draft.objectives.trim() ||
      draft.activity.trim() ||
      draft.resources.trim() ||
      draft.evaluation.trim() ||
      draft.suggestedSummary.trim()
  )
}

export function validatePlanificationImportPreview(
  rows: PlanificationImportPreviewRow[],
  destinations:
    PlanificationImportDestinationObservation[]
): PlanificationImportPreviewValidation {
  const errors: string[] = []
  const destinationByModuleId =
    new Map(
      destinations.map(
        destination => [
          destination.moduleId,
          destination
        ]
      )
    )

  const includedRows =
    rows.filter(
      row =>
        !row.excluded
    )

  if (
    includedRows.length === 0
  ) {
    errors.push(
      'Selecione pelo menos uma UFCD para importar.'
    )
  }

  includedRows.forEach(
    (
      row,
      index
    ) => {
      const label =
        row.section.code
          ? `UFCD ${row.section.code}`
          : `UFCD ${index + 1}`

      if (
        !row.selectedModuleId
      ) {
        errors.push(
          `${label}: escolha a UFCD de destino.`
        )
        return
      }

      const destination =
        destinationByModuleId.get(
          row.selectedModuleId
        )

      if (!destination) {
        errors.push(
          `${label}: o destino selecionado já não está disponível.`
        )
        return
      }

      if (
        !row.fingerprint ||
        row.fingerprint
          .academicYearId !==
          destination
            .academicYearId ||
        row.fingerprint
          .teachingAssignmentId !==
          destination
            .teachingAssignmentId ||
        row.fingerprint
          .moduleId !==
          destination.moduleId
      ) {
        errors.push(
          `${label}: o estado observado do destino é inválido. Volte a rever a importação.`
        )
        return
      }

      if (
        destination
          .activePlanification
      ) {
        if (
          row.mode !== 'skip' &&
          row.mode !== 'append'
        ) {
          errors.push(
            `${label}: a UFCD já possui uma planificação. Escolha explicitamente Ignorar ou Acrescentar.`
          )
        }
      } else if (
        row.mode !== 'create'
      ) {
        errors.push(
          `${label}: o modo de importação deve ser Criar.`
        )
      }

      if (
        row.mode !== 'skip' &&
        !hasMeaningfulDraft(
          row.draft
        )
      ) {
        errors.push(
          `${label}: a planificação extraída não contém conteúdo estruturado para guardar.`
        )
      }
    }
  )

  return {
    valid:
      errors.length === 0,
    errors
  }
}

export function buildPlanificationImportPreviewConfirmation(
  rows: PlanificationImportPreviewRow[],
  destinations:
    PlanificationImportDestinationObservation[]
): PlanificationImportPreviewConfirmationRow[] {
  const validation =
    validatePlanificationImportPreview(
      rows,
      destinations
    )

  if (!validation.valid) {
    throw new Error(
      validation.errors[0] ??
        'A pré-visualização da importação não é válida.'
    )
  }

  const destinationByModuleId =
    new Map(
      destinations.map(
        destination => [
          destination.moduleId,
          destination
        ]
      )
    )

  return rows.flatMap(
    row => {
      if (
        row.excluded ||
        !row.selectedModuleId ||
        !row.mode ||
        !row.fingerprint
      ) {
        return []
      }

      const destination =
        destinationByModuleId.get(
          row.selectedModuleId
        )

      if (!destination) {
        return []
      }

      return [
        {
          previewRowId:
            row.id,
          academicYearId:
            destination
              .academicYearId,
          teachingAssignmentId:
            destination
              .teachingAssignmentId,
          moduleId:
            destination.moduleId,
          mode:
            row.mode,
          fingerprint: {
            ...row.fingerprint,
            itemVersions:
              cloneItemVersions(
                row.fingerprint
                  .itemVersions
              )
          },
          draft: {
            ...row.draft,
            sourcePages: [
              ...row.draft
                .sourcePages
            ]
          }
        }
      ]
    }
  )
}
