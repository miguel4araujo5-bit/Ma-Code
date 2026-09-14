import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage
} from 'pdf-lib'

import {
  bytesToArrayBuffer,
  downloadBlob
} from '../../../lib/maPdf/fileUtils'

import type {
  AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepository'

import {
  buildUfcdCfpModel
} from './ufcdCfpModel'

const PAGE_WIDTH = 841.89
const PAGE_HEIGHT = 595.28
const MARGIN = 18

const COLORS = {
  border: rgb(0.15, 0.15, 0.15),
  header: rgb(0.78, 0.78, 0.78),
  title: rgb(0.86, 0.86, 0.86),
  criterion: [
    rgb(0.56, 0.72, 0.87),
    rgb(0.83, 0.57, 0.57),
    rgb(0.68, 0.80, 0.50),
    rgb(0.61, 0.55, 0.78),
    rgb(0.92, 0.79, 0.70),
    rgb(0.94, 0.66, 0.45)
  ],
  acs: rgb(0.68, 0.80, 0.50),
  automatic: rgb(0.82, 0.82, 0.82),
  self: rgb(0.86, 0.86, 0.86),
  final: rgb(0.86, 0.86, 0.86),
  white: rgb(1, 1, 1)
}

function formatNumber(
  value: number | null,
  decimals: number
) {
  if (value === null) {
    return ''
  }

  return new Intl.NumberFormat(
    'pt-PT',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }
  ).format(value)
}

function sanitizeText(
  value: string
) {
  return value
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
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
    return text.length * size * 0.5
  }
}

function fitText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const text =
    sanitizeText(value)

  if (
    textWidth(
      font,
      text,
      size
    ) <= maxWidth
  ) {
    return text
  }

  let shortened = text

  while (
    shortened.length > 1 &&
    textWidth(
      font,
      `${shortened}…`,
      size
    ) > maxWidth
  ) {
    shortened =
      shortened.slice(0, -1)
  }

  return shortened
    ? `${shortened}…`
    : ''
}

function drawCell(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  yTop: number,
  width: number,
  height: number,
  options: {
    fill?: ReturnType<typeof rgb>
    size?: number
    bold?: boolean
    align?: 'left' | 'center'
    padding?: number
  } = {}
) {
  const size =
    options.size ?? 6
  const padding =
    options.padding ?? 3

  page.drawRectangle({
    x,
    y: yTop - height,
    width,
    height,
    color:
      options.fill ??
      COLORS.white,
    borderColor:
      COLORS.border,
    borderWidth: 0.45
  })

  const fitted =
    fitText(
      text,
      font,
      size,
      Math.max(
        1,
        width - padding * 2
      )
    )

  const textX =
    options.align === 'center'
      ? x +
        Math.max(
          padding,
          (
            width -
            textWidth(
              font,
              fitted,
              size
            )
          ) / 2
        )
      : x + padding

  page.drawText(
    fitted,
    {
      x: textX,
      y:
        yTop -
        height +
        Math.max(
          2,
          (
            height - size
          ) / 2 - 0.5
        ),
      size,
      font,
      color: rgb(0, 0, 0)
    }
  )
}

function drawMergedBox(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  yTop: number,
  width: number,
  height: number,
  size: number
) {
  drawCell(
    page,
    font,
    text,
    x,
    yTop,
    width,
    height,
    {
      fill: COLORS.title,
      size,
      align: 'center',
      padding: 5
    }
  )
}

export async function exportUfcdCfpPdf(
  snapshot: AssessmentWorkspaceSnapshot
) {
  const model =
    buildUfcdCfpModel(snapshot)
  const document =
    await PDFDocument.create()
  const page =
    document.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT
    ])

  const font =
    await document.embedFont(
      StandardFonts.Helvetica
    )
  const bold =
    await document.embedFont(
      StandardFonts.HelveticaBold
    )

  const contentWidth =
    PAGE_WIDTH - MARGIN * 2

  const topY =
    PAGE_HEIGHT - 24
  const titleGap = 8
  const titleWidth =
    (
      contentWidth -
      titleGap * 2
    ) / 3

  drawMergedBox(
    page,
    bold,
    'CÁLCULOS DE FINAL DE MÓDULO/UFCD',
    MARGIN,
    topY,
    titleWidth,
    22,
    7
  )
  drawMergedBox(
    page,
    bold,
    `CURSO: ${model.course}`,
    MARGIN + titleWidth + titleGap,
    topY,
    titleWidth,
    22,
    6.5
  )
  drawMergedBox(
    page,
    bold,
    `MÓDULO/UFCD: ${model.moduleLabel}`,
    MARGIN +
      (
        titleWidth + titleGap
      ) * 2,
    topY,
    titleWidth,
    22,
    6.2
  )

  const metaY =
    topY - 30
  const metaGap = 10
  const metaWidths = [
    contentWidth * 0.43,
    contentWidth * 0.17,
    contentWidth * 0.14,
    contentWidth * 0.26 -
      metaGap * 3
  ]
  const metaTexts = [
    `Disciplina: ${model.subject}`,
    `Ano: ${model.gradeLevel}`,
    `Turma: ${model.group}`,
    `Ano letivo: ${model.academicYear}`
  ]

  let metaX = MARGIN
  metaWidths.forEach(
    (width, index) => {
      drawCell(
        page,
        bold,
        metaTexts[index],
        metaX,
        metaY,
        width,
        18,
        {
          fill: COLORS.white,
          size: 6.3,
          align: 'center'
        }
      )
      metaX += width + metaGap
    }
  )

  const processWidth = 48
  const numberWidth = 27
  const nameWidth = 190
  const criterionWidth = 42
  const acsWidth = 42
  const automaticWidth = 62
  const selfWidth = 58
  const finalWidth = 48

  const usedWithoutSignature =
    processWidth +
    numberWidth +
    nameWidth +
    model.criteria.length *
      criterionWidth +
    acsWidth +
    automaticWidth +
    selfWidth +
    finalWidth

  const signatureWidth =
    Math.max(
      72,
      contentWidth -
        usedWithoutSignature
    )

  const columns = [
    {
      label: 'Nº Processo',
      weight: '',
      width: processWidth,
      fill: COLORS.header
    },
    {
      label: 'Nº',
      weight: '',
      width: numberWidth,
      fill: COLORS.header
    },
    {
      label: 'Aluno / Domínio',
      weight: '',
      width: nameWidth,
      fill: COLORS.header
    },
    ...model.criteria.map(
      (criterion, index) => ({
        label: criterion.label,
        weight:
          `${criterion.weightPercent}%`,
        width: criterionWidth,
        fill:
          COLORS.criterion[
            index %
              COLORS.criterion.length
          ]
      })
    ),
    {
      label: 'ACS',
      weight: '100%',
      width: acsWidth,
      fill: COLORS.acs
    },
    {
      label: 'Nível Automático',
      weight: '',
      width: automaticWidth,
      fill: COLORS.automatic
    },
    {
      label: 'Autoavaliação',
      weight: '',
      width: selfWidth,
      fill: COLORS.self
    },
    {
      label: 'Nível Final',
      weight: '',
      width: finalWidth,
      fill: COLORS.final
    },
    {
      label: 'Assinatura do Formando',
      weight: '',
      width: signatureWidth,
      fill: COLORS.header
    }
  ]

  const weightsY =
    metaY - 28
  const headerY =
    weightsY - 14

  let columnX = MARGIN
  columns.forEach(
    column => {
      drawCell(
        page,
        bold,
        column.weight,
        columnX,
        weightsY,
        column.width,
        14,
        {
          fill: column.fill,
          size: 6,
          align: 'center'
        }
      )
      drawCell(
        page,
        bold,
        column.label,
        columnX,
        headerY,
        column.width,
        22,
        {
          fill: column.fill,
          size:
            column.label.length > 15
              ? 5.1
              : 6,
          align: 'center'
        }
      )
      columnX += column.width
    }
  )

  const minimumRows =
    25
  const visibleRows =
    Math.max(
      minimumRows,
      model.rows.length
    )
  const availableStudentHeight =
    300
  const rowHeight =
    Math.max(
      8.5,
      Math.min(
        12,
        availableStudentHeight /
          visibleRows
      )
    )

  let studentY =
    headerY - 22

  for (
    let index = 0;
    index < visibleRows;
    index += 1
  ) {
    const row =
      model.rows[index]

    const values = row
      ? [
          row.processNumber,
          row.studentNumber,
          row.studentName,
          ...row.criterionScores.map(
            value =>
              formatNumber(
                value,
                2
              )
          ),
          formatNumber(
            row.acsScore,
            2
          ),
          formatNumber(
            row.automaticLevel,
            1
          ),
          formatNumber(
            row.selfAssessmentGrade,
            0
          ),
          formatNumber(
            row.finalGrade,
            0
          ),
          ''
        ]
      : Array.from(
          {
            length:
              columns.length
          },
          () => ''
        )

    let x = MARGIN

    columns.forEach(
      (column, columnIndex) => {
        const criterionStart = 3
        const criterionEnd =
          criterionStart +
          model.criteria.length

        const fill =
          columnIndex >=
            criterionStart &&
          columnIndex <
            criterionEnd
            ? COLORS.criterion[
                (
                  columnIndex -
                  criterionStart
                ) %
                  COLORS.criterion.length
              ]
            : columnIndex ===
                criterionEnd
              ? COLORS.acs
              : COLORS.white

        drawCell(
          page,
          columnIndex === 2
            ? font
            : font,
          String(
            values[columnIndex] ?? ''
          ),
          x,
          studentY,
          column.width,
          rowHeight,
          {
            fill,
            size:
              columnIndex === 2
                ? 5.6
                : 5.5,
            align:
              columnIndex === 2
                ? 'left'
                : 'center',
            padding: 2
          }
        )

        x += column.width
      }
    )

    studentY -= rowHeight
  }

  const summaryTop =
    studentY - 12
  const summaryLabelWidth =
    110
  const summaryCellWidth =
    52

  drawCell(
    page,
    bold,
    'AVALIAÇÃO GLOBAL',
    MARGIN + 120,
    summaryTop,
    summaryLabelWidth,
    16,
    {
      fill: COLORS.header,
      size: 5.7,
      align: 'center'
    }
  )

  const summaryItems = [
    ...model.gradeBands.map(
      band => ({
        label: band.label,
        count: band.count,
        percent: band.percent
      })
    ),
    {
      label: 'NEGATIVO',
      count: model.negativeCount,
      percent:
        model.negativePercent
    },
    {
      label: 'POSITIVO',
      count: model.positiveCount,
      percent:
        model.positivePercent
    }
  ]

  let summaryX =
    MARGIN + 120 +
    summaryLabelWidth

  summaryItems.forEach(
    item => {
      drawCell(
        page,
        bold,
        item.label,
        summaryX,
        summaryTop,
        summaryCellWidth,
        16,
        {
          fill: COLORS.header,
          size: 5,
          align: 'center'
        }
      )
      drawCell(
        page,
        font,
        String(item.count),
        summaryX,
        summaryTop - 16,
        summaryCellWidth / 2,
        14,
        {
          size: 5.4,
          align: 'center'
        }
      )
      drawCell(
        page,
        font,
        `${item.percent}%`,
        summaryX +
          summaryCellWidth / 2,
        summaryTop - 16,
        summaryCellWidth / 2,
        14,
        {
          size: 5.4,
          align: 'center'
        }
      )

      summaryX +=
        summaryCellWidth
    }
  )

  const detailsY =
    summaryTop - 42

  drawCell(
    page,
    bold,
    `Formandos Avaliados: ${model.evaluatedCount}`,
    MARGIN + 500,
    detailsY,
    130,
    18,
    {
      fill: COLORS.header,
      size: 5.7,
      align: 'center'
    }
  )
  drawCell(
    page,
    bold,
    'Data de Conclusão do Módulo',
    MARGIN + 640,
    detailsY,
    166,
    18,
    {
      fill: COLORS.header,
      size: 5.5,
      align: 'center'
    }
  )
  drawCell(
    page,
    font,
    model.completionDate,
    MARGIN + 640,
    detailsY - 18,
    166,
    18,
    {
      size: 6,
      align: 'center'
    }
  )

  const pdfBytes =
    await document.save({
      useObjectStreams: true
    })

  downloadBlob(
    new Blob(
      [
        bytesToArrayBuffer(
          pdfBytes
        )
      ],
      {
        type: 'application/pdf'
      }
    ),
    `${model.fileBaseName}-CFP.pdf`
  )
}
