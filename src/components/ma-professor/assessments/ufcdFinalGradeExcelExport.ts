import {
  downloadBlob
} from '../../../lib/maPdf/fileUtils'

import type {
  AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepository'

import {
  buildUfcdFinalGradeExcelModel
} from './ufcdFinalGradeExcelModel'

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function exportUfcdFinalGradeExcel(
  snapshot: AssessmentWorkspaceSnapshot
) {
  const model =
    buildUfcdFinalGradeExcelModel(
      snapshot
    )

  const XLSX =
    await import('xlsx')

  const worksheet =
    XLSX.utils.aoa_to_sheet(
      model.rows
    )

  worksheet['!merges'] =
    model.merges

  worksheet['!cols'] =
    model.columnWidths.map(
      width => ({
        wch: width
      })
    )

  worksheet['!rows'] =
    model.rows.map(
      (_, index) => ({
        hpt:
          index < 4
            ? 24
            : 20
      })
    )

  const applyFormat = (
    cells: Array<{
      row: number
      column: number
    }>,
    format: string
  ) => {
    cells.forEach(
      ({ row, column }) => {
        const address =
          XLSX.utils.encode_cell({
            r: row,
            c: column
          })

        const cell =
          worksheet[address]

        if (cell) {
          cell.z = format
        }
      }
    )
  }

  applyFormat(
    model.percentageCells,
    '0%'
  )
  applyFormat(
    model.twoDecimalCells,
    '0.00'
  )
  applyFormat(
    model.oneDecimalCells,
    '0.0'
  )
  applyFormat(
    model.integerCells,
    '0'
  )

  const workbook =
    XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    model.sheetName
  )

  const bytes =
    XLSX.write(
      workbook,
      {
        bookType: 'xlsx',
        type: 'array',
        compression: true
      }
    )

  downloadBlob(
    new Blob(
      [bytes],
      {
        type: XLSX_MIME
      }
    ),
    model.fileName
  )
}
