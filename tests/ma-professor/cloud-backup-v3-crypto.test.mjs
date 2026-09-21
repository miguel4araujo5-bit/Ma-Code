import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source =
  await readFile(
    new URL(
      '../../src/components/ma-professor/sync/cloudBackupV3Crypto.ts',
      import.meta.url
    ),
    'utf8'
  )

const output =
  ts.transpileModule(
    source,
    {
      fileName:
        'cloudBackupV3Crypto.ts',
      compilerOptions: {
        module:
          ts.ModuleKind.ESNext,
        target:
          ts.ScriptTarget.ES2022
      },
      reportDiagnostics:
        true
    }
  )

const errors =
  (output.diagnostics || [])
    .filter(
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

const moduleUrl =
  `data:text/javascript;base64,${
    Buffer.from(
      output.outputText
    ).toString('base64')
  }`

const cryptoV3 =
  await import(moduleUrl)

function toBase64Url(
  bytes
) {
  return Buffer.from(bytes)
    .toString('base64url')
}

function randomExportKey() {
  return toBase64Url(
    crypto.getRandomValues(
      new Uint8Array(64)
    )
  )
}

function fromBase64Url(
  value
) {
  return Buffer.from(
    value,
    'base64url'
  )
}


async function proveSameMasterKey(
  first,
  second
) {
  const nonce =
    crypto.getRandomValues(
      new Uint8Array(12)
    )

  const plaintext =
    new TextEncoder()
      .encode(
        'ma-professor-v3-round-trip'
      )

  const ciphertext =
    await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce
      },
      first,
      plaintext
    )

  const decrypted =
    await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce
      },
      second,
      ciphertext
    )

  assert.equal(
    new TextDecoder().decode(
      decrypted
    ),
    'ma-professor-v3-round-trip'
  )
}

test(
  'v3 creates a random client master key and unwraps it with the same OPAQUE export key',
  async () => {
    const exportKey =
      randomExportKey()

    const created =
      await cryptoV3
        .createMAProfessorBackupV3KeyMaterial(
          exportKey
        )

    assert.equal(
      created.wrapped.cryptoVersion,
      3
    )
    assert.equal(
      created.wrapped.recoveryKdfAlgorithm,
      'OPAQUE-RFC9807-EXPORT-HKDF-SHA256'
    )
    assert.equal(
      created.wrapped.recoveryKeyWrapAlgorithm,
      'AES-256-GCM'
    )

    const restored =
      await cryptoV3
        .unwrapMAProfessorBackupV3MasterKey(
          exportKey,
          created.wrapped
        )

    await proveSameMasterKey(
      created.masterKey,
      restored
    )
  }
)

test(
  'v3 envelope has expected sizes and never exposes raw secrets',
  async () => {
    const exportKey =
      randomExportKey()

    const created =
      await cryptoV3
        .createMAProfessorBackupV3KeyMaterial(
          exportKey
        )

    assert.equal(
      created.masterKey.extractable,
      false
    )

    assert.deepEqual(
      [...created.masterKey.usages].sort(),
      ['decrypt', 'encrypt']
    )

    assert.equal(
      fromBase64Url(
        created.wrapped.recoveryKdfSalt
      ).byteLength,
      32
    )

    assert.equal(
      fromBase64Url(
        created.wrapped.recoveryWrappedMasterKeyNonce
      ).byteLength,
      12
    )

    assert.equal(
      fromBase64Url(
        created.wrapped.recoveryWrappedMasterKey
      ).byteLength,
      48
    )

    assert.doesNotMatch(
      created.wrapped.recoveryKdfSalt,
      /=/
    )
    assert.doesNotMatch(
      created.wrapped.recoveryWrappedMasterKeyNonce,
      /=/
    )
    assert.doesNotMatch(
      created.wrapped.recoveryWrappedMasterKey,
      /=/
    )

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        created.wrapped,
        'exportKey'
      ),
      false
    )

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        created.wrapped,
        'masterKey'
      ),
      false
    )

    assert.equal(
      JSON.stringify(
        created.wrapped
      ).includes(
        exportKey
      ),
      false
    )
  }
)

test(
  'v3 rejects malformed or wrong-sized OPAQUE export keys before HKDF',
  async () => {
    await assert.rejects(
      () =>
        cryptoV3
          .createMAProfessorBackupV3KeyMaterial(
            'not+base64url'
          ),
      /formato válido/
    )

    await assert.rejects(
      () =>
        cryptoV3
          .createMAProfessorBackupV3KeyMaterial(
            toBase64Url(
              crypto.getRandomValues(
                new Uint8Array(32)
              )
            )
          ),
      /tamanho esperado/
    )
  }
)

test(
  'v3 refuses to unwrap the master key with a different OPAQUE export key',
  async () => {
    const created =
      await cryptoV3
        .createMAProfessorBackupV3KeyMaterial(
          randomExportKey()
        )

    await assert.rejects(
      () =>
        cryptoV3
          .unwrapMAProfessorBackupV3MasterKey(
            randomExportKey(),
            created.wrapped
          ),
      /Não foi possível abrir a chave de cópia/
    )
  }
)

test(
  'v3 refuses an altered wrapped master key',
  async () => {
    const exportKey =
      randomExportKey()

    const created =
      await cryptoV3
        .createMAProfessorBackupV3KeyMaterial(
          exportKey
        )

    const original =
      created.wrapped
        .recoveryWrappedMasterKey

    const replacement =
      original.endsWith('A')
        ? 'B'
        : 'A'

    const tampered = {
      ...created.wrapped,
      recoveryWrappedMasterKey:
        original.slice(0, -1) +
        replacement
    }

    await assert.rejects(
      () =>
        cryptoV3
          .unwrapMAProfessorBackupV3MasterKey(
            exportKey,
            tampered
          ),
      /Não foi possível abrir a chave de cópia/
    )
  }
)

test(
  'v3 rejects incompatible HKDF domain parameters before attempting unwrap',
  async () => {
    const exportKey =
      randomExportKey()

    const created =
      await cryptoV3
        .createMAProfessorBackupV3KeyMaterial(
          exportKey
        )

    const incompatible = {
      ...created.wrapped,
      recoveryKdfParameters:
        JSON.stringify({
          version: 1,
          hash: 'SHA-256',
          context:
            'MA-CODE/MA-Professor/cloud-backup/v2/wrong-domain'
        })
    }

    await assert.rejects(
      () =>
        cryptoV3
          .unwrapMAProfessorBackupV3MasterKey(
            exportKey,
            incompatible
          ),
      /parâmetros incompatíveis/
    )
  }
)

test(
  'v3 source keeps separate HKDF and key-wrap domains and never persists a password',
  () => {
    assert.match(
      source,
      /MA-CODE\/MA-Professor\/cloud-backup\/v3\/wrapping-key/
    )
    assert.match(
      source,
      /MA-CODE\/MA-Professor\/cloud-backup\/v3\/master-key-wrap/
    )
    assert.doesNotMatch(
      source,
      /localStorage|sessionStorage/
    )
    assert.doesNotMatch(
      source,
      /\bpassword\b/i
    )
  }
)
