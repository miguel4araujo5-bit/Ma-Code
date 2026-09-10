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

const sharedExtractor = await readFile(
  new URL(
    '../../src/lib/maPdf/extractPdfText.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'schedule import prefers neutral geometry and semantic interpretation before the legacy parser',
  () => {
    assert.match(
      source,
      /extractScheduleGridAnalysisFromPdf\(\s*file,\s*setProgress\s*\)/s
    )
    assert.match(
      source,
      /interpretScheduleGridDocument\(\s*analysis\.grid,\s*analysis\.sourcePages,\s*settings\.defaultPeriodMinutes\s*\)/s
    )
    assert.match(
      source,
      /if \(!proposal && !geometryCapturedBlocks\) \{[\s\S]*extractTextFromPdf/
    )
  }
)

test(
  'captured but unresolved geometry blocks are reported instead of being forced through the legacy duty heuristic',
  () => {
    assert.match(
      source,
      /unknownBlockCount\s*=\s*interpreted\.unknownBlocks\.length/
    )
    assert.match(
      source,
      /ficou\$\{unknownBlockCount === 1 \? '' : 'aram'\} por identificar/
    )
    assert.match(
      source,
      /não os classificou à força como aulas ou cargos/
    )
  }
)

test(
  'the shared MA-PDF extractor remains untouched by the new schedule-specific integration contract',
  () => {
    assert.match(sharedExtractor, /function extractCompactTimetableLesson/)
    assert.match(sharedExtractor, /export async function extractTextFromPdf/)
    assert.doesNotMatch(
      sharedExtractor,
      /scheduleGridSemanticInterpretation|extractScheduleGridAnalysisFromPdf/
    )
  }
)
