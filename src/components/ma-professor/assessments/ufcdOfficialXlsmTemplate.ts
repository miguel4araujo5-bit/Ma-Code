import {
  strFromU8,
  strToU8,
  unzipSync,
  zipSync
} from 'fflate'

const TEMPLATE_URL =
  '/ma-professor/templates/Grelha_Avaliacao_UFCD_UC_Modelo.xlsm'

export type OfficialXlsmFiles =
  Record<string, Uint8Array>

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

function cellPattern(
  address: string
) {
  return new RegExp(
    `<c\\b([^>]*\\br="${address}"[^>]*)(?:\\s*\\/>|>([\\s\\S]*?)<\\/c>)`
  )
}

function escapeXml(
  value: string
) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function replaceCell(
  xml: string,
  address: string,
  body: string,
  type: string | null
) {
  const pattern =
    cellPattern(address)

  if (!pattern.test(xml)) {
    throw new Error(
      `O modelo XLSM não contém a célula esperada ${address}.`
    )
  }

  return xml.replace(
    pattern,
    (_match, rawAttributes: string) => {
      let attributes =
        rawAttributes.replace(
          /\s+t="[^"]*"/g,
          ''
        )

      if (type) {
        attributes += ` t="${type}"`
      }

      return `<c${attributes}>${body}</c>`
    }
  )
}

export function setWorksheetString(
  files: OfficialXlsmFiles,
  sheetPath: string,
  address: string,
  value: string
) {
  const escaped =
    escapeXml(value)
  const preserve =
    /^\s|\s$/.test(value)
      ? ' xml:space="preserve"'
      : ''

  setText(
    files,
    sheetPath,
    replaceCell(
      text(files, sheetPath),
      address,
      `<is><t${preserve}>${escaped}</t></is>`,
      'inlineStr'
    )
  )
}

export function setWorksheetNumber(
  files: OfficialXlsmFiles,
  sheetPath: string,
  address: string,
  value: number
) {
  setText(
    files,
    sheetPath,
    replaceCell(
      text(files, sheetPath),
      address,
      `<v>${String(value)}</v>`,
      null
    )
  )
}

export function setWorksheetFormula(
  files: OfficialXlsmFiles,
  sheetPath: string,
  address: string,
  formula: string
) {
  setText(
    files,
    sheetPath,
    replaceCell(
      text(files, sheetPath),
      address,
      `<f>${escapeXml(formula)}</f>`,
      null
    )
  )
}

export function clearWorksheetCell(
  files: OfficialXlsmFiles,
  sheetPath: string,
  address: string
) {
  setText(
    files,
    sheetPath,
    replaceCell(
      text(files, sheetPath),
      address,
      '',
      null
    )
  )
}

function columnName(
  oneBasedColumn: number
) {
  let value = oneBasedColumn
  let result = ''

  while (value > 0) {
    const remainder =
      (value - 1) % 26

    result =
      String.fromCharCode(
        65 + remainder
      ) + result

    value =
      Math.floor(
        (value - 1) / 26
      )
  }

  return result
}

function repairP2P3StudentReferences(
  files: OfficialXlsmFiles
) {
  const sheetNumbers = [
    3, 4, 5, 6, 7,
    8, 9, 10, 11, 12
  ]

  for (const sheetNumber of sheetNumbers) {
    const sheetPath =
      `xl/worksheets/sheet${sheetNumber}.xml`

    for (
      let studentIndex = 0;
      studentIndex < 30;
      studentIndex += 1
    ) {
      const homeRow =
        6 + studentIndex
      const inputRow =
        14 + studentIndex
      const summaryRow =
        54 + studentIndex

      setWorksheetFormula(
        files,
        sheetPath,
        `A${inputRow}`,
        `IF(HOME!I${homeRow}="","",HOME!I${homeRow})`
      )
      setWorksheetFormula(
        files,
        sheetPath,
        `B${inputRow}`,
        `IF(HOME!J${homeRow}="","",HOME!J${homeRow})`
      )
      setWorksheetFormula(
        files,
        sheetPath,
        `C${inputRow}`,
        `IF(HOME!K${homeRow}="","",HOME!K${homeRow})`
      )
      setWorksheetFormula(
        files,
        sheetPath,
        `D${summaryRow}`,
        `IF(HOME!J${homeRow}="","",HOME!J${homeRow})`
      )
      setWorksheetFormula(
        files,
        sheetPath,
        `AB${summaryRow}`,
        `IF(HOME!J${homeRow}="","",HOME!J${homeRow})`
      )
    }
  }
}

function repairAutoStudentReferences(
  files: OfficialXlsmFiles
) {
  const sheetPath =
    'xl/worksheets/sheet16.xml'

  for (
    let studentIndex = 0;
    studentIndex < 30;
    studentIndex += 1
  ) {
    const row = 9 + studentIndex
    const homeRow = 6 + studentIndex

    setWorksheetFormula(
      files,
      sheetPath,
      `A${row}`,
      `IF(HOME!I${homeRow}="","",HOME!I${homeRow})`
    )
    setWorksheetFormula(
      files,
      sheetPath,
      `B${row}`,
      `IF(HOME!J${homeRow}="","",HOME!J${homeRow})`
    )
  }
}

function repairCfpInstrumentReferences(
  files: OfficialXlsmFiles
) {
  const sheetPath =
    'xl/worksheets/sheet14.xml'
  const blocks = [
    {
      period: 1,
      targetStartRow: 12,
      sourceColumns: [
        'J', 'L', 'N', 'P', 'R', 'T'
      ]
    },
    {
      period: 2,
      targetStartRow: 47,
      sourceColumns: [
        'I', 'K', 'M', 'O', 'Q', 'S'
      ]
    },
    {
      period: 3,
      targetStartRow: 82,
      sourceColumns: [
        'I', 'K', 'M', 'O', 'Q', 'S'
      ]
    }
  ]

  for (const block of blocks) {
    for (
      let studentIndex = 0;
      studentIndex < 30;
      studentIndex += 1
    ) {
      for (
        let instrument = 1;
        instrument <= 5;
        instrument += 1
      ) {
        block.sourceColumns.forEach(
          (sourceColumn, domainIndex) => {
            const targetColumn =
              columnName(
                44 +
                (instrument - 1) * 6 +
                domainIndex
              )
            const targetAddress =
              `${targetColumn}${block.targetStartRow + studentIndex}`
            const sourceRow =
              54 + studentIndex

            setWorksheetFormula(
              files,
              sheetPath,
              targetAddress,
              `P${block.period}I${instrument}!${sourceColumn}${sourceRow}`
            )
          }
        )
      }
    }
  }
}

function markForRecalculation(
  files: OfficialXlsmFiles
) {
  const path = 'xl/workbook.xml'
  let workbook = text(files, path)

  if (/<calcPr\b[^>]*\/>/.test(workbook)) {
    workbook = workbook.replace(
      /<calcPr\b[^>]*\/>/,
      '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1" />'
    )
  } else {
    workbook = workbook.replace(
      '</workbook>',
      '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1" /></workbook>'
    )
  }

  setText(files, path, workbook)
  delete files['xl/calcChain.xml']
}

function validateOfficialTemplate(
  files: OfficialXlsmFiles
) {
  const required = [
    'xl/workbook.xml',
    'xl/vbaProject.bin',
    'xl/worksheets/sheet1.xml',
    'xl/worksheets/sheet14.xml',
    ...Array.from(
      { length: 20 },
      (_, index) =>
        `xl/worksheets/sheet${index + 1}.xml`
    )
  ]

  const missing =
    required.find(
      path => !files[path]
    )

  if (missing) {
    throw new Error(
      `O modelo oficial XLSM está incompleto: falta ${missing}.`
    )
  }
}

export async function loadOfficialUfcdXlsmTemplate() {
  const response =
    await fetch(
      TEMPLATE_URL,
      { cache: 'force-cache' }
    )

  if (!response.ok) {
    throw new Error(
      'Não foi possível carregar o modelo oficial XLSM de avaliação.'
    )
  }

  const files =
    unzipSync(
      new Uint8Array(
        await response.arrayBuffer()
      )
    ) as OfficialXlsmFiles

  validateOfficialTemplate(files)
  repairP2P3StudentReferences(files)
  repairAutoStudentReferences(files)
  repairCfpInstrumentReferences(files)
  markForRecalculation(files)

  return files
}

export function writeOfficialUfcdXlsm(
  files: OfficialXlsmFiles
) {
  markForRecalculation(files)

  return zipSync(
    files,
    {
      level: 6
    }
  )
}
