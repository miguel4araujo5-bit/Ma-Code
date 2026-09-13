import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/GroupsSetupStep.tsx',
    import.meta.url
  ),
  'utf8'
)

const output = ts.transpileModule(
  source,
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
  'onboarding offers every year from 1st to 12th',
  () => {
    for (let year = 1; year <= 12; year += 1) {
      assert.match(
        source,
        new RegExp(
          `\\{ id: '${year}', label: '${year}\\.º' \\}`
        )
      )
    }
  }
)

test(
  'onboarding no longer claims that only professional secondary education is supported',
  () => {
    assert.doesNotMatch(
      source,
      /No ensino profissional trabalhamos apenas com 10\.º, 11\.º e 12\.º/
    )

    assert.match(
      source,
      /Pode configurar turmas do 1\.º ao 12\.º ano, incluindo ensino básico, secundário e profissional\./
    )
  }
)

test(
  'existing critical 11th-year onboarding selectors stay compatible with the browser E2E',
  () => {
    assert.match(source, /\{ id: '11', label: '11\.º' \}/)
    assert.match(source, /Que turmas leciona\?/)
    assert.match(source, /Adicionar turma/)
    assert.match(source, /Turma adicionada\./)
    assert.match(source, /Continuar para as disciplinas/)
  }
)

test(
  'created groups keep using the generic group model with grade and optional course',
  () => {
    assert.match(
      source,
      /maProfessorRepository\.createGroup\(\{[\s\S]*?courseName:\s*''[\s\S]*?gradeLevel:/
    )
    assert.match(source, /active:\s*true/)
  }
)
