import { PDFDocument } from 'pdf-lib'

import type {
  ProgressCallback,
  ResultData,
  SelectedPdf
} from '../../types/maPdf'

import { bytesToArrayBuffer } from './fileUtils'

const A4_SHORT_SIDE = 595.28
const A4_LONG_SIDE = 841.89
const PAGE_MARGIN = 24

export async function convertJpgToPdf(
  selectedFiles: SelectedPdf[],
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (selectedFiles.length === 0) {
    throw new Error('Escolha pelo menos uma imagem JPG para converter.')
  }

  onProgress('A preparar o documento PDF...')

  const pdfDocument = await PDFDocument.create()

  pdfDocument.setTitle('Imagens convertidas para PDF')
  pdfDocument.setAuthor('MA-Code')
  pdfDocument.setCreator('MA PDF - MA-Code.pt')
  pdfDocument.setProducer('MA PDF - MA-Code.pt')

  for (let index = 0; index < selectedFiles.length; index += 1) {
    const selected = selectedFiles[index]

    onProgress(
      `A adicionar imagem ${index + 1} de ${selectedFiles.length}: ${selected.file.name}`
    )

    const imageBytes = await selected.file.arrayBuffer()
    const image = await pdfDocument.embedJpg(imageBytes)
    const imageSize = image.size()

    const isLandscape = imageSize.width > imageSize.height

    const pageWidth = isLandscape
      ? A4_LONG_SIDE
      : A4_SHORT_SIDE

    const pageHeight = isLandscape
      ? A4_SHORT_SIDE
      : A4_LONG_SIDE

    const availableWidth = pageWidth - PAGE_MARGIN * 2
    const availableHeight = pageHeight - PAGE_MARGIN * 2

    const scale = Math.min(
      availableWidth / imageSize.width,
      availableHeight / imageSize.height
    )

    const drawWidth = imageSize.width * scale
    const drawHeight = imageSize.height * scale

    const page = pdfDocument.addPage([
      pageWidth,
      pageHeight
    ])

    page.drawImage(image, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight
    })
  }

  onProgress('A criar o documento PDF final...')

  const pdfBytes = await pdfDocument.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 20
  })

  const blob = new Blob(
    [bytesToArrayBuffer(pdfBytes)],
    {
      type: 'application/pdf'
    }
  )

  const originalSize = selectedFiles.reduce(
    (total, selected) => total + selected.file.size,
    0
  )

  return {
    fileName: 'ma-pdf-imagens.pdf',
    blob,
    originalSize,
    finalSize: blob.size,
    message: `${selectedFiles.length} imagem${
      selectedFiles.length === 1 ? '' : 'ns'
    } JPG ${
      selectedFiles.length === 1
        ? 'foi convertida'
        : 'foram convertidas'
    } num único PDF.`
  }
}
