export type MAQuadroCanvasJson = Record<string, unknown>

export type MAQuadroBrandColor = {
  name: string
  value: string
}

export type MAQuadroBrandFont = {
  name: string
  family: string
  fallback?: string
}

export type MAQuadroBrand = {
  name: string
  colors: MAQuadroBrandColor[]
  fonts: MAQuadroBrandFont[]
}

export type MAQuadroCanvasPreset = {
  id: string
  name: string
  description: string
  width: number
  height: number
}

export type MAQuadroDesign = {
  id: string
  name: string
  width: number
  height: number
  backgroundColor: string
  transparentBackground: boolean
  canvasJson: MAQuadroCanvasJson
  thumbnail?: string
  isStarter: boolean
  createdAt: string
  updatedAt: string
}

export type MAQuadroStoredFont = {
  id: string
  family: string
  fileName: string
  mimeType: string
  data: ArrayBuffer
  createdAt: string
}

export type MAQuadroHistorySnapshot = {
  backgroundColor: string
  transparentBackground: boolean
  canvasJson: MAQuadroCanvasJson
}

export type MAQuadroExportScale = 1 | 2
