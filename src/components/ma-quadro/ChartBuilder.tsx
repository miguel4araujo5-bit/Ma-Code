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
  type MAQuadroChartSpec
} from '../../lib/maQuadro/chartSvg'

import {
  useMAQuadroEditorContext
} from './editorContext'

import ChartPreview from './ChartPreview'
import ChartProControls from './ChartProControls'

import './maQuadroChart.css'
import './maQuadroChartPro.css'

export default function ChartBuilder() {
  const editor =
    useMAQuadroEditorContext()

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
    spec,
    setSpec
  ] =
    useState<MAQuadroChartSpec>(
      DEFAULT_MA_QUADRO_CHART_SPEC
    )

  const [
    content,
    setContent
  ] =
    useState(
      DEFAULT_MA_QUADRO_CHART_CONTENT
    )

  const [
    inserting,
    setInserting
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
      document.querySelector<HTMLElement>(
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
      document.querySelector<HTMLElement>(
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

  const applyPreset =
    (
      values:
        Partial<MAQuadroChartSpec>
    ) => {
      setSpec(
        (
          current
        ) => ({
          ...current,
          ...values
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
      className="mq-chart-builder mq-chart-builder--pro"
      aria-label="Gráfico"
    >
      <div className="mq-section-title mq-chart-builder__title">
        <span>
          <h3>
            Gráfico
          </h3>

          <small>
            Editor Pro local
          </small>
        </span>

        <span>
          {
            chartDocument
              .data
              .length
          }
        </span>
      </div>

      <ChartProControls
        spec={
          spec
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

      <label className="mq-chart-field">
        <span>
          Dados rápidos
        </span>

        <textarea
          value={
            content
          }
          disabled={
            locked
          }
          rows={
            6
          }
          placeholder={
            'Produto;120\nServiço;95\nAutomação;60'
          }
          onChange={(
            event
          ) => {
            setContent(
              event.target
                .value
            )

            setMessage(
              ''
            )
          }}
        />

        <small>
          Cole CSV simples ou dados por linha. Use Tab, ponto e vírgula ou vírgula como separador. A primeira linha de cabeçalho é ignorada automaticamente.
        </small>
      </label>

      <div className="mq-chart-pro-note">
        <span
          aria-hidden="true"
        >
          i
        </span>

        <p>
          O gráfico é criado como SVG local e mantém metadata editável. Não existe upload, API ou processamento no servidor.
        </p>
      </div>

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
          {
            message
          }
        </p>
      ) : null}
    </section>,
    host
  )
}
