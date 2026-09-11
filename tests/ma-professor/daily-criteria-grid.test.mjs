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

function getSection(
  source,
  startMarker,
  endMarker
) {
  const start = source.indexOf(
    startMarker
  )
  const end = source.indexOf(
    endMarker,
    start
  )

  assert.notEqual(
    start,
    -1,
    `Não foi encontrado ${startMarker}`
  )
  assert.notEqual(
    end,
    -1,
    `Não foi encontrado ${endMarker}`
  )

  return source.slice(
    start,
    end
  )
}

async function loadScoreHelpers() {
  const source = [
    getSection(
      repositorySource,
      'const DAILY_SCORE_PATTERN =',
      '\n\nexport interface DailyCriteriaGridSnapshot'
    ),
    getSection(
      repositorySource,
      'function roundScore(',
      '\n\nfunction isDailyGridAssessment('
    ),
    getSection(
      repositorySource,
      'export function normalizeDailyCriterionScoreInput(',
      '\n\nexport function calculateDailyCriteriaAverage('
    )
  ].join('\n\n')

  const output = ts.transpileModule(
    source,
    {
      compilerOptions: {
        module:
          ts.ModuleKind.ESNext,
        target:
          ts.ScriptTarget.ES2022
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

  return import(
    `data:text/javascript;base64,${Buffer.from(
      output.outputText
    ).toString('base64')}`
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
  'daily score input normalizes decimal comma without silently repairing invalid text',
  async () => {
    const helpers =
      await loadScoreHelpers()

    assert.equal(
      helpers.normalizeDailyCriterionScoreInput(
        '17,5'
      ),
      '17.5'
    )
    assert.equal(
      helpers.normalizeDailyCriterionScoreInput(
        '-1'
      ),
      '-1'
    )
    assert.equal(
      helpers.normalizeDailyCriterionScoreInput(
        '1a5'
      ),
      '1a5'
    )
    assert.equal(
      helpers.normalizeDailyCriterionScoreInput(
        '1..5'
      ),
      '1..5'
    )
  }
)

test(
  'daily score parser accepts only explicit 0-20 decimal values with at most two decimal places',
  async () => {
    const helpers =
      await loadScoreHelpers()

    assert.equal(
      helpers.parseDailyCriterionScore(
        '0'
      ),
      0
    )
    assert.equal(
      helpers.parseDailyCriterionScore(
        '17,5'
      ),
      17.5
    )
    assert.equal(
      helpers.parseDailyCriterionScore(
        '20.00'
      ),
      20
    )

    for (const value of [
      '',
      '-1',
      '21',
      '1a5',
      '1..5',
      '1e1',
      '+10',
      '10.123'
    ]) {
      assert.throws(
        () =>
          helpers.parseDailyCriterionScore(
            value
          ),
        /entre 0 e 20 valores/
      )
    }
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
