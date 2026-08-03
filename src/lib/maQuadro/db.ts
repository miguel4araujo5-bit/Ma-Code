import Dexie, {
  type EntityTable
} from 'dexie'

import type {
  MAQuadroDesign,
  MAQuadroStoredFont
} from '../../types/maQuadro'

type MAQuadroDatabase = Dexie & {
  designs: EntityTable<MAQuadroDesign, 'id'>
  fonts: EntityTable<MAQuadroStoredFont, 'id'>
}

export const maQuadroDb = new Dexie(
  'ma-quadro-local'
) as MAQuadroDatabase

maQuadroDb.version(1).stores({
  designs: 'id, name, updatedAt, isStarter',
  fonts: 'id, family, createdAt'
})

export async function listMAQuadroDesigns() {
  const designs = await maQuadroDb.designs.toArray()

  return designs.sort((first, second) => {
    if (first.isStarter !== second.isStarter) {
      return first.isStarter ? 1 : -1
    }

    return second.updatedAt.localeCompare(
      first.updatedAt
    )
  })
}

export function getMAQuadroDesign(
  designId: string
) {
  return maQuadroDb.designs.get(designId)
}

export function saveMAQuadroDesign(
  design: MAQuadroDesign
) {
  return maQuadroDb.designs.put(design)
}

export function deleteMAQuadroDesign(
  designId: string
) {
  return maQuadroDb.designs.delete(designId)
}

export async function listMAQuadroFonts() {
  const fonts = await maQuadroDb.fonts.toArray()

  return fonts.sort((first, second) =>
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
  return maQuadroDb.fonts.delete(fontId)
}
