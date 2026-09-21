import assert from 'node:assert/strict'
import {
  readFile
} from 'node:fs/promises'
import test from 'node:test'

const source =
  await readFile(
    new URL(
      '../../worker/maProfessorAccountSessionBridge.ts',
      import.meta.url
    ),
    'utf8'
  )

test(
  'OPAQUE finish reuses the exact account-session fallback used by v2 login',
  () => {
    assert.match(
      source,
      /const PUBLIC_LOGIN_PATH =\s*'\/api\/ma-professor\/access\/login'/
    )

    assert.match(
      source,
      /const PUBLIC_OPAQUE_LOGIN_FINISH_PATH =\s*'\/api\/ma-professor\/access\/opaque\/login\/finish'/
    )

    assert.match(
      source,
      /pathname ===\s*PUBLIC_LOGIN_PATH\s*\|\|\s*pathname ===\s*PUBLIC_OPAQUE_LOGIN_FINISH_PATH\s*\) \{\s*return this\.handleLogin\(request\)/
    )

    assert.match(
      source,
      /licenseOnlyLoginMessages\.has\(\s*message\s*\)/
    )

    assert.match(
      source,
      /return this\.issueAccountSession\(\s*email,\s*deviceId,\s*accessState\s*\)/
    )
  }
)
