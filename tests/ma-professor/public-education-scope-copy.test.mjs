import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const professorPageSource = await readFile(
  new URL(
    '../../src/pages/MAProfessorPage.tsx',
    import.meta.url
  ),
  'utf8'
)

const productsPageSource = await readFile(
  new URL(
    '../../src/pages/ProductsPage.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'public MA-Professor metadata explicitly covers regular and professional education',
  () => {
    assert.match(
      professorPageSource,
      /ensino regular e profissional/
    )
    assert.match(
      professorPageSource,
      /gestão pedagógica, ensino regular, ensino profissional, disciplinas, UFCD/
    )
    assert.match(
      professorPageSource,
      /organização de aulas, sumários, turmas, assiduidade e avaliação no ensino regular e profissional/
    )
  }
)

test(
  'product catalogue presents disciplines and UFCD without reducing MA-Professor to professional education',
  () => {
    assert.match(
      productsPageSource,
      /suporte para ensino regular e profissional — incluindo UFCD quando aplicável/
    )
    assert.match(
      productsPageSource,
      /'Disciplinas e UFCD'/
    )
    assert.match(
      productsPageSource,
      /'Assiduidade'/
    )
    assert.match(
      productsPageSource,
      /gestão pedagógica, ensino regular, ensino profissional, disciplinas, UFCD/
    )
    assert.doesNotMatch(
      productsPageSource,
      /Organize planificações, sumários, UFCD, avaliações, faltas e recuperações de aprendizagens/
    )
  }
)
