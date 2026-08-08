import {
  useLayoutEffect,
  useMemo,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  createMAQuadroTableFile,
  createMAQuadroTableSvg,
  DEFAULT_MA_QUADRO_TABLE_SPEC,
  MA_QUADRO_TABLE_MAX_COLUMNS,
  MA_QUADRO_TABLE_MAX_ROWS,
  MA_QUADRO_TABLE_MIN_COLUMNS,
  MA_QUADRO_TABLE_MIN_ROWS,
  type MAQuadroTableSpec
} from '../../lib/maQuadro/tableSvg'

import {
  useMAQuadroEditorContext
} from './editorContext'

import TablePreview from './TablePreview'

import './maQuadroTable.css'

type TablePreset = {
  label: string
  rows: number
  columns: number
}

const TABLE_PRESETS:
  TablePreset[] = [
    {
      label: '2 × 2',
      rows: 2,
      columns: 2
    },
    {
      label: '3 × 3',
      rows: 3,
      columns: 3
    },
    {
      label: '4 × 4',
      rows: 4,
      columns: 4
    }
  ]

export default function TableBuilder() {
  const editor =
    useMAQuadroEditorContext()

  const [
    host,
    setHost
  ] = useState<
    HTMLElement |
    null
  >(null)

  const [
    spec,
    setSpec
  ] = useState<
    MAQuadroTableSpec
  >(
    DEFAULT_MA_QUADRO_TABLE_SPEC
  )

  const [
    content,
    setContent
  ] = useState(
    ''
  )

  const [
    inserting,
    setInserting
  ] = useState(
    false
  )

  const [
    message,
    setMessage
  ] = useState(
    ''
  )

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      editor.activePanel !==
        'elements'
    ) {
      setHost(
        null
      )

      return
    }

    const elementGrid =
      document.querySelector<
        HTMLElement
      >(
        '.mq-left-panel .mq-element-grid'
      )

    if (
      !elementGrid
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
      'mq-table-builder-host'

    elementGrid
      .insertAdjacentElement(
        'afterend',
        mount
      )

    setHost(
      mount
    )

    return () => {
      mount.remove()
    }
  }, [
    editor.activePanel,
    editor.ready
  ])

  const svg =
    useMemo(
      () =>
        createMAQuadroTableSvg(
          spec,
          content
        ),
      [
        content,
        spec
      ]
    )

  if (
    !host
  ) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    inserting

  const updateSpec = <
    Key extends
      keyof MAQuadroTableSpec
  >(
    key: Key,
    value:
      MAQuadroTableSpec[Key]
  ) => {
    setSpec(
      (
        current
      ) => ({
        ...current,
        [key]:
          value
      })
    )

    setMessage(
      ''
    )
  }

  const applyPreset = (
    preset:
      TablePreset
  ) => {
    setSpec(
      (
        current
      ) => ({
        ...current,

        rows:
          preset.rows,

        columns:
          preset.columns
      })
    )

    setMessage(
      ''
    )
  }

  const insertTable =
    async () => {
      if (
        locked
      ) {
        return
      }

      setInserting(
        true
      )

      setMessage(
        ''
      )

      try {
        await editor
          .handleDroppedFiles([
            createMAQuadroTableFile(
              spec,
              content
            )
          ])

        setMessage(
          'Tabela inserida.'
        )
      } catch {
        setMessage(
          'Erro ao inserir a tabela.'
        )
      } finally {
        setInserting(
          false
        )
      }
    }

  return createPortal(
    <section
      className="mq-table-builder"
      aria-label="Tabela"
    >
      <div className="mq-section-title mq-table-builder__title">
        <h3>
          Tabela
        </h3>

        <span>
          {spec.rows}
          {' × '}
          {spec.columns}
        </span>
      </div>

      <div className="mq-table-presets">
        {TABLE_PRESETS.map(
          (
            preset
          ) => (
            <button
              key={
                preset.label
              }
              type="button"
              disabled={
                locked
              }
              onClick={() =>
                applyPreset(
                  preset
                )
              }
              className={
                spec.rows ===
                  preset.rows &&
                spec.columns ===
                  preset.columns
                  ? 'is-active'
                  : ''
              }
            >
              {
                preset.label
              }
            </button>
          )
        )}
      </div>

      <div className="mq-table-size-fields">
        <label>
          <span>
            Linhas
          </span>

          <input
            type="number"
            min={
              MA_QUADRO_TABLE_MIN_ROWS
            }
            max={
              MA_QUADRO_TABLE_MAX_ROWS
            }
            value={
              spec.rows
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'rows',
                Number(
                  event
                    .target
                    .value
                )
              )
            }
          />
        </label>

        <label>
          <span>
            Colunas
          </span>

          <input
            type="number"
            min={
              MA_QUADRO_TABLE_MIN_COLUMNS
            }
            max={
              MA_QUADRO_TABLE_MAX_COLUMNS
            }
            value={
              spec.columns
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'columns',
                Number(
                  event
                    .target
                    .value
                )
              )
            }
          />
        </label>
      </div>

      <div className="mq-table-toggle-row">
        <label>
          <input
            type="checkbox"
            checked={
              spec.header
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'header',
                event
                  .target
                  .checked
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
              spec.striped
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'striped',
                event
                  .target
                  .checked
              )
            }
          />

          <span>
            Linhas alternadas
          </span>
        </label>
      </div>

      <div className="mq-table-color-grid">
        <label>
          <span>
            Cabeçalho
          </span>

          <input
            type="color"
            value={
              spec.headerBackground
            }
            disabled={
              locked ||
              !spec.header
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'headerBackground',
                event
                  .target
                  .value
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
              spec.bodyBackground
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'bodyBackground',
                event
                  .target
                  .value
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
              spec.alternateBackground
            }
            disabled={
              locked ||
              !spec.striped
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'alternateBackground',
                event
                  .target
                  .value
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
              spec.borderColor
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'borderColor',
                event
                  .target
                  .value
              )
            }
          />
        </label>
      </div>

      <label className="mq-table-content-field">
        <span>
          Conteúdo
        </span>

        <textarea
          value={
            content
          }
          disabled={
            locked
          }
          rows={
            4
          }
          placeholder={
            'Nome;Valor;Estado\nItem 1;10;Ativo\nItem 2;20;Pendente'
          }
          onChange={(
            event
          ) => {
            setContent(
              event
                .target
                .value
            )

            setMessage(
              ''
            )
          }}
        />

        <small>
          Separe colunas com
          Tab ou ;
        </small>
      </label>

      <TablePreview
        svg={
          svg
        }
      />

      <button
        type="button"
        className="mq-wide-action mq-table-insert-button"
        disabled={
          locked
        }
        onClick={() =>
          void insertTable()
        }
      >
        {inserting
          ? 'A inserir…'
          : '+ Inserir tabela'}
      </button>

      {message ? (
        <p
          className="mq-table-builder__message"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>,
    host
  )
}
