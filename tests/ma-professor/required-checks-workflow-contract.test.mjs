import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workflowSource = await readFile(
  new URL(
    '../../.github/workflows/deploy.yml',
    import.meta.url
  ),
  'utf8'
)

test(
  'required branch-protection checks are emitted for every pull request to main',
  () => {
    assert.doesNotMatch(
      workflowSource,
      /pull_request:[\s\S]{0,180}paths-ignore:/,
      'Validate build e Validate tests são obrigatórios no ruleset; o workflow não pode ignorar PRs apenas por caminho.'
    )

    assert.match(
      workflowSource,
      /name:\s*Validate tests/
    )
    assert.match(
      workflowSource,
      /name:\s*Validate build/
    )
  }
)

test(
  'documentation-only changes keep required checks lightweight',
  () => {
    assert.match(
      workflowSource,
      /coordination\/\*\|docs\/\*\|\*\.md\)[\s\S]*continue/
    )
    assert.match(
      workflowSource,
      /echo "any=\$any" >> "\$GITHUB_OUTPUT"/
    )
    assert.match(
      workflowSource,
      /if: steps\.scope\.outputs\.any == 'true'/
    )
    assert.match(
      workflowSource,
      /if: steps\.build_scope\.outputs\.build == 'true'/
    )
  }
)
