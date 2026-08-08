export type MAQuadroChartType = 'bar' | 'line' | 'pie'

export type MAQuadroChartDatum = {
  label: string
  value: number
  color: string
}

export type MAQuadroChartSpec = {
  type: MAQuadroChartType
  title: string
  showLegend: boolean
  showValues: boolean
  background: string
  textColor: string
  axisColor: string
}

export type MAQuadroChartDocument = {
  version: 1
  spec: MAQuadroChartSpec
  data: MAQuadroChartDatum[]
}

export const MA_QUADRO_CHART_MIN_ITEMS = 2
export const MA_QUADRO_CHART_MAX_ITEMS = 8

export const MA_QUADRO_CHART_COLORS = [
  '#22D3EE',
  '#8B5CF6',
  '#F472B6',
  '#F59E0B',
  '#10B981',
  '#38BDF8',
  '#FB7185',
  '#A3E635'
] as const

export const DEFAULT_MA_QUADRO_CHART_SPEC: MAQuadroChartSpec = {
  type: 'bar',
  title: 'Resultados',
  showLegend: true,
  showValues: true,
  background: '#FFFFFF',
  textColor: '#0F172A',
  axisColor: '#94A3B8'
}

export const DEFAULT_MA_QUADRO_CHART_CONTENT =
  'Website;45\nAutomação;32\nAplicação;24\nOutros;16'

const CHART_WIDTH = 960
const CHART_HEIGHT = 600
const CHART_METADATA_START = '\u{E0001}'
const CHART_METADATA_END = '\u{E007F}'
const CHART_TAG_BASE = 0xE0000
const MAX_LABEL_LENGTH = 48
const MAX_TITLE_LENGTH = 80
const MAX_VALUE = 1_000_000

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function normalizeLabel(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_LABEL_LENGTH)
}

function shortenLabel(
  value: string,
  maximum = 13
) {
  const normalized =
    normalizeLabel(value)

  return normalized.length <= maximum
    ? normalized
    : `${normalized.slice(
        0,
        maximum - 1
      )}…`
}

function normalizeValue(
  value: number
) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(
    MAX_VALUE,
    Math.max(
      0,
      value
    )
  )
}

function parseNumericValue(
  value: string
) {
  return normalizeValue(
    Number.parseFloat(
      value
        .trim()
        .replace(/\s/g, '')
        .replace(',', '.')
    )
  )
}

function formatValue(
  value: number
) {
  const normalized =
    normalizeValue(value)

  return Number.isInteger(
    normalized
  )
    ? String(normalized)
    : normalized
        .toFixed(2)
        .replace(
          /\.?0+$/,
          ''
        )
}

function utf8ToBase64(
  value: string
) {
  const bytes =
    new TextEncoder()
      .encode(value)

  let binary = ''

  for (
    const byte of
    bytes
  ) {
    binary +=
      String.fromCharCode(
        byte
      )
  }

  return btoa(
    binary
  )
}

function base64ToUtf8(
  value: string
) {
  const binary =
    atob(value)

  const bytes =
    Uint8Array.from(
      binary,
      (character) =>
        character
          .charCodeAt(0)
    )

  return new TextDecoder()
    .decode(bytes)
}

function encodeMetadata(
  document:
    MAQuadroChartDocument
) {
  const base64 =
    utf8ToBase64(
      JSON.stringify(
        document
      )
    )

  let encoded =
    CHART_METADATA_START

  for (
    const character of
    base64
  ) {
    encoded +=
      String.fromCodePoint(
        CHART_TAG_BASE +
          character
            .charCodeAt(0)
      )
  }

  return (
    encoded +
    CHART_METADATA_END
  )
}

function decodeMetadata(
  value: string
) {
  let base64 = ''

  for (
    const character of
    value
  ) {
    const codePoint =
      character
        .codePointAt(0)

    if (
      codePoint ===
      undefined
    ) {
      continue
    }

    const ascii =
      codePoint -
      CHART_TAG_BASE

    if (
      ascii < 0 ||
      ascii > 127
    ) {
      throw new Error(
        'Metadados de gráfico inválidos.'
      )
    }

    base64 +=
      String.fromCharCode(
        ascii
      )
  }

  return base64ToUtf8(
    base64
  )
}

function normalizeType(
  value:
    MAQuadroChartType
):
  MAQuadroChartType {
  return (
    value ===
      'line' ||
    value ===
      'pie'
  )
    ? value
    : 'bar'
}

function normalizeDatum(
  datum:
    MAQuadroChartDatum,
  index:
    number
):
  MAQuadroChartDatum {
  return {
    label:
      normalizeLabel(
        datum.label
      ) ||
      `Item ${
        index + 1
      }`,

    value:
      normalizeValue(
        datum.value
      ),

    color:
      datum.color ||
      MA_QUADRO_CHART_COLORS[
        index %
          MA_QUADRO_CHART_COLORS.length
      ]
  }
}

function createFallbackData():
  MAQuadroChartDatum[] {
  return [
    [
      'Website',
      45
    ],
    [
      'Automação',
      32
    ],
    [
      'Aplicação',
      24
    ],
    [
      'Outros',
      16
    ]
  ].map(
    (
      [
        label,
        value
      ],
      index
    ) => ({
      label:
        String(
          label
        ),

      value:
        Number(
          value
        ),

      color:
        MA_QUADRO_CHART_COLORS[
          index
        ]
    })
  )
}

export function normalizeMAQuadroChartSpec(
  spec:
    MAQuadroChartSpec
):
  MAQuadroChartSpec {
  return {
    type:
      normalizeType(
        spec.type
      ),

    title:
      spec.title
        .trim()
        .replace(
          /\s+/g,
          ' '
        )
        .slice(
          0,
          MAX_TITLE_LENGTH
        ),

    showLegend:
      Boolean(
        spec.showLegend
      ),

    showValues:
      Boolean(
        spec.showValues
      ),

    background:
      spec.background ||
      '#FFFFFF',

    textColor:
      spec.textColor ||
      '#0F172A',

    axisColor:
      spec.axisColor ||
      '#94A3B8'
  }
}

export function parseMAQuadroChartText(
  value:
    string
) {
  const parsed =
    value
      .replace(
        /\r/g,
        ''
      )
      .split(
        '\n'
      )
      .map(
        (line) =>
          line.trim()
      )
      .filter(
        Boolean
      )
      .slice(
        0,
        MA_QUADRO_CHART_MAX_ITEMS
      )
      .map(
        (
          line,
          index
        ) => {
          const separator =
            line.includes(
              '\t'
            )
              ? '\t'
              : ';'

          const [
            rawLabel,
            rawValue
          ] =
            line.split(
              separator
            )

          return {
            label:
              normalizeLabel(
                rawLabel ||
                ''
              ) ||
              `Item ${
                index + 1
              }`,

            value:
              parseNumericValue(
                rawValue ||
                '0'
              ),

            color:
              MA_QUADRO_CHART_COLORS[
                index %
                  MA_QUADRO_CHART_COLORS.length
              ]
          }
        }
      )

  return (
    parsed.length >=
    MA_QUADRO_CHART_MIN_ITEMS
  )
    ? parsed
    : createFallbackData()
}

export function createMAQuadroChartDocument(
  spec:
    MAQuadroChartSpec,
  content =
    DEFAULT_MA_QUADRO_CHART_CONTENT
):
  MAQuadroChartDocument {
  return normalizeMAQuadroChartDocument({
    version: 1,

    spec,

    data:
      parseMAQuadroChartText(
        content
      )
  })
}

export function normalizeMAQuadroChartDocument(
  document:
    MAQuadroChartDocument
):
  MAQuadroChartDocument {
  const source =
    Array.isArray(
      document.data
    )
      ? document.data
      : []

  const data =
    source
      .slice(
        0,
        MA_QUADRO_CHART_MAX_ITEMS
      )
      .map(
        normalizeDatum
      )

  while (
    data.length <
    MA_QUADRO_CHART_MIN_ITEMS
  ) {
    const index =
      data.length

    data.push({
      label:
        `Item ${
          index + 1
        }`,

      value:
        index === 0
          ? 10
          : 5,

      color:
        MA_QUADRO_CHART_COLORS[
          index %
            MA_QUADRO_CHART_COLORS.length
        ]
    })
  }

  return {
    version: 1,

    spec:
      normalizeMAQuadroChartSpec(
        document.spec
      ),

    data
  }
}

export function updateMAQuadroChartSpec(
  document:
    MAQuadroChartDocument,
  values:
    Partial<
      MAQuadroChartSpec
    >
) {
  const current =
    normalizeMAQuadroChartDocument(
      document
    )

  return normalizeMAQuadroChartDocument({
    ...current,

    spec: {
      ...current.spec,
      ...values
    }
  })
}

export function setMAQuadroChartDatum(
  document:
    MAQuadroChartDocument,
  index:
    number,
  values:
    Partial<
      MAQuadroChartDatum
    >
) {
  const current =
    normalizeMAQuadroChartDocument(
      document
    )

  if (
    index < 0 ||
    index >=
      current.data.length
  ) {
    return current
  }

  return normalizeMAQuadroChartDocument({
    ...current,

    data:
      current.data.map(
        (
          datum,
          datumIndex
        ) =>
          datumIndex ===
          index
            ? {
                ...datum,
                ...values
              }
            : datum
      )
  })
}

export function addMAQuadroChartDatum(
  document:
    MAQuadroChartDocument
) {
  const current =
    normalizeMAQuadroChartDocument(
      document
    )

  if (
    current.data.length >=
    MA_QUADRO_CHART_MAX_ITEMS
  ) {
    return current
  }

  const index =
    current.data.length

  return normalizeMAQuadroChartDocument({
    ...current,

    data: [
      ...current.data,

      {
        label:
          `Item ${
            index + 1
          }`,

        value:
          10,

        color:
          MA_QUADRO_CHART_COLORS[
            index %
              MA_QUADRO_CHART_COLORS.length
          ]
      }
    ]
  })
}

export function removeMAQuadroChartDatum(
  document:
    MAQuadroChartDocument,
  index:
    number
) {
  const current =
    normalizeMAQuadroChartDocument(
      document
    )

  if (
    current.data.length <=
    MA_QUADRO_CHART_MIN_ITEMS
  ) {
    return current
  }

  return normalizeMAQuadroChartDocument({
    ...current,

    data:
      current.data.filter(
        (
          _,
          datumIndex
        ) =>
          datumIndex !==
          index
      )
  })
}

function renderTitle(
  document:
    MAQuadroChartDocument
) {
  if (
    !document.spec.title
  ) {
    return ''
  }

  return `
    <text
      x="${CHART_WIDTH / 2}"
      y="48"
      text-anchor="middle"
      fill="${escapeXml(
        document.spec.textColor
      )}"
      font-family="Arial, Helvetica, sans-serif"
      font-size="30"
      font-weight="700"
    >${escapeXml(
      document.spec.title
    )}</text>
  `
}

function renderLegend(
  document:
    MAQuadroChartDocument,
  x:
    number,
  y:
    number
) {
  if (
    !document
      .spec
      .showLegend
  ) {
    return ''
  }

  return document.data
    .map(
      (
        datum,
        index
      ) => `
        <g transform="translate(${x}, ${
          y +
          index *
            42
        })">
          <rect
            x="0"
            y="-14"
            width="18"
            height="18"
            rx="4"
            fill="${escapeXml(
              datum.color
            )}"
          />

          <text
            x="28"
            y="0"
            fill="${escapeXml(
              document
                .spec
                .textColor
            )}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="17"
            font-weight="600"
          >${escapeXml(
            shortenLabel(
              datum.label,
              16
            )
          )}</text>
        </g>
      `
    )
    .join(
      ''
    )
}

function renderCartesianChart(
  document:
    MAQuadroChartDocument
) {
  const {
    spec,
    data
  } =
    document

  const plotX =
    84

  const plotY =
    spec.title
      ? 92
      : 58

  const legendWidth =
    spec.showLegend
      ? 220
      : 40

  const plotWidth =
    CHART_WIDTH -
    plotX -
    legendWidth -
    42

  const plotHeight =
    CHART_HEIGHT -
    plotY -
    105

  const maximum =
    Math.max(
      1,
      ...data.map(
        (datum) =>
          datum.value
      )
    )

  const gridLines:
    string[] = []

  for (
    let index = 0;
    index <= 5;
    index += 1
  ) {
    const ratio =
      index /
      5

    const y =
      plotY +
      plotHeight -
      plotHeight *
        ratio

    const value =
      maximum *
      ratio

    gridLines.push(`
      <line
        x1="${plotX}"
        y1="${y}"
        x2="${plotX + plotWidth}"
        y2="${y}"
        stroke="${escapeXml(
          spec.axisColor
        )}"
        stroke-opacity="${
          index === 0
            ? 0.85
            : 0.24
        }"
        stroke-width="${
          index === 0
            ? 2
            : 1
        }"
      />

      <text
        x="${plotX - 12}"
        y="${y + 6}"
        text-anchor="end"
        fill="${escapeXml(
          spec.textColor
        )}"
        fill-opacity="0.72"
        font-family="Arial, Helvetica, sans-serif"
        font-size="14"
      >${escapeXml(
        formatValue(
          value
        )
      )}</text>
    `)
  }

  const slot =
    plotWidth /
    data.length

  const labels =
    data
      .map(
        (
          datum,
          index
        ) => `
          <text
            x="${
              plotX +
              slot *
                (
                  index +
                  0.5
                )
            }"
            y="${
              plotY +
              plotHeight +
              32
            }"
            text-anchor="middle"
            fill="${escapeXml(
              spec.textColor
            )}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="15"
            font-weight="600"
          >${escapeXml(
            shortenLabel(
              datum.label
            )
          )}</text>
        `
      )
      .join(
        ''
      )

  let marks =
    ''

  if (
    spec.type ===
    'bar'
  ) {
    const barWidth =
      Math.max(
        18,
        Math.min(
          72,
          slot *
            0.6
        )
      )

    marks =
      data
        .map(
          (
            datum,
            index
          ) => {
            const height =
              plotHeight *
              (
                datum.value /
                maximum
              )

            const x =
              plotX +
              slot *
                (
                  index +
                  0.5
                ) -
              barWidth /
                2

            const y =
              plotY +
              plotHeight -
              height

            return `
              <rect
                x="${x}"
                y="${y}"
                width="${barWidth}"
                height="${Math.max(
                  0,
                  height
                )}"
                rx="8"
                fill="${escapeXml(
                  datum.color
                )}"
              />

              ${
                spec.showValues
                  ? `
                    <text
                      x="${
                        x +
                        barWidth /
                          2
                      }"
                      y="${Math.max(
                        plotY +
                          18,
                        y -
                          10
                      )}"
                      text-anchor="middle"
                      fill="${escapeXml(
                        spec.textColor
                      )}"
                      font-family="Arial, Helvetica, sans-serif"
                      font-size="15"
                      font-weight="700"
                    >${escapeXml(
                      formatValue(
                        datum.value
                      )
                    )}</text>
                  `
                  : ''
              }
            `
          }
        )
        .join(
          ''
        )
  } else {
    const points =
      data.map(
        (
          datum,
          index
        ) => ({
          datum,

          x:
            plotX +
            slot *
              (
                index +
                0.5
              ),

          y:
            plotY +
            plotHeight -
            plotHeight *
              (
                datum.value /
                maximum
              )
        })
      )

    marks = `
      <polyline
        points="${points
          .map(
            (point) =>
              `${point.x},${point.y}`
          )
          .join(
            ' '
          )}"
        fill="none"
        stroke="${escapeXml(
          data[0]
            ?.color ||
          MA_QUADRO_CHART_COLORS[
            0
          ]
        )}"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      ${points
        .map(
          (
            point
          ) => `
            <circle
              cx="${point.x}"
              cy="${point.y}"
              r="8"
              fill="${escapeXml(
                point
                  .datum
                  .color
              )}"
              stroke="${escapeXml(
                spec.background
              )}"
              stroke-width="4"
            />

            ${
              spec.showValues
                ? `
                  <text
                    x="${point.x}"
                    y="${Math.max(
                      plotY +
                        18,
                      point.y -
                        14
                    )}"
                    text-anchor="middle"
                    fill="${escapeXml(
                      spec.textColor
                    )}"
                    font-family="Arial, Helvetica, sans-serif"
                    font-size="15"
                    font-weight="700"
                  >${escapeXml(
                    formatValue(
                      point
                        .datum
                        .value
                    )
                  )}</text>
                `
                : ''
            }
          `
        )
        .join(
          ''
        )}
    `
  }

  return `
    ${gridLines.join('')}
    ${marks}
    ${labels}
    ${renderLegend(
      document,
      CHART_WIDTH -
        202,
      plotY +
        18
    )}
  `
}

function polarPoint(
  centerX:
    number,
  centerY:
    number,
  radius:
    number,
  angle:
    number
) {
  const radians =
    (
      (
        angle -
        90
      ) *
      Math.PI
    ) /
    180

  return {
    x:
      centerX +
      radius *
        Math.cos(
          radians
        ),

    y:
      centerY +
      radius *
        Math.sin(
          radians
        )
  }
}

function pieArcPath(
  centerX:
    number,
  centerY:
    number,
  radius:
    number,
  startAngle:
    number,
  endAngle:
    number
) {
  const start =
    polarPoint(
      centerX,
      centerY,
      radius,
      endAngle
    )

  const end =
    polarPoint(
      centerX,
      centerY,
      radius,
      startAngle
    )

  const largeArc =
    (
      endAngle -
      startAngle
    ) >
    180
      ? 1
      : 0

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    'Z'
  ].join(
    ' '
  )
}

function renderPieChart(
  document:
    MAQuadroChartDocument
) {
  const {
    spec,
    data
  } =
    document

  const total =
    data.reduce(
      (
        sum,
        datum
      ) =>
        sum +
        datum.value,
      0
    )

  const centerX =
    spec.showLegend
      ? 340
      : CHART_WIDTH /
        2

  const centerY =
    spec.title
      ? 325
      : 300

  const radius =
    190

  if (
    total <= 0
  ) {
    return `
      <circle
        cx="${centerX}"
        cy="${centerY}"
        r="${radius}"
        fill="none"
        stroke="${escapeXml(
          spec.axisColor
        )}"
        stroke-width="4"
        stroke-dasharray="12 10"
      />

      <text
        x="${centerX}"
        y="${centerY + 6}"
        text-anchor="middle"
        fill="${escapeXml(
          spec.textColor
        )}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="20"
        font-weight="700"
      >Sem valores</text>

      ${renderLegend(
        document,
        CHART_WIDTH -
          260,
        155
      )}
    `
  }

  let angle =
    0

  const segments:
    string[] = []

  data.forEach(
    (
      datum
    ) => {
      const ratio =
        datum.value /
        total

      if (
        ratio <= 0
      ) {
        return
      }

      const startAngle =
        angle

      const endAngle =
        angle +
        ratio *
          360

      const middle =
        startAngle +
        (
          endAngle -
          startAngle
        ) /
          2

      if (
        ratio >=
        0.999999
      ) {
        segments.push(`
          <circle
            cx="${centerX}"
            cy="${centerY}"
            r="${radius}"
            fill="${escapeXml(
              datum.color
            )}"
          />
        `)
      } else {
        segments.push(`
          <path
            d="${pieArcPath(
              centerX,
              centerY,
              radius,
              startAngle,
              endAngle
            )}"
            fill="${escapeXml(
              datum.color
            )}"
          />
        `)
      }

      if (
        spec.showValues &&
        ratio >=
          0.055
      ) {
        const labelPoint =
          polarPoint(
            centerX,
            centerY,
            radius *
              0.67,
            middle
          )

        segments.push(`
          <text
            x="${labelPoint.x}"
            y="${labelPoint.y + 6}"
            text-anchor="middle"
            fill="#FFFFFF"
            font-family="Arial, Helvetica, sans-serif"
            font-size="17"
            font-weight="800"
            paint-order="stroke"
            stroke="#0F172A"
            stroke-opacity="0.45"
            stroke-width="4"
          >${Math.round(
            ratio *
              100
          )}%</text>
        `)
      }

      angle =
        endAngle
    }
  )

  return `
    ${segments.join('')}

    ${renderLegend(
      document,
      CHART_WIDTH -
        260,
      155
    )}
  `
}

export function createMAQuadroChartSvgFromDocument(
  document:
    MAQuadroChartDocument
) {
  const normalized =
    normalizeMAQuadroChartDocument(
      document
    )

  const chart =
    normalized
      .spec
      .type ===
    'pie'
      ? renderPieChart(
          normalized
        )
      : renderCartesianChart(
          normalized
        )

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${CHART_WIDTH}"
  height="${CHART_HEIGHT}"
  viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}"
  role="img"
  aria-label="Gráfico"
>
  <rect
    x="0"
    y="0"
    width="${CHART_WIDTH}"
    height="${CHART_HEIGHT}"
    rx="24"
    fill="${escapeXml(
      normalized
        .spec
        .background
    )}"
  />

  ${renderTitle(
    normalized
  )}

  ${chart}
</svg>`
}

export function createMAQuadroChartPreviewUrl(
  svg:
    string
) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    svg
  )}`
}

function chartTypeLabel(
  type:
    MAQuadroChartType
) {
  if (
    type ===
    'line'
  ) {
    return 'Linhas'
  }

  if (
    type ===
    'pie'
  ) {
    return 'Circular'
  }

  return 'Barras'
}

export function createMAQuadroChartObjectName(
  document:
    MAQuadroChartDocument
) {
  const normalized =
    normalizeMAQuadroChartDocument(
      document
    )

  return (
    `Gráfico ${chartTypeLabel(
      normalized
        .spec
        .type
    )}` +
    encodeMetadata(
      normalized
    )
  )
}

export function readMAQuadroChartDocumentFromName(
  name:
    string
):
  MAQuadroChartDocument |
  null {
  const start =
    name.indexOf(
      CHART_METADATA_START
    )

  if (
    start < 0
  ) {
    return null
  }

  const payloadStart =
    start +
    CHART_METADATA_START.length

  const end =
    name.indexOf(
      CHART_METADATA_END,
      payloadStart
    )

  if (
    end < 0
  ) {
    return null
  }

  try {
    const parsed =
      JSON.parse(
        decodeMetadata(
          name.slice(
            payloadStart,
            end
          )
        )
      ) as
        Partial<
          MAQuadroChartDocument
        >

    if (
      parsed.version !==
        1 ||
      !parsed.spec ||
      !Array.isArray(
        parsed.data
      )
    ) {
      return null
    }

    const type =
      (
        parsed.spec as
          MAQuadroChartSpec
      ).type

    if (
      type !== 'bar' &&
      type !== 'line' &&
      type !== 'pie'
    ) {
      return null
    }

    return normalizeMAQuadroChartDocument(
      parsed as
        MAQuadroChartDocument
    )
  } catch {
    return null
  }
}

export function createMAQuadroChartFileFromDocument(
  document:
    MAQuadroChartDocument
) {
  const normalized =
    normalizeMAQuadroChartDocument(
      document
    )

  return new File(
    [
      createMAQuadroChartSvgFromDocument(
        normalized
      )
    ],
    createMAQuadroChartObjectName(
      normalized
    ),
    {
      type:
        'image/svg+xml',

      lastModified:
        Date.now()
    }
  )
}

export function createMAQuadroChartFile(
  spec:
    MAQuadroChartSpec,
  content =
    DEFAULT_MA_QUADRO_CHART_CONTENT
) {
  return createMAQuadroChartFileFromDocument(
    createMAQuadroChartDocument(
      spec,
      content
    )
  )
}
