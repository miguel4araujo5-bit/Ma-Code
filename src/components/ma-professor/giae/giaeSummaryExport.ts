import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont
} from 'pdf-lib'

import {
  bytesToArrayBuffer,
  downloadBlob,
  sanitizeFileName
} from '../../../lib/maPdf/fileUtils'

import type {
  GIAEWorkspaceRow,
  GIAEWorkspaceSnapshot
} from './giaeWorkspaceRepository'

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function stateLabel(
  row: GIAEWorkspaceRow
) {
  if (row.state === 'missing_summary') {
    return 'Sem sumário'
  }

  if (row.state === 'pending') {
    return 'Por submeter'
  }

  return 'Submetido'
}

function subjectLabel(
  row: GIAEWorkspaceRow
) {
  return (
    row.subject.shortName.trim() ||
    row.subject.name.trim()
  )
}

function moduleLabel(
  row: GIAEWorkspaceRow
) {
  return [
    row.module.code.trim(),
    row.module.name.trim()
  ]
    .filter(Boolean)
    .join(' · ')
}

function sortedRows(
  rows: GIAEWorkspaceRow[]
) {
  return [...rows].sort(
    (left, right) =>
      left.lesson.date.localeCompare(
        right.lesson.date
      ) ||
      left.lesson.startTime.localeCompare(
        right.lesson.startTime
      ) ||
      left.group.name.localeCompare(
        right.group.name,
        'pt-PT',
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  )
}

function fileBaseName(
  snapshot: GIAEWorkspaceSnapshot
) {
  return (
    sanitizeFileName(
      `Sumarios-${snapshot.academicYear.name}`
    ) ||
    'Sumarios-MA-Professor'
  )
}

function sanitizePdfText(
  value: string
) {
  return value
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/·/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function wrapText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const cleaned =
    sanitizePdfText(value)

  if (!cleaned) {
    return ['']
  }

  const words = cleaned.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate =
      current
        ? `${current} ${word}`
        : word

    if (
      font.widthOfTextAtSize(
        candidate,
        size
      ) <= maxWidth
    ) {
      current = candidate
      continue
    }

    if (current) {
      lines.push(current)
    }

    current = word
  }

  if (current) {
    lines.push(current)
  }

  return lines.length > 0
    ? lines
    : ['']
}

export async function exportGIAESummariesExcel(
  snapshot: GIAEWorkspaceSnapshot
) {
  const rows = sortedRows(
    snapshot.rows
  )

  if (rows.length === 0) {
    throw new Error(
      'Não existem registos para exportar com esta seleção.'
    )
  }

  const XLSX = await import('xlsx')

  const table = rows.map(
    row => ({
      Data: row.lesson.date,
      Início: row.lesson.startTime,
      Fim: row.lesson.endTime,
      Tempos: row.lesson.periodCount,
      Turma: row.group.name,
      Disciplina: subjectLabel(row),
      'UFCD / módulo': moduleLabel(row),
      Sumário: row.lesson.summary.trim(),
      Estado: stateLabel(row)
    })
  )

  const worksheet =
    XLSX.utils.json_to_sheet(table)

  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 9 },
    { wch: 9 },
    { wch: 8 },
    { wch: 14 },
    { wch: 24 },
    { wch: 32 },
    { wch: 90 },
    { wch: 18 }
  ]

  const workbook =
    XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'Sumários'
  )

  const bytes = XLSX.write(
    workbook,
    {
      bookType: 'xlsx',
      type: 'array',
      compression: true
    }
  )

  downloadBlob(
    new Blob(
      [
        bytes instanceof Uint8Array
          ? bytesToArrayBuffer(bytes)
          : bytes
      ],
      {
        type: XLSX_MIME
      }
    ),
    `${fileBaseName(snapshot)}.xlsx`
  )
}

export async function exportGIAESummariesPdf(
  snapshot: GIAEWorkspaceSnapshot
) {
  const rows = sortedRows(
    snapshot.rows
  )

  if (rows.length === 0) {
    throw new Error(
      'Não existem registos para exportar com esta seleção.'
    )
  }

  const document =
    await PDFDocument.create()

  const regular =
    await document.embedFont(
      StandardFonts.Helvetica
    )

  const bold =
    await document.embedFont(
      StandardFonts.HelveticaBold
    )

  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 42
  const contentWidth =
    pageWidth - margin * 2
  const lineHeight = 12

  let page = document.addPage([
    pageWidth,
    pageHeight
  ])
  let y = pageHeight - margin

  const drawHeader = () => {
    page.drawText(
      'Sumários',
      {
        x: margin,
        y,
        size: 18,
        font: bold,
        color: rgb(0.08, 0.12, 0.2)
      }
    )

    y -= 20

    page.drawText(
      sanitizePdfText(
        `MA-Professor - ${snapshot.academicYear.name}`
      ),
      {
        x: margin,
        y,
        size: 9,
        font: regular,
        color: rgb(0.35, 0.4, 0.48)
      }
    )

    y -= 20
  }

  const newPage = () => {
    page = document.addPage([
      pageWidth,
      pageHeight
    ])
    y = pageHeight - margin
    drawHeader()
  }

  drawHeader()

  for (const row of rows) {
    const meta = sanitizePdfText(
      [
        row.lesson.date,
        `${row.lesson.startTime}-${row.lesson.endTime}`,
        row.group.name,
        subjectLabel(row),
        moduleLabel(row),
        stateLabel(row)
      ].join(' | ')
    )

    const metaLines = wrapText(
      meta,
      bold,
      8.5,
      contentWidth
    )

    const summaryLines = wrapText(
      row.lesson.summary.trim() ||
        'Sem sumário registado.',
      regular,
      9.5,
      contentWidth
    )

    const requiredHeight =
      metaLines.length * lineHeight +
      summaryLines.length * lineHeight +
      24

    if (
      y - requiredHeight < margin
    ) {
      newPage()
    }

    for (const line of metaLines) {
      page.drawText(
        line,
        {
          x: margin,
          y,
          size: 8.5,
          font: bold,
          color: rgb(0.2, 0.25, 0.33)
        }
      )
      y -= lineHeight
    }

    y -= 3

    for (const line of summaryLines) {
      page.drawText(
        line,
        {
          x: margin,
          y,
          size: 9.5,
          font: regular,
          color: rgb(0.08, 0.12, 0.2)
        }
      )
      y -= lineHeight
    }

    y -= 7

    page.drawLine({
      start: {
        x: margin,
        y
      },
      end: {
        x: pageWidth - margin,
        y
      },
      thickness: 0.5,
      color: rgb(0.82, 0.84, 0.88)
    })

    y -= 12
  }

  const bytes =
    await document.save()

  downloadBlob(
    new Blob(
      [bytesToArrayBuffer(bytes)],
      {
        type: 'application/pdf'
      }
    ),
    `${fileBaseName(snapshot)}.pdf`
  )
}
