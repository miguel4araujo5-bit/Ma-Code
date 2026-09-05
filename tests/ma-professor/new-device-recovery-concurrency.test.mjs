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
    return {
      profile: {}
    };
  }

  export async function authorizeMAProfessorRecoveredDevice() {
    return {
      success: true,
      serverRevision: 7
    };
  }

  export async function registerMAProfessorRecoveryVerifier() {
    throw new Error('unused');
  }
`)

const databaseSnapshotStub = transpile(`
  export async function createMAProfessorDatabaseSnapshot() {
    const state = globalThis.__newDeviceRecoveryRace;
    state.snapshotReads += 1;
    return structuredClone(state.localSnapshot);
  }

  export async function downloadEncryptedMAProfessorDatabaseSnapshot() {
    const state = globalThis.__newDeviceRecoveryRace;
    state.downloadCalls += 1;
    return structuredClone(state.remoteResult);
  }

  export async function restoreMAProfessorDatabaseSnapshot(snapshot) {
    const state = globalThis.__newDeviceRecoveryRace;
    state.plainRestoreCalls += 1;
    state.localSnapshot = structuredClone(snapshot);

    return {
      snapshot: structuredClone(snapshot),
      recordCounts: {},
      totalRecords: snapshot.records || 0
    };
  }
`)

const fingerprintStub = transpile(`
  export async function createMAProfessorSnapshotFingerprint(snapshot) {
    const state = globalThis.__newDeviceRecoveryRace;

    if (
      state.mutateBeforeRestore &&
      snapshot.fingerprint === 'remote'
    ) {
      state.localSnapshot = {
        fingerprint: 'new-local',
        records: 1
      };
      state.mutateBeforeRestore = false;
    }

    return snapshot.fingerprint;
  }

  export function countMAProfessorSnapshotRecords(snapshot) {
    return snapshot.records || 0;
  }
`)

const syncStateStub = transpile(`
  export function saveMAProfessorManualSyncState() {
    globalThis.__newDeviceRecoveryRace.saveCalls += 1;
    return true;
  }
`)

const guardedRestoreStub = transpile(`
  export function createMAProfessorSnapshotContentSignature(snapshot) {
    return JSON.stringify({
      fingerprint: snapshot.fingerprint,
      records: snapshot.records || 0
    });
  }

  export class MAProfessorLocalSnapshotChangedError extends Error {
    constructor() {
      super('local snapshot changed');
      this.name = 'MAProfessorLocalSnapshotChangedError';
    }
  }

  export async function restoreMAProfessorDatabaseSnapshotIfLocalUnchanged(
    snapshot,
    expectedLocalContentSignature
  ) {
    const state = globalThis.__newDeviceRecoveryRace;
    state.guardedRestoreCalls += 1;

    const currentSignature =
      createMAProfessorSnapshotContentSignature(
        state.localSnapshot
      );

    if (
      currentSignature !==
        expectedLocalContentSignature
    ) {
      throw new MAProfessorLocalSnapshotChangedError();
    }

    state.localSnapshot = structuredClone(snapshot);

    return {
      snapshot: structuredClone(snapshot),
      recordCounts: {},
      totalRecords: snapshot.records || 0
    };
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
      "'./snapshotFingerprint'",
      `'${fingerprintStub}'`
    )
    .replaceAll(
      "'./syncStateStorage'",
      `'${syncStateStub}'`
    )
    .replaceAll(
      "'./guardedSnapshotRestore'",
      `'${guardedRestoreStub}'`
    )
    .replace(
      /const prepared =\s*await prepareRecoveredDevice\([\s\S]*?\n\s*\)/,
      preparedReplacement
    )
    .replace(
      /await storeRecoveredDeviceMaterial\(\s*email,\s*deviceId,\s*prepared\s*\)/,
      `globalThis.__newDeviceRecoveryRace.storeCalls += 1`
    )

const deviceRecoveryModule = await import(
  transpile(deviceRecoveryRuntime)
)

function resetRace(overrides = {}) {
  globalThis.__newDeviceRecoveryRace = {
    localSnapshot: {
      fingerprint: 'empty',
      records: 0
    },
    remoteResult: {
      found: true,
      snapshot: {
        fingerprint: 'remote',
        records: 4
      },
      remote: {
        serverRevision: 7,
        updatedAt: '2026-09-05T10:00:00.000Z'
      }
    },
    snapshotReads: 0,
    downloadCalls: 0,
    storeCalls: 0,
    plainRestoreCalls: 0,
    guardedRestoreCalls: 0,
    saveCalls: 0,
    mutateBeforeRestore: false,
    ...overrides
  }
}

test(
  'new-device automatic recovery aborts if another tab writes after the initial empty-local check',
  async () => {
    resetRace({
      mutateBeforeRestore: true
    })

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
      result.restoredRecords,
      0
    )

    assert.equal(
      globalThis.__newDeviceRecoveryRace.plainRestoreCalls,
      0,
      'O recovery não pode usar o restauro simples depois de uma verificação local não atómica.'
    )
    assert.equal(
      globalThis.__newDeviceRecoveryRace.guardedRestoreCalls,
      1
    )
    assert.deepEqual(
      globalThis.__newDeviceRecoveryRace.localSnapshot,
      {
        fingerprint: 'new-local',
        records: 1
      },
      'Os dados escritos pela outra janela têm de permanecer intactos.'
    )
    assert.equal(
      globalThis.__newDeviceRecoveryRace.saveCalls,
      0,
      'Um recovery abortado não pode ser marcado como sincronizado.'
    )
  }
)

test(
  'new-device automatic recovery still restores normally when local data remain unchanged',
  async () => {
    resetRace()

    const result =
      await deviceRecoveryModule.recoverMAProfessorOnNewDevice(
        'token',
        'prof@example.pt',
        'new-device',
        'MA-PROF-PLACEHOLDER'
      )

    assert.equal(
      result.dataStatus,
      'restored'
    )
    assert.equal(
      result.restoredRecords,
      4
    )
    assert.equal(
      globalThis.__newDeviceRecoveryRace.plainRestoreCalls,
      0
    )
    assert.equal(
      globalThis.__newDeviceRecoveryRace.guardedRestoreCalls,
      1
    )
    assert.deepEqual(
      globalThis.__newDeviceRecoveryRace.localSnapshot,
      {
        fingerprint: 'remote',
        records: 4
      }
    )
    assert.equal(
      globalThis.__newDeviceRecoveryRace.saveCalls,
      1
    )
  }
)
