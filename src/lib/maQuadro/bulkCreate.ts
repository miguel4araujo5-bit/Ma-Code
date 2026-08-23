import type {
  MAQuadroPage,
  MAQuadroProject
} from '../../types/maQuadro'

import {
  cloneMAQuadroValue,
  duplicatePage,
  duplicateProject
} from './project'

export const MA_QUADRO_BULK_MAX_ROWS = 200
export const MA_QUADRO_BULK_MAX_FILE_BYTES = 5_000_000
export const MA_QUADRO_BULK_MAX_ESTIMATED_CHARACTERS = 55_000_000

type CsvDelimiter = ',' | ';' | '\t'

export type MAQuadroBulkRow = Record<string, string>

export type MAQuadroBulkCsv = {
  headers: string[]
  rows: MAQuadroBulkRow[]
  delimiter: CsvDelimiter
}

function normalizeKey(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
}

function countDelimiterInFirstRecord(
  source: string,
  delimiter: CsvDelimiter
) {
  let inQuotes = false
  let count = 0

  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    const character =
      source[index]

    if (
      character === '"'
    ) {
      if (
        inQuotes &&
        source[index + 1] === '"'
      ) {
        index += 1
      } else {
        inQuotes =
          !inQuotes
      }

      continue
    }

    if (
      !inQuotes &&
      (
        character === '\n' ||
        character === '\r'
      )
    ) {
      break
    }

    if (
      !inQuotes &&
      character === delimiter
    ) {
      count += 1
    }
  }

  return count
}

function detectDelimiter(
  source: string
): CsvDelimiter {
  const candidates:
    CsvDelimiter[] = [
      ',',
      ';',
      '\t'
    ]

  let best:
    CsvDelimiter = ','

  let bestCount = -1

  for (
    const candidate
    of candidates
  ) {
    const count =
      countDelimiterInFirstRecord(
        source,
        candidate
      )

    if (
      count >
      bestCount
    ) {
      best =
        candidate

      bestCount =
        count
    }
  }

  if (
    bestCount <=
    0
  ) {
    return ';'
  }

  return best
}

function parseRecords(
  source: string,
  delimiter: CsvDelimiter
) {
  const records:
    string[][] = []

  let row:
    string[] = []

  let field = ''
  let inQuotes = false

  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    const character =
      source[index]

    if (
      character === '"'
    ) {
      if (
        inQuotes &&
        source[index + 1] === '"'
      ) {
        field += '"'
        index += 1
      } else {
        inQuotes =
          !inQuotes
      }

      continue
    }

    if (
      !inQuotes &&
      character === delimiter
    ) {
      row.push(
        field
      )

      field = ''

      continue
    }

    if (
      !inQuotes &&
      (
        character === '\n' ||
        character === '\r'
      )
    ) {
      if (
        character === '\r' &&
        source[index + 1] === '\n'
      ) {
        index += 1
      }

      row.push(
        field
      )

      field = ''

      records.push(
        row
      )

      row = []

      continue
    }

    field +=
      character
  }

  if (
    inQuotes
  ) {
    throw new Error(
      'O CSV contém um campo entre aspas que não foi fechado.'
    )
  }

  if (
    field.length >
      0 ||
    row.length >
      0
  ) {
    row.push(
      field
    )

    records.push(
      row
    )
  }

  return records.filter(
    (
      record
    ) =>
      record.some(
        (
          value
        ) =>
          value
            .trim()
            .length >
          0
      )
  )
}

export function parseMAQuadroBulkCsv(
  source: string
): MAQuadroBulkCsv {
  const cleanSource =
    source.replace(
      /^\uFEFF/,
      ''
    )

  const delimiter =
    detectDelimiter(
      cleanSource
    )

  const records =
    parseRecords(
      cleanSource,
      delimiter
    )

  if (
    records.length <
    2
  ) {
    throw new Error(
      'O CSV deve ter uma linha de cabeçalho e pelo menos uma linha de dados.'
    )
  }

  const headers =
    records[0].map(
      (
        value
      ) =>
        value.trim()
    )

  if (
    headers.some(
      (
        header
      ) =>
        !header
    )
  ) {
    throw new Error(
      'Todas as colunas do CSV precisam de ter um nome.'
    )
  }

  const normalizedHeaders =
    headers.map(
      normalizeKey
    )

  if (
    new Set(
      normalizedHeaders
    ).size !==
    normalizedHeaders.length
  ) {
    throw new Error(
      'O CSV contém nomes de coluna repetidos.'
    )
  }

  const rows =
    records
      .slice(1)
      .map(
        (
          record
        ) => {
          const row:
            MAQuadroBulkRow =
            {}

          headers.forEach(
            (
              header,
              index
            ) => {
              row[header] =
                record[
                  index
                ] ??
                ''
            }
          )

          return row
        }
      )

  if (
    rows.length >
    MA_QUADRO_BULK_MAX_ROWS
  ) {
    throw new Error(
      `O MA-Quadro permite até ${MA_QUADRO_BULK_MAX_ROWS} linhas por criação em massa.`
    )
  }

  return {
    headers,
    rows,
    delimiter
  }
}

function collectPlaceholders(
  value: unknown,
  target: Set<string>
) {
  if (
    typeof value ===
    'string'
  ) {
    const expression =
      /\{([^{}\r\n]{1,80})\}/g

    let match:
      RegExpExecArray |
      null

    while (
      (
        match =
          expression.exec(
            value
          )
      ) !==
      null
    ) {
      const placeholder =
        match[1].trim()

      if (
        placeholder
      ) {
        target.add(
          placeholder
        )
      }
    }

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
        collectPlaceholders(
          item,
          target
        )
    )

    return
  }

  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return
  }

  Object.values(
    value as
      Record<
        string,
        unknown
      >
  ).forEach(
    (
      item
    ) =>
      collectPlaceholders(
        item,
        target
      )
  )
}

export function findMAQuadroBulkPlaceholders(
  page:
    MAQuadroPage
) {
  const placeholders =
    new Set<string>()

  collectPlaceholders(
    page.canvasJson,
    placeholders
  )

  return Array.from(
    placeholders
  ).sort(
    (
      first,
      second
    ) =>
      first.localeCompare(
        second,
        'pt-PT'
      )
  )
}

export function findMissingMAQuadroBulkColumns(
  placeholders:
    string[],
  headers:
    string[]
) {
  const available =
    new Set(
      headers.map(
        normalizeKey
      )
    )

  return placeholders.filter(
    (
      placeholder
    ) =>
      !available.has(
        normalizeKey(
          placeholder
        )
      )
  )
}

function createNormalizedRow(
  row:
    MAQuadroBulkRow
) {
  const normalized =
    new Map<
      string,
      string
    >()

  Object.entries(
    row
  ).forEach(
    (
      [
        key,
        value
      ]
    ) => {
      normalized.set(
        normalizeKey(
          key
        ),
        value
      )
    }
  )

  return normalized
}

function replaceStringPlaceholders(
  value: string,
  normalizedRow:
    Map<
      string,
      string
    >
) {
  return value.replace(
    /\{([^{}\r\n]{1,80})\}/g,
    (
      match,
      rawKey:
        string
    ) => {
      const replacement =
        normalizedRow.get(
          normalizeKey(
            rawKey
          )
        )

      return replacement ===
        undefined
        ? match
        : replacement
    }
  )
}

function replacePlaceholders(
  value: unknown,
  normalizedRow:
    Map<
      string,
      string
    >
): unknown {
  if (
    typeof value ===
    'string'
  ) {
    return replaceStringPlaceholders(
      value,
      normalizedRow
    )
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value.map(
      (
        item
      ) =>
        replacePlaceholders(
          item,
          normalizedRow
        )
    )
  }

  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return value
  }

  const source =
    value as
      Record<
        string,
        unknown
      >

  const next:
    Record<
      string,
      unknown
    > = {}

  Object.entries(
    source
  ).forEach(
    (
      [
        key,
        item
      ]
    ) => {
      next[key] =
        replacePlaceholders(
          item,
          normalizedRow
        )
    }
  )

  return next
}

function pageLabel(
  row:
    MAQuadroBulkRow,
  index:
    number
) {
  const preferredKeys = [
    'nome',
    'name',
    'titulo',
    'title',
    'produto',
    'product',
    'codigo',
    'code'
  ]

  const entries =
    Object.entries(
      row
    )

  for (
    const preferredKey
    of preferredKeys
  ) {
    const match =
      entries.find(
        (
          [
            key
          ]
        ) =>
          normalizeKey(
            key
          ) ===
          preferredKey
      )

    const value =
      match?.[1]
        .trim()

    if (
      value
    ) {
      return value.slice(
        0,
        90
      )
    }
  }

  return String(
    index + 1
  )
}

export function estimateMAQuadroBulkCharacters(
  page:
    MAQuadroPage,
  rowCount:
    number
) {
  return (
    JSON.stringify(
      page
    ).length *
    rowCount
  )
}

export function createMAQuadroBulkProject(
  source:
    MAQuadroProject,
  templatePageId:
    string,
  rows:
    MAQuadroBulkRow[]
) {
  const templatePage =
    source.pages.find(
      (
        page
      ) =>
        page.id ===
        templatePageId
    )

  if (
    !templatePage
  ) {
    throw new Error(
      'A página usada como modelo já não está disponível.'
    )
  }

  if (
    rows.length ===
      0 ||
    rows.length >
      MA_QUADRO_BULK_MAX_ROWS
  ) {
    throw new Error(
      'Número de linhas inválido para criação em massa.'
    )
  }

  const copy =
    duplicateProject(
      source,
      `${source.name} — criação em massa`
    )

  const pages =
    rows.map(
      (
        row,
        index
      ) => {
        const generated =
          duplicatePage(
            cloneMAQuadroValue(
              templatePage
            ),
            `${templatePage.name} · ${pageLabel(
              row,
              index
            )}`
          )

        const normalizedRow =
          createNormalizedRow(
            row
          )

        generated.canvasJson =
          replacePlaceholders(
            generated.canvasJson,
            normalizedRow
          ) as
            MAQuadroPage['canvasJson']

        generated.thumbnail =
          undefined

        return generated
      }
    )

  const now =
    new Date()
      .toISOString()

  return {
    ...copy,
    pages,
    activePageId:
      pages[0].id,
    updatedAt:
      now
  } satisfies
    MAQuadroProject
}
