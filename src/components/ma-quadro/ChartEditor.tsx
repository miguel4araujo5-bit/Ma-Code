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
  addMAQuadroChartDatum,
  createMAQuadroChartFileFromDocument,
  createMAQuadroChartSvgFromDocument,
  MA_QUADRO_CHART_MAX_ITEMS,
  MA_QUADRO_CHART_MIN_ITEMS,
  readMAQuadroChartDocumentFromName,
  removeMAQuadroChartDatum,
  setMAQuadroChartDatum,
  updateMAQuadroChartSpec,
  type MAQuadroChartDocument,
  type MAQuadroChartSpec,
  type MAQuadroChartType
} from '../../lib/maQuadro/chartSvg'

import {
  useMAQuadroEditorContext
} from './editorContext'

import ChartPreview from './ChartPreview'

import './maQuadroChart.css'

const CHART_TYPES:
  Array<{
    type:
      MAQuadroChartType
    label:
      string
  }> = [
    {
      type: 'bar',
      label: 'Barras'
    },
    {
      type: 'line',
      label: 'Linhas'
    },
    {
      type: 'pie',
      label: 'Circular'
    }
  ]

function createFileChangeEvent(
  file:
    File
) {
  const files = {
    0:
      file,

    length:
      1,

    item:
      (
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

export default function ChartEditor() {
  const editor =
    useMAQuadroEditorContext()

  const sourceDocument =
    useMemo(
      () => {
        if (
          editor
            .selection
            .count !==
              1 ||
          editor
            .selection
            .role !==
              'image'
        ) {
          return null
        }

        return readMAQuadroChartDocumentFromName(
          editor
            .selection
            .name
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
    MAQuadroChartDocument |
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
      'mq-chart-editor-host'

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
    createMAQuadroChartSvgFromDocument(
      draft
    )

  const updateSpec = <
    Key extends
      keyof MAQuadroChartSpec
  >(
    key:
      Key,
    value:
      MAQuadroChartSpec[
        Key
      ]
  ) => {
    setDraft(
      (
        current
      ) =>
        current
          ? updateMAQuadroChartSpec(
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

  const updateDatum = (
    index:
      number,
    values:
      Parameters<
        typeof setMAQuadroChartDatum
      >[2]
  ) => {
    setDraft(
      (
        current
      ) =>
        current
          ? setMAQuadroChartDatum(
              current,
              index,
              values
            )
          : current
    )

    setMessage(
      ''
    )
  }

  const addDatum =
    () => {
      setDraft(
        (
          current
        ) =>
          current
            ? addMAQuadroChartDatum(
                current
              )
            : current
      )

      setMessage(
        ''
      )
    }

  const removeDatum = (
    index:
      number
  ) => {
    setDraft(
      (
        current
      ) =>
        current
          ? removeMAQuadroChartDatum(
              current,
              index
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
          createMAQuadroChartFileFromDocument(
            draft
          )

        await editor
          .replaceSelectedImage(
            createFileChangeEvent(
              file
            )
          )

        setMessage(
          'Gráfico atualizado.'
        )
      } catch {
        setMessage(
          'Erro ao atualizar o gráfico.'
        )
      } finally {
        setSaving(
          false
        )
      }
    }

  return createPortal(
    <section
      className="mq-chart-editor"
      aria-label="Editar gráfico"
    >
      <div className="mq-chart-editor__heading">
        <span>
          <strong>
            Gráfico
          </strong>

          <small>
            {
              draft
                .data
                .length
            }{' '}
            valores
          </small>
        </span>

        {dirty ? (
          <span className="mq-chart-editor__dirty">
            Alterado
          </span>
        ) : null}
      </div>

      <div className="mq-chart-type-grid">
        {CHART_TYPES.map(
          (
            item
          ) => (
            <button
              key={
                item.type
              }
              type="button"
              disabled={
                locked
              }
              className={
                draft
                  .spec
                  .type ===
                item.type
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                updateSpec(
                  'type',
                  item.type
                )
              }
            >
              {
                item.label
              }
            </button>
          )
        )}
      </div>

      <label className="mq-chart-field">
        <span>
          Título
        </span>

        <input
          type="text"
          maxLength={
            80
          }
          value={
            draft
              .spec
              .title
          }
          disabled={
            locked
          }
          onChange={(
            event
          ) =>
            updateSpec(
              'title',
              event
                .target
                .value
            )
          }
        />
      </label>

      <div className="mq-chart-toggle-row">
        <label>
          <input
            type="checkbox"
            checked={
              draft
                .spec
                .showValues
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'showValues',
                event
                  .target
                  .checked
              )
            }
          />

          <span>
            Mostrar valores
          </span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={
              draft
                .spec
                .showLegend
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'showLegend',
                event
                  .target
                  .checked
              )
            }
          />

          <span>
            Mostrar legenda
          </span>
        </label>
      </div>

      <div className="mq-chart-color-grid">
        <label>
          <span>
            Fundo
          </span>

          <input
            type="color"
            value={
              draft
                .spec
                .background
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'background',
                event
                  .target
                  .value
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
                .textColor
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'textColor',
                event
                  .target
                  .value
              )
            }
          />
        </label>

        <label>
          <span>
            Eixos
          </span>

          <input
            type="color"
            value={
              draft
                .spec
                .axisColor
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              updateSpec(
                'axisColor',
                event
                  .target
                  .value
              )
            }
          />
        </label>
      </div>

      <div className="mq-chart-data-heading">
        <span>
          <strong>
            Dados
          </strong>

          <small>
            {
              draft
                .data
                .length
            }
            {' / '}
            {
              MA_QUADRO_CHART_MAX_ITEMS
            }
          </small>
        </span>

        <button
          type="button"
          disabled={
            locked ||
            draft
              .data
              .length >=
              MA_QUADRO_CHART_MAX_ITEMS
          }
          onClick={
            addDatum
          }
        >
          + Valor
        </button>
      </div>

      <div className="mq-chart-data-list">
        {draft.data.map(
          (
            datum,
            index
          ) => (
            <div
              key={
                index
              }
              className="mq-chart-data-row"
            >
              <input
                type="color"
                value={
                  datum.color
                }
                disabled={
                  locked
                }
                aria-label={`Cor do valor ${index + 1}`}
                onChange={(
                  event
                ) =>
                  updateDatum(
                    index,
                    {
                      color:
                        event
                          .target
                          .value
                    }
                  )
                }
              />

              <input
                type="text"
                value={
                  datum.label
                }
                maxLength={
                  48
                }
                disabled={
                  locked
                }
                aria-label={`Nome do valor ${index + 1}`}
                onChange={(
                  event
                ) =>
                  updateDatum(
                    index,
                    {
                      label:
                        event
                          .target
                          .value
                    }
                  )
                }
              />

              <input
                type="number"
                min={
                  0
                }
                max={
                  1000000
                }
                step="any"
                value={
                  datum.value
                }
                disabled={
                  locked
                }
                aria-label={`Valor ${index + 1}`}
                onChange={(
                  event
                ) =>
                  updateDatum(
                    index,
                    {
                      value:
                        Number(
                          event
                            .target
                            .value
                        )
                    }
                  )
                }
              />

              <button
                type="button"
                disabled={
                  locked ||
                  draft
                    .data
                    .length <=
                    MA_QUADRO_CHART_MIN_ITEMS
                }
                aria-label={`Eliminar valor ${index + 1}`}
                title="Eliminar valor"
                onClick={() =>
                  removeDatum(
                    index
                  )
                }
              >
                ×
              </button>
            </div>
          )
        )}
      </div>

      <ChartPreview
        svg={
          svg
        }
      />

      <div className="mq-chart-editor__actions">
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
          className="mq-chart-message"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>,
    host
  )
}
