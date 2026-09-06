import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/product/MAProfessorProduct.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'daily preparation failure does not erase a valid operational academic year',
  () => {
    const refreshStart = source.indexOf(
      'const refreshAcademicYear ='
    )
    const firstEffect = source.indexOf(
      'useEffect(() => {',
      refreshStart
    )

    assert.ok(refreshStart >= 0)
    assert.ok(firstEffect > refreshStart)

    const refreshSource = source.slice(
      refreshStart,
      firstEffect
    )

    const setAcademicYearIndex =
      refreshSource.indexOf('setAcademicYear(')
    const setOperationalReadyIndex =
      refreshSource.indexOf('setOperationalReady(')
    const dailyPreparationIndex =
      refreshSource.indexOf(
        'ensureDailyScheduledLessonsForDate('
      )

    assert.ok(setAcademicYearIndex >= 0)
    assert.ok(setOperationalReadyIndex >= 0)
    assert.ok(dailyPreparationIndex >= 0)

    assert.ok(
      setAcademicYearIndex < dailyPreparationIndex,
      'O ano letivo válido deve chegar ao estado antes da preparação diária.'
    )
    assert.ok(
      setOperationalReadyIndex < dailyPreparationIndex,
      'O estado operacional válido deve ser preservado antes da preparação diária.'
    )

    assert.match(
      refreshSource,
      /try\s*\{[\s\S]*ensureDailyScheduledLessonsForDate\([\s\S]*\}\s*catch\s*\(\s*preparationError\s*\)/,
      'A preparação diária deve ter um erro isolado do carregamento do ano letivo.'
    )

    assert.match(
      source,
      /dailyPreparationReady/,
      'O produto deve distinguir configuração operacional de Daily efetivamente preparado.'
    )

    assert.match(
      source,
      /dailyPreparationError/,
      'Uma falha de preparação diária deve ter estado de erro próprio.'
    )

    assert.match(
      source,
      /nextWorkspace ===\s*'daily'[\s\S]*!dailyPreparationReady/,
      'Uma nova tentativa de abrir Hoje deve repetir a preparação quando ela ainda não está pronta.'
    )

    assert.match(
      source,
      /Não foi possível preparar as aulas de hoje\./,
      'O erro diário deve ser apresentado como problema de preparação das aulas, não como erro do ano letivo.'
    )

    assert.match(
      source,
      /workspace ===\s*'daily'[\s\S]*dailyPreparationReady[\s\S]*<DailyWorkspaceView/,
      'O Daily só deve montar depois de a preparação diária ter sido confirmada.'
    )
  }
)
