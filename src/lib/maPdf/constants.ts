import type { ToolAccent } from '../../types/maPdf'

export const siteUrl = 'https://ma-code.pt'

export const MBWAY_NUMBER = '936840619'

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024

export const MAX_JPG_CANVAS_DIMENSION = 8192

export const MAX_JPG_CANVAS_PIXELS = 32_000_000

export const accentClasses: Record<ToolAccent, string> = {
  cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 shadow-cyan-950/30',
  blue: 'border-sky-300/25 bg-sky-400/10 text-sky-100 shadow-sky-950/30',
  violet:
    'border-violet-300/25 bg-violet-400/10 text-violet-100 shadow-violet-950/30',
  emerald:
    'border-emerald-300/25 bg-emerald-400/10 text-emerald-100 shadow-emerald-950/30',
  amber:
    'border-amber-300/25 bg-amber-400/10 text-amber-100 shadow-amber-950/30',
  orange:
    'border-orange-300/25 bg-orange-400/10 text-orange-100 shadow-orange-950/30'
}
