import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const notifierSource = await readFile(
  new URL(
    '../../worker/maProfessorAccessAdminNotifier.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'MA-Professor admin notifications keep a configurable recipient',
  () => {
    assert.match(
      notifierSource,
      /MA_PROFESSOR_ADMIN_EMAIL\?:\s*string/
    )

    assert.match(
      notifierSource,
      /env\.MA_PROFESSOR_ADMIN_EMAIL/
    )

    assert.match(
      notifierSource,
      /const\s+adminEmail\s*=/
    )

    assert.match(
      notifierSource,
      /to:\s*\[\s*adminEmail\s*\]/
    )
  }
)

test(
  'MA-Professor notifier remains limited to successful pending access requests',
  () => {
    assert.match(
      notifierSource,
      /PUBLIC_REQUEST_PATH\s*=\s*\n\s*'\/api\/ma-professor\/access\/request'/
    )

    assert.match(
      notifierSource,
      /request\.method\s*!==\s*'POST'/
    )

    assert.match(
      notifierSource,
      /!response\.ok/
    )

    assert.match(
      notifierSource,
      /summary\.status\s*!==\s*'pending'/
    )

    assert.match(
      notifierSource,
      /RESEND_API_KEY_MA_PROFESSOR/
    )
  }
)
