export type ScheduleGridWeekday =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7

export type ScheduleImportBlockType =
  | 'teaching'
  | 'duty'
  | 'unknown'

export type ScheduleFieldConfidence =
  | 'high'
  | 'medium'
  | 'low'

export interface ScheduleGeometryTextItem {
  text: string
  x: number
  y: number
  width: number
  height: number
}

export interface ScheduleGeometryPageInput {
  pageNumber: number
  items: ScheduleGeometryTextItem[]
}

export interface ScheduleSourceBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ScheduleGridColumn {
  id: string
  pageNumber: number
  kind: 'day' | 'room'
  weekday: ScheduleGridWeekday | null
  label: string
  centerX: number
  leftBoundary: number
  rightBoundary: number
}

export interface ScheduleGridTimeRow {
  id: string
  pageNumber: number
  startTime: string
  endTime: string
  rawText: string
  baselineY: number
  upperBoundaryY: number
  lowerBoundaryY: number
}

export interface ScheduleImportBlockConfidence {
  weekday: ScheduleFieldConfidence
  time: ScheduleFieldConfidence
  activity: ScheduleFieldConfidence
  classification: ScheduleFieldConfidence
  group: ScheduleFieldConfidence
  course: ScheduleFieldConfidence
}

export interface ScheduleImportBlock {
  id: string
  timeRowId: string
  dayColumnId: string
  roomColumnId: string | null
  weekday: ScheduleGridWeekday
  startTime: string
  endTime: string
  rawText: string
  rawActivityText: string
  rawRoomText: string
  rawGroupToken: string
  rawActivityToken: string
  sourcePage: number
  sourceBounds: ScheduleSourceBounds
  sourceItems: ScheduleGeometryTextItem[]
  type: ScheduleImportBlockType
  groupName?: string
  courseCode?: string
  courseName?: string
  subjectCode?: string
  subjectName?: string
  included: boolean
  confidence: ScheduleImportBlockConfidence
  warnings: string[]
}

export interface ScheduleGridPage {
  pageNumber: number
  columns: ScheduleGridColumn[]
  timeRows: ScheduleGridTimeRow[]
  blocks: ScheduleImportBlock[]
  warnings: string[]
}

export interface ScheduleGridDocument {
  pages: ScheduleGridPage[]
  columns: ScheduleGridColumn[]
  timeRows: ScheduleGridTimeRow[]
  blocks: ScheduleImportBlock[]
  sourceItemCount: number
  warnings: string[]
}

type GeometryRow = {
  baselineY: number
  items: ScheduleGeometryTextItem[]
}

type GeometryCell = {
  text: string
  items: ScheduleGeometryTextItem[]
  x: number
  width: number
}

type ColumnAnchor = {
  kind: 'day' | 'room'
  weekday: ScheduleGridWeekday | null
  label: string
  centerX: number
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/\s+/g, ' ')
    .trim()
}

function median(values: number[]) {
  if (values.length === 0) return 0

  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)

  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle]
}

function averageCharacterWidth(item: ScheduleGeometryTextItem) {
  return item.width > 0 && item.text.length > 0
    ? item.width / item.text.length
    : Math.max(2, item.height * 0.5)
}

function joinInline(items: ScheduleGeometryTextItem[]) {
  const ordered = [...items].sort((left, right) => left.x - right.x)
  let result = ''
  let previous: ScheduleGeometryTextItem | null = null
  let previousRight = 0

  for (const item of ordered) {
    if (!previous) {
      result = item.text
      previous = item
      previousRight = item.x + item.width
      continue
    }

    const gap = item.x - previousRight
    const characterWidth = Math.max(
      2,
      (averageCharacterWidth(previous) + averageCharacterWidth(item)) / 2
    )

    result += `${gap > characterWidth * 0.25 ? ' ' : ''}${item.text}`
    previous = item
    previousRight = Math.max(previousRight, item.x + item.width)
  }

  return result.trim()
}

function groupIntoRows(items: ScheduleGeometryTextItem[]): GeometryRow[] {
  if (items.length === 0) return []

  const typicalHeight = median(
    items
      .map(item => item.height)
      .filter(value => value > 0)
  ) || 10
  const tolerance = Math.max(2, typicalHeight * 0.45)
  const ordered = [...items].sort((left, right) => {
    const vertical = right.y - left.y
    return Math.abs(vertical) > tolerance
      ? vertical
      : left.x - right.x
  })
  const rows: GeometryRow[] = []

  for (const item of ordered) {
    const current = rows[rows.length - 1]

    if (!current || Math.abs(current.baselineY - item.y) > tolerance) {
      rows.push({
        baselineY: item.y,
        items: [item]
      })
      continue
    }

    current.items.push(item)
    current.baselineY =
      current.items.reduce((total, rowItem) => total + rowItem.y, 0) /
      current.items.length
  }

  return rows
}

function splitRowIntoCells(row: GeometryRow): GeometryCell[] {
  const ordered = [...row.items].sort((left, right) => left.x - right.x)
  if (ordered.length === 0) return []

  const groups: ScheduleGeometryTextItem[][] = [[ordered[0]]]
  let previousRight = ordered[0].x + ordered[0].width

  for (let index = 1; index < ordered.length; index += 1) {
    const item = ordered[index]
    const previous = ordered[index - 1]
    const gap = item.x - previousRight
    const characterWidth = Math.max(
      2,
      (averageCharacterWidth(previous) + averageCharacterWidth(item)) / 2
    )
    const threshold = Math.max(
      previous.height * 1.8,
      item.height * 1.8,
      characterWidth * 4.5,
      18
    )

    if (gap > threshold) {
      groups.push([item])
    } else {
      groups[groups.length - 1].push(item)
    }

    previousRight = Math.max(previousRight, item.x + item.width)
  }

  return groups
    .map(group => {
      const text = joinInline(group)
      const left = Math.min(...group.map(item => item.x))
      const right = Math.max(...group.map(item => item.x + item.width))

      return {
        text,
        items: group,
        x: left,
        width: Math.max(0, right - left)
      }
    })
    .filter(cell => cell.text.length > 0)
}

function weekdayFromHeader(value: string): ScheduleGridWeekday | null {
  const normalized = normalizeText(value)

  if (/^segunda(?:-feira)?$/.test(normalized)) return 1
  if (/^terca(?:-feira)?$/.test(normalized)) return 2
  if (/^quarta(?:-feira)?$/.test(normalized)) return 3
  if (/^quinta(?:-feira)?$/.test(normalized)) return 4
  if (/^sexta(?:-feira)?$/.test(normalized)) return 5
  if (/^sabado$/.test(normalized)) return 6
  if (/^domingo$/.test(normalized)) return 7

  return null
}

function isRoomHeader(value: string) {
  return normalizeText(value) === 'sala'
}

function extractTimeRange(value: string) {
  const normalized = value.replace(/[hH.]/g, ':')
  const match = normalized.match(
    /\b([01]?\d|2[0-3]):([0-5]\d)\s*(?:-|–|—|a|as|às?)\s*([01]?\d|2[0-3]):([0-5]\d)\b/i
  )

  if (!match) return null

  return {
    startTime: `${match[1].padStart(2, '0')}:${match[2]}`,
    endTime: `${match[3].padStart(2, '0')}:${match[4]}`,
    matchedText: match[0]
  }
}

function detectHeaderRow(rows: GeometryRow[]) {
  let best: {
    row: GeometryRow
    cells: GeometryCell[]
    weekdayCount: number
    roomCount: number
  } | null = null

  for (const row of rows) {
    const cells = splitRowIntoCells(row)
    const weekdayCount = cells.filter(cell => weekdayFromHeader(cell.text)).length
    const roomCount = cells.filter(cell => isRoomHeader(cell.text)).length

    if (weekdayCount < 2) continue

    if (
      !best ||
      weekdayCount > best.weekdayCount ||
      (weekdayCount === best.weekdayCount && roomCount > best.roomCount)
    ) {
      best = {
        row,
        cells,
        weekdayCount,
        roomCount
      }
    }
  }

  return best
}

function buildColumns(
  pageNumber: number,
  headerCells: GeometryCell[]
): ScheduleGridColumn[] {
  const anchors: ColumnAnchor[] = []
  let lastWeekday: ScheduleGridWeekday | null = null

  for (const cell of headerCells) {
    const weekday = weekdayFromHeader(cell.text)

    if (weekday) {
      lastWeekday = weekday
      anchors.push({
        kind: 'day',
        weekday,
        label: cell.text,
        centerX: cell.x + cell.width / 2
      })
      continue
    }

    if (isRoomHeader(cell.text)) {
      anchors.push({
        kind: 'room',
        weekday: lastWeekday,
        label: cell.text,
        centerX: cell.x + cell.width / 2
      })
    }
  }

  anchors.sort((left, right) => left.centerX - right.centerX)

  return anchors.map((anchor, index) => {
    const previous = anchors[index - 1]
    const next = anchors[index + 1]
    const previousGap = previous
      ? anchor.centerX - previous.centerX
      : next
        ? next.centerX - anchor.centerX
        : 80
    const nextGap = next
      ? next.centerX - anchor.centerX
      : previous
        ? anchor.centerX - previous.centerX
        : 80

    return {
      id: `schedule-column-${pageNumber}-${index + 1}`,
      pageNumber,
      kind: anchor.kind,
      weekday: anchor.weekday,
      label: anchor.label,
      centerX: anchor.centerX,
      leftBoundary:
        previous
          ? (previous.centerX + anchor.centerX) / 2
          : anchor.centerX - previousGap / 2,
      rightBoundary:
        next
          ? (anchor.centerX + next.centerX) / 2
          : anchor.centerX + nextGap / 2
    }
  })
}

function detectTimeRows(
  pageNumber: number,
  rows: GeometryRow[]
): ScheduleGridTimeRow[] {
  const detected = rows
    .map(row => ({
      row,
      time: extractTimeRange(joinInline(row.items))
    }))
    .filter(
      (value): value is {
        row: GeometryRow
        time: NonNullable<ReturnType<typeof extractTimeRange>>
      } => value.time !== null
    )
    .sort((left, right) => right.row.baselineY - left.row.baselineY)

  if (detected.length === 0) return []

  const gaps = detected
    .slice(1)
    .map((entry, index) =>
      Math.abs(detected[index].row.baselineY - entry.row.baselineY)
    )
    .filter(value => value > 0)
  const typicalGap = median(gaps) || 40

  return detected.map((entry, index) => {
    const previous = detected[index - 1]
    const next = detected[index + 1]
    const upperBoundaryY = previous
      ? (previous.row.baselineY + entry.row.baselineY) / 2
      : entry.row.baselineY + typicalGap / 2
    const lowerBoundaryY = next
      ? (entry.row.baselineY + next.row.baselineY) / 2
      : entry.row.baselineY - typicalGap / 2

    return {
      id: `schedule-time-${pageNumber}-${index + 1}`,
      pageNumber,
      startTime: entry.time.startTime,
      endTime: entry.time.endTime,
      rawText: joinInline(entry.row.items),
      baselineY: entry.row.baselineY,
      upperBoundaryY,
      lowerBoundaryY
    }
  })
}

function itemCenterX(item: ScheduleGeometryTextItem) {
  return item.x + item.width / 2
}

function columnForItem(
  item: ScheduleGeometryTextItem,
  columns: ScheduleGridColumn[]
) {
  if (columns.length === 0) return null

  const itemLeft = item.x
  const itemRight = item.x + Math.max(0, item.width)
  let bestColumn: ScheduleGridColumn | null = null
  let bestOverlap = 0
  let uniqueBest = true

  for (const column of columns) {
    const overlap = Math.max(
      0,
      Math.min(itemRight, column.rightBoundary) -
      Math.max(itemLeft, column.leftBoundary)
    )

    if (overlap > bestOverlap + 0.001) {
      bestColumn = column
      bestOverlap = overlap
      uniqueBest = true
      continue
    }

    if (
      overlap > 0 &&
      Math.abs(overlap - bestOverlap) <= 0.001
    ) {
      uniqueBest = false
    }
  }

  if (bestOverlap > 0) {
    return uniqueBest
      ? bestColumn
      : null
  }

  const center = itemCenterX(item)

  return columns.find(
    column =>
      center >= column.leftBoundary &&
      center < column.rightBoundary
  ) ?? null
}

function itemsForTimeRow(
  row: ScheduleGridTimeRow,
  items: ScheduleGeometryTextItem[],
  columns: ScheduleGridColumn[]
) {
  if (columns.length === 0) return []

  const minimumGridX = Math.min(...columns.map(column => column.leftBoundary))
  const maximumGridX = Math.max(...columns.map(column => column.rightBoundary))

  return items.filter(item => {
    const centerX = itemCenterX(item)

    return (
      item.y <= row.upperBoundaryY &&
      item.y > row.lowerBoundaryY &&
      centerX >= minimumGridX &&
      centerX < maximumGridX
    )
  })
}

function joinPreservingRows(items: ScheduleGeometryTextItem[]) {
  return groupIntoRows(items)
    .map(row => joinInline(row.items))
    .filter(Boolean)
    .join('\n')
}

function sourceBounds(items: ScheduleGeometryTextItem[]): ScheduleSourceBounds {
  const left = Math.min(...items.map(item => item.x))
  const right = Math.max(...items.map(item => item.x + item.width))
  const bottom = Math.min(...items.map(item => item.y))
  const top = Math.max(...items.map(item => item.y + item.height))

  return {
    x: left,
    y: bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, top - bottom)
  }
}

function buildBlocks(
  pageNumber: number,
  items: ScheduleGeometryTextItem[],
  columns: ScheduleGridColumn[],
  timeRows: ScheduleGridTimeRow[]
): ScheduleImportBlock[] {
  const dayColumns = columns.filter(
    (column): column is ScheduleGridColumn & { weekday: ScheduleGridWeekday } =>
      column.kind === 'day' && column.weekday !== null
  )
  const blocks: ScheduleImportBlock[] = []
  let sequence = 0

  for (const timeRow of timeRows) {
    const rowItems = itemsForTimeRow(timeRow, items, columns)
    const itemsByColumn = new Map<string, ScheduleGeometryTextItem[]>()

    for (const item of rowItems) {
      const column = columnForItem(item, columns)
      if (!column) continue

      const bucket = itemsByColumn.get(column.id) ?? []
      bucket.push(item)
      itemsByColumn.set(column.id, bucket)
    }

    for (const dayColumn of dayColumns) {
      const activityItems = itemsByColumn.get(dayColumn.id) ?? []
      const roomColumn = columns.find(
        column => column.kind === 'room' && column.weekday === dayColumn.weekday
      ) ?? null
      const roomItems = roomColumn
        ? itemsByColumn.get(roomColumn.id) ?? []
        : []
      const rawActivityText = joinPreservingRows(activityItems).trim()
      const rawRoomText = joinPreservingRows(roomItems).trim()

      if (!rawActivityText) continue

      const allSourceItems = [...activityItems, ...roomItems]
      const rawText = rawRoomText
        ? `${rawActivityText}\n${rawRoomText}`
        : rawActivityText

      blocks.push({
        id: `schedule-block-${pageNumber}-${sequence += 1}`,
        timeRowId: timeRow.id,
        dayColumnId: dayColumn.id,
        roomColumnId: roomColumn?.id ?? null,
        weekday: dayColumn.weekday,
        startTime: timeRow.startTime,
        endTime: timeRow.endTime,
        rawText,
        rawActivityText,
        rawRoomText,
        rawGroupToken: '',
        rawActivityToken: '',
        sourcePage: pageNumber,
        sourceBounds: sourceBounds(allSourceItems),
        sourceItems: allSourceItems.map(item => ({ ...item })),
        type: 'unknown',
        included: true,
        confidence: {
          weekday: 'high',
          time: 'high',
          activity: 'high',
          classification: 'low',
          group: 'low',
          course: 'low'
        },
        warnings: []
      })
    }
  }

  return blocks
}

export function reconstructScheduleGridPage(
  input: ScheduleGeometryPageInput
): ScheduleGridPage {
  const usableItems = input.items.filter(
    item =>
      item.text.trim().length > 0 &&
      Number.isFinite(item.x) &&
      Number.isFinite(item.y) &&
      Number.isFinite(item.width) &&
      Number.isFinite(item.height)
  )
  const rows = groupIntoRows(usableItems)
  const header = detectHeaderRow(rows)
  const warnings: string[] = []

  if (!header) {
    warnings.push(
      `Página ${input.pageNumber}: não foi possível reconstruir com segurança as colunas dos dias.`
    )
  }

  const columns = header
    ? buildColumns(input.pageNumber, header.cells)
    : []
  const timeRows = detectTimeRows(input.pageNumber, rows)

  if (timeRows.length === 0) {
    warnings.push(
      `Página ${input.pageNumber}: não foram identificadas linhas horárias.`
    )
  }

  const blocks =
    columns.length > 0 && timeRows.length > 0
      ? buildBlocks(input.pageNumber, usableItems, columns, timeRows)
      : []

  return {
    pageNumber: input.pageNumber,
    columns,
    timeRows,
    blocks,
    warnings
  }
}

export function reconstructScheduleGridDocument(
  pages: ScheduleGeometryPageInput[]
): ScheduleGridDocument {
  const reconstructedPages = pages.map(reconstructScheduleGridPage)

  return {
    pages: reconstructedPages,
    columns: reconstructedPages.flatMap(page => page.columns),
    timeRows: reconstructedPages.flatMap(page => page.timeRows),
    blocks: reconstructedPages.flatMap(page => page.blocks),
    sourceItemCount: pages.reduce((total, page) => total + page.items.length, 0),
    warnings: reconstructedPages.flatMap(page => page.warnings)
  }
}
