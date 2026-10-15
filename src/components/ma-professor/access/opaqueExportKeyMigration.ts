import type {
  MAProfessorOpaqueLegacyExportKeyWrap
} from './accessTypes'

const EXPORT_KEY_BYTES =
  64

const SALT_BYTES =
  32

const NONCE_BYTES =
  12

const WRAP_CONTEXT =
  'MA-CODE/MA-Professor/opaque/mobile-migration/v1'

const WRAP_AAD =
  'MA-CODE/MA-Professor/opaque/mobile-migration/export-key'

const encoder =
  new TextEncoder()

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

  for (
    let offset = 0;
    offset < bytes.length;
    offset += 0x8000
  ) {
    const chunk =
      bytes.subarray(
        offset,
        Math.min(
          offset + 0x8000,
          bytes.length
        )
      )

    binary +=
      String.fromCharCode(
        ...chunk
      )
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function base64UrlToBytes(
  value: string
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
      'A chave protegida não tem um formato válido.'
    )
  }

  const padding =
    '='.repeat(
      (
        4 -
        (
          normalized.length %
          4
        )
      ) % 4
    )

  const binary =
    atob(
      normalized
        .replaceAll('-', '+')
        .replaceAll('_', '/') +
      padding
    )

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
      binary.charCodeAt(
        index
      )
  }

  return bytes
}

function readExportKey(
  value: string
) {
  const bytes =
    base64UrlToBytes(
      value
    )

  if (
    bytes.byteLength !==
      EXPORT_KEY_BYTES
  ) {
    throw new Error(
      'A chave protegida não tem o tamanho esperado.'
    )
  }

  return bytes
}

async function deriveWrappingKey(
  exportKey: string,
  salt: Uint8Array
) {
  const material =
    await globalThis.crypto.subtle.importKey(
      'raw',
      toArrayBuffer(
        readExportKey(
          exportKey
        )
      ),
      'HKDF',
      false,
      ['deriveKey']
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
          encoder.encode(
            WRAP_CONTEXT
          )
        )
    },
    material,
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

export async function wrapMAProfessorLegacyOpaqueExportKey(
  newExportKey: string,
  legacyExportKey: string
): Promise<MAProfessorOpaqueLegacyExportKeyWrap> {
  const salt =
    globalThis.crypto.getRandomValues(
      new Uint8Array(
        SALT_BYTES
      )
    )

  const nonce =
    globalThis.crypto.getRandomValues(
      new Uint8Array(
        NONCE_BYTES
      )
    )

  const wrappingKey =
    await deriveWrappingKey(
      newExportKey,
      salt
    )

  const ciphertext =
    await globalThis.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData:
          encoder.encode(
            WRAP_AAD
          ),
        tagLength: 128
      },
      wrappingKey,
      toArrayBuffer(
        readExportKey(
          legacyExportKey
        )
      )
    )

  return {
    version: 1,
    salt:
      bytesToBase64Url(
        salt
      ),
    nonce:
      bytesToBase64Url(
        nonce
      ),
    ciphertext:
      bytesToBase64Url(
        new Uint8Array(
          ciphertext
        )
      )
  }
}

export async function unwrapMAProfessorLegacyOpaqueExportKey(
  newExportKey: string,
  wrapped:
    MAProfessorOpaqueLegacyExportKeyWrap
) {
  if (
    wrapped.version !== 1
  ) {
    throw new Error(
      'A proteção da chave antiga não é compatível.'
    )
  }

  const salt =
    base64UrlToBytes(
      wrapped.salt
    )

  const nonce =
    base64UrlToBytes(
      wrapped.nonce
    )

  if (
    salt.byteLength !==
      SALT_BYTES ||
    nonce.byteLength !==
      NONCE_BYTES
  ) {
    throw new Error(
      'A proteção da chave antiga contém parâmetros inválidos.'
    )
  }

  const wrappingKey =
    await deriveWrappingKey(
      newExportKey,
      salt
    )

  let plaintext:
    ArrayBuffer

  try {
    plaintext =
      await globalThis.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          additionalData:
            encoder.encode(
              WRAP_AAD
            ),
          tagLength: 128
        },
        wrappingKey,
        toArrayBuffer(
          base64UrlToBytes(
            wrapped.ciphertext
          )
        )
      )
  } catch {
    throw new Error(
      'Não foi possível recuperar a chave compatível da conta.'
    )
  }

  const bytes =
    new Uint8Array(
      plaintext
    )

  if (
    bytes.byteLength !==
      EXPORT_KEY_BYTES
  ) {
    throw new Error(
      'A chave recuperada não tem o tamanho esperado.'
    )
  }

  return bytesToBase64Url(
    bytes
  )
}
