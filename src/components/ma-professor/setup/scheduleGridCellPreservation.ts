import type {
  ScheduleFieldConfidence,
  ScheduleGeometryPageInput,
  ScheduleGeometryTextItem,
  ScheduleGridColumn,
  ScheduleGridDocument,
  ScheduleGridPage,
  ScheduleGridTimeRow,
  ScheduleGridWeekday,
  ScheduleImportBlock
} from './scheduleGridGeometry'

type DayRoomPair = {
  day: ScheduleGridColumn & { weekday: ScheduleGridWeekday }
  room: ScheduleGridColumn | null
  leftBoundary: number
  rightBoundary: number
}

function itemCenterX(item: ScheduleGeometryTextItem) {
  return item.x + Math.max(0, item.width) / 2
}

function itemCenterY(item: ScheduleGeometryTextItem) {
  return item.y + Math.max(0, item.height) / 2
}

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim()
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

  return clean(result)
}

function median(values: number[]) {
  if (values.length === 0) return 0

  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)

  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle]
}

function joinPreservingRows(items: ScheduleGeometryTextItem[]) {
  if (items.length === 0) return ''

  const typicalHeight = median(
    items.map(item => item.height).filter(value => value > 0)
  ) || 10
  const tolerance = Math.max(2, typicalHeight * 0.45)
  const ordered = [...items].sort((left, right) => {
    const vertical = right.y - left.y
    return Math.abs(vertical) > tolerance
      ? vertical
      : left.x - right.x
  })
  const rows: Array<{
    y: number
    items: ScheduleGeometryTextItem[]
  }> = []

  for (const item of ordered) {
    const current = rows[rows.length - 1]

    if (!current || Math.abs(current.y - item.y) > tolerance) {
      rows.push({ y: item.y, items: [item] })
      continue
    }

    current.items.push(item)
    current.y = current.items.reduce(
      (total, rowItem) => total + rowItem.y,
      0
    ) / current.items.length
  }

  return rows
    .map(row => joinInline(row.items))
    .filter(Boolean)
    .join('\n')
}

function sourceBounds(items: ScheduleGeometryTextItem[]) {
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

function dayRoomPairs(columns: ScheduleGridColumn[]): DayRoomPair[] {
  return columns
    .filter(
      (column): column is ScheduleGridColumn & { weekday: ScheduleGridWeekday } =>
        column.kind === 'day' && column.weekday !== null
    )
    .map(day => {
      const room = columns.find(
        column =>
          column.kind === 'room' &&
          column.weekday === day.weekday
      ) ?? null

      return {
        day,
        room,
        leftBoundary: day.leftBoundary,
        rightBoundary: room?.rightBoundary ?? day.rightBoundary
      }
    })
}

function rowItems(
  row: ScheduleGridTimeRow,
  sourceItems: ScheduleGeometryTextItem[],
  minimumGridX: number,
  maximumGridX: number
) {
  return sourceItems.filter(item => {
    const centerY = itemCenterY(item)
    const centerX = itemCenterX(item)

    return (
      centerY <= row.upperBoundaryY + Math.max(1, item.height * 0.6) &&
      centerY > row.lowerBoundaryY - Math.max(1, item.height * 0.6) &&
      centerX >= minimumGridX &&
      centerX < maximumGridX
    )
  })
}

function fieldConfidence(
  hasActivity: boolean,
  hasRoom: boolean
): {
  activity: ScheduleFieldConfidence
  classification: ScheduleFieldConfidence
} {
  return {
    activity: hasActivity ? 'high' : hasRoom ? 'low' : 'low',
    classification: 'low'
  }
}

function rebuildPageBlocks(
  page: ScheduleGridPage,
  sourcePage: ScheduleGeometryPageInput
): ScheduleImportBlock[] {
  const pairs = dayRoomPairs(page.columns)

  if (pairs.length === 0 || page.timeRows.length === 0) {
    return page.blocks
  }

  const minimumGridX = Math.min(...pairs.map(pair => pair.leftBoundary))
  const maximumGridX = Math.max(...pairs.map(pair => pair.rightBoundary))
  const blocks: ScheduleImportBlock[] = []
  let sequence = 0

  for (const timeRow of page.timeRows) {
    const itemsInRow = rowItems(
      timeRow,
      sourcePage.items,
      minimumGridX,
      maximumGridX
    )

    for (const pair of pairs) {
      const pairItems = itemsInRow.filter(item => {
        const centerX = itemCenterX(item)
        return centerX >= pair.leftBoundary && centerX < pair.rightBoundary
      })

      if (pairItems.length === 0) continue

      const roomBoundary = pair.room?.leftBoundary ?? Number.POSITIVE_INFINITY
      const activityItems = pairItems.filter(
        item => item.x < roomBoundary
      )
      const roomItems = pair.room
        ? pairItems.filter(item => item.x >= roomBoundary)
        : []
      const rawActivityText = joinPreservingRows(activityItems).trim()
      const rawRoomText = joinPreservingRows(roomItems).trim()

      // A célula continua a existir mesmo quando só conseguimos ver conteúdo
      // na subcoluna de sala. A interpretação posterior decide se é aula,
      // cargo ou unknown; a geometria nunca a apaga.
      if (!rawActivityText && !rawRoomText) continue

      const allSourceItems = [...activityItems, ...roomItems]
      const rawText = rawRoomText
        ? `${rawActivityText}${rawActivityText ? '\n' : ''}${rawRoomText}`
        : rawActivityText
      const confidence = fieldConfidence(
        Boolean(rawActivityText),
        Boolean(rawRoomText)
      )

      blocks.push({
        id: `schedule-pair-block-${page.pageNumber}-${sequence += 1}`,
        timeRowId: timeRow.id,
        dayColumnId: pair.day.id,
        roomColumnId: pair.room?.id ?? null,
        weekday: pair.day.weekday,
        startTime: timeRow.startTime,
        endTime: timeRow.endTime,
        rawText,
        rawActivityText,
        rawRoomText,
        rawGroupToken: '',
        rawActivityToken: '',
        sourcePage: page.pageNumber,
        sourceBounds: sourceBounds(allSourceItems),
        sourceItems: allSourceItems.map(item => ({ ...item })),
        type: 'unknown',
        included: true,
        confidence: {
          weekday: 'high',
          time: 'high',
          activity: confidence.activity,
          classification: confidence.classification,
          group: 'low',
          course: 'low'
        },
        warnings: rawActivityText
          ? []
          : [
              'Foi detetado conteúdo nesta célula do horário, mas a atividade não ficou separada da sala. O bloco foi preservado para revisão.'
            ]
      })
    }
  }

  return blocks
}

export function preserveScheduleGridCells(
  grid: ScheduleGridDocument,
  sourcePages: ScheduleGeometryPageInput[]
): ScheduleGridDocument {
  const sourceByPage = new Map(
    sourcePages.map(page => [page.pageNumber, page])
  )
  const pages = grid.pages.map(page => {
    const sourcePage = sourceByPage.get(page.pageNumber)

    if (!sourcePage) return page

    const rebuiltBlocks = rebuildPageBlocks(page, sourcePage)

    return {
      ...page,
      blocks: rebuiltBlocks.length > 0
        ? rebuiltBlocks
        : page.blocks
    }
  })

  return {
    ...grid,
    pages,
    blocks: pages.flatMap(page => page.blocks)
  }
}
