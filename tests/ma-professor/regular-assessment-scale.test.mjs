import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const scaleSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/regularAssessmentScale.ts',
    import.meta.url
  ),
  'utf8'
)

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/assessmentWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const routerSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/AssessmentWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const regularWorkspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/RegularAssessmentWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const professionalWorkspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ProfessionalAssessmentWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const runtimeSource = ts.transpileModule(
  scaleSource,
  {
    fileName: 'regularAssessmentScale.ts',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022
    }
  }
).outputText

const scale = await import(
  `data:text/javascript;base64,${Buffer.from(runtimeSource).toString('base64')}`
)

function group(
  gradeLevel,
  educationType = 'regular'
) {
  return {
    id: `group-${gradeLevel}`,
    academicYearId: 'year-1',
    name: `${gradeLevel}.º A`,
    gradeLevel,
    courseName: '',
    educationType,
    active: true,
    createdAt: '2026-09-13T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z'
  }
}

test(
  'regular 5th to 9th grade uses integer levels from 1 to 5',
  () => {
    for (const gradeLevel of ['5', '6', '7', '8', '9']) {
      const current = group(gradeLevel)
      const resolved =
        scale.getSummativeAssessmentScale(current)

      assert.equal(resolved.kind, 'level_1_5')
      assert.equal(resolved.min, 1)
      assert.equal(resolved.max, 5)
      assert.equal(
        scale.usesNumericSuggestion(current),
        false
      )
      assert.equal(
        scale.validateSummativeNumericValue(
          current,
          1,
          'classificação final'
        ),
        1
      )
      assert.equal(
        scale.validateSummativeNumericValue(
          current,
          5,
          'classificação final'
        ),
        5
      )
    }

    assert.throws(
      () =>
        scale.validateSummativeNumericValue(
          group('5'),
          0,
          'classificação final'
        ),
      /inteiro entre 1 e 5/
    )
    assert.throws(
      () =>
        scale.validateSummativeNumericValue(
          group('5'),
          6,
          'classificação final'
        ),
      /inteiro entre 1 e 5/
    )
    assert.throws(
      () =>
        scale.validateSummativeNumericValue(
          group('5'),
          3.5,
          'classificação final'
        ),
      /inteiro entre 1 e 5/
    )
  }
)

test(
  'regular secondary keeps the 0 to 20 summative scale and may reuse the numeric suggestion',
  () => {
    for (const gradeLevel of ['10', '11', '12']) {
      const current = group(gradeLevel)
      const resolved =
        scale.getSummativeAssessmentScale(current)

      assert.equal(resolved.kind, 'score_0_20')
      assert.equal(resolved.min, 0)
      assert.equal(resolved.max, 20)
      assert.equal(
        scale.usesNumericSuggestion(current),
        true
      )
      assert.equal(
        scale.validateSummativeNumericValue(
          current,
          20,
          'autoavaliação'
        ),
        20
      )
    }

    assert.throws(
      () =>
        scale.validateSummativeNumericValue(
          group('10'),
          21,
          'classificação final'
        ),
      /inteiro entre 0 e 20/
    )
  }
)

test(
  'first cycle remains qualitative and is never silently converted from internal numeric activity results',
  () => {
    for (const gradeLevel of ['1', '2', '3', '4']) {
      const current = group(gradeLevel)
      const resolved =
        scale.getSummativeAssessmentScale(current)

      assert.equal(resolved.kind, 'qualitative')
      assert.equal(resolved.min, null)
      assert.equal(resolved.max, null)
      assert.equal(
        scale.usesNumericSuggestion(current),
        false
      )
      assert.throws(
        () =>
          scale.validateSummativeNumericValue(
            current,
            4,
            'classificação final'
          ),
        /não pode ser guardada como nota numérica/
      )
    }
  }
)

test(
  'legacy professional-compatible groups keep the existing 0 to 20 contract',
  () => {
    const legacy = group('11', undefined)
    const resolved =
      scale.getSummativeAssessmentScale(legacy)

    assert.equal(resolved.kind, 'score_0_20')
    assert.equal(
      scale.validateSummativeNumericValue(
        legacy,
        17,
        'classificação final'
      ),
      17
    )
  }
)

test(
  'unknown regular grade never falls through to a professional numeric scale',
  () => {
    const resolved =
      scale.getSummativeAssessmentScale(
        group('desconhecido')
      )

    assert.equal(resolved.kind, 'unsupported')
    assert.equal(
      scale.usesNumericSuggestion(
        group('desconhecido')
      ),
      false
    )
  }
)

test(
  'regular scale validation is enforced again at the persistence boundary',
  () => {
    assert.match(
      repositorySource,
      /getGroupForModule/
    )
    assert.match(
      repositorySource,
      /group\?\.educationType\s*===\s*['"]regular['"]/
    )
    assert.match(
      repositorySource,
      /validateSummativeNumericValue\([\s\S]*input\.finalGrade/
    )
    assert.match(
      repositorySource,
      /validateSummativeNumericValue\([\s\S]*input\.selfAssessmentGrade/
    )
    assert.match(
      repositorySource,
      /return super\.saveModuleFinalGrade/
    )
  }
)

test(
  'workspace split routes only explicit regular groups and preserves the professional implementation',
  () => {
    assert.match(
      routerSource,
      /educationType\s*===\s*['"]regular['"]/
    )
    assert.match(
      routerSource,
      /RegularAssessmentWorkspaceView/
    )
    assert.match(
      routerSource,
      /ProfessionalAssessmentWorkspaceView/
    )
    assert.match(
      professionalWorkspaceSource,
      /UfcdFinalGradeGrid/
    )
    assert.match(
      regularWorkspaceSource,
      /getSummativeAssessmentScale/
    )
    assert.match(
      regularWorkspaceSource,
      /min=\{scale\.min \?\? undefined\}/
    )
    assert.match(
      regularWorkspaceSource,
      /max=\{scale\.max \?\? undefined\}/
    )
    assert.match(
      regularWorkspaceSource,
      /Média interna das atividades:[\s\S]*\/ 20/
    )
  }
)

test(
  'regular assessment split stays local-first and adds no Cloudflare or remote persistence path',
  () => {
    const combined = [
      scaleSource,
      regularWorkspaceSource
    ].join('\n')

    assert.doesNotMatch(
      combined,
      /fetch\(|snapshotApi|Durable Object|wrangler|cloudflare|workers ai/i
    )
  }
)
