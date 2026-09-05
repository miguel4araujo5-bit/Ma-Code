import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    diagnostic =>
      diagnostic.category ===
        ts.DiagnosticCategory.Error
  )

  assert.equal(
    errors.length,
    0,
    errors.map(
      diagnostic =>
        ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n'
        )
    ).join('\n')
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const deviceRecoverySource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/deviceRecoveryService.ts',
    import.meta.url
  ),
  'utf8'
)

const cryptoSetupGateSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/CryptoSetupGate.tsx',
    import.meta.url
  ),
  'utf8'
)

const databaseSnapshotSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/databaseSnapshotService.ts',
    import.meta.url
  ),
  'utf8'
)

const cryptoStub = transpile(`
  export async function hashMAProfessorDeviceId() {
    return 'device-hash';
  }
`)

const cryptoStorageStub = transpile(`
  export async function unlockMAProfessorLocalMasterKey() {
    throw new Error('unused');
  }
`)

const recoveryApiStub = transpile(`
  export async function getMAProfessorRecoveryProfile() {
    globalThis.__deferredRecovery.profileCalls += 1;
    return {
      profile: {}
    };
  }

  export async function authorizeMAProfessorRecoveredDevice() {
    globalThis.__deferredRecovery.authorizationCalls += 1;
    return {
      success: true,
      serverRevision: 11
    };
  }

  export async function registerMAProfessorRecoveryVerifier() {
    throw new Error('unused');
  }
`)

const databaseSnapshotStub = transpile(`
  export async function createMAProfessorDatabaseSnapshot() {
    globalThis.__deferredRecovery.snapshotCalls += 1;
    throw new Error('snapshot must not be read after deferred download failure');
  }

  export async function downloadEncryptedMAProfessorDatabaseSnapshot() {
    globalThis.__deferredRecovery.downloadCalls += 1;
    throw new Error('simulated network failure');
  }
`)

const guardedRestoreStub = transpile(`
  export function createMAProfessorSnapshotContentSignature() {
    throw new Error('unused');
  }

  export class MAProfessorLocalSnapshotChangedError extends Error {}

  export async function restoreMAProfessorDatabaseSnapshotIfLocalUnchanged() {
    globalThis.__deferredRecovery.restoreCalls += 1;
    throw new Error('restore must not run after deferred download failure');
  }
`)

const fingerprintStub = transpile(`
  export function countMAProfessorSnapshotRecords() {
    throw new Error('unused');
  }

  export async function createMAProfessorSnapshotFingerprint() {
    throw new Error('unused');
  }
`)

const syncStateStub = transpile(`
  export function saveMAProfessorManualSyncState() {
    globalThis.__deferredRecovery.syncStateSaveCalls += 1;
    return true;
  }
`)

const preparedReplacement = `const prepared = {
    recoveryVerifier: 'verifier',
    privateKey: null,
    profile: {},
    device: {
      deviceIdHash: 'device-hash',
      devicePublicKey: '{}',
      keyWrapAlgorithm: 'RSA-OAEP-3072-SHA-256',
      wrappedMasterKey: 'wrapped',
      wrappedMasterKeyNonce: ''
    }
  }`

const deviceRecoveryRuntime =
  deviceRecoverySource
    .replaceAll(
      "'./cryptoService'",
      `'${cryptoStub}'`
    )
    .replaceAll(
      "'./cryptoStorage'",
      `'${cryptoStorageStub}'`
    )
    .replaceAll(
      "'./recoveryApi'",
      `'${recoveryApiStub}'`
    )
    .replaceAll(
      "'./databaseSnapshotService'",
      `'${databaseSnapshotStub}'`
    )
    .replaceAll(
      "'./guardedSnapshotRestore'",
      `'${guardedRestoreStub}'`
    )
    .replaceAll(
      "'./snapshotFingerprint'",
      `'${fingerprintStub}'`
    )
    .replaceAll(
      "'./syncStateStorage'",
      `'${syncStateStub}'`
    )
    .replace(
      /const prepared =\s*await prepareRecoveredDevice\([\s\S]*?\n\s*\)/,
      preparedReplacement
    )
    .replace(
      /await storeRecoveredDeviceMaterial\(\s*email,\s*deviceId,\s*prepared\s*\)/,
      `globalThis.__deferredRecovery.storeCalls += 1`
    )

const deviceRecoveryModule = await import(
  transpile(deviceRecoveryRuntime)
)

function resetDeferredRecovery() {
  globalThis.__deferredRecovery = {
    profileCalls: 0,
    authorizationCalls: 0,
    storeCalls: 0,
    downloadCalls: 0,
    snapshotCalls: 0,
    restoreCalls: 0,
    syncStateSaveCalls: 0
  }
}

test(
  'authorized new device keeps its local key when the first online-copy download fails',
  async () => {
    resetDeferredRecovery()

    const result =
      await deviceRecoveryModule.recoverMAProfessorOnNewDevice(
        'token',
        'prof@example.pt',
        'new-device',
        'MA-PROF-PLACEHOLDER'
      )

    assert.equal(
      result.authorized,
      true
    )
    assert.equal(
      result.dataStatus,
      'restore-deferred'
    )
    assert.equal(
      result.serverRevision,
      11
    )
    assert.equal(
      result.restoredRecords,
      0
    )
    assert.match(
      result.message,
      /dispositivo ficou autorizado/i
    )
    assert.match(
      result.message,
      /recuperá-la mais tarde/i
    )

    assert.deepEqual(
      globalThis.__deferredRecovery,
      {
        profileCalls: 1,
        authorizationCalls: 1,
        storeCalls: 1,
        downloadCalls: 1,
        snapshotCalls: 0,
        restoreCalls: 0,
        syncStateSaveCalls: 0
      }
    )
  }
)

test(
  'recovery stores authorized local crypto material before attempting the fallible snapshot download',
  () => {
    const authorization =
      deviceRecoverySource.indexOf(
        'await authorizeMAProfessorRecoveredDevice('
      )

    const store =
      deviceRecoverySource.indexOf(
        'await storeRecoveredDeviceMaterial(',
        authorization
      )

    const download =
      deviceRecoverySource.indexOf(
        'await downloadEncryptedMAProfessorDatabaseSnapshot({',
        store
      )

    const deferred =
      deviceRecoverySource.indexOf(
        "dataStatus:\n        'restore-deferred'",
        download
      )

    assert.ok(authorization >= 0)
    assert.ok(store > authorization)
    assert.ok(download > store)
    assert.ok(deferred > download)
  }
)

test(
  'a later visit recognizes the preserved local key instead of requesting the recovery code again',
  () => {
    const profileExists =
      cryptoSetupGateSource.indexOf(
        'syncStatus\n              .profileExists'
      )

    const missingLocal =
      cryptoSetupGateSource.indexOf(
        'if (\n              !local\n            )',
        profileExists
      )

    const remoteExisting =
      cryptoSetupGateSource.indexOf(
        "setStage(\n                'remote-existing'",
        missingLocal
      )

    const missingLocalReturn =
      cryptoSetupGateSource.indexOf(
        'return',
        remoteExisting
      )

    const unlockLocal =
      cryptoSetupGateSource.indexOf(
        'await unlockMAProfessorLocalMasterKey(',
        missingLocalReturn
      )

    const ready =
      cryptoSetupGateSource.indexOf(
        "setStage(\n              'ready'",
        unlockLocal
      )

    assert.ok(profileExists >= 0)
    assert.ok(missingLocal > profileExists)
    assert.ok(remoteExisting > missingLocal)
    assert.ok(missingLocalReturn > remoteExisting)
    assert.ok(unlockLocal > missingLocalReturn)
    assert.ok(ready > unlockLocal)
  }
)

test(
  'later online-copy download uses the preserved account-and-device key and does not require a recovery code',
  () => {
    const downloadFunction =
      databaseSnapshotSource.indexOf(
        'export async function downloadEncryptedMAProfessorDatabaseSnapshot('
      )

    const unlock =
      databaseSnapshotSource.indexOf(
        'await unlockMAProfessorLocalMasterKey(',
        downloadFunction
      )

    const email =
      databaseSnapshotSource.indexOf(
        'options.email',
        unlock
      )

    const deviceId =
      databaseSnapshotSource.indexOf(
        'options.deviceId',
        email
      )

    const nextFunction =
      databaseSnapshotSource.indexOf(
        '\nexport ',
        deviceId
      )

    const downloadBody =
      databaseSnapshotSource.slice(
        downloadFunction,
        nextFunction >= 0
          ? nextFunction
          : undefined
      )

    assert.ok(downloadFunction >= 0)
    assert.ok(unlock > downloadFunction)
    assert.ok(email > unlock)
    assert.ok(deviceId > email)
    assert.doesNotMatch(
      downloadBody,
      /recoveryCode|recovery code|chave de recuperação/i
    )
  }
)
