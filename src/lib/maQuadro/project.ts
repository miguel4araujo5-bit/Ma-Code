import type {
  MAQuadroBackground,
  MAQuadroCanvasJson,
  MAQuadroPage,
  MAQuadroProject,
  MAQuadroProjectCategory
} from '../../types/maQuadro'

export const MA_QUADRO_SCHEMA_VERSION = 2 as const

const PAGE_REFERENCE_KEYS = [
  'maMatchMoveSourcePageId',
  'maMatchMoveTargetPageId'
] as const

export function createMAQuadroId(prefix: string) {
  if (
    typeof crypto !== 'undefined' &&
    'randomUUID' in crypto
  ) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

export function cloneMAQuadroValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function remapPageReferences(
  value: unknown,
  pageIdMap: Map<string, string>
) {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => remapPageReferences(item, pageIdMap))
    return
  }

  const node = value as Record<string, unknown>

  for (const key of PAGE_REFERENCE_KEYS) {
    const current = node[key]

    if (typeof current !== 'string') {
      continue
    }

    const mapped = pageIdMap.get(current)

    if (mapped) {
      node[key] = mapped
    }
  }

  Object.values(node).forEach((child) => remapPageReferences(child, pageIdMap))
}

function cloneCanvasWithPageReferences(
  canvasJson: MAQuadroCanvasJson,
  pageIdMap: Map<string, string>
) {
  const cloned = cloneMAQuadroValue(canvasJson)
  remapPageReferences(cloned, pageIdMap)
  return cloned
}

export function createDefaultBackground(
  color = '#FFFFFF'
): MAQuadroBackground {
  return {
    type: 'solid',
    color,
    gradientFrom: '#22D3EE',
    gradientTo: '#8B5CF6',
    gradientAngle: 45
  }
}

export function createBlankCanvasJson(): MAQuadroCanvasJson {
  return {
    version: '7.4.0',
    objects: []
  }
}

export function createBlankPage(
  width: number,
  height: number,
  name = 'Página 1',
  background = createDefaultBackground()
): MAQuadroPage {
  return {
    id: createMAQuadroId('page'),
    name,
    width,
    height,
    background: cloneMAQuadroValue(background),
    canvasJson: createBlankCanvasJson()
  }
}

export function createBlankProject(
  width: number,
  height: number,
  name: string,
  category: MAQuadroProjectCategory = 'custom'
): MAQuadroProject {
  const now = new Date().toISOString()
  const page = createBlankPage(width, height)

  return {
    schemaVersion: MA_QUADRO_SCHEMA_VERSION,
    id: createMAQuadroId('project'),
    name,
    pages: [page],
    activePageId: page.id,
    category,
    isTemplate: false,
    createdAt: now,
    updatedAt: now
  }
}

export function duplicatePage(
  page: MAQuadroPage,
  name = `${page.name} — cópia`
): MAQuadroPage {
  const nextId = createMAQuadroId('page')
  const pageIdMap = new Map<string, string>([
    [page.id, nextId]
  ])

  return {
    ...cloneMAQuadroValue(page),
    id: nextId,
    name,
    canvasJson: cloneCanvasWithPageReferences(page.canvasJson, pageIdMap),
    thumbnail: page.thumbnail
  }
}

export function duplicateProject(
  project: MAQuadroProject,
  name = `${project.name} — cópia`
): MAQuadroProject {
  const now = new Date().toISOString()
  const pageIdMap = new Map<string, string>()

  project.pages.forEach((page) => {
    pageIdMap.set(page.id, createMAQuadroId('page'))
  })

  const pages = project.pages.map((page) => ({
    ...cloneMAQuadroValue(page),
    id: pageIdMap.get(page.id) || createMAQuadroId('page'),
    canvasJson: cloneCanvasWithPageReferences(page.canvasJson, pageIdMap)
  }))

  const activeIndex = Math.max(
    0,
    project.pages.findIndex(
      (page) => page.id === project.activePageId
    )
  )

  return {
    ...cloneMAQuadroValue(project),
    schemaVersion: MA_QUADRO_SCHEMA_VERSION,
    id: createMAQuadroId('project'),
    name,
    pages,
    activePageId:
      pages[activeIndex]?.id ||
      pages[0].id,
    isTemplate: false,
    createdAt: now,
    updatedAt: now
  }
}

export function getActiveProjectPage(
  project: MAQuadroProject
): MAQuadroPage {
  return (
    project.pages.find(
      (page) => page.id === project.activePageId
    ) || project.pages[0]
  )
}

export function replaceProjectPage(
  project: MAQuadroProject,
  nextPage: MAQuadroPage
): MAQuadroProject {
  return {
    ...project,
    pages: project.pages.map((page) =>
      page.id === nextPage.id
        ? nextPage
        : page
    ),
    updatedAt: new Date().toISOString()
  }
}

export function normalizeCanvasJson(
  canvasJson: MAQuadroCanvasJson
): MAQuadroCanvasJson {
  const objects = Array.isArray(canvasJson.objects)
    ? canvasJson.objects
    : []

  return {
    ...canvasJson,
    objects: objects.map((object) => {
      if (
        !object ||
        typeof object !== 'object'
      ) {
        return object
      }

      return {
        originX: 'left',
        originY: 'top',
        ...object
      }
    })
  }
}

export function isMAQuadroProject(
  value: unknown
): value is MAQuadroProject {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false
  }

  const project =
    value as Partial<MAQuadroProject>

  return (
    project.schemaVersion === 2 &&
    typeof project.id === 'string' &&
    typeof project.name === 'string' &&
    Array.isArray(project.pages) &&
    project.pages.length > 0 &&
    typeof project.activePageId === 'string'
  )
}

type LegacyMAQuadroDesign = {
  id?: string
  name?: string
  width?: number
  height?: number
  backgroundColor?: string
  transparentBackground?: boolean
  canvasJson?: MAQuadroCanvasJson
  thumbnail?: string
  isStarter?: boolean
  createdAt?: string
  updatedAt?: string
}

export function migrateLegacyMAQuadroDesign(
  value: unknown
): MAQuadroProject | null {
  if (isMAQuadroProject(value)) {
    return value
  }

  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null
  }

  const legacy =
    value as LegacyMAQuadroDesign

  if (
    typeof legacy.name !== 'string' ||
    typeof legacy.width !== 'number' ||
    typeof legacy.height !== 'number' ||
    !legacy.canvasJson
  ) {
    return null
  }

  const now = new Date().toISOString()

  const page: MAQuadroPage = {
    id: createMAQuadroId('page'),
    name: 'Página 1',
    width: legacy.width,
    height: legacy.height,
    background: {
      ...createDefaultBackground(
        legacy.backgroundColor || '#FFFFFF'
      ),
      type: legacy.transparentBackground
        ? 'transparent'
        : 'solid'
    },
    canvasJson: normalizeCanvasJson(
      legacy.canvasJson
    ),
    thumbnail: legacy.thumbnail
  }

  return {
    schemaVersion: MA_QUADRO_SCHEMA_VERSION,
    id:
      legacy.id ||
      createMAQuadroId('project'),
    name: legacy.name,
    pages: [page],
    activePageId: page.id,
    category: 'custom',
    isTemplate: Boolean(
      legacy.isStarter
    ),
    createdAt:
      legacy.createdAt ||
      now,
    updatedAt:
      legacy.updatedAt ||
      now
  }
}

export function safeMAQuadroFileName(
  name: string
) {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return normalized || 'design-ma-quadro'
}
