import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { HistoryBook, HistoryRow } from './giaeHistory'

GlobalWorkerOptions.workerSrc = workerUrl

type PositionedText = { text: string; x: number; y: number }
const TEACHER_CODE = /\((f\d+)\)/i
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const MARK = /(?<!\d)(\d+)\s*-\s*(\d+)\s*\(([A-Z]+)\)/gi

function parseDate(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
  if (!match) return ''
  const iso = [match[3], match[2], match[1]].join('-')
  const date = new Date(iso)
  return Number.isFinite(+date) && date.toISOString().startsWith(iso) ? iso : ''
}

function column(items: PositionedText[], from: number, to: number) {
  return items.filter(item => from <= item.x && item.x < to)
}

function lines(items: PositionedText[]) {
  const groups: PositionedText[][] = []
  for (const item of items) {
    const group = groups.at(-1)
    if (group && Math.abs(group[0].y - item.y) < 1.5) group.push(item)
    else groups.push([item])
  }
  return groups.map(group => group.sort((a, b) => a.x - b.x).map(item => item.text).join(' '))
}

function groupLabel(value: string) {
  return /^(?:Turma:\s*)?(\d{1,2}\s*\.?\s*[º°o]\s*[A-Z0-9][A-Z0-9 -]*)$/i.exec(value)?.[1] ?? ''
}

function readRows(items: PositionedText[], heading: PositionedText, group: string, page: number): HistoryRow[] {
  const footer = items.find(item => item.y >= 790 &&
    /^(?:Impresso em:|MALP\S*\s+Página\b|Página\s+\d+\s+de\b)/i.test(item.text))
  const bodyEnd = footer?.y ?? 804
  const starts = column(items, 30, 114).filter(item =>
    item.y > heading.y + 15 && item.y < bodyEnd - 3 && parseDate(item.text)
  )
  return starts.map((item, index) => {
    const end = (starts[index + 1]?.y ?? bodyEnd) - 3
    const row = items.filter(candidate => candidate.y >= item.y - 3 && candidate.y < end)
    const labels = lines(column(row, 29, 114)).slice(1)
    const numberLabel = labels.find(value => /^Lição\b/i.test(value))
    const number = numberLabel?.match(/\d+(?:\s*[-–]\s*\d+)?\s*$/)?.[0]?.trim() ?? ''
    const [subject = '', unit = ''] = labels.filter(value =>
      !groupLabel(value) && !/^Lição\b|^Adicionada$/i.test(value)
    )
    const times = column(row, 114, 151).map(value => value.text).filter(value => TIME.test(value))
    const teacherText = lines(column(row, 496.55, 570)).join(' ')
    const attendanceText = lines(column(row, 426, 496.55)).join(' ')
    return {
      page, group: labels.map(groupLabel).find(Boolean) ?? group, subject, unit,
      date: parseDate(item.text), start: times[0] ?? '', end: times[1] ?? '',
      valid: times.length === 2 && times[0] < times[1] && (!numberLabel || Boolean(number)),
      teacherId: teacherText.match(TEACHER_CODE)?.[1]?.toLowerCase() ?? '',
      teacher: teacherText.replace(TEACHER_CODE, '').trim(), number,
      summary: lines(column(row, 151, 426)).join('\n'),
      attendance: [...attendanceText.matchAll(MARK)].map(match => ({
        number: match[1], process: match[2], code: match[3].toUpperCase()
      })),
      unreadAttendance: Boolean(attendanceText.replace(MARK, '').replace(/[\s,;]+/g, ''))
    }
  })
}

export async function readGiaeHistory(file: File): Promise<HistoryBook> {
  const buffer = await file.arrayBuffer()
  const message = await crypto.subtle.digest('SHA-256', buffer)
  const hash = Array.from(new Uint8Array(message), part => part.toString(16).padStart(2, '0')).join('')
  const task = getDocument({ data: new Uint8Array(buffer) })
  try {
    const pdf = await task.promise
    const rows: HistoryRow[] = []
    const students: HistoryBook['students'] = []
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number)
      const viewport = page.getViewport({ scale: 1 })
      const scale = 595.5 / viewport.width
      const content = await page.getTextContent()
      const items = content.items.flatMap(item => {
        if (!('str' in item) || !item.str.trim()) return []
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5])
        return [{ text: item.str.replace(/\s+/g, ' ').trim(), x: x * scale, y: y * scale }]
      }).sort((a, b) => a.y - b.y || a.x - b.x)
      const group = items.filter(item => /^Turma:/i.test(item.text)).map(item => groupLabel(item.text)).find(Boolean) ?? ''
      const heading = items.find(item => item.x < 85 && /^Registo de Sumários\b/i.test(item.text))
      if (heading) rows.push(...readRows(items, heading, group, number))
      const roster = items.find(item => item.text === 'N.º Processo' && item.x >= 85 && item.x < 150)
      if (roster && group) {
        for (const item of column(items, 29, 90)) {
          if (item.y <= roster.y + 3 || item.y >= 790 || !/^\d+$/.test(item.text)) continue
          const row = items.filter(candidate => Math.abs(item.y - candidate.y) < 2)
          const process = lines(column(row, 90, 153)).join(' ')
          const name = lines(column(row, 153, 440)).join(' ')
          if (/^\d+$/.test(process) && name) students.push({ group, process, name, number: item.text })
        }
      }
      page.cleanup()
    }
    if (!rows.length) throw new Error('O ficheiro não contém um registo de sumários do GIAE reconhecível.')
    return { name: file.name, hash, rows, students }
  } finally {
    await task.destroy()
  }
}
