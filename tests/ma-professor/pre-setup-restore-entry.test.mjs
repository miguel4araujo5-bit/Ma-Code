import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/InitialSchoolCalendarBootstrap.tsx',
    import.meta.url
  ),
  'utf8'
)

const compact = source.replace(/\s+/g, ' ')

test(
  'school selection exposes restore before creating any school configuration',
  () => {
    assert.match(
      compact,
      /RestoreSettingsPanel/
    )
    assert.match(
      compact,
      /Restaurar uma cópia existente →/
    )
    assert.match(
      compact,
      /setStage\('restore'\)/
    )
    assert.match(
      compact,
      /stage === 'restore'/
    )
    assert.match(
      compact,
      /Não precisa de escolher uma escola nem de iniciar uma nova configuração antes do restauro\./
    )
  }
)

test(
  'pre-setup restore reuses the existing restore panel and only opens the app after restored profile data is re-read',
  () => {
    assert.match(
      compact,
      /<RestoreSettingsPanel onDataChanged=\{\(\) => void handleRestoreCompleted\(\) \} \/>/
    )

    const start = compact.indexOf(
      'const handleRestoreCompleted ='
    )
    const end = compact.indexOf(
      "if (stage === 'ready')",
      start
    )

    assert.ok(start >= 0)
    assert.ok(end > start)

    const handler = compact.slice(
      start,
      end
    )

    assert.match(
      handler,
      /getTeacherProfile\(\)/
    )
    assert.match(
      handler,
      /setStage\('ready'\)/
    )
    assert.match(
      handler,
      /setStage\('selecting'\)/
    )
    assert.doesNotMatch(
      handler,
      /saveTeacherProfile|createAcademicYear/
    )
  }
)
