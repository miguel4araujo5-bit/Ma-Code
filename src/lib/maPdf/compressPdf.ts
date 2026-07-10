import { PDFDocument } from 'pdf-lib'
import type {
  ProgressCallback,
  ResultData,
  SelectedPdf
} from '../../types/maPdf'
import { bytesToArrayBuffer, sanitizeFileName } from './fileUtils'

export async function compressPdfFile(
  selected: SelectedPdf | undefined,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error('Escolha um ficheiro PDF para otimizar.')
  }

  onProgress('A analisar e reorganizar o documento PDF...')

  const bytes = await selected.file.arrayBuffer()
  const sourceDocument = await PDFDocument.load(bytes, {
    updateMetadata: false
  })

  /*
   * Esta operação reorganiza os objetos internos e ativa object streams.
   * PDFs compostos sobretudo por imagens já comprimidas podem não ficar
   * significativamente menores sem reduzir a resolução das imagens.
   */
  const optimizedBytes = await sourceDocument.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 20
  })

  const optimizedBlob = new Blob(
    [bytesToArrayBuffer(optimizedBytes)],
    {
      type: 'application/pdf'
    }
  )

  const baseName = sanitizeFileName(selected.file.name)
  const reduced = optimizedBlob.size < selected.file.size

  return {
    fileName: `${baseName}-otimizado.pdf`,
    blob: optimizedBlob,
    originalSize: selected.file.size,
    finalSize: optimizedBlob.size,
    message: reduced
      ? 'O PDF foi reorganizado e o tamanho foi reduzido.'
      : 'O PDF foi reorganizado, mas já estava comprimido e não foi possível reduzir significativamente o tamanho.'
  }
}
