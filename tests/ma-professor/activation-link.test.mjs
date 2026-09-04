import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/access/activationLink.ts',
    import.meta.url
  ),
  'utf8'
)

const output = ts.transpileModule(
  source,
  {
    compilerOptions: {
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
  errors.map(
    diagnostic =>
      ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      )
  ).join('\n')
)

const moduleUrl =
  `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`

const {
  getMAProfessorUrlWithoutActivationData,
  readMAProfessorActivationLink
} = await import(moduleUrl)

test(
  'reads the activation link emitted by MA-Professor approval email',
  () => {
    const link =
      readMAProfessorActivationLink(
        'https://ma-code.pt/produtos/ma-professor?acesso=ativar&email=Docente%40Example.com#senha=MP-AAAA-BBBB-CCCC-DDDD'
      )

    assert.deepEqual(
      link,
      {
        email:
          'docente@example.com',
        activationPassword:
          'MP-AAAA-BBBB-CCCC-DDDD'
      }
    )
  }
)

test(
  'also accepts activation data entirely in the fragment for future privacy hardening',
  () => {
    const link =
      readMAProfessorActivationLink(
        'https://ma-code.pt/produtos/ma-professor#acesso=ativar&email=docente%40example.com&senha=mp-1111-2222'
      )

    assert.deepEqual(
      link,
      {
        email:
          'docente@example.com',
        activationPassword:
          'MP-1111-2222'
      }
    )
  }
)

test(
  'does not treat incomplete links as automatic activation links',
  () => {
    assert.equal(
      readMAProfessorActivationLink(
        'https://ma-code.pt/produtos/ma-professor?acesso=ativar&email=docente%40example.com'
      ),
      null
    )
  }
)

test(
  'removes activation credentials from the visible browser URL',
  () => {
    assert.equal(
      getMAProfessorUrlWithoutActivationData(
        'https://ma-code.pt/produtos/ma-professor?acesso=ativar&email=docente%40example.com&origem=email#senha=MP-AAAA-BBBB'
      ),
      '/produtos/ma-professor?origem=email'
    )
  }
)
