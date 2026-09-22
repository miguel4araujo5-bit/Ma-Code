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
  baseAccessSource,
  backupPreferenceSource,
  setupConfirmationSource,
  founderOfferSource,
  adminMaintenanceSource
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
    ),
    read(
      'src/components/ma-professor/sync/cloudBackupPreference.ts'
    ),
    read(
      'src/components/ma-professor/setup/SetupConfirmationStep.tsx'
    ),
    read(
      'src/components/ma-professor/access/FounderAccessOffer.tsx'
    ),
    read(
      'src/components/admin/ma-professor/MAProfessorAccountMaintenance.tsx'
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
  'onboarding lets the professor choose the password in the access request without sending it to the server',
  () => {
    const requestHandler =
      authGateSource.match(
        /const handleRequest =[\s\S]*?const handleLogin =/
      )?.[0] ?? ''

    assert.match(
      requestHandler,
      /personalPassword\.length <\s*PERSONAL_PASSWORD_MIN_LENGTH/
    )
    assert.match(
      requestHandler,
      /personalPassword !==\s*personalPasswordConfirm/
    )
    assert.match(
      requestHandler,
      /submitMAProfessorAccessRequest\(\s*normalizedEmail\s*\)/
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
      /verifyAccountPassword|createAccountPasswordCredential|ACCOUNT_PASSWORD_HASH/
    )
  }
)

test(
  'MP invitation enrollment still requires its activation secret',
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


test(
  'public privacy copy reflects OPAQUE and distinguishes v3 from legacy v2 protection',
  () => {
    assert.match(
      authGateSource,
      /Nunca recebemos nem guardamos a sua password/
    )
    assert.match(
      authGateSource,
      /protocolo OPAQUE[\s\S]*?servidor recebe só os dados criptográficos necessários/
    )
    assert.match(
      authGateSource,
      /novas cópias usam proteção v3[\s\S]*?servidor não guarda o necessário para os decifrar/
    )

    assert.match(
      backupPreferenceSource,
      /Nas cópias com proteção v3[\s\S]*?não recebe a sua password pessoal[\s\S]*?nem guarda no servidor o material necessário para decifrar os dados/
    )
    assert.match(
      backupPreferenceSource,
      /proteção v2[\s\S]*?material técnico que permite decifrá-las/
    )

    assert.match(
      setupConfirmationSource,
      /proteção v3[\s\S]*?não guarda no servidor o material necessário para decifrar os dados/
    )
    assert.match(
      setupConfirmationSource,
      /proteção v2[\s\S]*?material técnico que permite decifrá-las/
    )

    assert.doesNotMatch(
      founderOfferSource,
      /password pessoal continua a ser utilizada apenas para entrar/
    )
    assert.match(
      founderOfferSource,
      /A senha MP serve apenas para ativar o período/
    )
    assert.match(
      founderOfferSource,
      /password pessoal é usada no login protegido e nunca é enviada à MA-CODE/
    )

    assert.doesNotMatch(
      adminMaintenanceSource,
      /remove[\s\S]*?password pessoal, renovações/
    )
    assert.match(
      adminMaintenanceSource,
      /registo de autenticação OPAQUE/
    )
    assert.match(
      adminMaintenanceSource,
      /A MA-CODE não guarda a password pessoal do professor/
    )
  }
)


test(
  'new personal passwords require at least 15 characters without changing the OPAQUE transport contract',
  () => {
    assert.match(
      authGateSource,
      /const PERSONAL_PASSWORD_MIN_LENGTH =\s*15/
    )
    assert.match(
      authGateSource,
      /minLength=\{PERSONAL_PASSWORD_MIN_LENGTH\}/
    )
    assert.match(
      authGateSource,
      /personalPassword\.length <\s*PERSONAL_PASSWORD_MIN_LENGTH/
    )
    assert.match(
      authGateSource,
      /Use pelo menos 15 caracteres/
    )
    assert.match(
      authGateSource,
      /href="\/privacidade\/ma-professor"/
    )
  }
)
