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
    globalThis.__existingLocalRecovery.profileCalls += 1;
    return { profile: {} };
  }

  export async function authorizeMAProfessorRecoveredDevice() {
    globalThis.__existingLocalRecovery.authorizationCalls += 1;
    return {
      success: true,
      serverRevision: 12
    };
  }

  export async function registerMAProfessorRecoveryVerifier() {
    throw new Error('unused');
  }
`)

const databaseSnapshotStub = transpile(`
  export async function downloadEncryptedMAProfessorDatabaseSnapshot() {
    const state = globalThis.__existingLocalRecovery;
    state.downloadCalls += 1;
    return structuredClone(state.remoteResult);
  }

  export async function createMAProfessorDatabaseSnapshot() {
    const state = globalThis.__existingLocalRecovery;
    state.snapshotReads += 1;
    return structuredClone(state.localSnapshot);
  }
`)

const guardedRestoreStub = transpile(`
  export function createMAProfessorSnapshotContentSignature(snapshot) {
    return JSON.stringify(snapshot);
  }

  export class MAProfessorLocalSnapshotChangedError extends Error {}

  export async function restoreMAProfessorDatabaseSnapshotIfLocalUnchanged() {
    globalThis.__existingLocalRecovery.restoreCalls += 1;
    throw new Error('Restauro automático proibido quando já existem dados locais diferentes.');
  }
`)

const fingerprintStub = transpile(`
  export async function createMAProfessorSnapshotFingerprint(snapshot) {
    return snapshot.fingerprint;
  }

  export function countMAProfessorSnapshotRecords(snapshot) {
    return snapshot.records || 0;
  }
`)

const syncStateStub = transpile(`
  export function saveMAProfessorManualSyncState() {
    globalThis.__existingLocalRecovery.syncStateSaveCalls += 1;
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
      `globalThis.__existingLocalRecovery.storeCalls += 1`
    )

const deviceRecoveryModule = await import(
  transpile(deviceRecoveryRuntime)
)

function resetState() {
  globalThis.__existingLocalRecovery = {
    localSnapshot: {
      fingerprint: 'local-existing-v1',
      records: 7,
      marker: 'preserve-me'
    },
    remoteResult: {
      found: true,
      snapshot: {
        fingerprint: 'remote-different-v4',
        records: 18,
        marker: 'remote-copy'
      },
      remote: {
        serverRevision: 12,
        recordRevision: 4,
        createdAt: '2026-09-05T09:00:00.000Z',
        updatedAt: '2026-09-05T10:00:00.000Z'
      }
    },
    profileCalls: 0,
    authorizationCalls: 0,
    storeCalls: 0,
    downloadCalls: 0,
    snapshotReads: 0,
    restoreCalls: 0,
    syncStateSaveCalls: 0
  }
}

test(
  'new-device recovery preserves existing different local data and requires manual restore',
  async () => {
    resetState()

    const originalLocal =
      structuredClone(
        globalThis.__existingLocalRecovery.localSnapshot
      )

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
      'manual-restore-required'
    )
    assert.equal(
      result.serverRevision,
      12
    )
    assert.equal(
      result.restoredRecords,
      0
    )
    assert.match(
      result.message,
      /dados locais diferentes/i
    )
    assert.match(
      result.message,
      /nada foi substituído/i
    )

    assert.deepEqual(
      globalThis.__existingLocalRecovery.localSnapshot,
      originalLocal,
      'Os dados locais existentes têm de permanecer exatamente intactos.'
    )

    assert.equal(
      globalThis.__existingLocalRecovery.restoreCalls,
      0,
      'Não pode existir qualquer tentativa de restauro automático neste ramo.'
    )

    assert.equal(
      globalThis.__existingLocalRecovery.syncStateSaveCalls,
      0,
      'Dados locais diferentes não podem ser marcados falsamente como sincronizados.'
    )

    assert.deepEqual(
      {
        profileCalls:
          globalThis.__existingLocalRecovery.profileCalls,
        authorizationCalls:
          globalThis.__existingLocalRecovery.authorizationCalls,
        storeCalls:
          globalThis.__existingLocalRecovery.storeCalls,
        downloadCalls:
          globalThis.__existingLocalRecovery.downloadCalls,
        snapshotReads:
          globalThis.__existingLocalRecovery.snapshotReads
      },
      {
        profileCalls: 1,
        authorizationCalls: 1,
        storeCalls: 1,
        downloadCalls: 1,
        snapshotReads: 1
      }
    )
  }
)
