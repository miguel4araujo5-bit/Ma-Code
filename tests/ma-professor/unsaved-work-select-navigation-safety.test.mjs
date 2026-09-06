import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/navigation/useUnsavedWorkspaceProtection.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'unsaved-work protection handles external select changes in capture phase',
  () => {
    assert.match(
      source,
      /document\.addEventListener\(\s*'change',\s*handleExternalChange,\s*true\s*\)/
    )
    assert.match(
      source,
      /document\.removeEventListener\(\s*'change',\s*handleExternalChange,\s*true\s*\)/
    )
  }
)

test(
  'external select interaction is not confirmed twice by click and change handlers',
  () => {
    assert.match(source, /function getSelectInteractionTarget/)
    assert.match(
      source,
      /handleExternalClick[\s\S]*getSelectInteractionTarget\(\s*target\s*\)[\s\S]*return/
    )
  }
)

test(
  'cancelled external select navigation restores the previous value and blocks propagation',
  () => {
    assert.match(source, /previousSelectValues/)
    assert.match(source, /document\.addEventListener\(\s*'pointerdown'/)
    assert.match(source, /document\.addEventListener\(\s*'keydown'/)
    assert.match(source, /document\.addEventListener\(\s*'focusin'/)
    assert.match(
      source,
      /handleExternalChange[\s\S]*window\.confirm\(\s*message\s*\)[\s\S]*previousSelectValues\.get\(\s*select\s*\)[\s\S]*select\.value\s*=\s*previousValue[\s\S]*event\.preventDefault\(\)[\s\S]*event\.stopImmediatePropagation\(\)/
    )
  }
)
