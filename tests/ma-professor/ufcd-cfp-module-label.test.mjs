import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/assessments/ufcdCfpModel.ts',
    import.meta.url
  ),
  'utf8'
)

const compiled = ts.transpileModule(
  source,
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022
    }
  }
).outputText

const { buildUfcdCfpModel } = await import(
  `data:text/javascript;base64,${Buffer
    .from(compiled)
    .toString('base64')}`
)

function snapshot(name) {
  return {
    academicYear: {
      name: '2026-2027'
    },
    selectedGroup: {
      name: '12.º D',
      courseName: 'Técnico de Apoio Psicossocial',
      gradeLevel: '3.º Ano'
    },
    selectedSubject: {
      name: 'Área de Expressões'
    },
    selectedModule: {
      code: '10374',
      name
    },
    criteria: [],
    studentRows: []
  }
}

test(
  'CFP module label stops before assessment text accidentally appended to the UFCD name',
  () => {
    const model = buildUfcdCfpModel(
      snapshot(
        'deontologia do/a Técnico/a de Apoio Psicossocial Ficha de avaliação e/ou trabalho prático, fichas de trabalho e observação -Principais problemas ambientais da atualidade -Resíduos -Definição Gestão de resíduos -Estratégias de atuação -Boas práticas para o meio ambiente -CONCEITOS BÁSICOS RELACIONADOS'
      )
    )

    assert.equal(
      model.moduleLabel,
      '10374 deontologia do/a Técnico/a de Apoio Psicossocial'
    )
  }
)

test(
  'CFP module label leaves a normal UFCD title unchanged',
  () => {
    const model = buildUfcdCfpModel(
      snapshot(
        'deontologia do/a Técnico/a de Apoio Psicossocial'
      )
    )

    assert.equal(
      model.moduleLabel,
      '10374 deontologia do/a Técnico/a de Apoio Psicossocial'
    )
  }
)
