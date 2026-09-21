import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path =>
  readFile(
    new URL(
      `../../${path}`,
      import.meta.url
    ),
    'utf8'
  )

const [
  apiSource,
  opaqueAccessSource,
  authGateSource,
  authWorkerSource,
  privacyWorkerSource,
  requestGuardSource,
  baseAccessSource
] =
  await Promise.all([
    read(
      'src/components/ma-professor/access/accessApi.ts'
    ),
    read(
      'src/components/ma-professor/access/opaqueAccess.ts'
    ),
    read(
      'src/components/ma-professor/access/MAProfessorAuthGate.tsx'
    ),
    read(
      'worker/maProfessorAccessAuthBridge.ts'
    ),
    read(
      'worker/maProfessorPublicAuthPrivacyBridge.ts'
    ),
    read(
      'worker/maProfessorActivationCredentialGuardBridge.ts'
    ),
    read(
      'worker/maProfessorAccess.ts'
    )
  ])

test(
  'browser public APIs never send the personal password to MA-Professor endpoints',
  () => {
    assert.doesNotMatch(
      apiSource,
      /accountPassword/
    )

    assert.doesNotMatch(
      apiSource,
      /export async function loginMAProfessorAccess/
    )

    const request =
      apiSource.match(
        /export async function submitMAProfessorAccessRequest[\s\S]*?\n}\n/
      )?.[0] ?? ''

    assert.match(
      request,
      /email/
    )
    assert.doesNotMatch(
      request,
      /\bpassword\b/i
    )

    const enrollStart =
      apiSource.match(
        /export async function startMAProfessorOpaqueEnrollment[\s\S]*?\n}\n/
      )?.[0] ?? ''

    assert.match(
      enrollStart,
      /activationPassword/
    )
    assert.doesNotMatch(
      enrollStart,
      /(^|[^A-Za-z])password([^A-Za-z]|$)/
    )

    const loginStart =
      apiSource.match(
        /export async function startMAProfessorOpaqueLogin[\s\S]*?\n}\n/
      )?.[0] ?? ''

    const loginFinish =
      apiSource.match(
        /export async function finishMAProfessorOpaqueLogin[\s\S]*?\n}\n/
      )?.[0] ?? ''

    assert.doesNotMatch(
      loginStart,
      /\bpassword\b/i
    )
    assert.doesNotMatch(
      loginFinish,
      /\bpassword\b/i
    )
  }
)

test(
  'personal password is consumed only by the browser OPAQUE adapter',
  () => {
    assert.match(
      opaqueAccessSource,
      /startMAProfessorOpaqueClientRegistration\(\s*password\s*\)/
    )
    assert.match(
      opaqueAccessSource,
      /finishMAProfessorOpaqueClientRegistration\(\s*password,/
    )
    assert.match(
      opaqueAccessSource,
      /startMAProfessorOpaqueClientLogin\(\s*password\s*\)/
    )
    assert.match(
      opaqueAccessSource,
      /finishMAProfessorOpaqueClientLogin\(\s*password,/
    )

    assert.match(
      opaqueAccessSource,
      /startMAProfessorOpaqueEnrollment\(\s*email,\s*activationPassword,\s*deviceId,/
    )

    assert.doesNotMatch(
      opaqueAccessSource,
      /loginMAProfessorAccess|enrollMAProfessorOpaqueFromLegacySession/
    )
  }
)

test(
  'onboarding creates the personal password only after approval during protected activation',
  () => {
    const requestHandler =
      authGateSource.match(
        /const handleRequest =[\s\S]*?const handleLogin =/
      )?.[0] ?? ''

    assert.match(
      requestHandler,
      /submitMAProfessorAccessRequest\(\s*normalizedEmail\s*\)/
    )
    assert.doesNotMatch(
      requestHandler,
      /personalPassword/
    )

    const activationHandler =
      authGateSource.match(
        /const handleActivation =[\s\S]*?if \(mode === 'intro'\)/
      )?.[0] ?? ''

    assert.match(
      activationHandler,
      /enrollMAProfessorOpaqueForActivation\(\s*normalizedEmail,\s*personalPassword,\s*activationPassword\.trim\(\),\s*deviceId/
    )
  }
)

test(
  'Worker rejects legacy password-bearing account flows and has no personal-password login verifier',
  () => {
    assert.doesNotMatch(
      authWorkerSource,
      /private async handleLogin\(/
    )

    assert.match(
      authWorkerSource,
      /O login legado foi descontinuado\. Utilize o login protegido\./
    )

    assert.match(
      authWorkerSource,
      /'accountPassword' in\s*requestBody/
    )

    assert.match(
      authWorkerSource,
      /O fluxo antigo de password pessoal foi descontinuado/
    )

    assert.doesNotMatch(
      authWorkerSource,
      /ma-professor-account-auth-v1/
    )
  }
)

test(
  'Worker OPAQUE enrollment uses only the MP activation secret as server-side authorization',
  () => {
    const validator =
      authWorkerSource.match(
        /private async validateOpaqueEnrollmentActivation[\s\S]*?\n  }\n\n  private async handleOpaqueEnrollmentStart/
      )?.[0] ?? ''

    assert.match(
      validator,
      /body\.activationPassword/
    )
    assert.doesNotMatch(
      validator,
      /body\.password|accountPassword/
    )

    assert.doesNotMatch(
      privacyWorkerSource,
      /body\?\.password|ACCOUNT_AUTH_STORAGE_KEY/
    )

    assert.doesNotMatch(
      baseAccessSource,
      /body\.password/
    )

    assert.match(
      baseAccessSource,
      /body\.activationPassword/
    )
  }
)

test(
  'email-only access request is delegated while old accountPassword requests are rejected',
  () => {
    const method =
      requestGuardSource.match(
        /private async handlePublicAccessRequest[\s\S]*?\n  }\n\n  private async handleRequest/
      )?.[0] ?? ''

    assert.match(
      method,
      /'accountPassword' in\s*body/
    )
    assert.match(
      method,
      /await this\.existing\.fetch\(\s*request\s*\)/
    )
    assert.match(
      method,
      /createGenericAccessRequestResponse\(\s*email\s*\)/
    )
  }
)
