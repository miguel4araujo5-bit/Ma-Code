import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const geometrySource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleGridGeometry.ts',
    import.meta.url
  ),
  'utf8'
)
const semanticSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleGridSemanticInterpretation.ts',
    import.meta.url
  ),
  'utf8'
)

function transpile(source) {
  return ts.transpileModule(
    source,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      }
    }
  ).outputText
}

function loadGeometryModule() {
  const module = { exports: {} }

  new Function(
    'module',
    'exports',
    transpile(geometrySource)
  )(
    module,
    module.exports
  )

  return module.exports
}

function loadSemanticModule(geometryModule) {
  const module = { exports: {} }

  new Function(
    'module',
    'exports',
    'require',
    transpile(semanticSource)
  )(
    module,
    module.exports,
    specifier => {
      if (specifier === './scheduleGridGeometry') {
        return geometryModule
      }

      throw new Error(`Unexpected require: ${specifier}`)
    }
  )

  return module.exports
}

const geometry = loadGeometryModule()
const semantic = loadSemanticModule(geometry)

function item(
  text,
  x,
  y,
  width,
  height = 10
) {
  return {
    text,
    x,
    y,
    width,
    height
  }
}

function headerItems() {
  return [
    item('Segunda', 100, 700, 40),
    item('Sala', 180, 700, 30),
    item('Terça', 270, 700, 40),
    item('Sala', 360, 700, 30),
    item('Quarta', 450, 700, 40),
    item('Sala', 540, 700, 30),
    item('Quinta', 630, 700, 40),
    item('Sala', 720, 700, 30),
    item('Sexta', 810, 700, 40),
    item('Sala', 900, 700, 30)
  ]
}

function currentProfessionalPage() {
  return {
    pageNumber: 1,
    items: [
      ...headerItems(),
      item('09:25–10:15', 10, 650, 70),
      item('11.ºE_AP . AS', 270, 650, 70),
      item('REO', 364, 650, 24),
      item('12.ºD_AP . AEXP', 450, 650, 82),
      item('A2.10', 544, 650, 28),
      item('10:30–11:20', 10, 600, 70),
      item('12.ºD_AP . PAP', 270, 600, 78),
      item('REO', 364, 600, 24),
      item('10.ºD_AIS . AEXP', 450, 600, 88),
      item('REO', 544, 600, 24),
      item('11:25–12:15', 10, 550, 70),
      item('Eq Pedag', 630, 550, 56),
      item('SP', 724, 550, 18),
      item('Co PCE', 810, 550, 50),
      item('SP', 904, 550, 18),
      item('12:20–13:10', 10, 500, 70),
      item('Clube Xadrez', 630, 500, 76),
      item('SP', 724, 500, 18),
      item('Atividades do professor', 100, 180, 128),
      item('AEXP-Área de Expressões', 100, 160, 142),
      item('AS-Animação Sociocultural', 100, 140, 154),
      item('PAP-Prova de Aptidão Profissional', 100, 120, 190),
      item('Co PCE-Coordenadora do Projeto Cultural de Escola', 100, 100, 270),
      item('Eq Pedag-Equipa Pedagógica', 100, 80, 168),
      item('Clube Xadrez', 100, 60, 78),
      item('O diretor', 100, 40, 52)
    ]
  }
}

test(
  'current professional timetable resolves embedded group context before subject semantics and keeps room text separate',
  () => {
    const page = currentProfessionalPage()
    const grid = geometry.reconstructScheduleGridDocument([page])
    const proposal = semantic.interpretScheduleGridDocument(
      grid,
      [page],
      50
    )

    assert.equal(grid.blocks.length, 7)
    assert.equal(proposal.lessons.length, 4)
    assert.equal(proposal.duties.length, 3)
    assert.equal(proposal.unknownBlocks.length, 0)
    assert.equal(
      proposal.lessons.length +
        proposal.duties.length +
        proposal.unknownBlocks.length,
      grid.blocks.length,
      'semantic interpretation must account for every occupied geometry block'
    )

    const asLesson = proposal.lessons.find(
      lesson => lesson.groupName === '11.º E'
    )
    assert.ok(asLesson)
    assert.equal(asLesson.courseCode, 'AP')
    assert.equal(asLesson.courseName, 'Técnico de Apoio Psicossocial')
    assert.equal(asLesson.subjectCode, 'AS')
    assert.equal(asLesson.subjectName, 'Animação Sociocultural')
    assert.equal(asLesson.subjectConfirmed, true)
    assert.doesNotMatch(asLesson.subjectName, /REO|A2\.10/)

    const aexp = proposal.lessons.find(
      lesson => lesson.groupName === '12.º D' && lesson.subjectCode === 'AEXP'
    )
    assert.ok(aexp)
    assert.equal(aexp.subjectName, 'Área de Expressões')

    const pap = proposal.lessons.find(
      lesson => lesson.subjectCode === 'PAP'
    )
    assert.ok(pap)
    assert.equal(pap.subjectName, 'Prova de Aptidão Profissional')

    const ais = proposal.lessons.find(
      lesson => lesson.groupName === '10.º D'
    )
    assert.ok(ais)
    assert.equal(ais.courseCode, 'AIS')
    assert.equal(ais.courseName, '')
    assert.equal(ais.subjectName, 'Área de Expressões')
    assert.ok(ais.warnings.some(warning => warning.includes('AIS')))

    assert.deepEqual(
      proposal.duties.map(duty => duty.name).sort(),
      ['Clube Xadrez', 'Co PCE', 'Eq Pedag'].sort()
    )
  }
)

test(
  'legend from the PDF has priority over internal aliases',
  () => {
    const page = {
      pageNumber: 1,
      items: [
        ...headerItems(),
        item('09:25–10:15', 10, 650, 70),
        item('11.ºE_AP . AS', 270, 650, 70),
        item('REO', 364, 650, 24),
        item('Atividades do professor', 100, 160, 128),
        item('AS-Ação Social', 100, 140, 86),
        item('O diretor', 100, 120, 52)
      ]
    }
    const grid = geometry.reconstructScheduleGridDocument([page])
    const proposal = semantic.interpretScheduleGridDocument(
      grid,
      [page],
      50
    )

    assert.equal(proposal.lessons.length, 1)
    assert.equal(proposal.lessons[0].subjectCode, 'AS')
    assert.equal(proposal.lessons[0].subjectName, 'Ação Social')
  }
)

test(
  'unknown non-group activity is not turned into a duty merely because it has two words',
  () => {
    const page = {
      pageNumber: 1,
      items: [
        ...headerItems(),
        item('09:25–10:15', 10, 650, 70),
        item('Projeto Individual', 270, 650, 94),
        item('SP', 364, 650, 18)
      ]
    }
    const grid = geometry.reconstructScheduleGridDocument([page])
    const proposal = semantic.interpretScheduleGridDocument(
      grid,
      [page],
      50
    )

    assert.equal(proposal.lessons.length, 0)
    assert.equal(proposal.duties.length, 0)
    assert.equal(proposal.unknownBlocks.length, 1)
    assert.equal(proposal.unknownBlocks[0].rawActivityText, 'Projeto Individual')
  }
)

test(
  'old short activity code with a group remains a teaching candidate instead of becoming a duty',
  () => {
    const page = {
      pageNumber: 1,
      items: [
        ...headerItems(),
        item('09:25–10:15', 10, 650, 70),
        item('11.ºD_AP . A', 270, 650, 64),
        item('REO', 364, 650, 24)
      ]
    }
    const grid = geometry.reconstructScheduleGridDocument([page])
    const proposal = semantic.interpretScheduleGridDocument(
      grid,
      [page],
      50
    )

    assert.equal(proposal.lessons.length, 1)
    assert.equal(proposal.duties.length, 0)
    assert.equal(proposal.lessons[0].groupName, '11.º D')
    assert.equal(proposal.lessons[0].subjectName, 'A')
    assert.equal(proposal.lessons[0].subjectConfirmed, false)
  }
)
