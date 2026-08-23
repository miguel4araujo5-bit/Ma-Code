import Dexie, {
  type EntityTable
} from 'dexie'

import type {
  MAQuadroProject,
  MAQuadroStoredBrandKit,
  MAQuadroStoredFont,
  MAQuadroStoredImage,
  MAQuadroStoredLogo,
  MAQuadroStoredVideo
} from '../../types/maQuadro'

import {
  migrateLegacyMAQuadroDesign
} from './project'

const DEFAULT_BRAND_KIT_ID =
  'ma-code'

type MAQuadroDatabase = Dexie & {
  designs: EntityTable<
    MAQuadroProject,
    'id'
  >
  fonts: EntityTable<
    MAQuadroStoredFont,
    'id'
  >
  logos: EntityTable<
    MAQuadroStoredLogo,
    'id'
  >
  brandKits: EntityTable<
    MAQuadroStoredBrandKit,
    'id'
  >
  videos: EntityTable<
    MAQuadroStoredVideo,
    'id'
  >
  images: EntityTable<
    MAQuadroStoredImage,
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
        await table.put(
          migrated
        )
      }
    }
  })

maQuadroDb
  .version(3)
  .stores({
    designs:
      'id, name, updatedAt, isTemplate, category',
    fonts:
      'id, family, createdAt',
    logos:
      'id, name, createdAt'
  })

maQuadroDb
  .version(4)
  .stores({
    designs:
      'id, name, updatedAt, isTemplate, category',
    fonts:
      'id, family, createdAt',
    logos:
      'id, brandKitId, name, createdAt',
    brandKits:
      'id, name, updatedAt'
  })
  .upgrade(async (transaction) => {
    const logos =
      transaction.table('logos')

    await logos
      .toCollection()
      .modify((logo) => {
        if (!logo.brandKitId) {
          logo.brandKitId =
            DEFAULT_BRAND_KIT_ID
        }
      })
  })

maQuadroDb
  .version(5)
  .stores({
    designs:
      'id, name, updatedAt, isTemplate, category',
    fonts:
      'id, family, createdAt',
    logos:
      'id, brandKitId, name, createdAt',
    brandKits:
      'id, name, updatedAt',
    videos:
      'id, name, createdAt'
  })

maQuadroDb
  .version(6)
  .stores({
    designs:
      'id, name, updatedAt, isTemplate, category',
    fonts:
      'id, family, createdAt',
    logos:
      'id, brandKitId, name, createdAt',
    brandKits:
      'id, name, updatedAt',
    videos:
      'id, name, createdAt',
    images:
      'id, name, createdAt'
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
  return maQuadroDb.fonts.put(
    font
  )
}

export function deleteMAQuadroFont(
  fontId: string
) {
  return maQuadroDb.fonts.delete(
    fontId
  )
}

export async function listMAQuadroLogos(
  brandKitId?: string
) {
  const logos = brandKitId
    ? await maQuadroDb.logos
        .where('brandKitId')
        .equals(brandKitId)
        .toArray()
    : await maQuadroDb.logos.toArray()

  return logos.sort(
    (first, second) =>
      second.createdAt.localeCompare(
        first.createdAt
      )
  )
}

export function saveMAQuadroLogo(
  logo: MAQuadroStoredLogo
) {
  return maQuadroDb.logos.put(
    logo
  )
}

export function deleteMAQuadroLogo(
  logoId: string
) {
  return maQuadroDb.logos.delete(
    logoId
  )
}

export async function listMAQuadroImages() {
  const images =
    await maQuadroDb.images.toArray()

  return images.sort(
    (first, second) =>
      second.createdAt.localeCompare(
        first.createdAt
      )
  )
}

export function saveMAQuadroImage(
  image: MAQuadroStoredImage
) {
  return maQuadroDb.images.put(
    image
  )
}

export function deleteMAQuadroImage(
  imageId: string
) {
  return maQuadroDb.images.delete(
    imageId
  )
}

export async function listMAQuadroVideos() {
  const videos =
    await maQuadroDb.videos.toArray()

  return videos.sort(
    (first, second) =>
      second.createdAt.localeCompare(
        first.createdAt
      )
  )
}

export function getMAQuadroVideo(
  videoId: string
) {
  return maQuadroDb.videos.get(
    videoId
  )
}

export function saveMAQuadroVideo(
  video: MAQuadroStoredVideo
) {
  return maQuadroDb.videos.put(
    video
  )
}

export function deleteMAQuadroVideo(
  videoId: string
) {
  return maQuadroDb.videos.delete(
    videoId
  )
}

export async function listMAQuadroBrandKits() {
  const kits =
    await maQuadroDb.brandKits.toArray()

  return kits.sort(
    (first, second) =>
      first.name.localeCompare(
        second.name,
        'pt-PT'
      )
  )
}

export function saveMAQuadroBrandKit(
  kit: MAQuadroStoredBrandKit
) {
  return maQuadroDb.brandKits.put(
    kit
  )
}

export async function deleteMAQuadroBrandKit(
  brandKitId: string
) {
  await maQuadroDb.transaction(
    'rw',
    maQuadroDb.brandKits,
    maQuadroDb.logos,
    async () => {
      await maQuadroDb.brandKits.delete(
        brandKitId
      )

      await maQuadroDb.logos
        .where('brandKitId')
        .equals(brandKitId)
        .delete()
    }
  )
}
