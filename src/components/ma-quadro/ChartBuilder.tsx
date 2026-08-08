import {
  useLayoutEffect,
  useMemo,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  createMAQuadroChartDocument,
  createMAQuadroChartFileFromDocument,
  createMAQuadroChartSvgFromDocument,
  DEFAULT_MA_QUADRO_CHART_CONTENT,
  DEFAULT_MA_QUADRO_CHART_SPEC,
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

export default function ChartBuilder() {
  const editor =
    useMAQuadroEditorContext()

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
    spec,
    setSpec
  ] = useState<
    MAQuadroChartSpec
  >(
    DEFAULT_MA_QUADRO_CHART_SPEC
  )

  const [
    content,
    setContent
  ] = useState(
    DEFAULT_MA_QUADRO_CHART_CONTENT
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

    const anchor =
      document.querySelector<
        HTMLElement
      >(
        '.mq-table-builder-host'
      ) ||
      elementGrid

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-chart-builder-host'

    anchor
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

  const chartDocument =
    useMemo(
      () =>
        createMAQuadroChartDocument(
          spec,
          content
        ),
      [
        content,
        spec
      ]
    )

  const svg =
    useMemo(
      () =>
        createMAQuadroChartSvgFromDocument(
          chartDocument
        ),
      [
        chartDocument
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
      keyof MAQuadroChartSpec
  >(
    key:
      Key,
    value:
      MAQuadroChartSpec[
        Key
      ]
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

  const insertChart =
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
            createMAQuadroChartFileFromDocument(
              chartDocument
            )
          ])

        setMessage(
          'Gráfico inserido.'
        )
      } catch {
        setMessage(
          'Erro ao inserir o gráfico.'
        )
      } finally {
        setInserting(
          false
        )
      }
    }

  return createPortal(
    <section
      className="mq-chart-builder"
      aria-label="Gráfico"
    >
      <div className="mq-section-title mq-chart-builder__title">
        <h3>
          Gráfico
        </h3>

        <span>
          {
            chartDocument
              .data
              .length
          }
        </span>
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
                spec.type ===
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
            spec.title
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
              spec.showValues
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
              spec.showLegend
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
              spec.background
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
              spec.textColor
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
              spec.axisColor
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

      <label className="mq-chart-field">
        <span>
          Dados
        </span>

        <textarea
          value={
            content
          }
          disabled={
            locked
          }
          rows={
            5
          }
          placeholder={
            'Website;45\nAutomação;32\nAplicação;24'
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
          Uma linha por valor.
          Separe o nome e o
          valor com Tab ou ;
        </small>
      </label>

      <ChartPreview
        svg={
          svg
        }
      />

      <button
        type="button"
        className="mq-wide-action"
        disabled={
          locked
        }
        onClick={() =>
          void insertChart()
        }
      >
        {inserting
          ? 'A inserir…'
          : '+ Inserir gráfico'}
      </button>

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
