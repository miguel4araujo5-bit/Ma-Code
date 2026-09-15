import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const navigationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/ProductNavigation.tsx',
    import.meta.url
  ),
  'utf8'
)

const pageActionSource = await readFile(
  new URL(
    '../../src/components/ma-professor/giae/GIAESummaryExportPageAction.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'summary export is presented inside the Sumários / GIAE page instead of as a sidebar sub-action',
  () => {
    assert.doesNotMatch(
      navigationSource,
      /onOpenSummaryExport|summaryExportOpen|openSummaryExport/
    )
    assert.match(
      navigationSource,
      /<GIAESummaryExportPageAction\s*\/>/
    )
    assert.match(
      pageActionSource,
      /textContent\?\.trim\(\) ===[\s\S]*'Sumários \/ GIAE'/
    )
    assert.match(
      pageActionSource,
      /createPortal\([\s\S]*Exportar sumários[\s\S]*actionsHost/
    )
    assert.match(
      pageActionSource,
      /<GIAESummaryExportDialog[\s\S]*open=\{exportOpen\}/
    )
  }
)
