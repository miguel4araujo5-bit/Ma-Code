import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const [
  viewSource,
  repositorySource
] = await Promise.all([
  readFile(
    new URL(
      '../../src/components/ma-professor/groups/GroupsWorkspaceView.tsx',
      import.meta.url
    ),
    'utf8'
  ),
  readFile(
    new URL(
      '../../src/components/ma-professor/groups/groupsWorkspaceRepository.ts',
      import.meta.url
    ),
    'utf8'
  )
])

for (const [name, source, jsx] of [
  ['view', viewSource, true],
  ['repository', repositorySource, false]
]) {
  const compilerOptions = {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }

  if (jsx) {
    compilerOptions.jsx =
      ts.JsxEmit.ReactJSX
  }

  const output = ts.transpileModule(
    source,
    {
      compilerOptions,
      reportDiagnostics: true
    }
  )

  const errors =
    (output.diagnostics || []).filter(
      diagnostic =>
        diagnostic.category ===
          ts.DiagnosticCategory.Error
    )

  assert.equal(
    errors.length,
    0,
    `${name}: ${errors.map(diagnostic =>
      ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      )
    ).join('\n')}`
  )
}

test(
  'groups workspace keeps legacy groups professional by default',
  () => {
    assert.match(
      viewSource,
      /group\.educationType \?\?[\s\S]*?'professional'/
    )
    assert.match(
      viewSource,
      /educationType:\s*'professional'/
    )
    assert.match(
      repositorySource,
      /input\.educationType \?\?[\s\S]*?'professional'/
    )
  }
)

test(
  'new groups expose and persist regular or professional education',
  () => {
    assert.match(
      viewSource,
      /<option value="professional">[\s\S]*?Ensino profissional/
    )
    assert.match(
      viewSource,
      /<option value="regular">[\s\S]*?Ensino regular/
    )
    assert.match(
      viewSource,
      /onCreateGroup\(\{[\s\S]*?educationType:\s*newGroup\.educationType/
    )
    assert.match(
      repositorySource,
      /educationType\?:\s*EducationType/
    )
  }
)

test(
  'education type editing is locked in the UI after subjects are associated',
  () => {
    assert.match(
      viewSource,
      /selectedGroupHasAssignments/
    )
    assert.match(
      viewSource,
      /disabled=\{[\s\S]*?busy \|\|[\s\S]*?selectedGroupHasAssignments[\s\S]*?\}/
    )
    assert.match(
      viewSource,
      /O tipo de ensino fica bloqueado depois de existirem disciplinas associadas/
    )
  }
)

test(
  'repository rejects changing education type when any teaching assignment exists',
  () => {
    assert.match(
      repositorySource,
      /changes\.educationType !==[\s\S]*?currentEducationType/
    )
    assert.match(
      repositorySource,
      /teachingAssignments[\s\S]*?\.where\([\s\S]*?'groupId'[\s\S]*?\.count\(\)/
    )
    assert.match(
      repositorySource,
      /Não é possível alterar o tipo de ensino depois de existirem disciplinas associadas à turma\./
    )
  }
)

test(
  'regular groups use regular-education wording instead of presenting UFCD as their primary model',
  () => {
    assert.match(
      viewSource,
      /selectedEducationType === 'regular'[\s\S]*?'Disciplinas'[\s\S]*?'Disciplinas e UFCD'/
    )
    assert.match(
      viewSource,
      /'componente curricular'/
    )
  }
)
