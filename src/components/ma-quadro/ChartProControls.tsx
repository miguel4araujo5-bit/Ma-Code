import {
  MA_QUADRO_CHART_STYLE_PRESETS,
  type MAQuadroChartSpec,
  type MAQuadroChartType
} from '../../lib/maQuadro/chartSvg'

const CHART_TYPES:
  Array<{
    type:
      MAQuadroChartType

    label:
      string
  }> = [
    {
      type:
        'bar',

      label:
        'Barras'
    },

    {
      type:
        'line',

      label:
        'Linhas'
    },

    {
      type:
        'area',

      label:
        'Área'
    },

    {
      type:
        'pie',

      label:
        'Circular'
    },

    {
      type:
        'donut',

      label:
        'Donut'
    }
  ]

type Props = {
  spec:
    MAQuadroChartSpec

  disabled?:
    boolean

  onChange:
    <
      Key extends
        keyof MAQuadroChartSpec
    >(
      key:
        Key,

      value:
        MAQuadroChartSpec[
          Key
        ]
    ) =>
      void

  onApplyPreset:
    (
      values:
        Partial<MAQuadroChartSpec>
    ) =>
      void
}

export default function ChartProControls({
  spec,
  disabled = false,
  onChange,
  onApplyPreset
}: Props) {
  const cartesian =
    spec.type ===
      'bar' ||
    spec.type ===
      'line' ||
    spec.type ===
      'area'

  const lineLike =
    spec.type ===
      'line' ||
    spec.type ===
      'area'

  const circular =
    spec.type ===
      'pie' ||
    spec.type ===
      'donut'

  return (
    <>
      <div className="mq-chart-type-grid mq-chart-type-grid--pro">
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
                disabled
              }
              className={
                spec.type ===
                item.type
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                onChange(
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

      <div className="mq-chart-pro-section">
        <div className="mq-chart-pro-section__heading">
          <span>
            <strong>
              Estilos rápidos
            </strong>

            <small>
              Aplique uma base e personalize depois.
            </small>
          </span>
        </div>

        <div className="mq-chart-style-presets">
          {MA_QUADRO_CHART_STYLE_PRESETS.map(
            (
              preset
            ) => (
              <button
                key={
                  preset.id
                }
                type="button"
                disabled={
                  disabled
                }
                onClick={() =>
                  onApplyPreset(
                    preset.values
                  )
                }
              >
                <span
                  style={{
                    background:
                      preset.values
                        .background,

                    color:
                      preset.values
                        .seriesColor
                  }}
                  aria-hidden="true"
                >
                  ▥
                </span>

                <span>
                  <strong>
                    {
                      preset.name
                    }
                  </strong>

                  <small>
                    {
                      preset.description
                    }
                  </small>
                </span>
              </button>
            )
          )}
        </div>
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
            disabled
          }
          onChange={(
            event
          ) =>
            onChange(
              'title',
              event.target
                .value
            )
          }
        />
      </label>

      <div className="mq-chart-toggle-row mq-chart-toggle-row--pro">
        <label>
          <input
            type="checkbox"
            checked={
              spec.showValues
            }
            disabled={
              disabled
            }
            onChange={(
              event
            ) =>
              onChange(
                'showValues',
                event.target
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
              disabled
            }
            onChange={(
              event
            ) =>
              onChange(
                'showLegend',
                event.target
                  .checked
              )
            }
          />

          <span>
            Mostrar legenda
          </span>
        </label>

        {cartesian ? (
          <>
            <label>
              <input
                type="checkbox"
                checked={
                  spec.showAxes
                }
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    'showAxes',
                    event.target
                      .checked
                  )
                }
              />

              <span>
                Mostrar eixos
              </span>
            </label>

            <label>
              <input
                type="checkbox"
                checked={
                  spec.showGrid
                }
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    'showGrid',
                    event.target
                      .checked
                  )
                }
              />

              <span>
                Mostrar grelha
              </span>
            </label>
          </>
        ) : null}
      </div>

      {spec.type ===
        'bar' &&
      spec.showValues ? (
        <label className="mq-chart-pro-select">
          <span>
            Posição dos valores
          </span>

          <select
            value={
              spec.valuePosition
            }
            disabled={
              disabled
            }
            onChange={(
              event
            ) =>
              onChange(
                'valuePosition',
                event.target
                  .value as
                  MAQuadroChartSpec[
                    'valuePosition'
                  ]
              )
            }
          >
            <option value="auto">
              Automática
            </option>

            <option value="outside">
              Exterior
            </option>

            <option value="inside">
              Interior
            </option>
          </select>
        </label>
      ) : null}

      {spec.showLegend ? (
        <label className="mq-chart-pro-select">
          <span>
            Posição da legenda
          </span>

          <select
            value={
              spec.legendPosition
            }
            disabled={
              disabled
            }
            onChange={(
              event
            ) =>
              onChange(
                'legendPosition',
                event.target
                  .value as
                  MAQuadroChartSpec[
                    'legendPosition'
                  ]
              )
            }
          >
            <option value="top">
              Em cima
            </option>

            <option value="bottom">
              Em baixo
            </option>

            <option value="left">
              À esquerda
            </option>

            <option value="right">
              À direita
            </option>
          </select>
        </label>
      ) : null}

      {spec.type ===
      'bar' ? (
        <div className="mq-chart-pro-section">
          <div className="mq-chart-pro-section__heading">
            <span>
              <strong>
                Barras
              </strong>

              <small>
                Orientação e arredondamento.
              </small>
            </span>
          </div>

          <div className="mq-chart-pro-grid">
            <label>
              <span>
                Orientação
              </span>

              <select
                value={
                  spec.barDirection
                }
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    'barDirection',
                    event.target
                      .value as
                      MAQuadroChartSpec[
                        'barDirection'
                      ]
                  )
                }
              >
                <option value="vertical">
                  Vertical
                </option>

                <option value="horizontal">
                  Horizontal
                </option>
              </select>
            </label>

            <label>
              <span>
                Arredondamento
              </span>

              <input
                type="number"
                min={
                  0
                }
                max={
                  24
                }
                step={
                  1
                }
                value={
                  spec.barRadius
                }
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    'barRadius',
                    Number(
                      event.target
                        .value
                    )
                  )
                }
              />
            </label>
          </div>
        </div>
      ) : null}

      {lineLike ? (
        <div className="mq-chart-pro-section">
          <div className="mq-chart-pro-section__heading">
            <span>
              <strong>
                {spec.type ===
                'area'
                  ? 'Área e linha'
                  : 'Linha'}
              </strong>

              <small>
                Espessura, pontos e cor da série.
              </small>
            </span>
          </div>

          <div className="mq-chart-pro-grid mq-chart-pro-grid--three">
            <label>
              <span>
                Espessura
              </span>

              <input
                type="number"
                min={
                  2
                }
                max={
                  12
                }
                step={
                  1
                }
                value={
                  spec.lineWidth
                }
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    'lineWidth',
                    Number(
                      event.target
                        .value
                    )
                  )
                }
              />
            </label>

            <label>
              <span>
                Pontos
              </span>

              <input
                type="number"
                min={
                  0
                }
                max={
                  14
                }
                step={
                  1
                }
                value={
                  spec.pointSize
                }
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    'pointSize',
                    Number(
                      event.target
                        .value
                    )
                  )
                }
              />
            </label>

            <label>
              <span>
                Cor da série
              </span>

              <input
                type="color"
                value={
                  spec.seriesColor
                }
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    'seriesColor',
                    event.target
                      .value
                  )
                }
              />
            </label>
          </div>

          {spec.type ===
          'area' ? (
            <label className="mq-chart-pro-range">
              <span>
                <strong>
                  Opacidade da área
                </strong>

                <small>
                  {Math.round(
                    spec.areaOpacity *
                    100
                  )}
                  %
                </small>
              </span>

              <input
                type="range"
                min={
                  5
                }
                max={
                  80
                }
                step={
                  1
                }
                value={
                  Math.round(
                    spec.areaOpacity *
                    100
                  )
                }
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    'areaOpacity',
                    Number(
                      event.target
                        .value
                    ) /
                      100
                  )
                }
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {circular ? (
        <div className="mq-chart-pro-section">
          <div className="mq-chart-pro-section__heading">
            <span>
              <strong>
                Gráfico circular
              </strong>

              <small>
                Defina o formato apresentado nos segmentos.
              </small>
            </span>
          </div>

          <div className="mq-chart-pro-grid">
            <label>
              <span>
                Valores
              </span>

              <select
                value={
                  spec.pieValueMode
                }
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    'pieValueMode',
                    event.target
                      .value as
                      MAQuadroChartSpec[
                        'pieValueMode'
                      ]
                  )
                }
              >
                <option value="percent">
                  Percentagem
                </option>

                <option value="value">
                  Valor
                </option>
              </select>
            </label>

            {spec.type ===
            'donut' ? (
              <label>
                <span>
                  Centro
                </span>

                <input
                  type="number"
                  min={
                    30
                  }
                  max={
                    75
                  }
                  step={
                    1
                  }
                  value={
                    Math.round(
                      spec.donutHole *
                      100
                    )
                  }
                  disabled={
                    disabled
                  }
                  onChange={(
                    event
                  ) =>
                    onChange(
                      'donutHole',
                      Number(
                        event.target
                          .value
                      ) /
                        100
                    )
                  }
                />
              </label>
            ) : null}
          </div>
        </div>
      ) : null}

      {cartesian ? (
        <div className="mq-chart-pro-section">
          <div className="mq-chart-pro-section__heading">
            <span>
              <strong>
                Escala
              </strong>

              <small>
                Automática por defeito; ajuste apenas quando necessário.
              </small>
            </span>

            <label className="mq-chart-pro-switch">
              <input
                type="checkbox"
                checked={
                  spec.axisAuto
                }
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    'axisAuto',
                    event.target
                      .checked
                  )
                }
              />

              <span>
                Automática
              </span>
            </label>
          </div>

          <div className="mq-chart-pro-grid mq-chart-pro-grid--three">
            <label>
              <span>
                Mínimo
              </span>

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
                  spec.axisMin
                }
                disabled={
                  disabled ||
                  spec.axisAuto
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    'axisMin',
                    Number(
                      event.target
                        .value
                    )
                  )
                }
              />
            </label>

            <label>
              <span>
                Máximo
              </span>

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
                  spec.axisMax
                }
                disabled={
                  disabled ||
                  spec.axisAuto
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    'axisMax',
                    Number(
                      event.target
                        .value
                    )
                  )
                }
              />
            </label>

            <label>
              <span>
                Intervalo
              </span>

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
                  spec.axisStep
                }
                disabled={
                  disabled
                }
                placeholder="Auto"
                onChange={(
                  event
                ) =>
                  onChange(
                    'axisStep',
                    Number(
                      event.target
                        .value
                    )
                  )
                }
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="mq-chart-pro-section">
        <div className="mq-chart-pro-section__heading">
          <span>
            <strong>
              Formato dos valores
            </strong>

            <small>
              Moeda, percentagem, unidades e casas decimais.
            </small>
          </span>
        </div>

        <div className="mq-chart-pro-grid mq-chart-pro-grid--three">
          <label>
            <span>
              Prefixo
            </span>

            <input
              type="text"
              maxLength={
                12
              }
              value={
                spec.valuePrefix
              }
              disabled={
                disabled
              }
              placeholder="€"
              onChange={(
                event
              ) =>
                onChange(
                  'valuePrefix',
                  event.target
                    .value
                )
              }
            />
          </label>

          <label>
            <span>
              Sufixo
            </span>

            <input
              type="text"
              maxLength={
                12
              }
              value={
                spec.valueSuffix
              }
              disabled={
                disabled
              }
              placeholder="%"
              onChange={(
                event
              ) =>
                onChange(
                  'valueSuffix',
                  event.target
                    .value
                )
              }
            />
          </label>

          <label>
            <span>
              Decimais
            </span>

            <input
              type="number"
              min={
                0
              }
              max={
                4
              }
              step={
                1
              }
              value={
                spec.decimalPlaces
              }
              disabled={
                disabled
              }
              onChange={(
                event
              ) =>
                onChange(
                  'decimalPlaces',
                  Number(
                    event.target
                      .value
                  )
                )
              }
            />
          </label>
        </div>
      </div>

      <div className="mq-chart-color-grid mq-chart-color-grid--pro">
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
              disabled
            }
            onChange={(
              event
            ) =>
              onChange(
                'background',
                event.target
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
              disabled
            }
            onChange={(
              event
            ) =>
              onChange(
                'textColor',
                event.target
                  .value
              )
            }
          />
        </label>

        <label>
          <span>
            Eixos/grelha
          </span>

          <input
            type="color"
            value={
              spec.axisColor
            }
            disabled={
              disabled
            }
            onChange={(
              event
            ) =>
              onChange(
                'axisColor',
                event.target
                  .value
              )
            }
          />
        </label>
      </div>
    </>
  )
}
