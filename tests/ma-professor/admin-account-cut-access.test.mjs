import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const maintenanceSource = await readFile(
  new URL(
    '../../src/components/admin/ma-professor/MAProfessorAccountMaintenance.tsx',
    import.meta.url
  ),
  'utf8'
)

const operationalSource = await readFile(
  new URL(
    '../../src/components/admin/ma-professor/MAProfessorOperationalAccountStatus.tsx',
    import.meta.url
  ),
  'utf8'
)

const adminApiSource = await readFile(
  new URL(
    '../../src/lib/admin/maProfessorAdminApi.ts',
    import.meta.url
  ),
  'utf8'
)

const accessAdminBridgeSource = await readFile(
  new URL(
    '../../worker/maProfessorAccessAdminBridge.ts',
    import.meta.url
  ),
  'utf8'
)

function sliceBetween(
  source,
  startMarker,
  endMarker
) {
  const start =
    source.indexOf(
      startMarker
    )

  assert.notEqual(
    start,
    -1,
    `Marcador inicial em falta: ${startMarker}`
  )

  const end =
    source.indexOf(
      endMarker,
      start +
        startMarker.length
    )

  assert.notEqual(
    end,
    -1,
    `Marcador final em falta: ${endMarker}`
  )

  return source.slice(
    start,
    end
  )
}

test(
  'maintenance exposes Cut access through the existing revoke-license API without using reset/delete paths',
  () => {
    const handler =
      sliceBetween(
        maintenanceSource,
        'const handleCutAccess =',
        'const handleResetAccess ='
      )

    assert.match(
      maintenanceSource,
      /revokeMAProfessorLicense/
    )
    assert.match(
      handler,
      /await revokeMAProfessorLicense\(/
    )
    assert.match(
      handler,
      /await onChanged\(\)/
    )
    assert.match(
      handler,
      /A conta, a password, a configuração e a cópia cifrada dos dados escolares na cloud são preservadas\./
    )
    assert.doesNotMatch(
      handler,
      /resetMAProfessorAccountAccess|deleteMAProfessorAccounts/
    )
    assert.match(
      maintenanceSource,
      /Cortar acesso/
    )
    assert.match(
      maintenanceSource,
      /user\.licenseStatus !==\s*'revoked'/
    )
  }
)

test(
  'real account state shows immediate access explicitly and distinguishes revoked/expired/session states',
  () => {
    assert.match(
      operationalSource,
      /Acesso agora/
    )
    assert.match(
      operationalSource,
      /activeSessionCount/
    )
    assert.match(
      operationalSource,
      /Sessão ativa ·/
    )
    assert.match(
      operationalSource,
      /Sem sessão/
    )
    assert.match(
      operationalSource,
      /Acesso cortado/
    )
    assert.match(
      operationalSource,
      /Licença expirada/
    )
    assert.match(
      operationalSource,
      /licenseStatusByEmail/
    )
  }
)

test(
  'maintenance reuses the canonical admin license revoke endpoint',
  () => {
    const revokeApi =
      sliceBetween(
        adminApiSource,
        'export async function revokeMAProfessorLicense(',
        'export async function getMAProfessorCredentialStatus('
      )

    assert.match(
      revokeApi,
      /'\/licenses\/revoke'/
    )
  }
)

test(
  'backend license revoke marks the license and all active sessions revoked without deleting credentials or cloud data',
  () => {
    const handler =
      sliceBetween(
        accessAdminBridgeSource,
        'private async handleLicenseRevoke(',
        'private async handleCommerceStatus('
      )

    assert.match(
      handler,
      /license\.revokedAt\s*=\s*now/
    )
    assert.match(
      handler,
      /session\.email\s*===\s*email/
    )
    assert.match(
      handler,
      /session\.revokedAt\s*=\s*now/
    )
    assert.match(
      handler,
      /sessionsRevoked/
    )
    assert.match(
      handler,
      /this\.state\.storage\.put\(\s*STORAGE_KEY,\s*state\s*\)/
    )

    assert.doesNotMatch(
      handler,
      /state\.credentials|delete\s+.*credential/i
    )
    assert.doesNotMatch(
      handler,
      /snapshot|cloud|syncRepository|syncState|SYNC_STORAGE_KEY/i
    )
  }
)
