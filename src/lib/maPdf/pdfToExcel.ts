import type {
  ProgressCallback,
  ResultData,
  SelectedPdf
} from '../../types/maPdf'

import { extractTextFromPdf } from './extractPdfText'
import { sanitizeFileName } from './fileUtils'

const EXCEL_MIME_TYPE =
  'application/vnd.ms-excel;charset=utf-8'

const MAX_EXCEL_CELL_LENGTH = 32_767

function escapeXml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function normalizeCellValue(value: string) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, MAX_EXCEL_CELL_LENGTH)
}

function createCell(value: string) {
  return `<Cell><Data ss:Type="String">${escapeXml(
    normalizeCellValue(value)
  )}</Data></Cell>`
}

function createRow(cells: string[]) {
  const safeCells = cells.length > 0
    ? cells
    : ['']

  return `<Row>${safeCells.map(createCell).join('')}</Row>`
}

function sanitizeWorksheetName(value: string) {
  const cleaned = value
    .replace(/[\\/\?\*\[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31)

  return cleaned || 'Folha'
}

function createWorksheet(
  name: string,
  rows: string[][]
) {
  const worksheetRows =
    rows.length > 0
      ? rows
      : [
          [
            'Nenhum texto selecionável encontrado nesta página.'
          ]
        ]

  return `<Worksheet ss:Name="${escapeXml(
    sanitizeWorksheetName(name)
  )}">
  <Table>
    ${worksheetRows.map(createRow).join('\n    ')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
    <Selected />
    <ProtectObjects>False</ProtectObjects>
    <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
</Worksheet>`
}

function createWorkbookXml(
  pages: Array<{
    pageNumber: number
    lines: Array<{
      text: string
      cells: string[]
    }>
  }>
) {
  const worksheets = pages
    .map((page) => {
      const rows = page.lines.map(
        (line) =>
          line.cells.length > 0
            ? line.cells
            : [line.text]
      )

      return createWorksheet(
        `Página ${page.pageNumber}`,
        rows
      )
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40"
>
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Author>MA-Code</Author>
    <Company>MA-Code</Company>
    <Version>1.0</Version>
  </DocumentProperties>

  <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
    <WindowHeight>12345</WindowHeight>
    <WindowWidth>24000</WindowWidth>
    <ProtectStructure>False</ProtectStructure>
    <ProtectWindows>False</ProtectWindows>
  </ExcelWorkbook>

  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment
        ss:Vertical="Bottom"
        ss:WrapText="1"
      />
      <Borders />
      <Font
        ss:FontName="Aptos"
        ss:Size="11"
      />
      <Interior />
      <NumberFormat />
      <Protection />
    </Style>
  </Styles>

  ${worksheets}
</Workbook>`
}

function getBaseName(fileName: string) {
  return (
    sanitizeFileName(
      fileName.replace(/\.pdf$/i, '')
    ) ||
    'documento-pdf'
  )
}

export async function convertPdfToExcel(
  selected: SelectedPdf | undefined,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error(
      'Escolha um ficheiro PDF para converter para Excel.'
    )
  }

  const extracted = await extractTextFromPdf(
    selected,
    onProgress
  )

  onProgress(
    'A organizar as linhas e colunas para Excel...'
  )

  const workbookXml = createWorkbookXml(
    extracted.pages
  )

  const blob = new Blob(
    [`\ufeff${workbookXml}`],
    {
      type: EXCEL_MIME_TYPE
    }
  )

  const baseName = getBaseName(
    selected.file.name
  )

  return {
    fileName: `${baseName}-convertido.xls`,
    blob,
    originalSize: selected.file.size,
    finalSize: blob.size,
    message: `${extracted.pageCount} página${
      extracted.pageCount === 1
        ? ''
        : 's'
    } ${
      extracted.pageCount === 1
        ? 'foi convertida'
        : 'foram convertidas'
    } para Excel. Cada página foi criada como uma folha editável. A separação de colunas depende da estrutura do texto no PDF e pode precisar de pequenos ajustes.`
  }
}
