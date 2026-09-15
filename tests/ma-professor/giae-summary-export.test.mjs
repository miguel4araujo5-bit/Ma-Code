import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const navigationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/ProductNavigation.tsx',
    import.meta.url
  ),
  'utf8'
)

const dialogSource = await readFile(
  new URL(
    '../../src/components/ma-professor/giae/GIAESummaryExportDialog.tsx',
    import.meta.url
  ),
  'utf8'
)

const exportSource = await readFile(
  new URL(
    '../../src/components/ma-professor/giae/giaeSummaryExport.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'summary export is exposed from the Sumários / GIAE entry without restoring a duplicate Calendar sidebar entry',
  () => {
    assert.match(
      navigationSource,
      /Sumários \/ GIAE/
    )
    assert.match(
      navigationSource,
      /Exportar sumários/
    )
    assert.match(
      navigationSource,
      /<GIAESummaryExportDialog/
    )
    assert.doesNotMatch(
      navigationSource,
      /sidebarItems[\s\S]*\{ id: 'calendar', label: 'Calendário' \}/
    )
  }
)

test(
  'summary export supports all rows or the selected filters for dates group subject module and state',
  () => {
    assert.match(
      dialogSource,
      /Todos os sumários/
    )
    assert.match(
      dialogSource,
      /Apenas os filtrados/
    )

    for (const filterName of [
      'dateFrom',
      'dateTo',
      'groupId',
      'teachingAssignmentId',
      'moduleId',
      'state'
    ]) {
      assert.ok(
        dialogSource.includes(filterName),
        `missing summary export filter: ${filterName}`
      )
    }

    assert.match(
      dialogSource,
      /giaeWorkspaceRepository\.getWorkspace/
    )
  }
)

test(
  'summary export provides PDF and XLSX outputs with identification and summary content',
  () => {
    assert.match(
      exportSource,
      /exportGIAESummariesPdf/
    )
    assert.match(
      exportSource,
      /exportGIAESummariesExcel/
    )
    assert.match(
      exportSource,
      /application\/pdf/
    )
    assert.match(
      exportSource,
      /bookType: 'xlsx'/
    )

    for (const column of [
      'Data',
      'Turma',
      'Disciplina',
      'UFCD / módulo',
      'Sumário',
      'Estado'
    ]) {
      assert.ok(
        exportSource.includes(column),
        `missing summary export column: ${column}`
      )
    }
  }
)
