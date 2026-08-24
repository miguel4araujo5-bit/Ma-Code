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
  chartDataToText,
  createMAQuadroChartFileFromDocument,
  createMAQuadroChartSvgFromDocument,
  MA_QUADRO_CHART_MAX_ITEMS,
  MA_QUADRO_CHART_MIN_ITEMS,
  readMAQuadroChartDocumentFromName,
  removeMAQuadroChartDatum,
  replaceMAQuadroChartDataFromText,
  setMAQuadroChartDatum,
  updateMAQuadroChartSpec,
  type MAQuadroChartDocument,
  type MAQuadroChartSpec
} from '../../lib/maQuadro/chartSvg'

import {
  useMAQuadroEditorContext
} from './editorContext'

import ChartPreview from './ChartPreview'
import ChartProControls from './ChartProControls'

import './maQuadroChart.css'
import './maQuadroChartPro.css'

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
    ChangeEvent<HTMLInputElement>
}

export default function ChartEditor() {
  const editor =
    useMAQuadroEditorContext()

  const sourceDocument =
    useMemo(
      () => {
        if (
          editor.selection
            .count !==
              1 ||
          editor.selection
            .role !==
              'image'
        ) {
          return null
        }

        return readMAQuadroChartDocumentFromName(
          editor.selection
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
  ] =
    useState<
      HTMLElement |
      null
    >(
      null
    )

  const [
    draft,
    setDraft
  ] =
    useState<
      | MAQuadroChartDocument
      | null
    >(
      null
    )

  const [
    bulkData,
    setBulkData
  ] =
    useState(
      ''
    )

  const [
    showBulkData,
    setShowBulkData
  ] =
    useState(
      false
    )

  const [
    saving,
    setSaving
  ] =
    useState(
      false
    )

  const [
    message,
    setMessage
  ] =
    useState(
      ''
    )

  useEffect(() => {
    setDraft(
      sourceDocument
    )

    setBulkData(
      sourceDocument
        ? chartDataToText(
            sourceDocument
          )
        : ''
    )

    setShowBulkData(
      false
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
      document.querySelector<HTMLElement>(
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

  const applyPreset =
    (
      values:
        Partial<MAQuadroChartSpec>
    ) => {
      setDraft(
        (
          current
        ) =>
          current
            ? updateMAQuadroChartSpec(
                current,
                values
              )
            : current
      )

      setMessage(
        ''
      )
    }

  const updateDatum =
    (
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

  const removeDatum =
    (
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

  const applyBulkData =
    () => {
      setDraft(
        (
          current
        ) =>
          current
            ? replaceMAQuadroChartDataFromText(
                current,
                bulkData
              )
            : current
      )

      setMessage(
        'Dados atualizados no gráfico. Confirme em “Aplicar alterações”.'
      )
    }

  const reset =
    () => {
      setDraft(
        sourceDocument
      )

      setBulkData(
        chartDataToText(
          sourceDocument
        )
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
      className="mq-chart-editor mq-chart-editor--pro"
      aria-label="Editar gráfico"
    >
      <div className="mq-chart-editor__heading">
        <span>
          <strong>
            Gráfico Pro
          </strong>

          <small>
            {
              draft.data
                .length
            }{' '}
            valores · SVG editável
          </small>
        </span>

        {dirty ? (
          <span className="mq-chart-editor__dirty">
            Alterado
          </span>
        ) : null}
      </div>

      <ChartProControls
        spec={
          draft.spec
        }
        disabled={
          locked
        }
        onChange={
          updateSpec
        }
        onApplyPreset={
          applyPreset
        }
      />

      <div className="mq-chart-data-heading">
        <span>
          <strong>
            Dados
          </strong>

          <small>
            {
              draft.data
                .length
            }
            {' / '}
            {
              MA_QUADRO_CHART_MAX_ITEMS
            }
          </small>
        </span>

        <div className="mq-chart-data-heading__actions">
          <button
            type="button"
            disabled={
              locked
            }
            onClick={() => {
              setBulkData(
                chartDataToText(
                  draft
                )
              )

              setShowBulkData(
                (
                  current
                ) =>
                  !current
              )
            }}
          >
            {showBulkData
              ? 'Fechar dados rápidos'
              : 'Dados rápidos'}
          </button>

          <button
            type="button"
            disabled={
              locked ||
              draft.data
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
      </div>

      {showBulkData ? (
        <div className="mq-chart-bulk-editor">
          <label className="mq-chart-field">
            <span>
              Colar CSV/dados
            </span>

            <textarea
              value={
                bulkData
              }
              rows={
                6
              }
              disabled={
                locked
              }
              placeholder={
                'Produto;120\nServiço;95\nAutomação;60'
              }
              onChange={(
                event
              ) =>
                setBulkData(
                  event.target
                    .value
                )
              }
            />

            <small>
              Use Tab, ponto e vírgula ou vírgula. Os dados substituem os valores atuais, mantendo as cores existentes por posição quando possível.
            </small>
          </label>

          <button
            type="button"
            className="mq-wide-action"
            disabled={
              locked
            }
            onClick={
              applyBulkData
            }
          >
            Aplicar dados ao gráfico
          </button>
        </div>
      ) : null}

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
                        event.target
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
                        event.target
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
                  1_000_000
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
                          event.target
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
                  draft.data
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

      <div className="mq-chart-pro-note">
        <span
          aria-hidden="true"
        >
          i
        </span>

        <p>
          As alterações continuam incorporadas no SVG do próprio gráfico. Não existe sincronização, upload ou processamento remoto.
        </p>
      </div>

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
          {
            message
          }
        </p>
      ) : null}
    </section>,
    host
  )
}
          
