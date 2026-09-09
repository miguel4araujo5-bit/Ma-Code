import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const extractorSource =
  await readFile(
    new URL(
      '../../src/components/ma-professor/planifications/planificationPdfExtractor.ts',
      import.meta.url
    ),
    'utf8'
  )

test(
  'PDF planification extraction avoids the Safari 26 ReadableStream async-iterator failure',
  () => {
    assert.match(
      extractorSource,
      /streamTextContent\(\)[\s\S]*?\.getReader\(\)/,
      'A extração deve consumir o stream de texto através de getReader().' 
    )

    assert.doesNotMatch(
      extractorSource,
      /\.getTextContent\s*\(/,
      'pdfjs-dist 6.1.200 getTextContent() falha no Safari 26.x porque usa o iterador assíncrono do ReadableStream.'
    )

    assert.doesNotMatch(
      extractorSource,
      /for\s+await\s*\(/,
      'O caminho de extração não deve depender de ReadableStream[Symbol.asyncIterator].'
    )

    assert.match(
      extractorSource,
      /reader\.releaseLock\(\)/,
      'O reader do stream deve libertar o lock mesmo em caso de erro.'
    )
  }
)
