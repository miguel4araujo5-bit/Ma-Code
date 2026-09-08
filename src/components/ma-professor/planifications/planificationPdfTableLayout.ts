import type { PlanificationPdfLine } from './planificationPdfParser'
import type { PlanificationPdfTextItem } from './planificationPdfExtractor'

export type PdfRuleBox = [number, number, number, number]
const unique = (values: number[]) => values.sort((a, b) => a - b)
  .filter((value, index, sorted) => !index || value - sorted[index - 1] > 1)

function textInCell(items: PlanificationPdfTextItem[]) {
  const rows: Array<{ y: number; items: PlanificationPdfTextItem[] }> = []
  for (const item of [...items].sort((a, b) => b.transform[5] - a.transform[5])) {
    const row = rows.find(row => Math.abs(row.y - item.transform[5]) < 1)
    if (row) row.items.push(item)
    else rows.push({ y: item.transform[5], items: [item] })
  }
  return rows.map(row => {
    const sorted = row.items.sort((a, b) => a.transform[4] - b.transform[4])
    return sorted.map((item, i) => {
      const previous = sorted[i - 1]
      const gap = previous ? item.transform[4] - previous.transform[4] - previous.width : 0
      return (gap > 1 && previous && !/\s$/.test(previous.str) ? ' ' : '') + item.str
    }).join('').trim()
  }).filter(Boolean).join('\n')
}

/**
 * Read actual ruled cells, rather than assigning vertically centred cell text
 * to whichever UFCD happens to precede it in text-stream order.
 * Unrecognised geometry falls back to the existing text extractor.
 */
export function readRuledPlanificationTable(
  items: PlanificationPdfTextItem[],
  rules: PdfRuleBox[],
  precedingTableRecognized = false
): PlanificationPdfLine[] | null {
  const vertical = rules.filter(([x1, y1, x2, y2]) => Math.abs(x2 - x1) < 1 && y2 - y1 > 25)
  const horizontal = rules.filter(([x1, y1, x2, y2]) => Math.abs(y2 - y1) < 1 && x2 - x1 > 250)
  const ys = unique(horizontal.map(box => box[1])).reverse()
  const lines: PlanificationPdfLine[] = []
  let recognized = precedingTableRecognized
  let hasCells = false
  const makeLine = (cells: string[]) => ({
    text: cells.join(' '), cells,
    positionedCells: cells.map((text, index) => ({ text, x: index * 100, width: 80 }))
  })
  if (precedingTableRecognized) lines.push(makeLine(['Período Letivo', 'UFCD', 'Temas/Conteúdos',
    'Objetivos/Competências', 'Estratégias/Metodologias', 'Aulas previstas']))
  for (let i = 0; i < ys.length - 1; i++) {
    const top = ys[i], bottom = ys[i + 1], middle = (top + bottom) / 2
    const xs = unique(vertical.filter(box => box[1] <= middle && box[3] >= middle).map(box => box[0]))
    const band = items.filter(item => item.transform[5] < top && item.transform[5] > bottom && item.str.trim())
    if (xs.length === 7) {
      hasCells = true
      const cells = xs.slice(0, -1).map((left, index) => textInCell(
        band.filter(item => item.transform[4] >= left - 1 && item.transform[4] < xs[index + 1] - 1)
      ))
      if (/UFCD/i.test(cells[1]) && /temas|conte[úu]dos/i.test(cells[2])) {
        recognized = true
        lines.push(makeLine(['Período Letivo', 'UFCD', 'Temas/Conteúdos',
          'Objetivos/Competências', 'Estratégias/Metodologias',
          'Aulas previstas ' + (cells[5].replace(/\s+/g, ' ').match(/\(\s*\d+\s*min\s*\)/i)?.[0] ?? '')]))
      } else if (cells.some(Boolean)) {
        lines.push(makeLine(cells))
      }
    } else if (band.some(item => /^avalia[çc][ãa]o$/i.test(item.str.trim()))) {
      const evaluation = textInCell(band.filter(item => !/^avalia[çc][ãa]o$/i.test(item.str.trim())))
      lines.push(makeLine(['Avaliação', evaluation]))
    }
  }
  if (!recognized || !hasCells) return null
  // Keep title metadata outside the table, without inventing a discipline.
  const titles = items.filter(item => /planifica[çc][ãa]o de|curso profissional/i.test(item.str))
  return [...titles.map(item => makeLine([item.str])), ...lines]
}
