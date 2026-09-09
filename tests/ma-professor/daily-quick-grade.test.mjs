import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const helperSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/dailyQuickGrade.ts',
    import.meta.url
  ),
  'utf8'
)

const sectionSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/DailyLessonAssessmentSection.tsx',
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

function transpile(source, fileName = 'dailyQuickGrade.ts') {
  const output = ts.transpileModule(source, {
    fileName,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    item => item.category === ts.DiagnosticCategory.Error
  )

  assert.equal(
    errors.length,
    0,
    errors.map(item => item.messageText).join('\n')
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const quickGrade = await import(
  transpile(helperSource)
)

test(
  'typing a score makes the row evaluated and clearing a new score makes it not evaluated',
  () => {
    assert.equal(
      quickGrade.resolveQuickGradeStatus(
        'not_evaluated',
        '15'
      ),
      'evaluated'
    )

    assert.equal(
      quickGrade.resolveQuickGradeStatus(
        'evaluated',
        ''
      ),
      'not_evaluated'
    )
  }
)

test(
  'clearing a score never silently removes an explicit absence or exemption',
  () => {
    assert.equal(
      quickGrade.resolveQuickGradeStatus(
        'absent',
        ''
      ),
      'absent'
    )

    assert.equal(
      quickGrade.resolveQuickGradeStatus(
        'exempt',
        ''
      ),
      'exempt'
    )
  }
)

test(
  'an empty quick grid does not count as assessment data',
  () => {
    assert.equal(
      quickGrade.hasQuickGradeData([
        { status: 'not_evaluated' },
        { status: 'not_evaluated' }
      ]),
      false
    )

    assert.equal(
      quickGrade.hasQuickGradeData([
        { status: 'not_evaluated' },
        { status: 'evaluated' }
      ]),
      true
    )

    assert.equal(
      quickGrade.hasQuickGradeData([
        { status: 'absent' }
      ]),
      true
    )
  }
)

test(
  'criterion default is automatic only when unambiguous or derived from prior explicit use',
  () => {
    assert.equal(
      quickGrade.resolveQuickCriterionId(
        [{ id: 'c1' }],
        []
      ),
      'c1'
    )

    assert.equal(
      quickGrade.resolveQuickCriterionId(
        [{ id: 'c1' }, { id: 'c2' }],
        []
      ),
      ''
    )

    assert.equal(
      quickGrade.resolveQuickCriterionId(
        [{ id: 'c1' }, { id: 'c2' }],
        [
          { criterionId: 'c1' },
          { criterionId: 'old' },
          { criterionId: 'c2' }
        ]
      ),
      'c2'
    )
  }
)

test(
  'quick assessment title is deterministic and does not require teacher typing',
  () => {
    assert.equal(
      quickGrade.buildQuickAssessmentTitle(
        '2026-09-08',
        'Participação'
      ),
      'Participação · 08/09/2026'
    )

    assert.equal(
      quickGrade.buildQuickAssessmentTitle(
        '2026-09-08',
        ''
      ),
      'Avaliação · 08/09/2026'
    )
  }
)

test(
  'Daily quick-grade grid is immediately reachable without the old new-assessment gate',
  () => {
    assert.match(
      sectionSource,
      /nextWorkspace\.assessments\[0\]\?\.assessment\.id\s*\?\?\s*['"]new['"]/s
    )
    assert.match(sectionSource, /Nota 0–20/)
    assert.match(sectionSource, /data-quick-grade-input="true"/)
    assert.doesNotMatch(sectionSource, /\+ Nova avaliação/)
  }
)

test(
  'typing scores activates the draft while an untouched grid remains write-free',
  () => {
    assert.match(
      sectionSource,
      /enabled:\s*hasQuickGradeData\(rows\)/
    )
    assert.match(
      sectionSource,
      /if \(draft\?\.enabled\)[\s\S]*createLessonAssessment/
    )
    assert.match(
      sectionSource,
      /if \(entries\.length === 0\) \{\s*return\s*\}/
    )
  }
)

test(
  'score validation and special states remain explicit',
  () => {
    assert.match(
      sectionSource,
      /score < 0 \|\|\s*score > 20/
    )
    assert.match(sectionSource, /value: 'absent'/)
    assert.match(sectionSource, /value: 'exempt'/)
    assert.match(sectionSource, /specialStatus/)
  }
)

test(
  'Enter and ArrowDown move through quick score inputs',
  () => {
    assert.match(sectionSource, /event\.key === 'Enter'/)
    assert.match(sectionSource, /event\.key === 'ArrowDown'/)
    assert.match(sectionSource, /focusNextScore\(rowIndex\)/)
  }
)

test(
  'advanced metadata stays behind Details and title generation preserves the persistent contract',
  () => {
    assert.match(
      sectionSource,
      /\{detailsOpen[\s\S]*\?\s*['"]Ocultar detalhes['"][\s\S]*:\s*['"]Detalhes['"][\s\S]*\}/
    )
    assert.match(sectionSource, /buildQuickAssessmentTitle\(/)
    assert.match(sectionSource, /criterionId:\s*draft\.criterionId/)
    assert.match(sectionSource, /activityType:\s*draft\.activityType/)
    assert.match(sectionSource, /description:\s*draft\.description/)
  }
)

test(
  'existing assessment editing, rollback retry and stale module protection remain present',
  () => {
    assert.match(sectionSource, /getAssessmentRegister\(assessmentId\)/)
    assert.match(sectionSource, /saveAssessmentResults\(\s*assessmentId,/)
    assert.match(
      sectionSource,
      /resetTransientSaveState\(\)[\s\S]*draftCreatedAssessmentIdRef\.current = null/
    )
    assert.match(
      sectionSource,
      /lesson\.moduleId !== workspace\.lesson\.moduleId/
    )
  }
)

test(
  'the main Daily workspace also exposes quick score inputs before a new assessment exists',
  () => {
    assert.doesNotThrow(() =>
      transpile(
        dailyWorkspaceSource,
        'DailyWorkspaceView.tsx'
      )
    )
    assert.match(
      dailyWorkspaceSource,
      /const quickGradeVisible\s*=[\s\S]*assessmentWorkspace\?\.criteria/
    )
    assert.match(
      dailyWorkspaceSource,
      /data-daily-quick-grade-input="true"/
    )
    assert.match(
      dailyWorkspaceSource,
      /Nota 0–20/
    )
    assert.doesNotMatch(
      dailyWorkspaceSource,
      />\s*\+\s*Avaliação\s*</
    )
  }
)

test(
  'the first score activates one new assessment draft but clearing every new score remains write-free',
  () => {
    assert.match(
      dailyWorkspaceSource,
      /function activateQuickAssessment\(\)[\s\S]*choice: 'new'/
    )
    assert.match(
      dailyWorkspaceSource,
      /if \(normalizedValue\.trim\(\)\) \{\s*activateQuickAssessment\(\)/
    )
    assert.match(
      dailyWorkspaceSource,
      /const quickAssessmentHasData =[\s\S]*hasQuickAssessmentData\([\s\S]*students/
    )
    assert.match(
      dailyWorkspaceSource,
      /assessmentForm\.choice ===[\s\S]*'new'[\s\S]*quickAssessmentHasData[\s\S]*\? 'new'[\s\S]*: 'none'/
    )
  }
)

test(
  'the main Daily workspace blocks ambiguous criteria and invalid 0-20 values before persistence',
  () => {
    assert.match(
      dailyWorkspaceSource,
      /resolveQuickCriterionId\(/
    )
    assert.match(
      dailyWorkspaceSource,
      /Selecione o critério da avaliação em Detalhes\./
    )
    assert.match(
      dailyWorkspaceSource,
      /score < 0 \|\|[\s\S]*score > 20/
    )
  }
)

test(
  'the main Daily workspace keeps advanced assessment metadata collapsed and supports keyboard-only entry',
  () => {
    assert.match(
      dailyWorkspaceSource,
      /showAssessmentDetails &&[\s\S]*assessmentForm/
    )
    assert.match(
      dailyWorkspaceSource,
      /event\.key ===[\s\S]*'Enter'/
    )
    assert.match(
      dailyWorkspaceSource,
      /event\.key ===[\s\S]*'ArrowDown'/
    )
    assert.match(
      dailyWorkspaceSource,
      /focusNextQuickGrade\(/
    )
  }
)
