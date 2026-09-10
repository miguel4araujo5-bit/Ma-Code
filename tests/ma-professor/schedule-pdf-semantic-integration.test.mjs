import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SchedulePdfImportStep.tsx',
    import.meta.url
  ),
  'utf8'
)

const semanticSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleGridSemanticInterpretation.ts',
    import.meta.url
  ),
  'utf8'
)

const sharedExtractor = await readFile(
  new URL(
    '../../src/lib/maPdf/extractPdfText.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'schedule import keeps the proven legacy parser as the production path while geometry returns to shadow mode',
  () => {
    assert.doesNotMatch(
      source,
      /extractScheduleGridAnalysisFromPdf|interpretScheduleGridDocument/
    )
    assert.match(
      source,
      /extractTextFromPdf\(\s*\{[\s\S]*file[\s\S]*\},\s*setProgress\s*\)/
    )
    assert.match(
      source,
      /const proposal\s*=\s*parsePages\(\s*extracted\.pages,\s*settings\.defaultPeriodMinutes\s*\)/s
    )
  }
)

test(
  'the experimental semantic layer still preserves unknown as a first-class result without driving production import',
  () => {
    assert.match(
      semanticSource,
      /unknownBlocks:\s*ScheduleSemanticUnknown\[\]/
    )
    assert.match(
      semanticSource,
      /unknownBlocks\.push\(/
    )
    assert.match(
      semanticSource,
      /não há evidência suficiente para o classificar automaticamente como aula ou cargo/
    )
  }
)

test(
  'the shared MA-PDF extractor remains untouched by schedule shadow experiments',
  () => {
    assert.match(sharedExtractor, /function extractCompactTimetableLesson/)
    assert.match(sharedExtractor, /export async function extractTextFromPdf/)
    assert.doesNotMatch(
      sharedExtractor,
      /scheduleGridSemanticInterpretation|extractScheduleGridAnalysisFromPdf/
    )
  }
)
