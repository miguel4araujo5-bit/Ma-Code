import {
  createMAQuadroId
} from './project'

export type MAQuadroImageCollection = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY =
  'ma-quadro-image-collections-v1'

const MAX_COLLECTIONS = 50
const MAX_NAME_LENGTH = 60

function normalizeName(
  value: string
) {
  return value
    .trim()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLocaleLowerCase(
      'pt-PT'
    )
}

function sanitizeName(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_NAME_LENGTH)
}

function isCollection(
  value: unknown
): value is MAQuadroImageCollection {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false
  }

  const collection =
    value as Partial<MAQuadroImageCollection>

  return (
    typeof collection.id === 'string' &&
    collection.id.length > 0 &&
    typeof collection.name === 'string' &&
    collection.name.trim().length > 0 &&
    typeof collection.createdAt === 'string' &&
    typeof collection.updatedAt === 'string'
  )
}

function readCollections() {
  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY
      )

    if (!raw) {
      return [] as MAQuadroImageCollection[]
    }

    const parsed =
      JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      return [] as MAQuadroImageCollection[]
    }

    return parsed
      .filter(isCollection)
      .map((collection) => ({
        ...collection,
        name: sanitizeName(collection.name)
      }))
  } catch {
    return [] as MAQuadroImageCollection[]
  }
}

function writeCollections(
  collections: MAQuadroImageCollection[]
) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(collections)
    )
  } catch {
    throw new Error(
      'O navegador não permitiu guardar a organização local das coleções.'
    )
  }
}

function sortedCollections(
  collections: MAQuadroImageCollection[]
) {
  return [...collections].sort(
    (first, second) =>
      first.name.localeCompare(
        second.name,
        'pt-PT',
        {
          sensitivity: 'base'
        }
      )
  )
}

function ensureUniqueName(
  collections: MAQuadroImageCollection[],
  name: string,
  ignoredId?: string
) {
  const normalized =
    normalizeName(name)

  if (
    collections.some(
      (collection) =>
        collection.id !== ignoredId &&
        normalizeName(collection.name) === normalized
    )
  ) {
    throw new Error(
      'Já existe uma coleção com esse nome.'
    )
  }
}

export function listMAQuadroImageCollections() {
  return sortedCollections(
    readCollections()
  )
}

export function createMAQuadroImageCollection(
  requestedName: string
) {
  const name =
    sanitizeName(requestedName)

  if (!name) {
    throw new Error(
      'Indique um nome para a coleção.'
    )
  }

  const collections =
    readCollections()

  if (
    collections.length >= MAX_COLLECTIONS
  ) {
    throw new Error(
      `Pode criar até ${MAX_COLLECTIONS} coleções locais.`
    )
  }

  ensureUniqueName(
    collections,
    name
  )

  const now =
    new Date().toISOString()

  const collection:
    MAQuadroImageCollection = {
      id: createMAQuadroId(
        'image-collection'
      ),
      name,
      createdAt: now,
      updatedAt: now
    }

  writeCollections([
    ...collections,
    collection
  ])

  return collection
}

export function renameMAQuadroImageCollection(
  collectionId: string,
  requestedName: string
) {
  const name =
    sanitizeName(requestedName)

  if (!name) {
    throw new Error(
      'Indique um nome para a coleção.'
    )
  }

  const collections =
    readCollections()

  const current =
    collections.find(
      (collection) =>
        collection.id === collectionId
    )

  if (!current) {
    throw new Error(
      'A coleção já não existe neste dispositivo.'
    )
  }

  ensureUniqueName(
    collections,
    name,
    collectionId
  )

  const updated =
    collections.map(
      (collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              name,
              updatedAt:
                new Date().toISOString()
            }
          : collection
    )

  writeCollections(updated)

  return updated.find(
    (collection) =>
      collection.id === collectionId
  ) as MAQuadroImageCollection
}

export function deleteMAQuadroImageCollection(
  collectionId: string
) {
  const collections =
    readCollections()

  const exists =
    collections.some(
      (collection) =>
        collection.id === collectionId
    )

  if (!exists) {
    return false
  }

  writeCollections(
    collections.filter(
      (collection) =>
        collection.id !== collectionId
    )
  )

  return true
}
