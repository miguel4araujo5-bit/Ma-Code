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

test(
  'schedule PDF import treats an extracted proposal as unsaved work',
  () => {
    assert.match(
      source,
      /const hasProposal =\s*drafts\.length > 0 \|\|\s*duties\.length > 0/
    )
  }
)

test(
  'schedule PDF import protects browser close and navigation away while a proposal is pending',
  () => {
    assert.match(source, /rootRef/)
    assert.match(source, /useMAProfessorUnsavedWorkspaceProtection/)
    assert.match(
      source,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasProposal[\s\S]*rootRef/
    )
    assert.match(source, /ref=\{rootRef\}/)
  }
)

test(
  'schedule PDF import asks before discarding an extracted proposal',
  () => {
    assert.match(source, /function requestContinueWithoutPdf\(\)/)
    assert.match(
      source,
      /function requestContinueWithoutPdf\(\)[\s\S]*if \(!hasProposal\)[\s\S]*onContinueWithoutPdf\(\)[\s\S]*return/
    )
    assert.match(
      source,
      /function requestContinueWithoutPdf\(\)[\s\S]*window\.confirm\([\s\S]*UNSAVED_SCHEDULE_IMPORT_MESSAGE[\s\S]*\)[\s\S]*onContinueWithoutPdf\(\)/
    )
    assert.doesNotMatch(
      source,
      /onClick=\{onContinueWithoutPdf\}/
    )
    assert.match(
      source,
      /onClick=\{requestContinueWithoutPdf\}/
    )
  }
)
