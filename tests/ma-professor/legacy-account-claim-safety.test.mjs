import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const isolationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/access/AccountIsolationGate.tsx',
    import.meta.url
  ),
  'utf8'
)

function position(
  needle,
  start = 0
) {
  const found =
    isolationSource.indexOf(
      needle,
      start
    )

  assert.ok(
    found >= 0,
    `Não foi encontrado no AccountIsolationGate: ${needle}`
  )

  return found
}

test(
  'legacy meaningful data without an owner requires explicit claim before the account can become ready',
  () => {
    const ownerRead =
      position(
        'const owner ='
      )

    const noOwnerDataCheck =
      position(
        'const hasLocalData =',
        ownerRead
      )

    const meaningfulCheck =
      position(
        'if (hasLocalData) {',
        noOwnerDataCheck
      )

    const claimRequired =
      position(
        "'claim-required'",
        meaningfulCheck
      )

    const returnAfterClaimRequired =
      position(
        'return',
        claimRequired
      )

    const automaticClaim =
      position(
        'await claimLocalDataOwner(',
        returnAfterClaimRequired
      )

    assert.ok(
      meaningfulCheck < claimRequired
    )
    assert.ok(
      claimRequired < returnAfterClaimRequired
    )
    assert.ok(
      returnAfterClaimRequired < automaticClaim,
      'Dados legados significativos têm de sair do inspect antes de qualquer associação automática.'
    )
  }
)

test(
  'automatic ownership claim is reserved for a browser without meaningful pedagogical data',
  () => {
    const ownerRead =
      position(
        'const owner ='
      )

    const noOwnerDataCheck =
      position(
        'const hasLocalData =',
        ownerRead
      )

    const meaningfulBranch =
      position(
        'if (hasLocalData) {',
        noOwnerDataCheck
      )

    const claimRequired =
      position(
        "'claim-required'",
        meaningfulBranch
      )

    const branchReturn =
      position(
        'return',
        claimRequired
      )

    const automaticClaim =
      position(
        'await claimLocalDataOwner(',
        branchReturn
      )

    assert.ok(
      automaticClaim > branchReturn
    )

    assert.match(
      isolationSource.slice(
        meaningfulBranch,
        automaticClaim
      ),
      /setStage\(\s*'claim-required'\s*\)[\s\S]*?return/
    )
  }
)

test(
  'legacy claim is only completed by the explicit confirmation handler',
  () => {
    const handlerStart =
      position(
        'const handleClaim ='
      )

    const handlerClaim =
      position(
        'await claimLocalDataOwner(',
        handlerStart
      )

    const handlerEnd =
      position(
        "if (\n    stage ===\n    'ready'",
        handlerClaim
      )

    assert.ok(
      handlerClaim > handlerStart
    )
    assert.ok(
      handlerClaim < handlerEnd
    )

    const claimRequiredUi =
      position(
        "stage ===\n    'claim-required'",
        handlerEnd
      )

    const claimButton =
      position(
        'void handleClaim()',
        claimRequiredUi
      )

    assert.ok(
      claimButton > claimRequiredUi
    )

    assert.match(
      isolationSource.slice(
        claimRequiredUi,
        claimButton + 200
      ),
      /Sim, estes dados pertencem a esta conta/
    )
  }
)

test(
  'legacy confirmation identifies the current account and offers a safe exit instead of exposing the data',
  () => {
    const claimRequiredUi =
      position(
        "stage ===\n    'claim-required'"
      )

    const conflictUi =
      position(
        "stage ===\n    'conflict'",
        claimRequiredUi
      )

    const claimMarkup =
      isolationSource.slice(
        claimRequiredUi,
        conflictUi
      )

    assert.match(
      claimMarkup,
      /\{session\.email\}/
    )

    assert.match(
      claimMarkup,
      /Confirme apenas se estes dados pertencem à conta:/i
    )

    assert.match(
      claimMarkup,
      /void signOut\(\)/
    )

    assert.match(
      claimMarkup,
      /Usar outra conta/
    )

    assert.doesNotMatch(
      claimMarkup,
      /return children/
    )
  }
)

test(
  'children are exposed only after the isolation stage is ready',
  () => {
    const readyStage =
      position(
        "stage ===\n    'ready'"
      )

    const childrenReturn =
      position(
        'return children',
        readyStage
      )

    const checkingStage =
      position(
        "stage ===\n    'checking'",
        childrenReturn
      )

    assert.ok(
      childrenReturn > readyStage
    )
    assert.ok(
      childrenReturn < checkingStage
    )
  }
)

test(
  'a concurrent claim by another account cannot be silently overwritten',
  () => {
    const claimFunction =
      position(
        'async function claimLocalDataOwner('
      )

    const transactionStart =
      position(
        "ownershipDb.transaction(\n    'rw'",
        claimFunction
      )

    const existingRead =
      position(
        'const existing =',
        transactionStart
      )

    const existingGuard =
      position(
        'if (existing) {',
        existingRead
      )

    const sameOwnerOnly =
      position(
        'normalizeEmail(',
        existingGuard
      )

    const addOwner =
      position(
        '.add({',
        sameOwnerOnly
      )

    assert.ok(
      transactionStart < existingRead
    )
    assert.ok(
      existingRead < existingGuard
    )
    assert.ok(
      existingGuard < addOwner
    )

    assert.match(
      isolationSource.slice(
        existingGuard,
        addOwner
      ),
      /existing\.email[\s\S]*?normalizedEmail/
    )
  }
)

test(
  'default untouched settings alone do not force a legacy ownership prompt',
  () => {
    const meaningfulFunction =
      position(
        'async function hasMeaningfulLocalData()'
      )

    const functionEnd =
      position(
        '\n}\n\nfunction GuardShell',
        meaningfulFunction
      )

    const meaningfulBody =
      isolationSource.slice(
        meaningfulFunction,
        functionEnd
      )

    assert.match(
      meaningfulBody,
      /table\.name !==\s*'settings'/
    )

    assert.match(
      meaningfulBody,
      /MA_PROFESSOR_DEFAULT_SETTINGS_ID/
    )

    assert.match(
      meaningfulBody,
      /localSettings\.updatedAt !==\s*localSettings\.createdAt/
    )
  }
)
