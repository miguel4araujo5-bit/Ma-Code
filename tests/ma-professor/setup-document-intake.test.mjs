import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const intakeSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SetupDocumentIntakePanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const wizardSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SetupWizard.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'initial setup accepts several documents in one selection and keeps type correction editable',
  () => {
    assert.match(
      intakeSource,
      /type="file"[\s\S]*?multiple[\s\S]*?accept="application\/pdf,\.pdf,\.docx/
    )
    assert.match(
      intakeSource,
      /Horário · planificações · critérios de avaliação/
    )
    assert.match(
      intakeSource,
      /<option value="schedule">Horário<\/option>/
    )
    assert.match(
      intakeSource,
      /<option value="planification">Planificação<\/option>/
    )
    assert.match(
      intakeSource,
      /<option value="criteria">Critérios de avaliação<\/option>/
    )
    assert.match(
      intakeSource,
      /Tipo corrigido manualmente pelo professor/
    )
  }
)

test(
  'document intake cross-checks repeated subject and course context instead of trusting one file blindly',
  () => {
    assert.match(
      intakeSource,
      /agreementLabel\([\s\S]*?'Disciplina'/
    )
    assert.match(
      intakeSource,
      /agreementLabel\([\s\S]*?'Curso'/
    )
    assert.match(
      intakeSource,
      /confirmada por \$\{confirmations\} documentos/
    )
    assert.match(
      intakeSource,
      /foram encontrados valores diferentes/
    )
  }
)

test(
  'one selected document is handed to the specialized importer without a second file selection',
  () => {
    assert.match(
      wizardSource,
      /function attachFileToInput\([\s\S]*?new DataTransfer\(\)[\s\S]*?transfer\.items\.add\(file\)[\s\S]*?input\.files = transfer\.files[\s\S]*?dispatchEvent/
    )
    assert.match(
      wizardSource,
      /queuedDocument\.kind === 'schedule'/
    )
    assert.match(
      wizardSource,
      /queuedDocument\.kind === 'criteria'/
    )
    assert.match(
      wizardSource,
      /queuedDocument\.kind === 'planification'/
    )
    assert.match(
      wizardSource,
      /findButtonByText\('Importar PDF'\)/
    )
    assert.match(
      wizardSource,
      /findButtonByText\('Importar PDF ou Word'\)/
    )
  }
)

test(
  'classification remains separate from persistence and routes to existing specialist review screens',
  () => {
    assert.match(
      intakeSource,
      /Nesta etapa os documentos são classificados e cruzados; cada importador continua a validar a estrutura específica antes de guardar dados\./
    )
    assert.match(
      wizardSource,
      /kind === 'criteria'[\s\S]*?'assessment_criteria'[\s\S]*?: 'modules'/
    )
    assert.match(
      wizardSource,
      /kind === 'schedule'[\s\S]*?setShowScheduleImport\(true\)/
    )
  }
)
