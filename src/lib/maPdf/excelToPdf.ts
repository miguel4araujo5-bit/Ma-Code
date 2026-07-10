import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage
} from 'pdf-lib'

import * as XLSX from 'xlsx'

import type {
  ProgressCallback,
  ResultData,
  SelectedPdf
} from '../../types/maPdf'

import {
  bytesToArrayBuffer,
  sanitizeFileName
} from './fileUtils'

const PAGE_WIDTH = 841.89
const PAGE_HEIGHT = 595.28
const MARGIN = 28
const TITLE_AREA = 48
const HEADER_HEIGHT = 24
const ROW_HEIGHT = 22
const FONT_SIZE = 7
const HEADER_FONT_SIZE = 8
const MAX_COLUMNS_PER_PAGE = 12
const MAX_ROWS_PER_SHEET = 20_000

function getBaseName(fileName: string) {
  return (
    sanitizeFileName(
      fileName.replace(
        /\.(xlsx?|xlsm)$/i,
        ''
      )
    ) || 'folha-de-calculo'
  )
}

function normalizeCell(value: unknown) {
  if (
    value === null ||
    value === undefined
  ) {
    return ''
  }

  return String(value)
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toPdfSafeText(value: string) {
  return value
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/•/g, '-')
    .replace(/€/g, ' EUR ')
    .normalize('NFKD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^\x20-\x7e\xa0-\xff]/g,
      '?'
    )
    .trim()
}

function textWidth(
  font: PDFFont,
  text: string,
  size: number
) {
  try {
    return font.widthOfTextAtSize(
      text,
      size
    )
  } catch {
    return text.length * size * 0.52
  }
}

function fitText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const text = toPdfSafeText(value)

  if (
    textWidth(font, text, size) <=
    maxWidth
  ) {
    return text
  }

  let result = text

  while (
    result.length > 1 &&
    textWidth(
      font,
      `${result}...`,
      size
    ) > maxWidth
  ) {
    result = result.slice(0, -1)
  }

  return result
    ? `${result}...`
    : ''
}

function drawHeading(
  page: PDFPage,
  sheetName: string,
  detail: string,
  font: PDFFont,
  boldFont: PDFFont
) {
  page.drawText(
    fitText(
      sheetName,
      boldFont,
      15,
      PAGE_WIDTH - MARGIN * 2
    ),
    {
      x: MARGIN,
      y:
        PAGE_HEIGHT -
        MARGIN -
        15,
      size: 15,
      font: boldFont,
      color: rgb(
        0.04,
        0.23,
        0.31
      )
    }
  )

  page.drawText(
    fitText(
      detail,
      font,
      8,
      PAGE_WIDTH - MARGIN * 2
    ),
    {
      x: MARGIN,
      y:
        PAGE_HEIGHT -
        MARGIN -
        31,
      size: 8,
      font,
      color: rgb(
        0.38,
        0.44,
        0.51
      )
    }
  )
}

function drawRow(
  page: PDFPage,
  values: string[],
  yTop: number,
  columnWidth: number,
  font: PDFFont,
  fontSize: number,
  isHeader: boolean,
  alternate: boolean
) {
  values.forEach(
    (value, index) => {
      const x =
        MARGIN +
        index * columnWidth

      const height = isHeader
        ? HEADER_HEIGHT
        : ROW_HEIGHT

      page.drawRectangle({
        x,
        y: yTop - height,
        width: columnWidth,
        height,
        color: isHeader
          ? rgb(
              0.86,
              0.95,
              0.98
            )
          : alternate
            ? rgb(
                0.97,
                0.98,
                0.99
              )
            : rgb(1, 1, 1),
        borderColor: rgb(
          0.77,
          0.82,
          0.87
        ),
        borderWidth: 0.55
      })

      page.drawText(
        fitText(
          value,
          font,
          fontSize,
          columnWidth - 8
        ),
        {
          x: x + 4,
          y:
            yTop -
            height +
            (height - fontSize) /
              2 -
            1,
          size: fontSize,
          font,
          color: isHeader
            ? rgb(
                0.04,
                0.23,
                0.31
              )
            : rgb(
                0.12,
                0.16,
                0.22
              )
        }
      )
    }
  )
}

function readRows(
  sheet: XLSX.WorkSheet
) {
  const rawRows =
    XLSX.utils.sheet_to_json<
      unknown[]
    >(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false
    })

  const rows = rawRows
    .slice(0, MAX_ROWS_PER_SHEET)
    .map((row) =>
      Array.isArray(row)
        ? row.map(normalizeCell)
        : [normalizeCell(row)]
    )

  let columnCount = rows.reduce(
    (maximum, row) =>
      Math.max(
        maximum,
        row.length
      ),
    0
  )

  while (
    columnCount > 0 &&
    !rows.some((row) =>
      Boolean(
        row[
          columnCount - 1
        ]?.trim()
      )
    )
  ) {
    columnCount -= 1
  }

  return {
    rows: rows.map((row) =>
      row.slice(0, columnCount)
    ),
    columnCount
  }
}

export async function convertExcelToPdf(
  selected: SelectedPdf | undefined,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error(
      'Escolha um ficheiro Excel para converter para PDF.'
    )
  }

  onProgress(
    'A ler o ficheiro Excel...'
  )

  const workbook = XLSX.read(
    await selected.file.arrayBuffer(),
    {
      type: 'array',
      cellDates: true
    }
  )

  if (
    workbook.SheetNames.length === 0
  ) {
    throw new Error(
      'O ficheiro Excel não contém folhas para converter.'
    )
  }

  const pdfDocument =
    await PDFDocument.create()

  const font =
    await pdfDocument.embedFont(
      StandardFonts.Helvetica
    )

  const boldFont =
    await pdfDocument.embedFont(
      StandardFonts.HelveticaBold
    )

  let generatedPages = 0

  for (
    let sheetIndex = 0;
    sheetIndex <
    workbook.SheetNames.length;
    sheetIndex += 1
  ) {
    const sheetName =
      workbook.SheetNames[
        sheetIndex
      ]

    const sheet =
      workbook.Sheets[
        sheetName
      ]

    onProgress(
      `A converter a folha ${sheetIndex + 1} de ${workbook.SheetNames.length}: ${sheetName}...`
    )

    const {
      rows,
      columnCount
    } = readRows(sheet)

    if (
      rows.length === 0 ||
      columnCount === 0
    ) {
      const page =
        pdfDocument.addPage([
          PAGE_WIDTH,
          PAGE_HEIGHT
        ])

      drawHeading(
        page,
        sheetName,
        'Folha sem células preenchidas.',
        font,
        boldFont
      )

      page.drawText(
        'Esta folha não contém dados visíveis para converter.',
        {
          x: MARGIN,
          y:
            PAGE_HEIGHT -
            MARGIN -
            78,
          size: 11,
          font,
          color: rgb(
            0.38,
            0.44,
            0.51
          )
        }
      )

      generatedPages += 1
      continue
    }

    const columnGroups:
      number[][] = []

    for (
      let start = 0;
      start < columnCount;
      start +=
        MAX_COLUMNS_PER_PAGE
    ) {
      columnGroups.push(
        Array.from(
          {
            length: Math.min(
              MAX_COLUMNS_PER_PAGE,
              columnCount - start
            )
          },
          (_, index) =>
            start + index
        )
      )
    }

    const headerRow = rows[0]
    const dataRows = rows.slice(1)

    const availableHeight =
      PAGE_HEIGHT -
      MARGIN * 2 -
      TITLE_AREA -
      HEADER_HEIGHT

    const rowsPerPage = Math.max(
      1,
      Math.floor(
        availableHeight /
          ROW_HEIGHT
      )
    )

    for (
      let groupIndex = 0;
      groupIndex <
      columnGroups.length;
      groupIndex += 1
    ) {
      const columns =
        columnGroups[groupIndex]

      const columnWidth =
        (PAGE_WIDTH -
          MARGIN * 2) /
        columns.length

      const pageCount = Math.max(
        1,
        Math.ceil(
          dataRows.length /
            rowsPerPage
        )
      )

      for (
        let pageIndex = 0;
        pageIndex < pageCount;
        pageIndex += 1
      ) {
        const page =
          pdfDocument.addPage([
            PAGE_WIDTH,
            PAGE_HEIGHT
          ])

        generatedPages += 1

        const firstColumn =
          columns[0] + 1

        const lastColumn =
          columns[
            columns.length - 1
          ] + 1

        drawHeading(
          page,
          sheetName,
          `Colunas ${firstColumn}-${lastColumn} · Página ${pageIndex + 1} de ${pageCount}`,
          font,
          boldFont
        )

        let cursorY =
          PAGE_HEIGHT -
          MARGIN -
          TITLE_AREA

        drawRow(
          page,
          columns.map(
            (column) =>
              headerRow[column] ||
              `Coluna ${column + 1}`
          ),
          cursorY,
          columnWidth,
          boldFont,
          HEADER_FONT_SIZE,
          true,
          false
        )

        cursorY -= HEADER_HEIGHT

        const startRow =
          pageIndex *
          rowsPerPage

        const pageRows =
          dataRows.slice(
            startRow,
            startRow +
              rowsPerPage
          )

        pageRows.forEach(
          (row, rowIndex) => {
            drawRow(
              page,
              columns.map(
                (column) =>
                  row[column] || ''
              ),
              cursorY,
              columnWidth,
              font,
              FONT_SIZE,
              false,
              rowIndex % 2 === 1
            )

            cursorY -= ROW_HEIGHT
          }
        )
      }
    }
  }

  onProgress(
    'A finalizar o documento PDF...'
  )

  const pdfBytes =
    await pdfDocument.save({
      useObjectStreams: true
    })

  const blob = new Blob(
    [
      bytesToArrayBuffer(
        pdfBytes
      )
    ],
    {
      type: 'application/pdf'
    }
  )

  return {
    fileName: `${getBaseName(
      selected.file.name
    )}-convertido.pdf`,
    blob,
    originalSize:
      selected.file.size,
    finalSize: blob.size,
    message: `${workbook.SheetNames.length} folha${
      workbook.SheetNames.length ===
      1
        ? ''
        : 's'
    } Excel ${
      workbook.SheetNames.length ===
      1
        ? 'foi convertida'
        : 'foram convertidas'
    } para ${generatedPages} página${
      generatedPages === 1
        ? ''
        : 's'
    } PDF. Fórmulas aparecem pelos valores calculados; gráficos, macros e imagens não são reproduzidos.`
  }
}
