import assert from 'node:assert/strict'
import {
  readFile
} from 'node:fs/promises'
import test from 'node:test'

const source =
  await readFile(
    new URL(
      '../../worker/maProfessorLoginAttemptGuardBridge.ts',
      import.meta.url
    ),
    'utf8'
  )

test(
  'OPAQUE login finish is protected by the same failed-login guard as v2 login',
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
      /url\.pathname ===\s*PUBLIC_LOGIN_PATH\s*\|\|\s*url\.pathname ===\s*PUBLIC_OPAQUE_LOGIN_FINISH_PATH/
    )

    assert.match(
      source,
      /recordFailedAttempt\(\s*guardState,\s*originKey,\s*LOGIN_GUARD_MAX_ORIGIN_FAILURES/
    )

    assert.match(
      source,
      /recordFailedAttempt\(\s*guardState,\s*pairKey,\s*LOGIN_GUARD_MAX_PAIR_FAILURES/
    )
  }
)
