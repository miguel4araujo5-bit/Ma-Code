import { PDFDocument } from 'pdf-lib'
import type {
  ProgressCallback,
  ResultData,
  SelectedPdf
} from '../../types/maPdf'
import { bytesToArrayBuffer } from './fileUtils'

export async function mergePdfFiles(
  selectedFiles: SelectedPdf[],
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (selectedFiles.length < 2) {
    throw new Error('Escolha pelo menos dois ficheiros PDF para juntar.')
  }

  onProgress('A ler os documentos PDF...')

  const mergedDocument = await PDFDocument.create()

  for (let index = 0; index < selectedFiles.length; index += 1) {
    const selected = selectedFiles[index]

    onProgress(
      `A adicionar ${index + 1} de ${selectedFiles.length}: ${selected.file.name}`
    )

    const bytes = await selected.file.arrayBuffer()
    const sourceDocument = await PDFDocument.load(bytes, {
      updateMetadata: false
    })

    const pageIndexes = sourceDocument.getPageIndices()
    const copiedPages = await mergedDocument.copyPages(
      sourceDocument,
      pageIndexes
    )

    copiedPages.forEach((page) => {
      mergedDocument.addPage(page)
    })
  }

  onProgress('A criar o documento final...')

  const mergedBytes = await mergedDocument.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 30
  })

  const blob = new Blob([bytesToArrayBuffer(mergedBytes)], {
    type: 'application/pdf'
  })

  const originalSize = selectedFiles.reduce(
    (total, selected) => total + selected.file.size,
    0
  )

  return {
    fileName: 'ma-pdf-documentos-juntos.pdf',
    blob,
    originalSize,
    finalSize: blob.size,
    message: `${selectedFiles.length} documentos foram unidos com sucesso.`
  }
}
