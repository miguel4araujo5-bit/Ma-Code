import type {
  ProgressCallback,
  ResultData,
  SelectedPdf
} from '../../types/maPdf'

import { sanitizeFileName } from './fileUtils'
import { extractTextFromPdf } from './extractPdfText'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function createDocHtml(
  pages: Array<{
    pageNumber: number
    lines: Array<{ text: string }>
  }>
) {
  const pageMarkup = pages
    .map((page, index) => {
      const paragraphs = page.lines.length
        ? page.lines
            .map(
              (line) =>
                `<p>${
                  escapeHtml(line.text) || '&nbsp;'
                }</p>`
            )
            .join('\n')
        : '<p>&nbsp;</p>'

      return `<section class="pdf-page${
        index > 0 ? ' page-break' : ''
      }" data-page="${page.pageNumber}">
${paragraphs}
</section>`
    })
    .join('\n')

  return `<!doctype html>
<html
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:w="urn:schemas-microsoft-com:office:word"
  lang="pt-PT"
>
<head>
  <meta charset="utf-8" />
  <meta
    name="ProgId"
    content="Word.Document"
  />
  <meta
    name="Generator"
    content="MA PDF - MA-Code.pt"
  />
  <title>Documento convertido pelo MA PDF</title>

  <style>
    @page {
      size: A4;
      margin: 2.5cm;
    }

    body {
      font-family: Aptos, Calibri, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.35;
      color: #111827;
    }

    p {
      margin: 0 0 8pt 0;
      white-space: pre-wrap;
    }

    .pdf-page {
      width: 100%;
    }

    .page-break {
      page-break-before: always;
    }
  </style>
</head>

<body>
${pageMarkup}
</body>
</html>`
}

export async function convertPdfToDoc(
  selected: SelectedPdf | undefined,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error(
      'Escolha um ficheiro PDF para converter para DOC.'
    )
  }

  const extracted = await extractTextFromPdf(
    selected,
    onProgress
  )

  onProgress(
    'A criar o ficheiro DOC editável...'
  )

  const html = createDocHtml(extracted.pages)

  const blob = new Blob(
    [`\ufeff${html}`],
    {
      type: 'application/msword;charset=utf-8'
    }
  )

  const baseName = sanitizeFileName(
    selected.file.name
  )

  return {
    fileName: `${baseName}-convertido.doc`,
    blob,
    originalSize: selected.file.size,
    finalSize: blob.size,
    message: `${extracted.pageCount} página${
      extracted.pageCount === 1 ? '' : 's'
    } foram convertidas para DOC. O ficheiro contém o texto selecionável do PDF e pode ser editado no Word ou numa aplicação compatível.`
  }
}
