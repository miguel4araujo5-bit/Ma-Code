import {
  strFromU8,
  strToU8
} from 'fflate'

import type {
  OfficialXlsmFiles
} from './ufcdOfficialXlsmTemplate'

const WORKBOOK_PATH =
  'xl/workbook.xml'
const WORKBOOK_RELS_PATH =
  'xl/_rels/workbook.xml.rels'
const CONTENT_TYPES_PATH =
  '[Content_Types].xml'

const WORKSHEET_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'
const DRAWING_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.drawing+xml'
const WORKSHEET_RELATIONSHIP_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet'

const TEMPLATE_SHEET_PATH =
  'xl/worksheets/sheet2.xml'
const TEMPLATE_SHEET_RELS_PATH =
  'xl/worksheets/_rels/sheet2.xml.rels'

export const BASE_EVALUATION_MOMENT_SHEETS = [
  { name: 'P1I1', path: 'xl/worksheets/sheet2.xml' },
  { name: 'P1I2', path: 'xl/worksheets/sheet17.xml' },
  { name: 'P1I3', path: 'xl/worksheets/sheet18.xml' },
  { name: 'P1I4', path: 'xl/worksheets/sheet19.xml' },
  { name: 'P1I5', path: 'xl/worksheets/sheet20.xml' },
  { name: 'P2I1', path: 'xl/worksheets/sheet3.xml' },
  { name: 'P2I2', path: 'xl/worksheets/sheet4.xml' },
  { name: 'P2I3', path: 'xl/worksheets/sheet5.xml' },
  { name: 'P2I4', path: 'xl/worksheets/sheet6.xml' },
  { name: 'P2I5', path: 'xl/worksheets/sheet7.xml' },
  { name: 'P3I1', path: 'xl/worksheets/sheet8.xml' },
  { name: 'P3I2', path: 'xl/worksheets/sheet9.xml' },
  { name: 'P3I3', path: 'xl/worksheets/sheet10.xml' },
  { name: 'P3I4', path: 'xl/worksheets/sheet11.xml' },
  { name: 'P3I5', path: 'xl/worksheets/sheet12.xml' }
] as const

export interface EvaluationMomentSheetLocation {
  name: string
  path: string
  layout: 'p1' | 'p23'
}

function text(
  files: OfficialXlsmFiles,
  path: string
) {
  const value = files[path]

  if (!value) {
    throw new Error(
      `O modelo XLSM está incompleto: falta ${path}.`
    )
  }

  return strFromU8(value)
}

function setText(
  files: OfficialXlsmFiles,
  path: string,
  value: string
) {
  files[path] = strToU8(value)
}

function escapeRegExp(
  value: string
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  )
}

function nextNumber(
  files: OfficialXlsmFiles,
  pattern: RegExp
) {
  let maximum = 0

  for (const path of Object.keys(files)) {
    const match = path.match(pattern)

    if (match) {
      maximum = Math.max(
        maximum,
        Number(match[1])
      )
    }
  }

  return maximum + 1
}

function nextRelationshipNumber(
  workbookRels: string
) {
  let maximum = 0

  for (
    const match of workbookRels.matchAll(
      /\bId="rId(\d+)"/g
    )
  ) {
    maximum = Math.max(
      maximum,
      Number(match[1])
    )
  }

  return maximum + 1
}

function nextSheetId(
  workbook: string
) {
  let maximum = 0

  for (
    const match of workbook.matchAll(
      /\bsheetId="(\d+)"/g
    )
  ) {
    maximum = Math.max(
      maximum,
      Number(match[1])
    )
  }

  return maximum + 1
}

function setSheetVisibility(
  workbook: string,
  sheetName: string,
  visible: boolean
) {
  const pattern = new RegExp(
    `<sheet\\b[^>]*\\bname="${escapeRegExp(sheetName)}"[^>]*/>`
  )

  if (!pattern.test(workbook)) {
    throw new Error(
      `O modelo XLSM perdeu a folha ${sheetName}.`
    )
  }

  return workbook.replace(
    pattern,
    tag => {
      const withoutState = tag.replace(
        /\s+state="[^"]*"/g,
        ''
      )

      if (visible) {
        return withoutState
      }

      return withoutState.replace(
        /\/>$/,
        ' state="hidden"/>'
      )
    }
  )
}

function stripWorksheetCodeName(
  worksheetXml: string
) {
  return worksheetXml.replace(
    /<sheetPr\b([^>]*)>/,
    tag => tag.replace(
      /\s+codeName="[^"]*"/g,
      ''
    )
  )
}

function addContentTypeOverride(
  contentTypes: string,
  partName: string,
  contentType: string
) {
  if (
    contentTypes.includes(
      `PartName="${partName}"`
    )
  ) {
    return contentTypes
  }

  return contentTypes.replace(
    '</Types>',
    `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`
  )
}

function cloneTemplateDrawing(
  files: OfficialXlsmFiles,
  worksheetRels: string,
  drawingNumber: number
) {
  const targetMatch =
    worksheetRels.match(
      /<Relationship\b[^>]*\bType="[^"]*\/drawing"[^>]*\bTarget="([^"]+)"[^>]*\/>/
    )

  if (!targetMatch) {
    return {
      worksheetRels,
      drawingPath: null as string | null
    }
  }

  const sourceTarget = targetMatch[1]
  const sourceDrawingName =
    sourceTarget.split('/').pop()

  if (!sourceDrawingName) {
    throw new Error(
      'A relação gráfica da folha de avaliação é inválida.'
    )
  }

  const sourceDrawingPath =
    `xl/drawings/${sourceDrawingName}`
  const sourceDrawing =
    files[sourceDrawingPath]

  if (!sourceDrawing) {
    throw new Error(
      `O modelo XLSM está incompleto: falta ${sourceDrawingPath}.`
    )
  }

  const drawingName =
    `drawing${drawingNumber}.xml`
  const drawingPath =
    `xl/drawings/${drawingName}`

  files[drawingPath] = sourceDrawing.slice()

  const sourceDrawingRelsPath =
    `xl/drawings/_rels/${sourceDrawingName}.rels`
  const drawingRelsPath =
    `xl/drawings/_rels/${drawingName}.rels`

  if (files[sourceDrawingRelsPath]) {
    files[drawingRelsPath] =
      files[sourceDrawingRelsPath].slice()
  }

  return {
    worksheetRels:
      worksheetRels.replace(
        sourceTarget,
        `../drawings/${drawingName}`
      ),
    drawingPath
  }
}

function appendWorkbookSheet(
  workbook: string,
  sheetName: string,
  sheetId: number,
  relationshipId: string
) {
  const sheetTag =
    `<sheet name="${sheetName}" sheetId="${sheetId}" r:id="${relationshipId}"/>`

  const printPattern =
    /<sheet\b[^>]*\bname="PRINT"[^>]*\/>/

  if (printPattern.test(workbook)) {
    return workbook.replace(
      printPattern,
      match => `${sheetTag}${match}`
    )
  }

  return workbook.replace(
    '</sheets>',
    `${sheetTag}</sheets>`
  )
}

export function prepareOfficialEvaluationMomentSheets(
  files: OfficialXlsmFiles,
  totalMoments: number
): EvaluationMomentSheetLocation[] {
  const safeCount =
    Math.max(
      0,
      Math.trunc(totalMoments)
    )

  let workbook =
    text(files, WORKBOOK_PATH)

  BASE_EVALUATION_MOMENT_SHEETS.forEach(
    (sheet, index) => {
      workbook = setSheetVisibility(
        workbook,
        sheet.name,
        index < safeCount
      )
    }
  )

  const locations: EvaluationMomentSheetLocation[] =
    BASE_EVALUATION_MOMENT_SHEETS
      .slice(
        0,
        Math.min(
          safeCount,
          BASE_EVALUATION_MOMENT_SHEETS.length
        )
      )
      .map(
        (sheet, index) => ({
          name: sheet.name,
          path: sheet.path,
          layout:
            index < 5
              ? 'p1'
              : 'p23'
        })
      )

  const extraCount =
    Math.max(
      0,
      safeCount -
        BASE_EVALUATION_MOMENT_SHEETS.length
    )

  if (extraCount === 0) {
    setText(
      files,
      WORKBOOK_PATH,
      workbook
    )

    return locations
  }

  const sourceWorksheet =
    text(files, TEMPLATE_SHEET_PATH)
  const sourceWorksheetRels =
    text(files, TEMPLATE_SHEET_RELS_PATH)

  let workbookRels =
    text(files, WORKBOOK_RELS_PATH)
  let contentTypes =
    text(files, CONTENT_TYPES_PATH)
  let worksheetNumber =
    nextNumber(
      files,
      /^xl\/worksheets\/sheet(\d+)\.xml$/
    )
  let drawingNumber =
    nextNumber(
      files,
      /^xl\/drawings\/drawing(\d+)\.xml$/
    )
  let relationshipNumber =
    nextRelationshipNumber(
      workbookRels
    )
  let sheetId =
    nextSheetId(workbook)

  for (
    let extraIndex = 0;
    extraIndex < extraCount;
    extraIndex += 1
  ) {
    while (
      files[
        `xl/worksheets/sheet${worksheetNumber}.xml`
      ]
    ) {
      worksheetNumber += 1
    }

    while (
      files[
        `xl/drawings/drawing${drawingNumber}.xml`
      ]
    ) {
      drawingNumber += 1
    }

    const momentNumber =
      BASE_EVALUATION_MOMENT_SHEETS.length +
      extraIndex +
      1
    const sheetName =
      `AV${momentNumber}`
    const worksheetPath =
      `xl/worksheets/sheet${worksheetNumber}.xml`
    const worksheetRelsPath =
      `xl/worksheets/_rels/sheet${worksheetNumber}.xml.rels`
    const relationshipId =
      `rId${relationshipNumber}`

    files[worksheetPath] =
      strToU8(
        stripWorksheetCodeName(
          sourceWorksheet
        )
      )

    const clonedDrawing =
      cloneTemplateDrawing(
        files,
        sourceWorksheetRels,
        drawingNumber
      )

    files[worksheetRelsPath] =
      strToU8(
        clonedDrawing.worksheetRels
      )

    workbookRels = workbookRels.replace(
      '</Relationships>',
      `<Relationship Id="${relationshipId}" Type="${WORKSHEET_RELATIONSHIP_TYPE}" Target="worksheets/sheet${worksheetNumber}.xml"/></Relationships>`
    )

    workbook = appendWorkbookSheet(
      workbook,
      sheetName,
      sheetId,
      relationshipId
    )

    contentTypes = addContentTypeOverride(
      contentTypes,
      `/xl/worksheets/sheet${worksheetNumber}.xml`,
      WORKSHEET_CONTENT_TYPE
    )

    if (clonedDrawing.drawingPath) {
      contentTypes = addContentTypeOverride(
        contentTypes,
        `/${clonedDrawing.drawingPath}`,
        DRAWING_CONTENT_TYPE
      )
    }

    locations.push({
      name: sheetName,
      path: worksheetPath,
      layout: 'p1'
    })

    worksheetNumber += 1
    drawingNumber += 1
    relationshipNumber += 1
    sheetId += 1
  }

  setText(
    files,
    WORKBOOK_PATH,
    workbook
  )
  setText(
    files,
    WORKBOOK_RELS_PATH,
    workbookRels
  )
  setText(
    files,
    CONTENT_TYPES_PATH,
    contentTypes
  )

  return locations
}
