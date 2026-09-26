import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path =>
  readFile(
    new URL(
      `../../${path}`,
      import.meta.url
    ),
    'utf8'
  )

const [
  knowledgeBaseSource,
  panelSource,
  reportClientSource
] = await Promise.all([
  read('src/components/ma-professor/support/helpKnowledgeBase.ts'),
  read('src/components/ma-professor/support/ProblemReportPanel.tsx'),
  read('src/components/ma-professor/support/problemReportClient.ts')
])

test(
  'help knowledge base is static and cannot read pedagogical storage or call the network',
  () => {
    assert.match(
      knowledgeBaseSource,
      /export const helpCategories/
    )

    assert.match(
      knowledgeBaseSource,
      /export const helpArticles/
    )

    assert.match(
      knowledgeBaseSource,
      /searchHelpArticles/
    )

    assert.doesNotMatch(
      knowledgeBaseSource,
      /fetch\s*\(|indexedDB|maProfessorDb|Dexie|localStorage|sessionStorage|repository|accessStorage/i
    )
  }
)

test(
  'help panel searches locally and keeps technical reporting as a separate explicit action',
  () => {
    assert.match(
      panelSource,
      /searchHelpArticles/
    )

    assert.match(
      panelSource,
      /Nada é enviado automaticamente ao pesquisar ou abrir um artigo/
    )

    assert.match(
      panelSource,
      /Reportar problema técnico/
    )

    assert.match(
      panelSource,
      /ProblemReportDialog/
    )

    assert.doesNotMatch(
      panelSource,
      /fetch\s*\(|maProfessorDb|Dexie|localStorage|sessionStorage|repository|accessStorage/i
    )

    assert.doesNotMatch(
      panelSource,
      /\bindexedDB\s*(?:\.|\()/i
    )
  }
)

test(
  'support copy explicitly excludes school data and credentials',
  () => {
    assert.match(
      panelSource,
      /Não são recolhidos automaticamente dados escolares, ficheiros, conteúdos do IndexedDB ou passwords/
    )

    assert.match(
      panelSource,
      /não inclua nomes de alunos, classificações, emails, números de identificação, passwords ou outros dados pessoais/
    )

    assert.doesNotMatch(
      knowledgeBaseSource,
      /studentId|studentName|assessmentResult|lessonAttendance|moduleFinalGrade/
    )
  }
)

test(
  'existing technical report endpoint remains unchanged and separate from the knowledge base',
  () => {
    assert.match(
      reportClientSource,
      /\/api\/ma-professor\/problem-report/
    )

    assert.doesNotMatch(
      knowledgeBaseSource,
      /problem-report|sendProblemReport|PROBLEM_REPORT_ENDPOINT/
    )
  }
)
