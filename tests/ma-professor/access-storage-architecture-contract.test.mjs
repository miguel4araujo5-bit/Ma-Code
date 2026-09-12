import assert from 'node:assert/strict'
import {
  readFile,
  readdir
} from 'node:fs/promises'
import test from 'node:test'

const ROOT = new URL('../../', import.meta.url)

const ACCESS_CORE_KEY =
  'ma-professor-access-state-v1'

const SESSION_LIFECYCLE_FILE =
  'maProfessorSessionLifecycleState.ts'

const SESSION_LIFECYCLE_FACTORY =
  'createMAProfessorSessionLifecycleState'

const SPLITS = [
  {
    field: 'sessions',
    file: 'maProfessorAccessSessionSplitBridge.ts',
    factory: 'createMAProfessorAccessSessionSplitState',
    variable: 'sessionSplitState',
    key: 'ma-professor-access-sessions-v1'
  },
  {
    field: 'accessRequests',
    file: 'maProfessorAccessRequestSplitBridge.ts',
    factory: 'createMAProfessorAccessRequestSplitState',
    variable: 'requestSplitState',
    key: 'ma-professor-access-requests-v1'
  },
  {
    field: 'renewals',
    file: 'maProfessorAccessRenewalSplitBridge.ts',
    factory: 'createMAProfessorAccessRenewalSplitState',
    variable: 'renewalSplitState',
    key: 'ma-professor-access-renewals-v1'
  },
  {
    field: 'credentials',
    file: 'maProfessorAccessCredentialSplitBridge.ts',
    factory: 'createMAProfessorAccessCredentialSplitState',
    variable: 'credentialSplitState',
    key: 'ma-professor-access-credentials-v1'
  },
  {
    field: 'licenses',
    file: 'maProfessorAccessLicenseSplitBridge.ts',
    factory: 'createMAProfessorAccessLicenseSplitState',
    variable: 'licenseSplitState',
    key: 'ma-professor-access-licenses-v1'
  }
]

async function read(relativePath) {
  return readFile(
    new URL(relativePath, ROOT),
    'utf8'
  )
}

test(
  'production composes all access-state splits and the session lifecycle guard in the migration-safe order',
  async () => {
    const retention =
      await read(
        'worker/maProfessorAccessRetentionBridge.ts'
      )

    const entry =
      await read(
        'worker/entry.ts'
      )

    assert.match(
      entry,
      /from ['"]\.\/maProfessorAccessRetentionBridge['"]/
    )

    let previousPosition = -1

    for (const split of SPLITS) {
      const declaration =
        `const ${split.variable}`
      const declarationPosition =
        retention.indexOf(declaration)

      assert.ok(
        declarationPosition > previousPosition,
        `${split.field} deve manter a ordem documentada na composição.`
      )

      const factoryPosition =
        retention.indexOf(
          split.factory,
          declarationPosition
        )

      assert.ok(
        factoryPosition > declarationPosition,
        `${split.factory} deve compor ${split.field}.`
      )

      previousPosition =
        declarationPosition
    }

    const lifecycleDeclarationPosition =
      retention.indexOf(
        'const sessionLifecycleState',
        previousPosition
      )

    assert.ok(
      lifecycleDeclarationPosition >
        previousPosition,
      'O lifecycle guard deve receber o estado lógico já recomposto pelos cinco splits.'
    )

    const lifecycleFactoryPosition =
      retention.indexOf(
        SESSION_LIFECYCLE_FACTORY,
        lifecycleDeclarationPosition
      )

    assert.ok(
      lifecycleFactoryPosition >
        lifecycleDeclarationPosition
    )

    assert.match(
      retention.slice(
        lifecycleDeclarationPosition
      ),
      /createMAProfessorSessionLifecycleState\(\s*licenseSplitState\s*\)/
    )

    const retentionPosition =
      retention.indexOf(
        'createRetentionGuardedState(',
        lifecycleDeclarationPosition
      )

    assert.ok(
      retentionPosition >
        lifecycleDeclarationPosition,
      'A retenção deve correr depois da política de ciclo de vida das sessões.'
    )

    assert.match(
      retention.slice(retentionPosition),
      /createRetentionGuardedState\(\s*sessionLifecycleState\s*\)/
    )
  }
)

test(
  'each aggregate has one dedicated physical key and keeps the shared logical AccessState contract',
  async () => {
    for (const split of SPLITS) {
      const source =
        await read(
          `worker/${split.file}`
        )

      assert.match(
        source,
        new RegExp(
          `['"]${ACCESS_CORE_KEY}['"]`
        ),
        `${split.file} deve continuar a adaptar a chave lógica comum.`
      )

      assert.match(
        source,
        new RegExp(
          `['"]${split.key}['"]`
        ),
        `${split.file} deve manter a sua chave física dedicada.`
      )

      assert.match(
        source,
        new RegExp(
          `export function ${split.factory}`
        )
      )

      assert.match(
        source,
        /schemaVersion:\s*1/
      )

      assert.match(
        source,
        /structuredClone/
      )

      assert.match(
        source,
        /Object\.prototype\.hasOwnProperty\.call/
      )

      assert.doesNotMatch(
        source,
        /setInterval\s*\(|setTimeout\s*\(|scheduled\s*\(|alarm\s*\(/,
        `${split.file} não deve introduzir polling, timers, scheduled handlers ou alarms.`
      )
    }
  }
)

test(
  'session lifecycle remains an internal state guard with no polling or Cloudflare resource of its own',
  async () => {
    const lifecycle =
      await read(
        `worker/${SESSION_LIFECYCLE_FILE}`
      )
    const wrangler =
      await read('wrangler.jsonc')

    assert.match(
      lifecycle,
      new RegExp(
        `['"]${ACCESS_CORE_KEY}['"]`
      )
    )
    assert.match(
      lifecycle,
      new RegExp(
        `export function ${SESSION_LIFECYCLE_FACTORY}`
      )
    )
    assert.match(
      lifecycle,
      /MA_PROFESSOR_SESSION_ABSOLUTE_MAX_AGE_DAYS\s*=\s*\n?\s*180/
    )
    assert.doesNotMatch(
      lifecycle,
      /setInterval\s*\(|setTimeout\s*\(|scheduled\s*\(|alarm\s*\(/
    )
    assert.doesNotMatch(
      wrangler,
      /SessionLifecycle|session-lifecycle|SESSION_LIFECYCLE/
    )
  }
)

test(
  'split storage keys are private implementation details of their owning bridges',
  async () => {
    const workerDirectory =
      new URL('worker/', ROOT)

    const workerFiles =
      (await readdir(workerDirectory))
        .filter(name =>
          name.endsWith('.ts')
        )

    for (const split of SPLITS) {
      const owners = []

      for (const file of workerFiles) {
        const source =
          await read(`worker/${file}`)

        if (source.includes(split.key)) {
          owners.push(file)
        }
      }

      assert.deepEqual(
        owners,
        [split.file],
        `${split.key} só pode ser acedida diretamente pelo bridge que a possui.`
      )
    }
  }
)

test(
  'the five split stores and lifecycle guard do not require Cloudflare bindings or Wrangler migrations',
  async () => {
    const wrangler =
      await read('wrangler.jsonc')

    for (const split of SPLITS) {
      assert.doesNotMatch(
        wrangler,
        new RegExp(split.key),
        `${split.key} é armazenamento interno do DO existente, não um binding.`
      )
    }

    const splitFiles =
      (await readdir(
        new URL('worker/', ROOT)
      ))
        .filter(name =>
          /^maProfessorAccess.*SplitBridge\.ts$/.test(name)
        )
        .sort()

    assert.deepEqual(
      splitFiles,
      SPLITS
        .map(split => split.file)
        .sort(),
      'Alterar o conjunto de splits exige atualizar deliberadamente este contrato e a documentação da arquitetura.'
    )
  }
)
