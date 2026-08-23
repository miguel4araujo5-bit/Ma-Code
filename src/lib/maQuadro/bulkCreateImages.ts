import type {
  MAQuadroPage,
  MAQuadroProject
} from '../../types/maQuadro'

import type {
  MAQuadroBulkRow
} from './bulkCreate'

export const MA_QUADRO_BULK_IMAGE_MAX_FILE_BYTES =
  25 * 1024 * 1024

export const MA_QUADRO_BULK_IMAGE_MAX_TOTAL_BYTES =
  80 * 1024 * 1024

export const MA_QUADRO_BULK_IMAGE_MAX_TEMPLATE_PIXELS =
  16_000_000

export const MA_QUADRO_BULK_IMAGE_MAX_SOURCE_PIXELS =
  50_000_000

export type MAQuadroBulkImageBinding = {
  column: string
  objectId: string
  layerName: string
  templateWidth: number
  templateHeight: number
}

export type MAQuadroBulkImageAnalysis = {
  requested: number
  matched: number
  missing: string[]
  uniqueMatchedFiles: number
}

type SerializedNode =
  Record<string, unknown>

type PreparedImage = {
  dataUrl: string
  width: number
  height: number
}

function normalizeKey(
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

function normalizeFileReference(
  value: string
) {
  const normalized =
    value
      .trim()
      .replace(
        /\\/g,
        '/'
      )

  const parts =
    normalized.split(
      '/'
    )

  return normalizeKey(
    parts[
      parts.length - 1
    ] ||
    normalized
  )
}

function withoutExtension(
  value: string
) {
  return value.replace(
    /\.[^.]+$/,
    ''
  )
}

function imageBindingColumn(
  value: unknown
) {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const match =
    value
      .trim()
      .match(
        /^\{([^{}\r\n]{1,80})\}$/
      )

  return (
    match?.[1]
      .trim() ||
    null
  )
}

function isSerializedImage(
  node:
    SerializedNode
) {
  const role =
    typeof node.maRole ===
    'string'
      ? node.maRole
      : ''

  const type =
    typeof node.type ===
    'string'
      ? node.type
      : ''

  return (
    role ===
      'image' ||
    type ===
      'FabricImage' ||
    type ===
      'Image'
  )
}

function walkNodes(
  value: unknown,
  operation: (
    node:
      SerializedNode
  ) => void
) {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return
  }

  if (
    Array.isArray(
      value
    )
  ) {
    value.forEach(
      (
        item
      ) =>
        walkNodes(
          item,
          operation
        )
    )

    return
  }

  const node =
    value as
      SerializedNode

  operation(
    node
  )

  Object.values(
    node
  ).forEach(
    (
      child
    ) =>
      walkNodes(
        child,
        operation
      )
  )
}

function finitePositive(
  value: unknown,
  fallback: number
) {
  const numeric =
    Number(
      value
    )

  return (
    Number.isFinite(
      numeric
    ) &&
    numeric >
      0
  )
    ? numeric
    : fallback
}

export function findMAQuadroBulkImageBindings(
  page:
    MAQuadroPage
) {
  const bindings:
    MAQuadroBulkImageBinding[] =
    []

  const seen =
    new Set<string>()

  walkNodes(
    page.canvasJson,

    (
      node
    ) => {
      if (
        !isSerializedImage(
          node
        )
      ) {
        return
      }

      const column =
        imageBindingColumn(
          node.maName
        )

      const objectId =
        typeof node.maId ===
        'string'
          ? node.maId
          : ''

      if (
        !column ||
        !objectId ||
        seen.has(
          objectId
        )
      ) {
        return
      }

      const templateWidth =
        Math.round(
          finitePositive(
            node.maOriginalWidth,

            finitePositive(
              node.width,
              1
            )
          )
        )

      const templateHeight =
        Math.round(
          finitePositive(
            node.maOriginalHeight,

            finitePositive(
              node.height,
              1
            )
          )
        )

      bindings.push({
        column,
        objectId,

        layerName:
          typeof node.maName ===
          'string'
            ? node.maName
            : `{${column}}`,

        templateWidth,
        templateHeight
      })

      seen.add(
        objectId
      )
    }
  )

  return bindings.sort(
    (
      first,
      second
    ) =>
      first.column
        .localeCompare(
          second.column,
          'pt-PT'
        )
  )
}

function rowValue(
  row:
    MAQuadroBulkRow,
  column:
    string
) {
  const normalizedColumn =
    normalizeKey(
      column
    )

  const entry =
    Object.entries(
      row
    ).find(
      (
        [
          key
        ]
      ) =>
        normalizeKey(
          key
        ) ===
        normalizedColumn
    )

  return (
    entry?.[1]
      ?.trim() ||
    ''
  )
}

function createFileIndex(
  files:
    File[]
) {
  const exact =
    new Map<
      string,
      File
    >()

  const stems =
    new Map<
      string,
      File[]
    >()

  for (
    const file
    of files
  ) {
    const normalizedName =
      normalizeFileReference(
        file.name
      )

    if (
      !normalizedName
    ) {
      continue
    }

    exact.set(
      normalizedName,
      file
    )

    const stem =
      withoutExtension(
        normalizedName
      )

    const current =
      stems.get(
        stem
      ) ||
      []

    current.push(
      file
    )

    stems.set(
      stem,
      current
    )
  }

  return {
    exact,
    stems
  }
}

function resolveFile(
  reference:
    string,

  index:
    ReturnType<
      typeof createFileIndex
    >
) {
  const normalized =
    normalizeFileReference(
      reference
    )

  if (
    !normalized
  ) {
    return null
  }

  const exact =
    index.exact.get(
      normalized
    )

  if (
    exact
  ) {
    return exact
  }

  const stem =
    withoutExtension(
      normalized
    )

  const candidates =
    index.stems.get(
      stem
    ) ||
    []

  return candidates.length ===
    1
    ? candidates[0]
    : null
}

export function analyseMAQuadroBulkImageReferences(
  bindings:
    MAQuadroBulkImageBinding[],

  rows:
    MAQuadroBulkRow[],

  files:
    File[]
):
  MAQuadroBulkImageAnalysis {
  const index =
    createFileIndex(
      files
    )

  const missing =
    new Set<string>()

  const matchedFiles =
    new Set<File>()

  let requested =
    0

  let matched =
    0

  for (
    const row
    of rows
  ) {
    for (
      const binding
      of bindings
    ) {
      const reference =
        rowValue(
          row,
          binding.column
        )

      if (
        !reference
      ) {
        continue
      }

      requested +=
        1

      const file =
        resolveFile(
          reference,
          index
        )

      if (
        file
      ) {
        matched +=
          1

        matchedFiles.add(
          file
        )
      } else {
        missing.add(
          reference
        )
      }
    }
  }

  return {
    requested,
    matched,

    missing:
      Array.from(
        missing
      ).sort(
        (
          first,
          second
        ) =>
          first.localeCompare(
            second,
            'pt-PT'
          )
      ),

    uniqueMatchedFiles:
      matchedFiles.size
  }
}

function readFileAsDataUrl(
  file:
    File
) {
  return new Promise<string>(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader()

      reader.onload =
        () => {
          if (
            typeof reader.result ===
            'string'
          ) {
            resolve(
              reader.result
            )

            return
          }

          reject(
            new Error(
              `Não foi possível ler ${file.name}.`
            )
          )
        }

      reader.onerror =
        () => {
          reject(
            reader.error ||
            new Error(
              `Não foi possível ler ${file.name}.`
            )
          )
        }

      reader.readAsDataURL(
        file
      )
    }
  )
}

function loadImage(
  source:
    string
) {
  return new Promise<
    HTMLImageElement
  >(
    (
      resolve,
      reject
    ) => {
      const image =
        new Image()

      image.decoding =
        'async'

      image.onload =
        () =>
          resolve(
            image
          )

      image.onerror =
        () =>
          reject(
            new Error(
              'Não foi possível preparar uma das imagens da criação em massa.'
            )
          )

      image.src =
        source
    }
  )
}

function canvasToDataUrl(
  canvas:
    HTMLCanvasElement
) {
  const webp =
    canvas.toDataURL(
      'image/webp',
      0.9
    )

  if (
    webp.startsWith(
      'data:image/webp'
    )
  ) {
    return webp
  }

  return canvas.toDataURL(
    'image/png'
  )
}

async function prepareFileForBinding(
  file:
    File,

  binding:
    MAQuadroBulkImageBinding
):
  Promise<PreparedImage> {
  if (
    !file.type
      .startsWith(
        'image/'
      )
  ) {
    throw new Error(
      `${file.name} não é uma imagem suportada.`
    )
  }

  if (
    file.size >
    MA_QUADRO_BULK_IMAGE_MAX_FILE_BYTES
  ) {
    throw new Error(
      `${file.name} ultrapassa o limite de 25 MB por imagem.`
    )
  }

  const targetPixels =
    binding.templateWidth *
    binding.templateHeight

  if (
    targetPixels >
    MA_QUADRO_BULK_IMAGE_MAX_TEMPLATE_PIXELS
  ) {
    throw new Error(
      `A camada ${binding.layerName} usa uma imagem-modelo demasiado grande para criação em massa. Reduza a resolução dessa imagem para menos de 16 milhões de píxeis.`
    )
  }

  const sourceDataUrl =
    await readFileAsDataUrl(
      file
    )

  const image =
    await loadImage(
      sourceDataUrl
    )

  const sourceWidth =
    Math.max(
      1,
      image.naturalWidth
    )

  const sourceHeight =
    Math.max(
      1,
      image.naturalHeight
    )

  if (
    sourceWidth *
    sourceHeight >
    MA_QUADRO_BULK_IMAGE_MAX_SOURCE_PIXELS
  ) {
    throw new Error(
      `${file.name} tem demasiados píxeis para ser processada com segurança.`
    )
  }

  const canvas =
    document.createElement(
      'canvas'
    )

  canvas.width =
    binding.templateWidth

  canvas.height =
    binding.templateHeight

  const context =
    canvas.getContext(
      '2d'
    )

  if (
    !context
  ) {
    throw new Error(
      'O navegador não permitiu preparar as imagens da criação em massa.'
    )
  }

  const scale =
    Math.max(
      binding.templateWidth /
        sourceWidth,

      binding.templateHeight /
        sourceHeight
    )

  const width =
    sourceWidth *
    scale

  const height =
    sourceHeight *
    scale

  const x =
    (
      binding.templateWidth -
      width
    ) /
    2

  const y =
    (
      binding.templateHeight -
      height
    ) /
    2

  context.clearRect(
    0,
    0,
    binding.templateWidth,
    binding.templateHeight
  )

  context.imageSmoothingEnabled =
    true

  context.imageSmoothingQuality =
    'high'

  context.drawImage(
    image,
    x,
    y,
    width,
    height
  )

  const dataUrl =
    canvasToDataUrl(
      canvas
    )

  canvas.width =
    1

  canvas.height =
    1

  return {
    dataUrl,

    width:
      binding.templateWidth,

    height:
      binding.templateHeight
  }
}

function findNodeById(
  value:
    unknown,

  objectId:
    string
):
  SerializedNode |
  null {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return null
  }

  if (
    Array.isArray(
      value
    )
  ) {
    for (
      const item
      of value
    ) {
      const found =
        findNodeById(
          item,
          objectId
        )

      if (
        found
      ) {
        return found
      }
    }

    return null
  }

  const node =
    value as
      SerializedNode

  if (
    node.maId ===
    objectId
  ) {
    return node
  }

  for (
    const child
    of Object.values(
      node
    )
  ) {
    const found =
      findNodeById(
        child,
        objectId
      )

    if (
      found
    ) {
      return found
    }
  }

  return null
}

export async function applyMAQuadroBulkImages(
  project:
    MAQuadroProject,

  templatePage:
    MAQuadroPage,

  rows:
    MAQuadroBulkRow[],

  files:
    File[]
) {
  const bindings =
    findMAQuadroBulkImageBindings(
      templatePage
    )

  if (
    bindings.length ===
    0
  ) {
    return project
  }

  const analysis =
    analyseMAQuadroBulkImageReferences(
      bindings,
      rows,
      files
    )

  if (
    analysis.missing.length >
    0
  ) {
    throw new Error(
      `Faltam ${analysis.missing.length} ficheiro(s) referido(s) no CSV: ${analysis.missing.slice(0, 6).join(', ')}${analysis.missing.length > 6 ? '…' : ''}`
    )
  }

  const totalBytes =
    files.reduce(
      (
        total,
        file
      ) =>
        total +
        file.size,
      0
    )

  if (
    totalBytes >
    MA_QUADRO_BULK_IMAGE_MAX_TOTAL_BYTES
  ) {
    throw new Error(
      'As imagens selecionadas ultrapassam 80 MB no total. Selecione apenas os ficheiros utilizados neste CSV.'
    )
  }

  const index =
    createFileIndex(
      files
    )

  const prepared =
    new Map<
      string,
      PreparedImage
    >()

  for (
    let rowIndex =
      0;
    rowIndex <
      rows.length;
    rowIndex +=
      1
  ) {
    const page =
      project.pages[
        rowIndex
      ]

    const row =
      rows[
        rowIndex
      ]

    if (
      !page ||
      !row
    ) {
      continue
    }

    for (
      const binding
      of bindings
    ) {
      const reference =
        rowValue(
          row,
          binding.column
        )

      const node =
        findNodeById(
          page.canvasJson,
          binding.objectId
        )

      if (
        !node
      ) {
        throw new Error(
          `A camada ${binding.layerName} deixou de existir numa das páginas geradas.`
        )
      }

      if (
        !reference
      ) {
        node.maName =
          binding.layerName

        continue
      }

      const file =
        resolveFile(
          reference,
          index
        )

      if (
        !file
      ) {
        throw new Error(
          `Não foi encontrado o ficheiro ${reference}.`
        )
      }

      const cacheKey = [
        normalizeFileReference(
          file.name
        ),
        binding.templateWidth,
        binding.templateHeight
      ].join(
        '::'
      )

      let image =
        prepared.get(
          cacheKey
        )

      if (
        !image
      ) {
        image =
          await prepareFileForBinding(
            file,
            binding
          )

        prepared.set(
          cacheKey,
          image
        )
      }

      node.src =
        image.dataUrl

      node.maSourceDataUrl =
        image.dataUrl

      node.maOriginalWidth =
        image.width

      node.maOriginalHeight =
        image.height

      node.maName =
        file.name
    }

    page.thumbnail =
      undefined
  }

  project.updatedAt =
    new Date()
      .toISOString()

  return project
}
