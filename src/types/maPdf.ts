export type ToolAccent =
  | 'cyan'
  | 'blue'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'orange'

export type ActiveTool =
  | 'merge'
  | 'split'
  | 'compress'
  | 'pdfToJpg'
  | 'jpgToPdf'
  | 'watermark'
  | 'sign'

export type PdfTool = {
  id: string
  title: string
  description: string
  badge: string
  accent: ToolAccent
  activeTool?: ActiveTool
  available: boolean
}

export type SelectedPdf = {
  id: string
  file: File
}

export type ResultData = {
  fileName: string
  blob: Blob
  originalSize?: number
  finalSize?: number
  message: string
}

export type SplitMode =
  | 'ranges'
  | 'individual'

export type JpgQuality =
  | 'standard'
  | 'high'

export type ProgressCallback = (
  message: string
) => void
