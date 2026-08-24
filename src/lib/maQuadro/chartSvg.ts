export type MAQuadroChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'

export type MAQuadroChartBarDirection =
  | 'vertical'
  | 'horizontal'

export type MAQuadroChartLegendPosition =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'

export type MAQuadroChartPieValueMode =
  | 'percent'
  | 'value'

export type MAQuadroChartValuePosition =
  | 'auto'
  | 'inside'
  | 'outside'

export type MAQuadroChartDatum = {
  label: string
  value: number
  color: string
}

export type MAQuadroChartSpec = {
  type: MAQuadroChartType
  title: string

  showLegend: boolean
  legendPosition: MAQuadroChartLegendPosition

  showValues: boolean
  valuePosition: MAQuadroChartValuePosition

  showAxes: boolean
  showGrid: boolean

  background: string
  textColor: string
  axisColor: string
  seriesColor: string

  barDirection: MAQuadroChartBarDirection
  barRadius: number

  lineWidth: number
  pointSize: number
  areaOpacity: number

  donutHole: number

  axisAuto: boolean
  axisMin: number
  axisMax: number
  axisStep: number

  valuePrefix: string
  valueSuffix: string
  decimalPlaces: number

  pieValueMode: MAQuadroChartPieValueMode
}

export type MAQuadroChartDocument = {
  version: 1
  spec: MAQuadroChartSpec
  data: MAQuadroChartDatum[]
}

export type MAQuadroChartStylePreset = {
  id:
    | 'minimal'
    | 'business'
    | 'editorial'
    | 'dark'

  name: string
  description: string

  values:
    Partial<MAQuadroChartSpec>
}

export const
  MA_QUADRO_CHART_MIN_ITEMS =
    2

export const
  MA_QUADRO_CHART_MAX_ITEMS =
    8

export const
  MA_QUADRO_CHART_COLORS = [
    '#22D3EE',
    '#8B5CF6',
    '#F472B6',
    '#F59E0B',
    '#10B981',
    '#38BDF8',
    '#FB7185',
    '#A3E635'
  ] as const

export const
  MA_QUADRO_CHART_STYLE_PRESETS:
    MAQuadroChartStylePreset[] = [
      {
        id:
          'minimal',

        name:
          'Minimal',

        description:
          'Limpo e discreto',

        values: {
          background:
            '#FFFFFF',

          textColor:
            '#0F172A',

          axisColor:
            '#CBD5E1',

          seriesColor:
            '#0F172A',

          showGrid:
            false,

          showAxes:
            true,

          showLegend:
            false,

          barRadius:
            4,

          lineWidth:
            4,

          pointSize:
            5,

          areaOpacity:
            0.14
        }
      },

      {
        id:
          'business',

        name:
          'Business',

        description:
          'Claro e analítico',

        values: {
          background:
            '#FFFFFF',

          textColor:
            '#0F172A',

          axisColor:
            '#94A3B8',

          seriesColor:
            '#2563EB',

          showGrid:
            true,

          showAxes:
            true,

          showLegend:
            true,

          legendPosition:
            'right',

          barRadius:
            8,

          lineWidth:
            6,

          pointSize:
            7,

          areaOpacity:
            0.18
        }
      },

      {
        id:
          'editorial',

        name:
          'Editorial',

        description:
          'Quente e expressivo',

        values: {
          background:
            '#FFF7ED',

          textColor:
            '#431407',

          axisColor:
            '#FDBA74',

          seriesColor:
            '#EA580C',

          showGrid:
            false,

          showAxes:
            true,

          showLegend:
            true,

          legendPosition:
            'bottom',

          barRadius:
            14,

          lineWidth:
            7,

          pointSize:
            8,

          areaOpacity:
            0.22
        }
      },

      {
        id:
          'dark',

        name:
          'Dark',

        description:
          'Contraste para ecrã',

        values: {
          background:
            '#0B1020',

          textColor:
            '#F8FAFC',

          axisColor:
            '#475569',

          seriesColor:
            '#22D3EE',

          showGrid:
            true,

          showAxes:
            true,

          showLegend:
            true,

          legendPosition:
            'right',

          barRadius:
            10,

          lineWidth:
            6,

          pointSize:
            7,

          areaOpacity:
            0.24
        }
      }
    ]

export const
  DEFAULT_MA_QUADRO_CHART_SPEC:
    MAQuadroChartSpec = {
      type:
        'bar',

      title:
        'Resultados',

      showLegend:
        true,

      legendPosition:
        'right',

      showValues:
        true,

      valuePosition:
        'auto',

      showAxes:
        true,

      showGrid:
        true,

      background:
        '#FFFFFF',

      textColor:
        '#0F172A',

      axisColor:
        '#94A3B8',

      seriesColor:
        '#22D3EE',

      barDirection:
        'vertical',

      barRadius:
        8,

      lineWidth:
        6,

      pointSize:
        8,

      areaOpacity:
        0.2,

      donutHole:
        0.54,

      axisAuto:
        true,

      axisMin:
        0,

      axisMax:
        100,

      axisStep:
        0,

      valuePrefix:
        '',

      valueSuffix:
        '',

      decimalPlaces:
        0,

      pieValueMode:
        'percent'
    }

export const
  DEFAULT_MA_QUADRO_CHART_CONTENT =
    'Website;45\nAutomação;32\nAplicação;24\nOutros;16'

const CHART_WIDTH =
  960

const CHART_HEIGHT =
  600

const CHART_METADATA_START =
  '\u{E0001}'

const CHART_METADATA_END =
  '\u{E007F}'

const CHART_TAG_BASE =
  0xE0000

const MAX_LABEL_LENGTH =
  48

const MAX_TITLE_LENGTH =
  80

const MAX_VALUE =
  1_000_000

const MAX_AFFIX_LENGTH =
  12

function clamp(
  value:
    number,
  minimum:
    number,
  maximum:
    number
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      Number.isFinite(
        value
      )
        ? value
        : minimum
    )
  )
}

function escapeXml(
  value:
    string
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

function normalizeLabel(
  value:
    string
) {
  return value
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
    .slice(
      0,
      MAX_LABEL_LENGTH
    )
}

function shortenLabel(
  value:
    string,
  maximum =
    13
) {
  const normalized =
    normalizeLabel(
      value
    )

  return normalized.length <=
    maximum
    ? normalized
    : `${normalized.slice(
        0,
        maximum -
          1
      )}…`
}

function normalizeValue(
  value:
    number
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
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
  value:
    string
) {
  const normalized =
    value
      .trim()
      .replace(
        /\s/g,
        ''
      )
      .replace(
        ',',
        '.'
      )

  const parsed =
    Number.parseFloat(
      normalized
    )

  return Number.isFinite(
    parsed
  )
    ? normalizeValue(
        parsed
      )
    : null
}

function normalizeColor(
  value:
    unknown,
  fallback:
    string
) {
  return (
    typeof value ===
      'string' &&
    /^#[0-9a-f]{6}$/i.test(
      value.trim()
    )
  )
    ? value.trim()
    : fallback
}

function normalizeAffix(
  value:
    unknown
) {
  return typeof value ===
    'string'
    ? value
        .replace(
          /[\r\n]/g,
          ' '
        )
        .slice(
          0,
          MAX_AFFIX_LENGTH
        )
    : ''
}

function formatValue(
  value:
    number,
  spec:
    MAQuadroChartSpec
) {
  const decimals =
    Math.round(
      clamp(
        spec.decimalPlaces,
        0,
        4
      )
    )

  const formatted =
    normalizeValue(
      value
    ).toLocaleString(
      'pt-PT',
      {
        minimumFractionDigits:
          decimals,

        maximumFractionDigits:
          decimals
      }
    )

  return (
    `${spec.valuePrefix}` +
    `${formatted}` +
    `${spec.valueSuffix}`
  )
}

function utf8ToBase64(
  value:
    string
) {
  const bytes =
    new TextEncoder()
      .encode(
        value
      )

  let binary =
    ''

  for (
    const byte
    of bytes
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
  value:
    string
) {
  const binary =
    atob(
      value
    )

  const bytes =
    Uint8Array.from(
      binary,
      (
        character
      ) =>
        character.charCodeAt(
          0
        )
    )

  return new TextDecoder()
    .decode(
      bytes
    )
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
    const character
    of base64
  ) {
    encoded +=
      String.fromCodePoint(
        CHART_TAG_BASE +
          character
            .charCodeAt(
              0
            )
      )
  }

  return (
    encoded +
    CHART_METADATA_END
  )
}

function decodeMetadata(
  value:
    string
) {
  let base64 =
    ''

  for (
    const character
    of value
  ) {
    const codePoint =
      character
        .codePointAt(
          0
        )

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
      ascii <
        0 ||
      ascii >
        127
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
    unknown
):
  MAQuadroChartType {
  return (
    value ===
      'line' ||
    value ===
      'area' ||
    value ===
      'pie' ||
    value ===
      'donut'
  )
    ? value
    : 'bar'
}

function normalizeLegendPosition(
  value:
    unknown
):
  MAQuadroChartLegendPosition {
  return (
    value ===
      'top' ||
    value ===
      'bottom' ||
    value ===
      'left'
  )
    ? value
    : 'right'
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
        index +
        1
      }`,

    value:
      normalizeValue(
        datum.value
      ),

    color:
      normalizeColor(
        datum.color,
        MA_QUADRO_CHART_COLORS[
          index %
          MA_QUADRO_CHART_COLORS.length
        ]
      )
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
    | Partial<MAQuadroChartSpec>
    | MAQuadroChartSpec
):
  MAQuadroChartSpec {
  const minimum =
    normalizeValue(
      Number(
        spec.axisMin ??
        DEFAULT_MA_QUADRO_CHART_SPEC
          .axisMin
      )
    )

  const requestedMaximum =
    normalizeValue(
      Number(
        spec.axisMax ??
        DEFAULT_MA_QUADRO_CHART_SPEC
          .axisMax
      )
    )

  const maximum =
    requestedMaximum >
    minimum
      ? requestedMaximum
      : Math.min(
          MAX_VALUE,
          minimum +
            100
        )

  return {
    type:
      normalizeType(
        spec.type
      ),

    title:
      String(
        spec.title ??
        ''
      )
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
        spec.showLegend ??
        DEFAULT_MA_QUADRO_CHART_SPEC
          .showLegend
      ),

    legendPosition:
      normalizeLegendPosition(
        spec.legendPosition
      ),

    showValues:
      Boolean(
        spec.showValues ??
        DEFAULT_MA_QUADRO_CHART_SPEC
          .showValues
      ),

    valuePosition:
      spec.valuePosition ===
        'inside' ||
      spec.valuePosition ===
        'outside'
        ? spec.valuePosition
        : 'auto',

    showAxes:
      Boolean(
        spec.showAxes ??
        DEFAULT_MA_QUADRO_CHART_SPEC
          .showAxes
      ),

    showGrid:
      Boolean(
        spec.showGrid ??
        DEFAULT_MA_QUADRO_CHART_SPEC
          .showGrid
      ),

    background:
      normalizeColor(
        spec.background,
        DEFAULT_MA_QUADRO_CHART_SPEC
          .background
      ),

    textColor:
      normalizeColor(
        spec.textColor,
        DEFAULT_MA_QUADRO_CHART_SPEC
          .textColor
      ),

    axisColor:
      normalizeColor(
        spec.axisColor,
        DEFAULT_MA_QUADRO_CHART_SPEC
          .axisColor
      ),

    seriesColor:
      normalizeColor(
        spec.seriesColor,
        DEFAULT_MA_QUADRO_CHART_SPEC
          .seriesColor
      ),

    barDirection:
      spec.barDirection ===
      'horizontal'
        ? 'horizontal'
        : 'vertical',

    barRadius:
      Math.round(
        clamp(
          Number(
            spec.barRadius ??
            8
          ),
          0,
          24
        )
      ),

    lineWidth:
      Math.round(
        clamp(
          Number(
            spec.lineWidth ??
            6
          ),
          2,
          12
        )
      ),

    pointSize:
      Math.round(
        clamp(
          Number(
            spec.pointSize ??
            8
          ),
          0,
          14
        )
      ),

    areaOpacity:
      clamp(
        Number(
          spec.areaOpacity ??
          0.2
        ),
        0.05,
        0.8
      ),

    donutHole:
      clamp(
        Number(
          spec.donutHole ??
          0.54
        ),
        0.3,
        0.75
      ),

    axisAuto:
      Boolean(
        spec.axisAuto ??
        true
      ),

    axisMin:
      minimum,

    axisMax:
      maximum,

    axisStep:
      clamp(
        Number(
          spec.axisStep ??
          0
        ),
        0,
        MAX_VALUE
      ),

    valuePrefix:
      normalizeAffix(
        spec.valuePrefix
      ),

    valueSuffix:
      normalizeAffix(
        spec.valueSuffix
      ),

    decimalPlaces:
      Math.round(
        clamp(
          Number(
            spec.decimalPlaces ??
            0
          ),
          0,
          4
        )
      ),

    pieValueMode:
      spec.pieValueMode ===
      'value'
        ? 'value'
        : 'percent'
  }
}

function detectSeparator(
  line:
    string
) {
  if (
    line.includes(
      '\t'
    )
  ) {
    return '\t'
  }

  if (
    line.includes(
      ';'
    )
  ) {
    return ';'
  }

  return ','
}

export function parseMAQuadroChartText(
  value:
    string
) {
  const lines =
    value
      .replace(
        /\r/g,
        ''
      )
      .split(
        '\n'
      )
      .map(
        (
          line
        ) =>
          line.trim()
      )
      .filter(
        Boolean
      )

  const parsed:
    MAQuadroChartDatum[] =
    []

  for (
    const line
    of lines
  ) {
    if (
      parsed.length >=
      MA_QUADRO_CHART_MAX_ITEMS
    ) {
      break
    }

    const separator =
      detectSeparator(
        line
      )

    const parts =
      line.split(
        separator
      )

    if (
      parts.length <
      2
    ) {
      continue
    }

    const rawValue =
      parts.pop() ||
      ''

    const numeric =
      parseNumericValue(
        rawValue
      )

    if (
      numeric ===
      null
    ) {
      continue
    }

    const rawLabel =
      parts.join(
        separator
      )

    const index =
      parsed.length

    parsed.push({
      label:
        normalizeLabel(
          rawLabel
        ) ||
        `Item ${
          index +
          1
        }`,

      value:
        numeric,

      color:
        MA_QUADRO_CHART_COLORS[
          index %
          MA_QUADRO_CHART_COLORS.length
        ]
    })
  }

  return parsed.length >=
    MA_QUADRO_CHART_MIN_ITEMS
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
    version:
      1,

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
          index +
          1
        }`,

      value:
        index ===
        0
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
    version:
      1,

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
    Partial<MAQuadroChartSpec>
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
    Partial<MAQuadroChartDatum>
) {
  const current =
    normalizeMAQuadroChartDocument(
      document
    )

  if (
    index <
      0 ||
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
            index +
            1
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

export function replaceMAQuadroChartDataFromText(
  document:
    MAQuadroChartDocument,
  content:
    string
) {
  const current =
    normalizeMAQuadroChartDocument(
      document
    )

  const parsed =
    parseMAQuadroChartText(
      content
    )

  return normalizeMAQuadroChartDocument({
    ...current,

    data:
      parsed.map(
        (
          datum,
          index
        ) => ({
          ...datum,

          color:
            current.data[
              index
            ]?.color ||
            datum.color
        })
      )
  })
}

export function chartDataToText(
  document:
    MAQuadroChartDocument
) {
  return normalizeMAQuadroChartDocument(
    document
  )
    .data
    .map(
      (
        datum
      ) =>
        `${datum.label};${datum.value}`
    )
    .join(
      '\n'
    )
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

type PlotLayout = {
  x: number
  y: number
  width: number
  height: number
}

function getPlotLayout(
  document:
    MAQuadroChartDocument,
  horizontalBar =
    false
):
  PlotLayout {
  const {
    spec
  } =
    document

  let left =
    horizontalBar
      ? 170
      : 84

  let right =
    42

  let top =
    spec.title
      ? 92
      : 56

  let bottom =
    92

  if (
    spec.showLegend
  ) {
    if (
      spec.legendPosition ===
      'left'
    ) {
      left +=
        180
    }

    if (
      spec.legendPosition ===
      'right'
    ) {
      right +=
        190
    }

    if (
      spec.legendPosition ===
      'top'
    ) {
      top +=
        66
    }

    if (
      spec.legendPosition ===
      'bottom'
    ) {
      bottom +=
        64
    }
  }

  return {
    x:
      left,

    y:
      top,

    width:
      Math.max(
        220,
        CHART_WIDTH -
        left -
        right
      ),

    height:
      Math.max(
        180,
        CHART_HEIGHT -
        top -
        bottom
      )
  }
}

function renderLegend(
  document:
    MAQuadroChartDocument
) {
  const {
    spec,
    data
  } =
    document

  if (
    !spec.showLegend
  ) {
    return ''
  }

  if (
    spec.legendPosition ===
      'top' ||
    spec.legendPosition ===
      'bottom'
  ) {
    const y =
      spec.legendPosition ===
      'top'
        ? spec.title
          ? 78
          : 28
        : CHART_HEIGHT -
          44

    return data
      .map(
        (
          datum,
          index
        ) => {
          const row =
            Math.floor(
              index /
              4
            )

          const column =
            index %
            4

          const x =
            58 +
            column *
              220

          const rowY =
            y +
            row *
              26

          return `
            <g transform="translate(${x}, ${rowY})">
              <rect
                x="0"
                y="-12"
                width="14"
                height="14"
                rx="4"
                fill="${escapeXml(
                  datum.color
                )}"
              />

              <text
                x="22"
                y="0"
                fill="${escapeXml(
                  spec.textColor
                )}"
                font-family="Arial, Helvetica, sans-serif"
                font-size="14"
                font-weight="600"
              >${escapeXml(
                shortenLabel(
                  datum.label,
                  18
                )
              )}</text>
            </g>
          `
        }
      )
      .join(
        ''
      )
  }

  const x =
    spec.legendPosition ===
    'left'
      ? 26
      : CHART_WIDTH -
        172

  const startY =
    spec.title
      ? 120
      : 84

  return data
    .map(
      (
        datum,
        index
      ) => `
        <g transform="translate(${x}, ${startY + index * 42})">
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
              spec.textColor
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

function niceStep(
  range:
    number,
  targetTicks =
    5
) {
  if (
    !Number.isFinite(
      range
    ) ||
    range <=
      0
  ) {
    return 1
  }

  const rough =
    range /
    targetTicks

  const magnitude =
    Math.pow(
      10,
      Math.floor(
        Math.log10(
          rough
        )
      )
    )

  const normalized =
    rough /
    magnitude

  const nice =
    normalized <=
      1
      ? 1
      : normalized <=
          2
        ? 2
        : normalized <=
            5
          ? 5
          : 10

  return (
    nice *
    magnitude
  )
}

function createAxisScale(
  document:
    MAQuadroChartDocument
) {
  const {
    spec,
    data
  } =
    document

  const dataMaximum =
    Math.max(
      1,
      ...data.map(
        (
          datum
        ) =>
          datum.value
      )
    )

  let minimum =
    spec.axisAuto
      ? 0
      : spec.axisMin

  let maximum =
    spec.axisAuto
      ? dataMaximum
      : spec.axisMax

  if (
    spec.axisAuto
  ) {
    const step =
      niceStep(
        maximum -
        minimum,
        5
      )

    maximum =
      Math.max(
        step,
        Math.ceil(
          maximum /
          step
        ) *
          step
      )
  }

  if (
    maximum <=
    minimum
  ) {
    maximum =
      minimum +
      1
  }

  let step =
    spec.axisStep >
    0
      ? spec.axisStep
      : niceStep(
          maximum -
          minimum,
          5
        )

  if (
    !Number.isFinite(
      step
    ) ||
    step <=
      0
  ) {
    step =
      1
  }

  if (
    (
      maximum -
      minimum
    ) /
    step >
    10
  ) {
    step =
      niceStep(
        maximum -
        minimum,
        8
      )
  }

  const ticks:
    number[] =
    []

  let value =
    minimum

  let guard =
    0

  while (
    value <=
      maximum +
        step *
          0.001 &&
    guard <
      12
  ) {
    ticks.push(
      value
    )

    value +=
      step

    guard +=
      1
  }

  if (
    ticks[
      ticks.length -
      1
    ] <
    maximum *
      0.999
  ) {
    ticks.push(
      maximum
    )
  }

  return {
    minimum,
    maximum,
    ticks
  }
}

function axisRatio(
  value:
    number,
  minimum:
    number,
  maximum:
    number
) {
  return clamp(
    (
      value -
      minimum
    ) /
      Math.max(
        0.000001,
        maximum -
        minimum
      ),
    0,
    1
  )
}

function renderVerticalCartesian(
  document:
    MAQuadroChartDocument
) {
  const {
    spec,
    data
  } =
    document

  const plot =
    getPlotLayout(
      document,
      false
    )

  const scale =
    createAxisScale(
      document
    )

  const slot =
    plot.width /
    data.length

  const gridAndAxis =
    scale.ticks
      .map(
        (
          tick,
          index
        ) => {
          const ratio =
            axisRatio(
              tick,
              scale.minimum,
              scale.maximum
            )

          const y =
            plot.y +
            plot.height -
            plot.height *
              ratio

          const line =
            spec.showGrid
              ? `
                <line
                  x1="${plot.x}"
                  y1="${y}"
                  x2="${plot.x + plot.width}"
                  y2="${y}"
                  stroke="${escapeXml(
                    spec.axisColor
                  )}"
                  stroke-opacity="${
                    index ===
                    0
                      ? 0.48
                      : 0.2
                  }"
                  stroke-width="1"
                />
              `
              : ''

          const label =
            spec.showAxes
              ? `
                <text
                  x="${plot.x - 12}"
                  y="${y + 5}"
                  text-anchor="end"
                  fill="${escapeXml(
                    spec.textColor
                  )}"
                  fill-opacity="0.7"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="13"
                >${escapeXml(
                  formatValue(
                    tick,
                    spec
                  )
                )}</text>
              `
              : ''

          return (
            line +
            label
          )
        }
      )
      .join(
        ''
      )

  const axes =
    spec.showAxes
      ? `
        <line
          x1="${plot.x}"
          y1="${plot.y}"
          x2="${plot.x}"
          y2="${plot.y + plot.height}"
          stroke="${escapeXml(
            spec.axisColor
          )}"
          stroke-width="2"
        />

        <line
          x1="${plot.x}"
          y1="${plot.y + plot.height}"
          x2="${plot.x + plot.width}"
          y2="${plot.y + plot.height}"
          stroke="${escapeXml(
            spec.axisColor
          )}"
          stroke-width="2"
        />
      `
      : ''

  const labels =
    data
      .map(
        (
          datum,
          index
        ) => `
          <text
            x="${plot.x + slot * (index + 0.5)}"
            y="${plot.y + plot.height + 30}"
            text-anchor="middle"
            fill="${escapeXml(
              spec.textColor
            )}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="14"
            font-weight="600"
          >${escapeXml(
            shortenLabel(
              datum.label,
              12
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
        16,
        Math.min(
          74,
          slot *
            0.62
        )
      )

    marks =
      data
        .map(
          (
            datum,
            index
          ) => {
            const ratio =
              axisRatio(
                datum.value,
                scale.minimum,
                scale.maximum
              )

            const height =
              plot.height *
              ratio

            const x =
              plot.x +
              slot *
                (
                  index +
                  0.5
                ) -
              barWidth /
                2

            const y =
              plot.y +
              plot.height -
              height

            const inside =
              spec.valuePosition ===
              'inside'

            return `
              <rect
                x="${x}"
                y="${y}"
                width="${barWidth}"
                height="${Math.max(
                  0,
                  height
                )}"
                rx="${spec.barRadius}"
                fill="${escapeXml(
                  datum.color
                )}"
              />

              ${
                spec.showValues
                  ? `
                    <text
                      x="${x + barWidth / 2}"
                      y="${
                        inside
                          ? Math.min(
                              plot.y +
                                plot.height -
                                8,
                              y +
                                22
                            )
                          : Math.max(
                              plot.y +
                                17,
                              y -
                                9
                            )
                      }"
                      text-anchor="middle"
                      fill="${escapeXml(
                        inside
                          ? '#FFFFFF'
                          : spec.textColor
                      )}"
                      font-family="Arial, Helvetica, sans-serif"
                      font-size="14"
                      font-weight="700"
                      ${
                        inside
                          ? 'paint-order="stroke" stroke="#0F172A" stroke-opacity="0.25" stroke-width="3"'
                          : ''
                      }
                    >${escapeXml(
                      formatValue(
                        datum.value,
                        spec
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
            plot.x +
            slot *
              (
                index +
                0.5
              ),

          y:
            plot.y +
            plot.height -
            plot.height *
              axisRatio(
                datum.value,
                scale.minimum,
                scale.maximum
              )
        })
      )

    const pointString =
      points
        .map(
          (
            point
          ) =>
            `${point.x},${point.y}`
        )
        .join(
          ' '
        )

    const area =
      spec.type ===
      'area'
        ? `
          <polygon
            points="
              ${plot.x + slot * 0.5},${plot.y + plot.height}
              ${pointString}
              ${plot.x + slot * (data.length - 0.5)},${plot.y + plot.height}
            "
            fill="${escapeXml(
              spec.seriesColor
            )}"
            fill-opacity="${spec.areaOpacity}"
          />
        `
        : ''

    const line = `
      <polyline
        points="${pointString}"
        fill="none"
        stroke="${escapeXml(
          spec.seriesColor
        )}"
        stroke-width="${spec.lineWidth}"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    `

    const pointsSvg =
      points
        .map(
          (
            point
          ) => `
            ${
              spec.pointSize >
              0
                ? `
                  <circle
                    cx="${point.x}"
                    cy="${point.y}"
                    r="${spec.pointSize}"
                    fill="${escapeXml(
                      point.datum.color
                    )}"
                    stroke="${escapeXml(
                      spec.background
                    )}"
                    stroke-width="3"
                  />
                `
                : ''
            }

            ${
              spec.showValues
                ? `
                  <text
                    x="${point.x}"
                    y="${Math.max(
                      plot.y +
                        17,
                      point.y -
                        spec.pointSize -
                        9
                    )}"
                    text-anchor="middle"
                    fill="${escapeXml(
                      spec.textColor
                    )}"
                    font-family="Arial, Helvetica, sans-serif"
                    font-size="14"
                    font-weight="700"
                  >${escapeXml(
                    formatValue(
                      point.datum.value,
                      spec
                    )
                  )}</text>
                `
                : ''
            }
          `
        )
        .join(
          ''
        )

    marks =
      area +
      line +
      pointsSvg
  }

  return `
    ${gridAndAxis}
    ${axes}
    ${marks}
    ${labels}
    ${renderLegend(
      document
    )}
  `
}

function renderHorizontalBars(
  document:
    MAQuadroChartDocument
) {
  const {
    spec,
    data
  } =
    document

  const plot =
    getPlotLayout(
      document,
      true
    )

  const scale =
    createAxisScale(
      document
    )

  const slot =
    plot.height /
    data.length

  const barHeight =
    Math.max(
      16,
      Math.min(
        52,
        slot *
          0.62
      )
    )

  const gridAndAxis =
    scale.ticks
      .map(
        (
          tick,
          index
        ) => {
          const ratio =
            axisRatio(
              tick,
              scale.minimum,
              scale.maximum
            )

          const x =
            plot.x +
            plot.width *
              ratio

          const line =
            spec.showGrid
              ? `
                <line
                  x1="${x}"
                  y1="${plot.y}"
                  x2="${x}"
                  y2="${plot.y + plot.height}"
                  stroke="${escapeXml(
                    spec.axisColor
                  )}"
                  stroke-opacity="${
                    index ===
                    0
                      ? 0.48
                      : 0.2
                  }"
                  stroke-width="1"
                />
              `
              : ''

          const label =
            spec.showAxes
              ? `
                <text
                  x="${x}"
                  y="${plot.y + plot.height + 28}"
                  text-anchor="middle"
                  fill="${escapeXml(
                    spec.textColor
                  )}"
                  fill-opacity="0.72"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="13"
                >${escapeXml(
                  formatValue(
                    tick,
                    spec
                  )
                )}</text>
              `
              : ''

          return (
            line +
            label
          )
        }
      )
      .join(
        ''
      )

  const axes =
    spec.showAxes
      ? `
        <line
          x1="${plot.x}"
          y1="${plot.y}"
          x2="${plot.x}"
          y2="${plot.y + plot.height}"
          stroke="${escapeXml(
            spec.axisColor
          )}"
          stroke-width="2"
        />

        <line
          x1="${plot.x}"
          y1="${plot.y + plot.height}"
          x2="${plot.x + plot.width}"
          y2="${plot.y + plot.height}"
          stroke="${escapeXml(
            spec.axisColor
          )}"
          stroke-width="2"
        />
      `
      : ''

  const marks =
    data
      .map(
        (
          datum,
          index
        ) => {
          const ratio =
            axisRatio(
              datum.value,
              scale.minimum,
              scale.maximum
            )

          const width =
            plot.width *
            ratio

          const y =
            plot.y +
            slot *
              (
                index +
                0.5
              ) -
            barHeight /
              2

          const inside =
            spec.valuePosition ===
            'inside'

          const valueX =
            inside
              ? Math.max(
                  plot.x +
                    8,
                  plot.x +
                    width -
                    10
                )
              : Math.min(
                  plot.x +
                    plot.width -
                    5,
                  plot.x +
                    width +
                    10
                )

          return `
            <text
              x="${plot.x - 12}"
              y="${y + barHeight / 2 + 5}"
              text-anchor="end"
              fill="${escapeXml(
                spec.textColor
              )}"
              font-family="Arial, Helvetica, sans-serif"
              font-size="14"
              font-weight="600"
            >${escapeXml(
              shortenLabel(
                datum.label,
                16
              )
            )}</text>

            <rect
              x="${plot.x}"
              y="${y}"
              width="${Math.max(
                0,
                width
              )}"
              height="${barHeight}"
              rx="${spec.barRadius}"
              fill="${escapeXml(
                datum.color
              )}"
            />

            ${
              spec.showValues
                ? `
                  <text
                    x="${valueX}"
                    y="${y + barHeight / 2 + 5}"
                    text-anchor="${
                      inside
                        ? 'end'
                        : 'start'
                    }"
                    fill="${escapeXml(
                      inside
                        ? '#FFFFFF'
                        : spec.textColor
                    )}"
                    font-family="Arial, Helvetica, sans-serif"
                    font-size="14"
                    font-weight="700"
                    ${
                      inside
                        ? 'paint-order="stroke" stroke="#0F172A" stroke-opacity="0.25" stroke-width="3"'
                        : ''
                    }
                  >${escapeXml(
                    formatValue(
                      datum.value,
                      spec
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

  return `
    ${gridAndAxis}
    ${axes}
    ${marks}
    ${renderLegend(
      document
    )}
  `
}

function renderCartesianChart(
  document:
    MAQuadroChartDocument
) {
  return (
    document.spec.type ===
      'bar' &&
    document.spec
      .barDirection ===
      'horizontal'
  )
    ? renderHorizontalBars(
        document
      )
    : renderVerticalCartesian(
        document
      )
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
    endAngle -
    startAngle >
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

  const layout =
    getPlotLayout(
      document,
      false
    )

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
    layout.x +
    layout.width /
      2

  const centerY =
    layout.y +
    layout.height /
      2

  const radius =
    Math.max(
      95,
      Math.min(
        layout.width,
        layout.height
      ) *
        0.43
    )

  const innerRadius =
    spec.type ===
    'donut'
      ? radius *
        spec.donutHole
      : 0

  if (
    total <=
    0
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
        document
      )}
    `
  }

  let angle =
    0

  const segments:
    string[] =
    []

  data.forEach(
    (
      datum
    ) => {
      const ratio =
        datum.value /
        total

      if (
        ratio <=
        0
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
          0.045
      ) {
        const labelPoint =
          polarPoint(
            centerX,
            centerY,
            innerRadius >
              0
              ? innerRadius +
                (
                  radius -
                  innerRadius
                ) *
                  0.56
              : radius *
                0.67,
            middle
          )

        const label =
          spec.pieValueMode ===
          'value'
            ? formatValue(
                datum.value,
                spec
              )
            : `${Math.round(
                ratio *
                100
              )}%`

        segments.push(`
          <text
            x="${labelPoint.x}"
            y="${labelPoint.y + 6}"
            text-anchor="middle"
            fill="#FFFFFF"
            font-family="Arial, Helvetica, sans-serif"
            font-size="16"
            font-weight="800"
            paint-order="stroke"
            stroke="#0F172A"
            stroke-opacity="0.45"
            stroke-width="4"
          >${escapeXml(
            label
          )}</text>
        `)
      }

      angle =
        endAngle
    }
  )

  const hole =
    innerRadius >
    0
      ? `
        <circle
          cx="${centerX}"
          cy="${centerY}"
          r="${innerRadius}"
          fill="${escapeXml(
            spec.background
          )}"
        />
      `
      : ''

  return `
    ${segments.join('')}
    ${hole}
    ${renderLegend(
      document
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
    (
      normalized.spec.type ===
        'pie' ||
      normalized.spec.type ===
        'donut'
    )
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
      normalized.spec.background
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
    'area'
  ) {
    return 'Área'
  }

  if (
    type ===
    'pie'
  ) {
    return 'Circular'
  }

  if (
    type ===
    'donut'
  ) {
    return 'Donut'
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
      normalized.spec.type
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
  | MAQuadroChartDocument
  | null {
  const start =
    name.indexOf(
      CHART_METADATA_START
    )

  if (
    start <
    0
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
    end <
    0
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
        Partial<MAQuadroChartDocument>

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
