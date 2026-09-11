import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyCriteriaGridRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const dailyWorkspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

function assertTranspiles(
  source,
  fileName
) {
  const output = ts.transpileModule(
    source,
    {
      fileName,
      compilerOptions: {
        module:
          ts.ModuleKind.ESNext,
        target:
          ts.ScriptTarget.ES2022,
        jsx:
          ts.JsxEmit.ReactJSX
      },
      reportDiagnostics: true
    }
  )

  const errors =
    (output.diagnostics || [])
      .filter(
        item =>
          item.category ===
          ts.DiagnosticCategory.Error
      )

  assert.equal(
    errors.length,
    0,
    errors
      .map(item => item.messageText)
      .join('\n')
  )
}

test(
  'criteria grid repository and Daily workspace transpile',
  () => {
    assertTranspiles(
      repositorySource,
      'dailyCriteriaGridRepository.ts'
    )
    assertTranspiles(
      dailyWorkspaceSource,
      'DailyWorkspaceView.tsx'
    )
  }
)

test(
  'daily grid stores one managed assessment per real criterion',
  () => {
    assert.match(
      repositorySource,
      /criterionId/
    )
    assert.match(
      repositorySource,
      /Registo diário/
    )
    assert.match(
      repositorySource,
      /createLessonAssessmentWithResults/
    )
    assert.match(
      repositorySource,
      /saveAssessmentResults/
    )
  }
)

test(
  'present students require 0-20 scores while absent students are omitted',
  () => {
    assert.match(
      repositorySource,
      /score < 0 \|\|[\s\S]*score > 20/
    )
    assert.match(
      repositorySource,
      /row\.attendanceStatus ===[\s\S]*'absent'[\s\S]*return \[\]/
    )
  }
)

test(
  'daily mean respects criterion weights',
  () => {
    assert.match(
      repositorySource,
      /score \*[\s\S]*criterion\.weightPercent/
    )
    assert.match(
      repositorySource,
      /weightedTotal \/[\s\S]*assessedWeight/
    )
  }
)

test(
  'Daily grid renders criteria, weighted mean and default ten values',
  () => {
    assert.match(
      dailyWorkspaceSource,
      /criteria\.map\(/
    )
    assert.match(
      dailyWorkspaceSource,
      /data-criterion-id=/
    )
    assert.match(
      dailyWorkspaceSource,
      /calculateDailyCriteriaAverage\(/
    )
    assert.match(
      dailyWorkspaceSource,
      /'10'/
    )
  }
)

test(
  'Daily grid removes the old assessment bureaucracy and scroll explanation',
  () => {
    assert.doesNotMatch(
      dailyWorkspaceSource,
      /Detalhes da avaliação/
    )
    assert.doesNotMatch(
      dailyWorkspaceSource,
      /Atividade nesta aula/
    )
    assert.doesNotMatch(
      dailyWorkspaceSource,
      /A lista tem[\s\S]*deslocamento próprio/
    )
    assert.match(
      dailyWorkspaceSource,
      /Atividade avaliada/
    )
  }
)
