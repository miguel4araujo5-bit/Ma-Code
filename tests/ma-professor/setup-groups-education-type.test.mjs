import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const [
  setupSource,
  typesSource
] = await Promise.all([
  readFile(
    new URL(
      '../../src/components/ma-professor/setup/GroupsSetupStep.tsx',
      import.meta.url
    ),
    'utf8'
  ),
  readFile(
    new URL(
      '../../src/components/ma-professor/types.ts',
      import.meta.url
    ),
    'utf8'
  )
])

const output = ts.transpileModule(
  setupSource,
  {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
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
  errors.map(diagnostic =>
    ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      '\n'
    )
  ).join('\n')
)

test(
  'class groups persist an optional regular/professional education type without invalidating legacy records',
  () => {
    assert.match(
      typesSource,
      /export type EducationType\s*=\s*[\s\S]*?'professional'[\s\S]*?'regular'/
    )
    assert.match(
      typesSource,
      /educationType\?:\s*EducationType/
    )
  }
)

test(
  'legacy groups and the existing onboarding path default to professional education',
  () => {
    assert.match(
      setupSource,
      /return group\.educationType \?\?\s*'professional'/
    )
    assert.match(
      setupSource,
      /useState<EducationType>\(\s*'professional'\s*\)/
    )
  }
)

test(
  'professional setup keeps grades 10 to 12 while regular education can use every configured grade',
  () => {
    assert.match(
      setupSource,
      /selectedEducationType ===\s*'professional'[\s\S]*?gradeLevels\.filter[\s\S]*?Number\([\s\S]*?grade\.id[\s\S]*?\)\s*>= 10[\s\S]*?: gradeLevels/
    )
    assert.match(
      setupSource,
      /Ensino profissional/
    )
    assert.match(
      setupSource,
      /Ensino regular/
    )
    assert.match(
      setupSource,
      /1\.º ao 12\.º ano · organização regular da disciplina\./
    )
  }
)

test(
  'new groups persist the selected education type',
  () => {
    assert.match(
      setupSource,
      /maProfessorRepository\.createGroup\(\{[\s\S]*?educationType:\s*selectedEducationType[\s\S]*?active:\s*true/
    )
  }
)

test(
  'education type cannot be changed after curricular assignments exist',
  () => {
    assert.match(
      setupSource,
      /editingGroupHasAssignments[\s\S]*?snapshot\.teachingAssignments\.some/
    )
    assert.match(
      setupSource,
      /disabled=\{\s*editingGroupHasAssignments\s*\}/
    )
    assert.match(
      setupSource,
      /O tipo de ensino fica bloqueado depois de existirem disciplinas associadas/
    )
  }
)
