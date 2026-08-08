export type MAQuadroTableSpec = {
  rows: number
  columns: number
  header: boolean
  striped: boolean
  headerBackground: string
  bodyBackground: string
  alternateBackground: string
  borderColor: string
  headerTextColor: string
  bodyTextColor: string
}

export const MA_QUADRO_TABLE_MIN_ROWS = 2
export const MA_QUADRO_TABLE_MAX_ROWS = 12
export const MA_QUADRO_TABLE_MIN_COLUMNS = 2
export const MA_QUADRO_TABLE_MAX_COLUMNS = 8

export const DEFAULT_MA_QUADRO_TABLE_SPEC:
  MAQuadroTableSpec = {
    rows: 3,
    columns: 3,
    header: true,
    striped: false,
    headerBackground: '#0F172A',
    bodyBackground: '#FFFFFF',
    alternateBackground: '#F1F5F9',
    borderColor: '#94A3B8',
    headerTextColor: '#FFFFFF',
    bodyTextColor: '#0F172A'
  }

const CELL_WIDTH = 180
const CELL_HEIGHT = 68
const FONT_SIZE = 22
const HEADER_FONT_WEIGHT = 700
const BODY_FONT_WEIGHT = 500
const MAX_CELL_TEXT_LENGTH = 24

function clampInteger(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.round(
        Number.isFinite(value)
          ? value
          : minimum
      )
    )
  )
}

function escapeXml(
  value: string
) {
  return value
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&apos;'
    )
}

function shortenCellText(
  value: string
) {
  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  if (
    normalized.length <=
    MAX_CELL_TEXT_LENGTH
  ) {
    return normalized
  }

  return `${normalized.slice(
    0,
    MAX_CELL_TEXT_LENGTH - 1
  )}…`
}

export function normalizeMAQuadroTableSpec(
  spec:
    MAQuadroTableSpec
): MAQuadroTableSpec {
  return {
    ...spec,

    rows:
      clampInteger(
        spec.rows,
        MA_QUADRO_TABLE_MIN_ROWS,
        MA_QUADRO_TABLE_MAX_ROWS
      ),

    columns:
      clampInteger(
        spec.columns,
        MA_QUADRO_TABLE_MIN_COLUMNS,
        MA_QUADRO_TABLE_MAX_COLUMNS
      )
  }
}

export function parseMAQuadroTableText(
  value: string,
  spec:
    MAQuadroTableSpec
) {
  const normalizedSpec =
    normalizeMAQuadroTableSpec(
      spec
    )

  const lines =
    value
      .replace(
        /\r/g,
        ''
      )
      .split(
        '\n'
      )
      .slice(
        0,
        normalizedSpec.rows
      )

  const matrix =
    Array.from(
      {
        length:
          normalizedSpec.rows
      },
      () =>
        Array.from(
          {
            length:
              normalizedSpec.columns
          },
          () => ''
        )
    )

  lines.forEach(
    (
      line,
      rowIndex
    ) => {
      const separator =
        line.includes(
          '\t'
        )
          ? '\t'
          : ';'

      line
        .split(
          separator
        )
        .slice(
          0,
          normalizedSpec.columns
        )
        .forEach(
          (
            cell,
            columnIndex
          ) => {
            matrix[
              rowIndex
            ][
              columnIndex
            ] =
              cell.trim()
          }
        )
    }
  )

  if (
    normalizedSpec.header &&
    matrix[0].every(
      (
        cell
      ) =>
        !cell
    )
  ) {
    for (
      let column = 0;
      column <
      normalizedSpec.columns;
      column += 1
    ) {
      matrix[0][
        column
      ] =
        `Coluna ${
          column + 1
        }`
    }
  }

  return matrix
}

export function createMAQuadroTableSvg(
  spec:
    MAQuadroTableSpec,
  content = ''
) {
  const normalizedSpec =
    normalizeMAQuadroTableSpec(
      spec
    )

  const matrix =
    parseMAQuadroTableText(
      content,
      normalizedSpec
    )

  const width =
    normalizedSpec.columns *
    CELL_WIDTH

  const height =
    normalizedSpec.rows *
    CELL_HEIGHT

  const cells:
    string[] = []

  for (
    let row = 0;
    row <
    normalizedSpec.rows;
    row += 1
  ) {
    const isHeader =
      normalizedSpec.header &&
      row === 0

    const isAlternate =
      normalizedSpec.striped &&
      !isHeader &&
      row % 2 === 0

    const fill =
      isHeader
        ? normalizedSpec
            .headerBackground
        : isAlternate
          ? normalizedSpec
              .alternateBackground
          : normalizedSpec
              .bodyBackground

    const textColor =
      isHeader
        ? normalizedSpec
            .headerTextColor
        : normalizedSpec
            .bodyTextColor

    const fontWeight =
      isHeader
        ? HEADER_FONT_WEIGHT
        : BODY_FONT_WEIGHT

    for (
      let column = 0;
      column <
      normalizedSpec.columns;
      column += 1
    ) {
      const x =
        column *
        CELL_WIDTH

      const y =
        row *
        CELL_HEIGHT

      const text =
        escapeXml(
          shortenCellText(
            matrix[
              row
            ][
              column
            ]
          )
        )

      cells.push(`
        <rect
          x="${x}"
          y="${y}"
          width="${CELL_WIDTH}"
          height="${CELL_HEIGHT}"
          fill="${escapeXml(
            fill
          )}"
          stroke="${escapeXml(
            normalizedSpec
              .borderColor
          )}"
          stroke-width="2"
        />
      `)

      if (text) {
        cells.push(`
          <text
            x="${
              x +
              CELL_WIDTH /
                2
            }"
            y="${
              y +
              CELL_HEIGHT /
                2 +
              1
            }"
            text-anchor="middle"
            dominant-baseline="middle"
            fill="${escapeXml(
              textColor
            )}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${FONT_SIZE}"
            font-weight="${fontWeight}"
          >${text}</text>
        `)
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  role="img"
  aria-label="Tabela ${normalizedSpec.rows} por ${normalizedSpec.columns}"
>
  <g>
    ${cells.join('')}
  </g>
</svg>`
}

export function createMAQuadroTablePreviewUrl(
  svg: string
) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    svg
  )}`
}

export function createMAQuadroTableFile(
  spec:
    MAQuadroTableSpec,
  content = ''
) {
  const normalizedSpec =
    normalizeMAQuadroTableSpec(
      spec
    )

  const svg =
    createMAQuadroTableSvg(
      normalizedSpec,
      content
    )

  return new File(
    [
      svg
    ],
    `Tabela-${normalizedSpec.rows}x${normalizedSpec.columns}.svg`,
    {
      type:
        'image/svg+xml',

      lastModified:
        Date.now()
    }
  )
}
