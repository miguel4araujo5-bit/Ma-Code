import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { ProgressCallback, SelectedPdf } from '../../types/maPdf'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type PdfTextItemLike = {
  str?: unknown
  transform?: unknown
  width?: unknown
  height?: unknown
  hasEOL?: unknown
}

type PdfTextContentChunkLike = {
  items?: unknown
}

type PositionedTextItem = {
  text: string
  x: number
  y: number
  width: number
  height: number
  hasEOL: boolean
}

export type ExtractedPdfCell = {
  text: string
  x: number
  width: number
  requiresReview?: boolean
}

export type ExtractedPdfLine = {
  text: string
  cells: string[]
  positionedCells?: ExtractedPdfCell[]
}

export type ExtractedPdfPage = {
  pageNumber: number
  lines: ExtractedPdfLine[]
}

export type ExtractedPdfDocument = {
  pages: ExtractedPdfPage[]
  pageCount: number
  characterCount: number
}

type ScheduleColumnAnchor = {
  kind: 'day' | 'room'
  centerX: number
}

function toFiniteNumber(
  value: unknown,
  fallback = 0
) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback
}

function normalizeText(value: unknown) {
  return typeof value === 'string'
    ? value
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .trim()
    : ''
}

function normalizeComparableText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/\s+/g, ' ')
    .trim()
}

function toPositionedItem(
  value: unknown
): PositionedTextItem | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const item = value as PdfTextItemLike
  const text = normalizeText(item.str)

  if (
    !text ||
    !Array.isArray(item.transform) ||
    item.transform.length < 6
  ) {
    return null
  }

  const transform = item.transform
  const x = toFiniteNumber(transform[4])
  const y = toFiniteNumber(transform[5])
  const measuredHeight = Math.hypot(
    toFiniteNumber(transform[2]),
    toFiniteNumber(transform[3])
  )
  const height = Math.max(
    1,
    toFiniteNumber(item.height, measuredHeight || 10),
    measuredHeight
  )
  const estimatedWidth = Math.max(
    text.length * height * 0.45,
    height * 0.5
  )
  const width = Math.max(
    0,
    toFiniteNumber(item.width, estimatedWidth)
  )

  return {
    text,
    x,
    y,
    width,
    height,
    hasEOL: item.hasEOL === true
  }
}

function getMedian(values: number[]) {
  if (values.length === 0) {
    return 10
  }

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

function getAverageCharacterWidth(
  item: PositionedTextItem
) {
  return item.width > 0 && item.text.length > 0
    ? item.width / item.text.length
    : item.height * 0.5
}

function joinItemsAsText(
  items: PositionedTextItem[]
) {
  const sorted = [...items].sort((a, b) => a.x - b.x)
  let result = ''
  let previousRight = 0
  let previousItem: PositionedTextItem | null = null

  for (const item of sorted) {
    if (!previousItem) {
      result = item.text
      previousRight = item.x + item.width
      previousItem = item
      continue
    }

    const gap = item.x - previousRight
    const characterWidth = Math.max(
      2,
      (
        getAverageCharacterWidth(previousItem) +
        getAverageCharacterWidth(item)
      ) / 2
    )
    const shouldInsertSpace = gap > characterWidth * 0.25
    const spaceCount = shouldInsertSpace
      ? Math.min(
          8,
          Math.max(
            1,
            Math.round(gap / characterWidth)
          )
        )
      : 0

    result += `${' '.repeat(spaceCount)}${item.text}`
    previousRight = Math.max(
      previousRight,
      item.x + item.width
    )
    previousItem = item
  }

  return result.replace(/[ \t]+/g, ' ').trim()
}

function createExtractedCell(
  items: PositionedTextItem[]
): ExtractedPdfCell | null {
  const text = joinItemsAsText(items)

  if (!text || items.length === 0) {
    return null
  }

  const left = Math.min(...items.map(item => item.x))
  const right = Math.max(
    ...items.map(item => item.x + item.width)
  )

  return {
    text,
    x: left,
    width: Math.max(0, right - left)
  }
}

function hasTimeRange(value: string) {
  const normalized =
    value.replace(/[hH.]/g, ':')

  return /\b([01]?\d|2[0-3]):[0-5]\d\s*(?:-|–|—|a|as|às?)\s*([01]?\d|2[0-3]):[0-5]\d\b/i.test(
    normalized
  )
}

function isStandaloneTimeRange(value: string) {
  const normalized =
    value.replace(/[hH.]/g, ':')

  return /^\s*([01]?\d|2[0-3]):[0-5]\d\s*(?:-|–|—|a|as|às?)\s*([01]?\d|2[0-3]):[0-5]\d\s*$/i.test(
    normalized
  )
}

function splitItemsIntoPositionedCells(
  items: PositionedTextItem[]
) {
  const sorted = [...items].sort((a, b) => a.x - b.x)

  if (sorted.length === 0) {
    return []
  }

  const cells: ExtractedPdfCell[] = []
  let currentItems: PositionedTextItem[] = [sorted[0]]
  let previousRight = sorted[0].x + sorted[0].width

  for (
    let index = 1;
    index < sorted.length;
    index += 1
  ) {
    const item = sorted[index]
    const previousItem = sorted[index - 1]
    const gap = item.x - previousRight
    const characterWidth = Math.max(
      2,
      (
        getAverageCharacterWidth(previousItem) +
        getAverageCharacterWidth(item)
      ) / 2
    )
    const cellBreakThreshold = Math.max(
      previousItem.height * 1.8,
      item.height * 1.8,
      characterWidth * 4.5,
      18
    )
    const currentText =
      joinItemsAsText(currentItems)
    const timetableTimeBreak =
      isStandaloneTimeRange(currentText) &&
      gap > 2

    if (
      gap > cellBreakThreshold ||
      previousItem.hasEOL ||
      timetableTimeBreak
    ) {
      const cell = createExtractedCell(currentItems)

      if (cell) {
        cells.push(cell)
      }

      currentItems = [item]
    } else {
      currentItems.push(item)
    }

    previousRight = Math.max(
      previousRight,
      item.x + item.width
    )
  }

  const lastCell = createExtractedCell(currentItems)

  if (lastCell) {
    cells.push(lastCell)
  }

  return cells
}

function extractCompactTimetableLesson(value: string) {
  const match = value.match(
    /^\s*(10|11|12|[1-9])\s*(?:\.?\s*[ºo°])?\s*([A-Za-z][A-Za-z0-9]{0,2})(?=$|[\s_.:;|/-])/i
  )

  if (!match) {
    return null
  }

  // Normalizar apenas a turma: tudo o que se segue pode conter curso e
  // disciplina. Reduzir ao primeiro token transformava «AP . AEXP» em «AP».
  const suffix = value.slice(match[0].length).trimEnd()
  return `${match[1]}.º ${match[2].toLocaleUpperCase('pt-PT')}${suffix}`
}

function isWeekdayHeader(value: string) {
  return /^(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?$/i.test(
    value.trim()
  )
}

function isRoomHeader(value: string) {
  const normalized =
    normalizeComparableText(value)

  return [
    'sala',
    'sala n.º',
    'sala nº',
    'sala n°',
    'sl.',
    'sl',
    'espaco',
    'local'
  ].includes(normalized)
}

function getCellCenter(
  cell: ExtractedPdfCell
) {
  return cell.x + cell.width / 2
}

function getScheduleColumnAnchorForCell(
  cell: ExtractedPdfCell,
  anchors: ScheduleColumnAnchor[]
) {
  if (anchors.length === 0) {
    return null
  }

  const left = cell.x
  const right =
    cell.x + Math.max(0, cell.width)
  const centerX = getCellCenter(cell)
  let bestAnchor: ScheduleColumnAnchor | null = null
  let bestOverlap = 0
  let hasUniqueBestOverlap = true

  for (
    let index = 0;
    index < anchors.length;
    index += 1
  ) {
    const anchor = anchors[index]
    const leftBoundary =
      index === 0
        ? Number.NEGATIVE_INFINITY
        : (
            anchors[index - 1].centerX +
            anchor.centerX
          ) / 2
    const rightBoundary =
      index === anchors.length - 1
        ? Number.POSITIVE_INFINITY
        : (
            anchor.centerX +
            anchors[index + 1].centerX
          ) / 2
    const overlap = Math.max(
      0,
      Math.min(right, rightBoundary) -
      Math.max(left, leftBoundary)
    )

    if (overlap > bestOverlap) {
      bestAnchor = anchor
      bestOverlap = overlap
      hasUniqueBestOverlap = true
      continue
    }

    if (
      overlap > 0 &&
      Math.abs(overlap - bestOverlap) < 0.001
    ) {
      hasUniqueBestOverlap = false
    }
  }

  if (bestOverlap > 0) {
    return hasUniqueBestOverlap
      ? bestAnchor
      : null
  }

  return anchors.reduce(
    (nearest, anchor) =>
      Math.abs(anchor.centerX - centerX) <
      Math.abs(nearest.centerX - centerX)
        ? anchor
        : nearest,
    anchors[0]
  )
}

function normalizeScheduleActivityText(
  value: string
) {
  return value
    .replace(/^[^0-9A-Za-zÀ-ÿ]+/u, '')
    .replace(/^(?:TE|Cre)\s+/i, '')
    .replace(/\s+(?:SP|TE|Cre)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function mergeScheduleDayCells(
  cells: ExtractedPdfCell[]
) {
  if (cells.length === 0) {
    return null
  }

  const sorted = [...cells].sort(
    (left, right) => left.x - right.x
  )
  const rawText = sorted
    .map(cell => cell.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  const text = normalizeScheduleActivityText(
    rawText
  )

  if (!text) {
    return null
  }

  const left = Math.min(
    ...sorted.map(cell => cell.x)
  )
  const right = Math.max(
    ...sorted.map(
      cell => cell.x + cell.width
    )
  )
  const compactLesson =
    extractCompactTimetableLesson(text)

  return {
    text: compactLesson ?? text,
    x: left,
    width: Math.max(0, right - left),
    ...(cells.some(cell => cell.requiresReview) ? { requiresReview: true } : {})
  }
}

function discardTimetableRoomColumns(
  lines: ExtractedPdfLine[]
) {
  const header = lines.find(line => {
    const cells = line.positionedCells ?? []
    const dayCount = cells.filter(
      cell => isWeekdayHeader(cell.text)
    ).length
    const roomCount = cells.filter(
      cell => isRoomHeader(cell.text)
    ).length

    return dayCount >= 2 && roomCount >= 2
  })

  if (!header?.positionedCells) {
    return lines
  }

  const anchors: ScheduleColumnAnchor[] = []

  for (const cell of header.positionedCells) {
    if (isWeekdayHeader(cell.text)) {
      anchors.push({
        kind: 'day',
        centerX: getCellCenter(cell)
      })
      continue
    }

    if (isRoomHeader(cell.text)) {
      anchors.push({
        kind: 'room',
        centerX: getCellCenter(cell)
      })
    }
  }

  anchors.sort(
    (left, right) =>
      left.centerX - right.centerX
  )

  if (
    anchors.filter(anchor => anchor.kind === 'day').length < 2 ||
    anchors.filter(anchor => anchor.kind === 'room').length < 2
  ) {
    return lines
  }

  const dayAnchors = anchors.filter(
    anchor => anchor.kind === 'day'
  )

  // Alguns PDFs já entregam atividade e sala num único TextItem. Recolher
  // atividades observadas com uma sala fisicamente separada permite resolver
  // esses fragmentos sem uma lista fechada de nomes de salas ou disciplinas.
  const separatedActivities = new Map<string, number>()
  for (const line of lines) {
    if (!hasTimeRange(line.text)) continue
    const cells = (line.positionedCells ?? []).filter(cell => !hasTimeRange(cell.text))
    for (const day of dayAnchors) {
      const room = anchors[anchors.indexOf(day) + 1]
      if (room?.kind !== 'room') continue
      if (!cells.some(cell => getScheduleColumnAnchorForCell(cell, anchors) === room)) continue
      const activity = mergeScheduleDayCells(
        cells.filter(cell => getScheduleColumnAnchorForCell(cell, anchors) === day)
      )
      if (activity) separatedActivities.set(activity.text, activity.width)
    }
  }

  return lines.map(line => {
    const positionedCells = line.positionedCells ?? []

    if (
      line === header ||
      !hasTimeRange(line.text) ||
      positionedCells.length === 0
    ) {
      return line
    }

    const timeCells = positionedCells.filter(
      cell => hasTimeRange(cell.text)
    )
    const cellsByDay = new Map<
      number,
      ExtractedPdfCell[]
    >()

    for (const cell of positionedCells) {
      if (hasTimeRange(cell.text)) {
        continue
      }

      const matchedAnchor =
        getScheduleColumnAnchorForCell(
          cell,
          anchors
        )

      if (
        !matchedAnchor ||
        matchedAnchor.kind === 'room'
      ) {
        continue
      }

      const dayIndex = dayAnchors.findIndex(
        anchor => anchor === matchedAnchor
      )

      if (dayIndex < 0) {
        continue
      }

      let activityCell = cell
      const room = anchors[anchors.indexOf(matchedAnchor) + 1]
      const hasSeparateRoom = room?.kind === 'room' && positionedCells.some(other =>
        other !== cell && getScheduleColumnAnchorForCell(other, anchors) === room
      )
      if (
        room?.kind === 'room' &&
        !hasSeparateRoom &&
        cell.x < matchedAnchor.centerX &&
        cell.x + cell.width >= room.centerX
      ) {
        const text = extractCompactTimetableLesson(cell.text) ?? cell.text
        const prefixes = [...separatedActivities.keys()].filter(activity => {
          const width = separatedActivities.get(activity)!
          return text.startsWith(`${activity} `) &&
            cell.x + width < room.centerX && width < cell.width
        }).sort((left, right) => right.length - left.length)
        const prefix = prefixes[0]
        activityCell = prefix
          ? {
              ...cell,
              text: prefix,
              width: separatedActivities.get(prefix)!,
              requiresReview: true
            }
          : { ...cell, requiresReview: true }
      }

      const dayCells = cellsByDay.get(dayIndex) ?? []
      dayCells.push(activityCell)
      cellsByDay.set(dayIndex, dayCells)
    }

    const mergedDayCells = Array.from(
      cellsByDay.entries()
    )
      .sort(
        ([left], [right]) => left - right
      )
      .map(([, cells]) =>
        mergeScheduleDayCells(cells)
      )
      .filter(
        (cell): cell is ExtractedPdfCell =>
          cell !== null
      )

    return {
      ...line,
      positionedCells: [
        ...timeCells,
        ...mergedDayCells
      ].sort(
        (left, right) => left.x - right.x
      )
    }
  })
}

function prepareSchedulePositionedCells(
  cells: ExtractedPdfCell[]
) {
  if (cells.length === 0) {
    return []
  }

  return [...cells]
    .sort((a, b) => a.x - b.x)
    .map(cell => {
      const compactLesson =
        extractCompactTimetableLesson(
          cell.text
        )

      return compactLesson
        ? {
            ...cell,
            text: compactLesson
          }
        : {
            ...cell
          }
    })
}

function groupItemsIntoLines(
  items: PositionedTextItem[]
): ExtractedPdfLine[] {
  if (items.length === 0) {
    return []
  }

  const medianHeight = getMedian(
    items.map(item => item.height)
  )
  const lineTolerance = Math.max(
    2,
    medianHeight * 0.45
  )
  const sorted = [...items].sort((a, b) => {
    const verticalDifference = b.y - a.y

    if (
      Math.abs(verticalDifference) > lineTolerance
    ) {
      return verticalDifference
    }

    return a.x - b.x
  })
  const lineGroups: Array<{
    baseline: number
    items: PositionedTextItem[]
  }> = []

  for (const item of sorted) {
    const currentLine = lineGroups[lineGroups.length - 1]

    if (
      !currentLine ||
      Math.abs(currentLine.baseline - item.y) > lineTolerance
    ) {
      lineGroups.push({
        baseline: item.y,
        items: [item]
      })
      continue
    }

    currentLine.items.push(item)
    currentLine.baseline =
      currentLine.items.reduce(
        (total, lineItem) => total + lineItem.y,
        0
      ) / currentLine.items.length
  }

  // As subcolunas de sala são estreitas: o intervalo entre dois fragmentos
  // de texto pode ser menor do que o limiar usado para juntar palavras.
  // Preservar cada posição até separar as colunas evita fundir AEXP + REO
  // e também cabeçalhos como «Segunda» + «Sala». Texto e células de exportação
  // continuam a usar a reconstrução genérica, sem perda de conteúdo.
  const hasScheduleColumns = lineGroups.some(group =>
    group.items.filter(item => isWeekdayHeader(item.text)).length >= 2 &&
    group.items.filter(item => isRoomHeader(item.text)).length >= 2
  )

  return lineGroups
    .map(group => {
      const text = joinItemsAsText(group.items)
      const rawPositionedCells = splitItemsIntoPositionedCells(
        group.items
      )
      const cells = rawPositionedCells.map(cell => cell.text)
      const positionedCells = hasScheduleColumns
        ? group.items.map(item => ({
            text: item.text,
            x: item.x,
            width: item.width
          }))
        : prepareSchedulePositionedCells(rawPositionedCells)

      return {
        text,
        cells: cells.length > 0
          ? cells
          : text
            ? [text]
            : [],
        positionedCells: positionedCells.length > 0
          ? positionedCells
          : text
            ? [{ text, x: 0, width: 0 }]
            : []
      }
    })
    .filter(line => line.text.length > 0)
}

async function readPdfTextItems(
  page: {
    streamTextContent: () => ReadableStream<unknown>
  }
) {
  const reader = page.streamTextContent().getReader()
  const items: unknown[] = []

  try {
    while (true) {
      const result = await reader.read()

      if (result.done) {
        break
      }

      const chunk = result.value

      if (!chunk || typeof chunk !== 'object') {
        continue
      }

      const chunkItems = (chunk as PdfTextContentChunkLike).items

      if (Array.isArray(chunkItems)) {
        items.push(...chunkItems)
      }
    }
  } finally {
    reader.releaseLock()
  }

  return items
}

export async function extractTextFromPdf(
  selected: SelectedPdf | undefined,
  onProgress: ProgressCallback
): Promise<ExtractedPdfDocument> {
  if (!selected) {
    throw new Error('Escolha um ficheiro PDF para converter.')
  }

  onProgress('A preparar a leitura do documento PDF...')

  const data = new Uint8Array(
    await selected.file.arrayBuffer()
  )
  const loadingTask = getDocument({ data })

  try {
    const pdfDocument = await loadingTask.promise
    const pages: ExtractedPdfPage[] = []
    let characterCount = 0

    if (pdfDocument.numPages === 0) {
      throw new Error('O documento não contém páginas.')
    }

    for (
      let pageNumber = 1;
      pageNumber <= pdfDocument.numPages;
      pageNumber += 1
    ) {
      onProgress(
        `A extrair texto da página ${pageNumber} de ${pdfDocument.numPages}...`
      )

      const page = await pdfDocument.getPage(pageNumber)
      const textItems = await readPdfTextItems(page)
      const positionedItems = textItems
        .map(item => toPositionedItem(item))
        .filter(
          (item): item is PositionedTextItem => item !== null
        )
      const lines = discardTimetableRoomColumns(
        groupItemsIntoLines(positionedItems)
      )

      characterCount += lines.reduce(
        (total, line) => total + line.text.length,
        0
      )

      pages.push({
        pageNumber,
        lines
      })

      page.cleanup()
    }

    if (characterCount === 0) {
      throw new Error(
        'Este PDF não contém texto selecionável. Se o documento for uma digitalização ou fotografia, será necessário OCR, que ainda não está disponível nesta ferramenta.'
      )
    }

    return {
      pages,
      pageCount: pdfDocument.numPages,
      characterCount
    }
  } finally {
    try {
      await loadingTask.destroy()
    } catch {
      // A limpeza do worker não deve esconder
      // o resultado ou o erro principal.
    }
  }
}
