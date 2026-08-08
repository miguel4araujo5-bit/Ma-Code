import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ChangeEvent
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  createMAQuadroTableFileFromDocument,
  createMAQuadroTableObjectName,
  createMAQuadroTableSvgFromDocument,
  MA_QUADRO_TABLE_MAX_COLUMNS,
  MA_QUADRO_TABLE_MAX_ROWS,
  MA_QUADRO_TABLE_MIN_COLUMNS,
  MA_QUADRO_TABLE_MIN_ROWS,
  readMAQuadroTableDocumentFromName,
  resizeMAQuadroTableDocument,
  setMAQuadroTableCell,
  updateMAQuadroTableSpec,
  type MAQuadroTableDocument,
  type MAQuadroTableSpec
} from '../../lib/maQuadro/tableSvg'

import {
  useMAQuadroEditorContext
} from './editorContext'

import TablePreview from './TablePreview'

import './maQuadroTableEditor.css'

function createFileChangeEvent(
  file: File
) {
  const files = {
    0:
      file,

    length:
      1,

    item: (
      index:
        number
    ) =>
      index ===
        0
        ? file
        : null
  } as unknown as
    FileList

  const input = {
    files,
    value: ''
  } as unknown as
    HTMLInputElement

  return {
    currentTarget:
      input,

    target:
      input
  } as unknown as
    ChangeEvent<
      HTMLInputElement
    >
}

export default function TableEditor() {
  const editor =
    useMAQuadroEditorContext()

  const sourceDocument =
    useMemo(
      () => {
        if (
          editor.selection.count !==
            1 ||
          editor.selection.role !==
            'image'
        ) {
          return null
        }

        return readMAQuadroTableDocumentFromName(
          editor.selection.name
        )
      },
      [
        editor.selection.count,
        editor.selection.name,
        editor.selection.role
      ]
    )

  const [
    host,
    setHost
  ] = useState<
    HTMLElement |
    null
  >(
    null
  )

  const [
    draft,
    setDraft
  ] = useState<
    MAQuadroTableDocument |
    null
  >(
    null
  )

  const [
    saving,
    setSaving
  ] = useState(
    false
  )

  const [
    message,
    setMessage
  ] = useState(
    ''
  )

  useEffect(() => {
    setDraft(
      sourceDocument
    )

    setMessage(
      ''
    )
  }, [
    editor.activePage?.id,
    editor.project?.id,
    editor.selection.name,
    sourceDocument
  ])

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      !sourceDocument
    ) {
      setHost(
        null
      )

      return
    }

    const scroll =
      document.querySelector<
        HTMLElement
      >(
        '.mq-properties-panel .mq-properties-panel__scroll'
      )

    if (
      !scroll
    ) {
      setHost(
        null
      )

      return
    }

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-table-editor-host'

    scroll.prepend(
      mount
    )

    setHost(
      mount
    )

    return () => {
      mount.remove()
    }
  }, [
    editor.ready,
    editor.selection.name,
    sourceDocument
  ])

  if (
    !host ||
    !sourceDocument ||
    !draft
  ) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    saving

  const dirty =
    JSON.stringify(
      draft
    ) !==
    JSON.stringify(
      sourceDocument
    )

  const svg =
    createMAQuadroTableSvgFromDocument(
      draft
    )

  const updateSpec = <
    Key extends
      keyof MAQuadroTableSpec
  >(
    key:
      Key,
    value:
      MAQuadroTableSpec[
        Key
      ]
  ) => {
    setDraft(
      (
        current
      ) =>
        current
          ? updateMAQuadroTableSpec(
              current,
              {
                [key]:
                  value
              }
            )
          : current
    )

    setMessage(
      ''
    )
  }

  const resize = (
    rowDelta:
      number,
    columnDelta:
      number
  ) => {
    setDraft(
      (
        current
      ) => {
        if (
          !current
        ) {
          return current
        }

        return resizeMAQuadroTableDocument(
          current,
          current.spec.rows +
            rowDelta,
          current.spec.columns +
            columnDelta
        )
      }
    )

    setMessage(
      ''
    )
  }

  const updateCell = (
    row:
      number,
    column:
      number,
    value:
      string
  ) => {
    setDraft(
      (
        current
      ) =>
        current
          ? setMAQuadroTableCell(
              current,
              row,
              column,
              value
            )
          : current
    )

    setMessage(
      ''
    )
  }

  const reset =
    () => {
      setDraft(
        sourceDocument
      )

      setMessage(
        ''
      )
    }

  const apply =
    async () => {
      if (
        locked ||
        !dirty
      ) {
        return
      }

      setSaving(
        true
      )

      setMessage(
        ''
      )

      try {
        const file =
          createMAQuadroTableFileFromDocument(
            draft
          )

        const name =
          createMAQuadroTableObjectName(
            draft
          )

        editor.setSelectionName(
          name
        )

        await editor
          .replaceSelectedImage(
            createFileChangeEvent(
              file
            )
          )

        setMessage(
          'Tabela atualizada.'
        )
      } catch (
        error
      ) {
        console.error(
          error
        )

        setMessage(
          'Erro ao atualizar a tabela.'
        )
      } finally {
        setSaving(
          false
        )
      }
    }

  return createPortal(
    <section
      className="mq-table-editor"
      aria-label="Editar tabela"
    >
      <div className="mq-table-editor__heading">
        <span>
          <strong>
            Tabela
          </strong>

          <small>
            {
              draft.spec.rows
            }
            {' × '}
            {
              draft.spec.columns
            }
          </small>
        </span>

        {dirty ? (
          <span className="mq-table-editor__dirty">
            Alterada
          </span>
        ) : null}
      </div>

      <div className="mq-table-editor__structure">
        <button
          type="button"
          disabled={
            locked ||
            draft.spec.rows >=
              MA_QUADRO_TABLE_MAX_ROWS
          }
          onClick={() =>
            resize(
              1,
              0
            )
          }
        >
          + Linha
        </button>

        <button
          type="button"
          disabled={
            locked ||
            draft.spec.rows <=
              MA_QUADRO_TABLE_MIN_ROWS
          }
          onClick={() =>
            resize(
              -1,
              0
            )
          }
        >
          − Linha
        </button>

        <button
          type="button"
          disabled={
            locked ||
            draft.spec.columns >=
              MA_QUADRO_TABLE_MAX_COLUMNS
          }
          onClick={() =>
            resize(
              0,
              1
            )
          }
        >
          + Coluna
        </button>

        <button
          type="button"
          disabled={
            locked ||
            draft.spec.columns <=
              MA_QUADRO_TABLE_MIN_COLUMNS
          }
          onClick={() =>
            resize(
              0,
              -1
            )
          }
        >
          − Coluna
        </button>
      </div>

      <div className="mq-table-editor__toggles">
        <label>
          <input
            type="checkbox"
            checked={
              draft.spec.header
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'header',
                event.target.checked
              )
            }
          />

          <span>
            Cabeçalho
          </span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={
              draft.spec.striped
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'striped',
                event.target.checked
              )
            }
          />

          <span>
            Linhas alternadas
          </span>
        </label>
      </div>

      <div className="mq-table-editor__colors">
        <label>
          <span>
            Cabeçalho
          </span>

          <input
            type="color"
            value={
              draft
                .spec
                .headerBackground
            }
            disabled={
              locked ||
              !draft.spec.header
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'headerBackground',
                event.target.value
              )
            }
          />
        </label>

        <label>
          <span>
            Células
          </span>

          <input
            type="color"
            value={
              draft
                .spec
                .bodyBackground
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'bodyBackground',
                event.target.value
              )
            }
          />
        </label>

        <label>
          <span>
            Alternada
          </span>

          <input
            type="color"
            value={
              draft
                .spec
                .alternateBackground
            }
            disabled={
              locked ||
              !draft.spec.striped
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'alternateBackground',
                event.target.value
              )
            }
          />
        </label>

        <label>
          <span>
            Linhas
          </span>

          <input
            type="color"
            value={
              draft
                .spec
                .borderColor
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'borderColor',
                event.target.value
              )
            }
          />
        </label>

        <label>
          <span>
            Texto cabeçalho
          </span>

          <input
            type="color"
            value={
              draft
                .spec
                .headerTextColor
            }
            disabled={
              locked ||
              !draft.spec.header
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'headerTextColor',
                event.target.value
              )
            }
          />
        </label>

        <label>
          <span>
            Texto
          </span>

          <input
            type="color"
            value={
              draft
                .spec
                .bodyTextColor
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'bodyTextColor',
                event.target.value
              )
            }
          />
        </label>
      </div>

      <div className="mq-table-editor__cells-label">
        <strong>
          Células
        </strong>

        <small>
          Edite o conteúdo diretamente.
        </small>
      </div>

      <div className="mq-table-editor__cells-scroll">
        <div
          className="mq-table-editor__cells"
          style={{
            gridTemplateColumns:
              `repeat(${
                draft.spec.columns
              }, minmax(5.4rem, 1fr))`
          }}
        >
          {draft.cells.flatMap(
            (
              row,
              rowIndex
            ) =>
              row.map(
                (
                  cell,
                  columnIndex
                ) => (
                  <input
                    key={`${rowIndex}-${columnIndex}`}
                    type="text"
                    value={
                      cell
                    }
                    disabled={
                      locked
                    }
                    maxLength={
                      120
                    }
                    aria-label={`Linha ${
                      rowIndex +
                      1
                    }, coluna ${
                      columnIndex +
                      1
                    }`}
                    className={
                      draft.spec.header &&
                      rowIndex ===
                        0
                        ? 'is-header'
                        : ''
                    }
                    onChange={(
                      event
                    ) =>
                      updateCell(
                        rowIndex,
                        columnIndex,
                        event.target.value
                      )
                    }
                  />
                )
              )
          )}
        </div>
      </div>

      <TablePreview
        svg={
          svg
        }
      />

      <div className="mq-table-editor__actions">
        <button
          type="button"
          disabled={
            locked ||
            !dirty
          }
          onClick={
            reset
          }
        >
          Repor
        </button>

        <button
          type="button"
          className="is-primary"
          disabled={
            locked ||
            !dirty
          }
          onClick={() =>
            void apply()
          }
        >
          {saving
            ? 'A aplicar…'
            : 'Aplicar alterações'}
        </button>
      </div>

      {message ? (
        <p
          className="mq-table-editor__message"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>,
    host
  )
}
