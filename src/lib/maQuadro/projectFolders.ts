export type MAQuadroProjectFolder = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type MAQuadroProjectFolderCollection = {
  schemaVersion: 1
  folders: MAQuadroProjectFolder[]
  projectFolderIds: Record<string, string>
}

export const MA_QUADRO_PROJECT_FOLDERS_STORAGE_KEY =
  'ma-quadro-project-folders-v1'

export const MA_QUADRO_UNFILED_FOLDER_ID =
  '__ma-quadro-unfiled__'

const EMPTY_COLLECTION:
  MAQuadroProjectFolderCollection = {
    schemaVersion: 1,
    folders: [],
    projectFolderIds: {}
  }

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function normalizeFolder(
  value: unknown
): MAQuadroProjectFolder | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    typeof value.id === 'string'
      ? value.id.trim()
      : ''

  const name =
    typeof value.name === 'string'
      ? value.name.trim()
      : ''

  if (!id || !name) {
    return null
  }

  const now =
    new Date().toISOString()

  return {
    id,
    name: name.slice(0, 80),
    createdAt:
      typeof value.createdAt === 'string'
        ? value.createdAt
        : now,
    updatedAt:
      typeof value.updatedAt === 'string'
        ? value.updatedAt
        : now
  }
}

export function createEmptyMAQuadroProjectFolderCollection():
  MAQuadroProjectFolderCollection {
  return {
    ...EMPTY_COLLECTION,
    folders: [],
    projectFolderIds: {}
  }
}

export function normalizeMAQuadroProjectFolderCollection(
  value: unknown
): MAQuadroProjectFolderCollection {
  if (!isRecord(value)) {
    return createEmptyMAQuadroProjectFolderCollection()
  }

  const folders =
    Array.isArray(value.folders)
      ? value.folders
          .map(normalizeFolder)
          .filter(
            (
              folder
            ): folder is MAQuadroProjectFolder =>
              folder !== null
          )
      : []

  const folderIds =
    new Set(
      folders.map(
        (folder) =>
          folder.id
      )
    )

  const projectFolderIds:
    Record<string, string> = {}

  if (
    isRecord(
      value.projectFolderIds
    )
  ) {
    for (
      const [
        projectId,
        folderId
      ] of Object.entries(
        value.projectFolderIds
      )
    ) {
      if (
        projectId &&
        typeof folderId === 'string' &&
        folderIds.has(folderId)
      ) {
        projectFolderIds[
          projectId
        ] = folderId
      }
    }
  }

  return {
    schemaVersion: 1,
    folders,
    projectFolderIds
  }
}

export function readMAQuadroProjectFolderCollection():
  MAQuadroProjectFolderCollection {
  if (
    typeof window === 'undefined'
  ) {
    return createEmptyMAQuadroProjectFolderCollection()
  }

  try {
    const raw =
      window.localStorage.getItem(
        MA_QUADRO_PROJECT_FOLDERS_STORAGE_KEY
      )

    if (!raw) {
      return createEmptyMAQuadroProjectFolderCollection()
    }

    return normalizeMAQuadroProjectFolderCollection(
      JSON.parse(raw) as unknown
    )
  } catch {
    return createEmptyMAQuadroProjectFolderCollection()
  }
}

export function writeMAQuadroProjectFolderCollection(
  collection:
    MAQuadroProjectFolderCollection
) {
  if (
    typeof window === 'undefined'
  ) {
    return false
  }

  try {
    window.localStorage.setItem(
      MA_QUADRO_PROJECT_FOLDERS_STORAGE_KEY,
      JSON.stringify(
        normalizeMAQuadroProjectFolderCollection(
          collection
        )
      )
    )

    return true
  } catch {
    return false
  }
}

export function createMAQuadroProjectFolderId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `folder-${crypto.randomUUID()}`
  }

  return [
    'folder',
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 10)
  ].join('-')
}

export function normalizeMAQuadroProjectFolderName(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80)
}

export function hasMAQuadroProjectFolderName(
  folders:
    MAQuadroProjectFolder[],
  name: string,
  ignoredFolderId?: string
) {
  const normalizedName =
    normalizeMAQuadroProjectFolderName(
      name
    ).toLocaleLowerCase(
      'pt-PT'
    )

  return folders.some(
    (folder) =>
      folder.id !==
        ignoredFolderId &&
      folder.name
        .toLocaleLowerCase(
          'pt-PT'
        ) === normalizedName
  )
}
