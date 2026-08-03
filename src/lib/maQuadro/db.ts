import Dexie, {
  type EntityTable
} from 'dexie'

import type {
  MAQuadroProject,
  MAQuadroStoredFont
} from '../../types/maQuadro'
import {
  migrateLegacyMAQuadroDesign
} from './project'

type MAQuadroDatabase = Dexie & {
  designs: EntityTable<
    MAQuadroProject,
    'id'
  >
  fonts: EntityTable<
    MAQuadroStoredFont,
    'id'
  >
}

export const maQuadroDb =
  new Dexie(
    'ma-quadro-local'
  ) as MAQuadroDatabase

maQuadroDb.version(1).stores({
  designs:
    'id, name, updatedAt, isStarter',
  fonts:
    'id, family, createdAt'
})

maQuadroDb
  .version(2)
  .stores({
    designs:
      'id, name, updatedAt, isTemplate, category',
    fonts:
      'id, family, createdAt'
  })
  .upgrade(async (transaction) => {
    const table =
      transaction.table('designs')
    const records =
      await table.toArray()

    for (const record of records) {
      const migrated =
        migrateLegacyMAQuadroDesign(
          record
        )

      if (migrated) {
        await table.put(migrated)
      }
    }
  })

export async function listMAQuadroProjects() {
  const projects =
    await maQuadroDb.designs.toArray()

  return projects.sort(
    (first, second) => {
      if (
        first.isTemplate !==
        second.isTemplate
      ) {
        return first.isTemplate
          ? 1
          : -1
      }

      return second.updatedAt.localeCompare(
        first.updatedAt
      )
    }
  )
}

export function getMAQuadroProject(
  projectId: string
) {
  return maQuadroDb.designs.get(
    projectId
  )
}

export function saveMAQuadroProject(
  project: MAQuadroProject
) {
  return maQuadroDb.designs.put(
    project
  )
}

export function deleteMAQuadroProject(
  projectId: string
) {
  return maQuadroDb.designs.delete(
    projectId
  )
}

export async function listMAQuadroFonts() {
  const fonts =
    await maQuadroDb.fonts.toArray()

  return fonts.sort(
    (first, second) =>
      first.family.localeCompare(
        second.family,
        'pt-PT'
      )
  )
}

export function saveMAQuadroFont(
  font: MAQuadroStoredFont
) {
  return maQuadroDb.fonts.put(font)
}

export function deleteMAQuadroFont(
  fontId: string
) {
  return maQuadroDb.fonts.delete(
    fontId
  )
}
