import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'

const sourceUrl = new URL(
  './browser-cloud-restore-v2.e2e.mjs',
  import.meta.url
)

const generatedUrl = new URL(
  './browser-cloud-restore-webkit.generated.mjs',
  import.meta.url
)

const source = await readFile(
  sourceUrl,
  'utf8'
)

const webkitSource = source
  .replace(
    "import { chromium } from 'playwright'",
    "import { webkit } from 'playwright'"
  )
  .replace(
    'const PORT = 4176',
    'const PORT = 4177'
  )
  .replace(
    'browser = await chromium.launch({ headless: true })',
    'browser = await webkit.launch({ headless: true })'
  )
  .replace(
    'MA-Professor mobile cloud restore E2E v2: OK',
    'MA-Professor mobile cloud restore WebKit E2E: OK'
  )

assert.notEqual(
  webkitSource,
  source,
  'O cenário WebKit tem de substituir o motor Chromium.'
)

await writeFile(
  generatedUrl,
  webkitSource,
  'utf8'
)

try {
  const result = spawnSync(
    process.execPath,
    [generatedUrl.pathname],
    {
      stdio: 'inherit',
      encoding: 'utf8'
    }
  )

  if (result.error) {
    throw result.error
  }

  assert.equal(
    result.status,
    0,
    `O cenário WebKit terminou com código ${result.status}.`
  )
} finally {
  await rm(
    generatedUrl,
    {
      force: true
    }
  )
}
