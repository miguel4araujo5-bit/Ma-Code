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

function mutateBase64(value) {
  assert.ok(value.length > 0)

  const replacement =
    value[0] === 'A'
      ? 'B'
      : 'A'

  return replacement + value.slice(1)
}

function mutateRecoveryCode(value) {
  assert.ok(value.length > 0)

  const replacement =
    value.at(-1) === 'A'
      ? 'B'
      : 'A'

  return value.slice(0, -1) + replacement
}

const cryptoSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/cryptoService.ts',
    import.meta.url
  ),
  'utf8'
)

const cryptoModule = await import(
  transpile(cryptoSource)
)

const cryptoMaterial =
  await cryptoModule.createMAProfessorCryptoMaterial(
    'recovery-safety-device'
  )

const deviceRecoverySource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/deviceRecoveryService.ts',
    import.meta.url
  ),
  'utf8'
)

const recoveryDependencyStub = transpile(`
  export async function hashMAProfessorDeviceId() { return 'device-hash'; }
  export async function unlockMAProfessorLocalMasterKey() { throw new Error('unused'); }
  export async function authorizeMAProfessorRecoveredDevice() { throw new Error('unused'); }
  export async function getMAProfessorRecoveryProfile() { throw new Error('unused'); }
  export async function registerMAProfessorRecoveryVerifier() { throw new Error('unused'); }
  export async function createMAProfessorDatabaseSnapshot() { throw new Error('unused'); }
  export async function downloadEncryptedMAProfessorDatabaseSnapshot() { throw new Error('unused'); }
  export async function restoreMAProfessorDatabaseSnapshot() { throw new Error('unused'); }
  export function countMAProfessorSnapshotRecords() { return 0; }
  export async function createMAProfessorSnapshotFingerprint() { return 'unused'; }
  export function saveMAProfessorManualSyncState() { return true; }
`)

const deviceRecoveryRuntime =
  deviceRecoverySource
    .replaceAll(
      "'./cryptoService'",
      `'${recoveryDependencyStub}'`
    )
    .replaceAll(
      "'./cryptoStorage'",
      `'${recoveryDependencyStub}'`
    )
    .replaceAll(
      "'./recoveryApi'",
      `'${recoveryDependencyStub}'`
    )
    .replaceAll(
      "'./databaseSnapshotService'",
      `'${recoveryDependencyStub}'`
    )
    .replaceAll(
      "'./snapshotFingerprint'",
      `'${recoveryDependencyStub}'`
    )
    .replaceAll(
      "'./syncStateStorage'",
      `'${recoveryDependencyStub}'`
    )
    .replace(
      'async function unwrapMasterKeyWithRecoveryCode(',
      'export async function unwrapMasterKeyWithRecoveryCode('
    )

const deviceRecoveryModule = await import(
  transpile(deviceRecoveryRuntime)
)

test(
  'wrong recovery code fails locally before a recovered device can be prepared',
  async () => {
    const wrongCode =
      mutateRecoveryCode(
        cryptoMaterial.recoveryCode
      )

    await assert.rejects(
      () =>
        deviceRecoveryModule.unwrapMasterKeyWithRecoveryCode(
          wrongCode,
          cryptoMaterial.profile
        ),
      /chave de recuperação está incorreta/i
    )
  }
)

test(
  'tampered encrypted record is rejected before plaintext is returned',
  async () => {
    const encrypted =
      await cryptoModule.encryptMAProfessorRecordBytes(
        cryptoMaterial.masterKey,
        'database-v1',
        new TextEncoder().encode(
          'snapshot protegido'
        )
      )

    const tampered = {
      ...encrypted,
      ciphertext:
        mutateBase64(
          encrypted.ciphertext
        )
    }

    await assert.rejects(
      () =>
        cryptoModule.decryptMAProfessorRecordBytes(
          cryptoMaterial.masterKey,
          'database-v1',
          tampered
        ),
      /alterado ou está incompleto/i
    )
  }
)

test(
  'AES-GCM still rejects tampered ciphertext even if its public SHA-256 hash is recomputed',
  async () => {
    const encrypted =
      await cryptoModule.encryptMAProfessorRecordBytes(
        cryptoMaterial.masterKey,
        'database-v1',
        new TextEncoder().encode(
          'snapshot protegido'
        )
      )

    const changedCiphertext =
      mutateBase64(
        encrypted.ciphertext
      )

    const changedBytes =
      Buffer.from(
        changedCiphertext,
        'base64'
      )

    const digest =
      await globalThis.crypto.subtle.digest(
        'SHA-256',
        changedBytes
      )

    const forged = {
      ...encrypted,
      ciphertext:
        changedCiphertext,
      ciphertextHash:
        Buffer.from(digest)
          .toString('base64')
    }

    await assert.rejects(
      () =>
        cryptoModule.decryptMAProfessorRecordBytes(
          cryptoMaterial.masterKey,
          'database-v1',
          forged
        ),
      /não foi possível desencriptar/i
    )
  }
)

const snapshotApiStub = transpile(`
  export class MAProfessorSnapshotRequestError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'MAProfessorSnapshotRequestError';
      this.status = status;
    }
  }

  export class MAProfessorSnapshotConflictError extends MAProfessorSnapshotRequestError {
    constructor(message, currentServerRevision) {
      super(message, 409);
      this.name = 'MAProfessorSnapshotConflictError';
      this.currentServerRevision = currentServerRevision;
    }
  }
`)

const manualSnapshotServiceStub = transpile(`
  import { MAProfessorSnapshotConflictError } from '${snapshotApiStub}';

  export async function createMAProfessorDatabaseSnapshot() {
    return structuredClone(globalThis.__manualSyncSafety.currentSnapshot);
  }

  export async function downloadEncryptedMAProfessorDatabaseSnapshot() {
    throw new Error('unused');
  }

  export async function uploadEncryptedMAProfessorDatabaseSnapshot() {
    const state = globalThis.__manualSyncSafety;
    state.uploadCalls += 1;

    if (state.uploadMode === 'conflict') {
      throw new MAProfessorSnapshotConflictError(
        'conflict',
        state.conflictRevision
      );
    }

    return {
      snapshot: structuredClone(state.currentSnapshot),
      plaintextBytes: 1,
      remote: {
        success: true,
        recordId: 'database-v1',
        serverRevision: state.serverRevision + 1,
        recordRevision: 1,
        updatedAt: '2026-09-05T10:00:00.000Z'
      }
    };
  }
`)

const manualFingerprintStub = transpile(`
  export async function createMAProfessorSnapshotFingerprint(snapshot) {
    return snapshot.fingerprint;
  }

  export function countMAProfessorSnapshotRecords(snapshot) {
    return snapshot.records || 0;
  }

  export function getMAProfessorSnapshotBytes() {
    return 1;
  }
`)

const manualStorageStub = transpile(`
  export function readMAProfessorManualSyncState() {
    return globalThis.__manualSyncSafety.previousState;
  }

  export function saveMAProfessorManualSyncState() {
    globalThis.__manualSyncSafety.saveCalls += 1;
    return true;
  }
`)

const manualSyncSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/manualSyncService.ts',
    import.meta.url
  ),
  'utf8'
)

const manualSyncRuntime =
  manualSyncSource
    .replaceAll(
      "'./databaseSnapshotService'",
      `'${manualSnapshotServiceStub}'`
    )
    .replaceAll(
      "'./snapshotApi'",
      `'${snapshotApiStub}'`
    )
    .replaceAll(
      "'./snapshotFingerprint'",
      `'${manualFingerprintStub}'`
    )
    .replaceAll(
      "'./syncStateStorage'",
      `'${manualStorageStub}'`
    )

const manualSyncModule = await import(
  transpile(manualSyncRuntime)
)

function resetManualSyncSafety(overrides = {}) {
  globalThis.__manualSyncSafety = {
    currentSnapshot: {
      fingerprint: 'local-fingerprint',
      records: 3
    },
    previousState: null,
    uploadCalls: 0,
    saveCalls: 0,
    uploadMode: 'success',
    conflictRevision: 0,
    serverRevision: 0,
    ...overrides
  }
}

test(
  'a second device cannot overwrite an existing remote copy it has never verified',
  async () => {
    resetManualSyncSafety({
      serverRevision: 4,
      previousState: null
    })

    await assert.rejects(
      () =>
        manualSyncModule.uploadAndVerifyMAProfessorManualSync({
          token: 'token',
          email: 'prof@example.pt',
          deviceId: 'second-device',
          serverRevision: 4
        }),
      error => {
        assert.ok(
          error instanceof
            manualSyncModule.MAProfessorManualSyncSafetyError
        )
        assert.match(
          error.message,
          /ainda não confirmou/i
        )
        return true
      }
    )

    assert.equal(
      globalThis.__manualSyncSafety.uploadCalls,
      0
    )
    assert.equal(
      globalThis.__manualSyncSafety.saveCalls,
      0
    )
  }
)

test(
  'a 409 remote conflict aborts manual upload without marking the local state as synchronized',
  async () => {
    resetManualSyncSafety({
      serverRevision: 4,
      previousState: {
        serverRevision: 4,
        fingerprint: 'local-fingerprint',
        syncedAt: '2026-09-05T09:00:00.000Z',
        verifiedAt: '2026-09-05T09:00:00.000Z',
        lastOperation: 'verify'
      },
      uploadMode: 'conflict',
      conflictRevision: 5
    })

    await assert.rejects(
      () =>
        manualSyncModule.uploadAndVerifyMAProfessorManualSync({
          token: 'token',
          email: 'prof@example.pt',
          deviceId: 'device-1',
          serverRevision: 4
        }),
      error => {
        assert.ok(
          error instanceof
            manualSyncModule.MAProfessorManualSyncSafetyError
        )
        assert.match(
          error.message,
          /revisão 5/i
        )
        return true
      }
    )

    assert.equal(
      globalThis.__manualSyncSafety.uploadCalls,
      1
    )
    assert.equal(
      globalThis.__manualSyncSafety.saveCalls,
      0
    )
  }
)

const restoreDatabaseStub = transpile(`
  export async function createMAProfessorDatabaseSnapshot() {
    return structuredClone(globalThis.__onlineRestoreSafety.localSnapshot);
  }

  export async function downloadEncryptedMAProfessorDatabaseSnapshot() {
    globalThis.__onlineRestoreSafety.downloadCalls += 1;
    return structuredClone(globalThis.__onlineRestoreSafety.remoteResult);
  }
`)

const guardedRestoreStub = transpile(`
  export function createMAProfessorSnapshotContentSignature(snapshot) {
    return 'signature:' + snapshot.fingerprint;
  }

  export async function restoreMAProfessorDatabaseSnapshotIfLocalUnchanged(snapshot) {
    const state = globalThis.__onlineRestoreSafety;
    state.restoreCalls += 1;
    state.localSnapshot = structuredClone(snapshot);

    return {
      snapshot: structuredClone(snapshot),
      recordCounts: {},
      totalRecords: snapshot.records || 0
    };
  }
`)

const restoreFingerprintStub = transpile(`
  export async function createMAProfessorSnapshotFingerprint(snapshot) {
    return snapshot.fingerprint;
  }

  export function countMAProfessorSnapshotRecords(snapshot) {
    return snapshot.records || 0;
  }

  export function getMAProfessorSnapshotBytes() {
    return 1;
  }
`)

const restoreStorageStub = transpile(`
  export function saveMAProfessorManualSyncState() {
    globalThis.__onlineRestoreSafety.saveCalls += 1;
    return true;
  }
`)

const onlineRestoreSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/onlineRestoreService.ts',
    import.meta.url
  ),
  'utf8'
)

const onlineRestoreRuntime =
  onlineRestoreSource
    .replaceAll(
      "'./databaseSnapshotService'",
      `'${restoreDatabaseStub}'`
    )
    .replaceAll(
      "'./guardedSnapshotRestore'",
      `'${guardedRestoreStub}'`
    )
    .replaceAll(
      "'./snapshotFingerprint'",
      `'${restoreFingerprintStub}'`
    )
    .replaceAll(
      "'./syncStateStorage'",
      `'${restoreStorageStub}'`
    )

const onlineRestoreModule = await import(
  transpile(onlineRestoreRuntime)
)

function makeRemoteResult(
  revision,
  fingerprint
) {
  return {
    found: true,
    snapshot: {
      fingerprint,
      records: 5
    },
    remote: {
      serverRevision: revision,
      recordRevision: revision,
      createdAt: '2026-09-05T08:00:00.000Z',
      updatedAt: `2026-09-05T09:0${Math.min(revision, 9)}:00.000Z`
    }
  }
}

function resetOnlineRestoreSafety() {
  globalThis.__onlineRestoreSafety = {
    localSnapshot: {
      fingerprint: 'local-fingerprint',
      records: 2
    },
    remoteResult:
      makeRemoteResult(
        4,
        'remote-fingerprint-a'
      ),
    downloadCalls: 0,
    restoreCalls: 0,
    saveCalls: 0
  }
}

async function createRestorePreview() {
  return onlineRestoreModule.previewMAProfessorOnlineRestore({
    token: 'token',
    email: 'prof@example.pt',
    deviceId: 'device-1'
  })
}

async function restoreFromPreview(preview) {
  assert.equal(preview.found, true)

  return onlineRestoreModule.restoreMAProfessorOnlineSnapshot({
    token: 'token',
    email: 'prof@example.pt',
    deviceId: 'device-1',
    expectedServerRevision:
      preview.serverRevision,
    expectedRemoteFingerprint:
      preview.remoteFingerprint,
    expectedLocalContentSignature:
      preview.localContentSignature
  })
}

test(
  'online restore aborts if the remote revision changes after preview',
  async () => {
    resetOnlineRestoreSafety()

    const preview =
      await createRestorePreview()

    globalThis.__onlineRestoreSafety.remoteResult =
      makeRemoteResult(
        5,
        'remote-fingerprint-b'
      )

    await assert.rejects(
      () =>
        restoreFromPreview(preview),
      error => {
        assert.ok(
          error instanceof
            onlineRestoreModule.MAProfessorOnlineRestoreSafetyError
        )
        assert.match(
          error.message,
          /atualizada depois da sua verificação/i
        )
        return true
      }
    )

    assert.equal(
      globalThis.__onlineRestoreSafety.restoreCalls,
      0
    )
    assert.equal(
      globalThis.__onlineRestoreSafety.saveCalls,
      0
    )
  }
)

test(
  'online restore aborts if remote content changes without the expected fingerprint',
  async () => {
    resetOnlineRestoreSafety()

    const preview =
      await createRestorePreview()

    globalThis.__onlineRestoreSafety.remoteResult =
      makeRemoteResult(
        4,
        'remote-fingerprint-changed'
      )

    await assert.rejects(
      () =>
        restoreFromPreview(preview),
      error => {
        assert.ok(
          error instanceof
            onlineRestoreModule.MAProfessorOnlineRestoreSafetyError
        )
        assert.match(
          error.message,
          /conteúdo da cópia online mudou/i
        )
        return true
      }
    )

    assert.equal(
      globalThis.__onlineRestoreSafety.restoreCalls,
      0
    )
    assert.equal(
      globalThis.__onlineRestoreSafety.saveCalls,
      0
    )
  }
)

test(
  'new-device recovery validates the recovery key before authorization and never overwrites different local data automatically',
  () => {
    const prepareStart =
      deviceRecoverySource.indexOf(
        'async function prepareRecoveredDevice('
      )

    const unwrapPosition =
      deviceRecoverySource.indexOf(
        'await unwrapMasterKeyWithRecoveryCode(',
        prepareStart
      )

    const recoverStart =
      deviceRecoverySource.indexOf(
        'export async function recoverMAProfessorOnNewDevice('
      )

    const preparePosition =
      deviceRecoverySource.indexOf(
        'await prepareRecoveredDevice(',
        recoverStart
      )

    const authorizePosition =
      deviceRecoverySource.indexOf(
        'await authorizeMAProfessorRecoveredDevice(',
        recoverStart
      )

    const localDataGuardPosition =
      deviceRecoverySource.indexOf(
        'localRecords >',
        recoverStart
      )

    const manualRestorePosition =
      deviceRecoverySource.indexOf(
        "'manual-restore-required'",
        localDataGuardPosition
      )

    const automaticRestorePosition =
      deviceRecoverySource.indexOf(
        'await restoreMAProfessorDatabaseSnapshot(',
        localDataGuardPosition
      )

    assert.ok(prepareStart >= 0)
    assert.ok(unwrapPosition > prepareStart)
    assert.ok(recoverStart >= 0)
    assert.ok(preparePosition > recoverStart)
    assert.ok(authorizePosition > preparePosition)
    assert.ok(localDataGuardPosition > authorizePosition)
    assert.ok(manualRestorePosition > localDataGuardPosition)
    assert.ok(
      automaticRestorePosition >
        manualRestorePosition,
      'Dados locais diferentes têm de provocar restauro manual antes de qualquer substituição automática.'
    )
  }
)
