import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/setupDocumentInterpretationResolver.ts',
    import.meta.url
  ),
  'utf8'
)

const javascript = ts.transpileModule(
  source,
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }
).outputText

const module = { exports: {} }
new Function(
  'module',
  'exports',
  javascript
)(module, module.exports)

const {
  resolveSetupDocumentInterpretation
} = module.exports

function proposal(
  kind,
  {
    baseScore,
    structuralEvidence = false,
    explicitEvidence = false,
    internallyConsistent = false,
    negativeEvidence = [],
    evidence = []
  }
) {
  return {
    kind,
    baseScore,
    structuralEvidence,
    explicitEvidence,
    internallyConsistent,
    negativeEvidence,
    evidence
  }
}

test(
  'strong timetable structure wins even when another weak signal exists',
  () => {
    const result = resolveSetupDocumentInterpretation([
      proposal('schedule', {
        baseScore: 15,
        structuralEvidence: true,
        internallyConsistent: true,
        evidence: ['5 dias e 9 intervalos coerentes']
      }),
      proposal('planification', {
        baseScore: 3,
        explicitEvidence: false
      }),
      proposal('criteria', {
        baseScore: 6,
        explicitEvidence: true,
        negativeEvidence: [
          'As percentagens não formam uma matriz de ponderações.'
        ]
      })
    ])

    assert.equal(result.kind, 'schedule')
    assert.equal(result.confidence, 'high')
  }
)

test(
  'coherent 60/20/20 criteria beat a misleading timetable filename signal',
  () => {
    const result = resolveSetupDocumentInterpretation([
      proposal('schedule', {
        baseScore: 6,
        explicitEvidence: true,
        structuralEvidence: false,
        internallyConsistent: false,
        evidence: ['O nome do ficheiro contém horário.']
      }),
      proposal('planification', {
        baseScore: 2
      }),
      proposal('criteria', {
        baseScore: 18,
        structuralEvidence: true,
        explicitEvidence: true,
        internallyConsistent: true,
        evidence: [
          'Domínios e ponderações estruturais totalizam 100%.'
        ]
      })
    ])

    assert.equal(result.kind, 'criteria')
    assert.equal(result.confidence, 'high')
  }
)

test(
  'close competing interpretations stay unknown instead of guessing',
  () => {
    const result = resolveSetupDocumentInterpretation([
      proposal('schedule', {
        baseScore: 9,
        structuralEvidence: true,
        internallyConsistent: false
      }),
      proposal('planification', {
        baseScore: 10,
        structuralEvidence: true,
        internallyConsistent: false
      }),
      proposal('criteria', {
        baseScore: 1
      })
    ])

    assert.equal(result.kind, 'unknown')
    assert.equal(result.confidence, 'low')
  }
)

test(
  'negative evidence can stop stray percentages from becoming criteria',
  () => {
    const result = resolveSetupDocumentInterpretation([
      proposal('schedule', {
        baseScore: 3
      }),
      proposal('planification', {
        baseScore: 13,
        structuralEvidence: true,
        explicitEvidence: true,
        internallyConsistent: true,
        evidence: ['Módulos com conteúdos e objetivos reconhecidos.']
      }),
      proposal('criteria', {
        baseScore: 8,
        explicitEvidence: true,
        negativeEvidence: [
          'As percentagens aparecem apenas em descritores.',
          'Não existe relação domínio-ponderação reconhecida.'
        ]
      })
    ])

    assert.equal(result.kind, 'planification')
    assert.equal(result.confidence, 'high')
  }
)

test(
  'a plausible but structurally weak interpretation requires manual confirmation',
  () => {
    const result = resolveSetupDocumentInterpretation([
      proposal('schedule', {
        baseScore: 7,
        explicitEvidence: true
      }),
      proposal('planification', {
        baseScore: 1
      }),
      proposal('criteria', {
        baseScore: 0
      })
    ])

    assert.equal(result.kind, 'unknown')
    assert.equal(result.confidence, 'low')
  }
)
