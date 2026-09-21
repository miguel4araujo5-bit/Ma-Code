const CRYPTO_VERSION =
  3 as const

const MASTER_KEY_BYTES =
  32

const OPAQUE_EXPORT_KEY_BYTES =
  64

const KDF_SALT_BYTES =
  32

const NONCE_BYTES =
  12

export const MA_PROFESSOR_BACKUP_V3_KDF_ALGORITHM =
  'OPAQUE-RFC9807-EXPORT-HKDF-SHA256' as const

export const MA_PROFESSOR_BACKUP_V3_KEY_WRAP_ALGORITHM =
  'AES-256-GCM' as const

export const MA_PROFESSOR_BACKUP_V3_KDF_CONTEXT =
  'MA-CODE/MA-Professor/cloud-backup/v3/wrapping-key' as const

export const MA_PROFESSOR_BACKUP_V3_WRAP_AAD =
  'MA-CODE/MA-Professor/cloud-backup/v3/master-key-wrap' as const

const textEncoder =
  new TextEncoder()

export interface MAProfessorBackupV3WrappedMasterKey {
  cryptoVersion:
    typeof CRYPTO_VERSION
  recoveryKdfAlgorithm:
    typeof MA_PROFESSOR_BACKUP_V3_KDF_ALGORITHM
  recoveryKdfSalt:
    string
  recoveryKdfParameters:
    string
  recoveryKeyWrapAlgorithm:
    typeof MA_PROFESSOR_BACKUP_V3_KEY_WRAP_ALGORITHM
  recoveryWrappedMasterKey:
    string
  recoveryWrappedMasterKeyNonce:
    string
}

export interface MAProfessorBackupV3KeyMaterial {
  masterKey:
    CryptoKey
  wrapped:
    MAProfessorBackupV3WrappedMasterKey
}

function assertWebCrypto() {
  if (
    !globalThis.crypto?.subtle
  ) {
    throw new Error(
      'Este browser não suporta a proteção criptográfica necessária.'
    )
  }
}

function toArrayBuffer(
  bytes: Uint8Array
): ArrayBuffer {
  const copy =
    new Uint8Array(
      bytes.byteLength
    )

  copy.set(bytes)

  return copy.buffer
}

function bytesToBase64Url(
  bytes: Uint8Array
) {
  let binary = ''
  const chunkSize =
    0x8000

  for (
    let offset = 0;
    offset < bytes.length;
    offset += chunkSize
  ) {
    const chunk =
      bytes.subarray(
        offset,
        Math.min(
          offset + chunkSize,
          bytes.length
        )
      )

    binary +=
      String.fromCharCode(
        ...chunk
      )
  }

  return globalThis
    .btoa(binary)
    .split('+').join('-')
    .split('/').join('_')
    .split('=').join('')
}

function base64UrlToBytes(
  value: string,
  label: string
) {
  const normalized =
    value.trim()

  if (
    !normalized ||
    !/^[A-Za-z0-9_-]+$/.test(
      normalized
    )
  ) {
    throw new Error(
      `${label} não tem um formato válido.`
    )
  }

  const padding =
    '='.repeat(
      (4 -
        (
          normalized.length %
          4
        )) %
        4
    )

  let binary: string

  try {
    binary =
      globalThis.atob(
        normalized
          .split('-').join('+')
          .split('_').join('/') +
        padding
      )
  } catch {
    throw new Error(
      `${label} não tem um formato válido.`
    )
  }

  const bytes =
    new Uint8Array(
      binary.length
    )

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(index)
  }

  return bytes
}

function readExportKey(
  exportKey: string
) {
  const bytes =
    base64UrlToBytes(
      exportKey,
      'A chave de autenticação protegida'
    )

  if (
    bytes.byteLength !==
      OPAQUE_EXPORT_KEY_BYTES
  ) {
    throw new Error(
      'A chave de autenticação protegida não tem o tamanho esperado.'
    )
  }

  return bytes
}

function createKdfParameters() {
  return JSON.stringify({
    version: 1,
    hash: 'SHA-256',
    context:
      MA_PROFESSOR_BACKUP_V3_KDF_CONTEXT
  })
}

function parseKdfParameters(
  value: string
) {
  let parsed:
    unknown

  try {
    parsed =
      JSON.parse(value)
  } catch {
    throw new Error(
      'Os parâmetros de proteção da chave de cópia não são válidos.'
    )
  }

  if (
    !parsed ||
    typeof parsed !==
      'object' ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      'Os parâmetros de proteção da chave de cópia não são válidos.'
    )
  }

  const record =
    parsed as
      Record<
        string,
        unknown
      >

  if (
    record.version !== 1 ||
    record.hash !==
      'SHA-256' ||
    record.context !==
      MA_PROFESSOR_BACKUP_V3_KDF_CONTEXT
  ) {
    throw new Error(
      'A proteção da chave de cópia utiliza parâmetros incompatíveis.'
    )
  }
}

async function deriveWrappingKey(
  exportKey: string,
  salt: Uint8Array
) {
  assertWebCrypto()

  const keyMaterial =
    await globalThis.crypto.subtle.importKey(
      'raw',
      toArrayBuffer(
        readExportKey(
          exportKey
        )
      ),
      'HKDF',
      false,
      [
        'deriveKey'
      ]
    )

  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt:
        toArrayBuffer(
          salt
        ),
      info:
        toArrayBuffer(
          textEncoder.encode(
            MA_PROFESSOR_BACKUP_V3_KDF_CONTEXT
          )
        )
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    [
      'encrypt',
      'decrypt'
    ]
  )
}

async function importMasterKey(
  bytes: Uint8Array
) {
  assertWebCrypto()

  if (
    bytes.byteLength !==
      MASTER_KEY_BYTES
  ) {
    throw new Error(
      'A chave mestre da cópia não tem o tamanho esperado.'
    )
  }

  return globalThis.crypto.subtle.importKey(
    'raw',
    toArrayBuffer(bytes),
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    [
      'encrypt',
      'decrypt'
    ]
  )
}

export async function createMAProfessorBackupV3KeyMaterial(
  exportKey: string
): Promise<MAProfessorBackupV3KeyMaterial> {
  assertWebCrypto()

  const salt =
    globalThis.crypto.getRandomValues(
      new Uint8Array(
        KDF_SALT_BYTES
      )
    )

  const nonce =
    globalThis.crypto.getRandomValues(
      new Uint8Array(
        NONCE_BYTES
      )
    )

  const masterKeyBytes =
    globalThis.crypto.getRandomValues(
      new Uint8Array(
        MASTER_KEY_BYTES
      )
    )

  const wrappingKey =
    await deriveWrappingKey(
      exportKey,
      salt
    )

  const wrappedBuffer =
    await globalThis.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv:
          nonce,
        additionalData:
          textEncoder.encode(
            MA_PROFESSOR_BACKUP_V3_WRAP_AAD
          ),
        tagLength: 128
      },
      wrappingKey,
      toArrayBuffer(
        masterKeyBytes
      )
    )

  const masterKey =
    await importMasterKey(
      masterKeyBytes
    )

  masterKeyBytes.fill(0)

  return {
    masterKey,
    wrapped: {
      cryptoVersion:
        CRYPTO_VERSION,
      recoveryKdfAlgorithm:
        MA_PROFESSOR_BACKUP_V3_KDF_ALGORITHM,
      recoveryKdfSalt:
        bytesToBase64Url(
          salt
        ),
      recoveryKdfParameters:
        createKdfParameters(),
      recoveryKeyWrapAlgorithm:
        MA_PROFESSOR_BACKUP_V3_KEY_WRAP_ALGORITHM,
      recoveryWrappedMasterKey:
        bytesToBase64Url(
          new Uint8Array(
            wrappedBuffer
          )
        ),
      recoveryWrappedMasterKeyNonce:
        bytesToBase64Url(
          nonce
        )
    }
  }
}

export async function unwrapMAProfessorBackupV3MasterKey(
  exportKey: string,
  wrapped:
    MAProfessorBackupV3WrappedMasterKey
) {
  assertWebCrypto()

  if (
    wrapped.cryptoVersion !==
      CRYPTO_VERSION ||
    wrapped.recoveryKdfAlgorithm !==
      MA_PROFESSOR_BACKUP_V3_KDF_ALGORITHM ||
    wrapped.recoveryKeyWrapAlgorithm !==
      MA_PROFESSOR_BACKUP_V3_KEY_WRAP_ALGORITHM
  ) {
    throw new Error(
      'A proteção da chave de cópia utiliza uma versão incompatível.'
    )
  }

  parseKdfParameters(
    wrapped.recoveryKdfParameters
  )

  const salt =
    base64UrlToBytes(
      wrapped.recoveryKdfSalt,
      'O salt da chave de cópia'
    )

  const nonce =
    base64UrlToBytes(
      wrapped.recoveryWrappedMasterKeyNonce,
      'O nonce da chave de cópia'
    )

  const ciphertext =
    base64UrlToBytes(
      wrapped.recoveryWrappedMasterKey,
      'A chave mestre protegida'
    )

  if (
    salt.byteLength !==
      KDF_SALT_BYTES ||
    nonce.byteLength !==
      NONCE_BYTES
  ) {
    throw new Error(
      'A proteção da chave de cópia contém parâmetros inválidos.'
    )
  }

  const wrappingKey =
    await deriveWrappingKey(
      exportKey,
      salt
    )

  let masterKeyBuffer:
    ArrayBuffer

  try {
    masterKeyBuffer =
      await globalThis.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv:
            nonce,
          additionalData:
            textEncoder.encode(
              MA_PROFESSOR_BACKUP_V3_WRAP_AAD
            ),
          tagLength: 128
        },
        wrappingKey,
        toArrayBuffer(
          ciphertext
        )
      )
  } catch {
    throw new Error(
      'Não foi possível abrir a chave de cópia com esta password.'
    )
  }

  const masterKeyBytes =
    new Uint8Array(
      masterKeyBuffer
    )

  const masterKey =
    await importMasterKey(
      masterKeyBytes
    )

  masterKeyBytes.fill(0)

  return masterKey
}
