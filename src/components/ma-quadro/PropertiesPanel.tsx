import {
  useState,
  type ReactNode
} from 'react'

import {
  useMAQuadroEditorContext
} from './editorContext'

function Section({
  title,
  description,
  children,
  defaultOpen = true
}: {
  title: string
  description?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [
    open,
    setOpen
  ] = useState(defaultOpen)

  return (
    <section className="mq-properties-section">
      <button
        type="button"
        className="mq-properties-section__header"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        aria-expanded={open}
      >
        <span>
          <strong>
            {title}
          </strong>

          {description ? (
            <small>
              {description}
            </small>
          ) : null}
        </span>

        <span>
          {open ? '−' : '+'}
        </span>
      </button>

      {open ? (
        <div className="mq-properties-section__body">
          {children}
        </div>
      ) : null}
    </section>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled = false
}: {
  label: string
  value: number
  onChange: (
    value: number
  ) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
}) {
  return (
    <label className="mq-field">
      <span>
        {label}
      </span>

      <span className="mq-number-field">
        <input
          type="number"
          value={
            Number.isFinite(value)
              ? value
              : 0
          }
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              Number(
                event.target.value
              )
            )
          }
        />

        {suffix ? (
          <small>
            {suffix}
          </small>
        ) : null}
      </span>
    </label>
  )
}

function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = ''
}: {
  label: string
  value: number
  onChange: (
    value: number
  ) => void
  min: number
  max: number
  step?: number
  suffix?: string
}) {
  return (
    <label className="mq-range-field">
      <span>
        <strong>
          {label}
        </strong>

        <output>
          {value}
          {suffix}
        </output>
      </span>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(
            Number(
              event.target.value
            )
          )
        }
      />
    </label>
  )
}

function ColorField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (
    value: string
  ) => void
}) {
  return (
    <label className="mq-field mq-field--color">
      <span>
        {label}
      </span>

      <span>
        <input
          type="color"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
        />

        <input
          type="text"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
        />
      </span>
    </label>
  )
}

function BackgroundProperties() {
  const editor =
    useMAQuadroEditorContext()

  const page =
    editor.activePage

  if (!page) {
    return null
  }

  return (
    <>
      <Section
        title="Fundo da página"
        description="Cor sólida, transparência ou gradiente"
      >
        <div className="mq-segmented">
          {([
            [
              'solid',
              'Cor'
            ],
            [
              'gradient',
              'Gradiente'
            ],
            [
              'transparent',
              'Transparente'
            ]
          ] as const).map(
            (
              [
                type,
                label
              ]
            ) => (
              <button
                key={type}
                type="button"
                className={
                  page.background
                    .type ===
                  type
                    ? 'is-active'
                    : ''
                }
                onClick={() =>
                  editor.setBackground({
                    type
                  })
                }
              >
                {label}
              </button>
            )
          )}
        </div>

        {page.background.type ===
        'solid' ? (
          <ColorField
            label="Cor"
            value={
              page.background
                .color
            }
            onChange={(color) =>
              editor.setBackground({
                color
              })
            }
          />
        ) : null}

        {page.background.type ===
        'gradient' ? (
          <>
            <ColorField
              label="Cor inicial"
              value={
                page.background
                  .gradientFrom
              }
              onChange={(
                gradientFrom
              ) =>
                editor.setBackground({
                  gradientFrom
                })
              }
            />

            <ColorField
              label="Cor final"
              value={
                page.background
                  .gradientTo
              }
              onChange={(
                gradientTo
              ) =>
                editor.setBackground({
                  gradientTo
                })
              }
            />

            <RangeField
              label="Ângulo"
              value={
                page.background
                  .gradientAngle
              }
              onChange={(
                gradientAngle
              ) =>
                editor.setBackground({
                  gradientAngle
                })
              }
              min={0}
              max={360}
              suffix="°"
            />
          </>
        ) : null}
      </Section>

      <Section
        title="Tamanho do projeto"
        defaultOpen={false}
      >
        <div className="mq-two-columns">
          <NumberField
            label="Largura"
            value={page.width}
            onChange={() =>
              undefined
            }
            suffix="px"
            disabled
          />

          <NumberField
            label="Altura"
            value={page.height}
            onChange={() =>
              undefined
            }
            suffix="px"
            disabled
          />
        </div>

        <p className="mq-control-note">
          Para evitar alterações
          acidentais, use o botão
          abaixo para redimensionar
          todas as páginas de uma só
          vez.
        </p>

        <button
          type="button"
          className="mq-panel-action"
          onClick={() => {
            const width =
              Number(
                window.prompt(
                  'Nova largura em píxeis:',
                  String(
                    page.width
                  )
                )
              )

            const height =
              Number(
                window.prompt(
                  'Nova altura em píxeis:',
                  String(
                    page.height
                  )
                )
              )

            if (
              Number.isFinite(
                width
              ) &&
              Number.isFinite(
                height
              )
            ) {
              void editor
                .resizeAllPages(
                  width,
                  height
                )
            }
          }}
        >
          Redimensionar todas as
          páginas
        </button>
      </Section>
    </>
  )
}

function SelectionGeometry() {
  const editor =
    useMAQuadroEditorContext()

  const selection =
    editor.selection

  return (
    <Section
      title="Posição e tamanho"
      description={`${selection.count} selecionado${
        selection.count === 1
          ? ''
          : 's'
      }`}
    >
      <div className="mq-two-columns">
        <NumberField
          label="X"
          value={selection.x}
          onChange={(value) =>
            editor
              .setSelectionGeometry(
                'x',
                value
              )
          }
          suffix="px"
        />

        <NumberField
          label="Y"
          value={selection.y}
          onChange={(value) =>
            editor
              .setSelectionGeometry(
                'y',
                value
              )
          }
          suffix="px"
        />

        <NumberField
          label="Largura"
          value={
            selection.width
          }
          onChange={(value) =>
            editor
              .setSelectionGeometry(
                'width',
                value
              )
          }
          min={1}
          suffix="px"
        />

        <NumberField
          label="Altura"
          value={
            selection.height
          }
          onChange={(value) =>
            editor
              .setSelectionGeometry(
                'height',
                value
              )
          }
          min={1}
          suffix="px"
        />
      </div>

      <RangeField
        label="Rotação"
        value={
          selection.angle
        }
        onChange={(value) =>
          editor
            .setSelectionGeometry(
              'angle',
              value
            )
        }
        min={-180}
        max={180}
        suffix="°"
      />

      <div className="mq-action-grid mq-action-grid--2">
        <button
          type="button"
          onClick={() =>
            editor
              .setSelectionFlip(
                'x'
              )
          }
        >
          Virar horizontal
        </button>

        <button
          type="button"
          onClick={() =>
            editor
              .setSelectionFlip(
                'y'
              )
          }
        >
          Virar vertical
        </button>
      </div>
    </Section>
  )
}

function AppearanceProperties() {
  const editor =
    useMAQuadroEditorContext()

  const selection =
    editor.selection

  const supportsFill =
    selection.role !==
      'image' &&
    selection.role !==
      'group'

  return (
    <Section
      title="Aspeto"
      description="Cores, contorno, opacidade e efeitos"
    >
      {supportsFill ? (
        <ColorField
          label="Preenchimento"
          value={
            selection.fill
          }
          onChange={
            editor
              .setSelectionFill
          }
        />
      ) : null}

      <ColorField
        label="Contorno"
        value={
          selection.stroke
        }
        onChange={
          editor
            .setSelectionStroke
        }
      />

      <RangeField
        label="Espessura do contorno"
        value={
          selection.strokeWidth
        }
        onChange={
          editor
            .setSelectionStrokeWidth
        }
        min={0}
        max={100}
        suffix="px"
      />

      <RangeField
        label="Opacidade"
        value={
          selection.opacity
        }
        onChange={
          editor
            .setSelectionOpacity
        }
        min={0}
        max={100}
        suffix="%"
      />

      {selection.role ===
      'shape' ? (
        <RangeField
          label="Cantos arredondados"
          value={
            selection
              .cornerRadius
          }
          onChange={
            editor
              .setCornerRadius
          }
          min={0}
          max={400}
          suffix="px"
        />
      ) : null}
    </Section>
  )
}

function TextProperties() {
  const editor =
    useMAQuadroEditorContext()

  const selection =
    editor.selection

  if (
    selection.role !==
    'text'
  ) {
    return null
  }

  return (
    <Section
      title="Tipografia"
      description="Fonte, hierarquia e espaçamento"
    >
      <label className="mq-field">
        <span>
          Fonte
        </span>

        <select
          value={
            selection.fontFamily
          }
          onChange={(event) =>
            editor.setTextProperty(
              'fontFamily',
              event.target.value
            )
          }
        >
          {editor.availableFonts.map(
            (font) => (
              <option
                key={
                  font.family
                }
                value={
                  font.family
                }
              >
                {font.name}
              </option>
            )
          )}
        </select>
      </label>

      <div className="mq-two-columns">
        <NumberField
          label="Tamanho"
          value={
            selection.fontSize
          }
          onChange={(value) =>
            editor.setTextProperty(
              'fontSize',
              value
            )
          }
          min={6}
          max={600}
          suffix="px"
        />

        <label className="mq-field">
          <span>
            Alinhamento
          </span>

          <select
            value={
              selection.textAlign
            }
            onChange={(event) =>
              editor.setTextProperty(
                'textAlign',
                event.target.value
              )
            }
          >
            <option value="left">
              Esquerda
            </option>

            <option value="center">
              Centro
            </option>

            <option value="right">
              Direita
            </option>

            <option value="justify">
              Justificado
            </option>
          </select>
        </label>
      </div>

      <div className="mq-style-buttons">
        <button
          type="button"
          className={
            selection.fontWeight ===
            '700'
              ? 'is-active'
              : ''
          }
          onClick={() =>
            editor.setTextProperty(
              'fontWeight',
              selection
                .fontWeight ===
              '700'
                ? '400'
                : '700'
            )
          }
        >
          <strong>
            B
          </strong>
        </button>

        <button
          type="button"
          className={
            selection.fontStyle ===
            'italic'
              ? 'is-active'
              : ''
          }
          onClick={() =>
            editor.setTextProperty(
              'fontStyle',
              selection
                .fontStyle ===
              'italic'
                ? 'normal'
                : 'italic'
            )
          }
        >
          <em>
            I
          </em>
        </button>

        <button
          type="button"
          className={
            selection.underline
              ? 'is-active'
              : ''
          }
          onClick={() =>
            editor.setTextProperty(
              'underline',
              !selection
                .underline
            )
          }
        >
          <u>
            U
          </u>
        </button>

        <button
          type="button"
          className={
            selection.linethrough
              ? 'is-active'
              : ''
          }
          onClick={() =>
            editor.setTextProperty(
              'linethrough',
              !selection
                .linethrough
            )
          }
        >
          <s>
            S
          </s>
        </button>
      </div>

      <RangeField
        label="Altura da linha"
        value={
          selection.lineHeight
        }
        onChange={(value) =>
          editor.setTextProperty(
            'lineHeight',
            value
          )
        }
        min={0.7}
        max={3}
        step={0.05}
      />

      <RangeField
        label="Espaçamento das letras"
        value={
          selection.charSpacing
        }
        onChange={(value) =>
          editor.setTextProperty(
            'charSpacing',
            value
          )
        }
        min={-100}
        max={800}
        step={10}
      />

      <div className="mq-action-grid mq-action-grid--3">
        <button
          type="button"
          onClick={() =>
            editor
              .transformTextCase(
                'upper'
              )
          }
        >
          ABC
        </button>

        <button
          type="button"
          onClick={() =>
            editor
              .transformTextCase(
                'lower'
              )
          }
        >
          abc
        </button>

        <button
          type="button"
          onClick={() =>
            editor
              .transformTextCase(
                'title'
              )
          }
        >
          Título
        </button>
      </div>
    </Section>
  )
}

function EffectsProperties() {
  const editor =
    useMAQuadroEditorContext()

  const selection =
    editor.selection

  const supportsGradient =
    [
      'shape',
      'text'
    ].includes(
      selection.role ||
      ''
    )

  return (
    <Section
      title="Efeitos"
      description="Sombra e gradiente"
      defaultOpen={false}
    >
      <label className="mq-switch-row">
        <span>
          <strong>
            Sombra
          </strong>

          <small>
            Cria profundidade
            visual
          </small>
        </span>

        <input
          type="checkbox"
          checked={
            selection
              .shadowEnabled
          }
          onChange={(event) =>
            editor.setShadow({
              enabled:
                event.target
                  .checked
            })
          }
        />
      </label>

      {selection
        .shadowEnabled ? (
        <>
          <ColorField
            label="Cor da sombra"
            value={
              selection
                .shadowColor
                .startsWith('#')
                ? selection
                    .shadowColor
                : '#0F172A'
            }
            onChange={(color) =>
              editor.setShadow({
                color
              })
            }
          />

          <RangeField
            label="Desfoque"
            value={
              selection
                .shadowBlur
            }
            onChange={(blur) =>
              editor.setShadow({
                blur
              })
            }
            min={0}
            max={100}
            suffix="px"
          />

          <div className="mq-two-columns">
            <NumberField
              label="Deslocamento X"
              value={
                selection
                  .shadowOffsetX
              }
              onChange={(
                offsetX
              ) =>
                editor.setShadow({
                  offsetX
                })
              }
              suffix="px"
            />

            <NumberField
              label="Deslocamento Y"
              value={
                selection
                  .shadowOffsetY
              }
              onChange={(
                offsetY
              ) =>
                editor.setShadow({
                  offsetY
                })
              }
              suffix="px"
            />
          </div>
        </>
      ) : null}

      {supportsGradient ? (
        <>
          <label className="mq-switch-row mq-switch-row--separated">
            <span>
              <strong>
                Gradiente
              </strong>

              <small>
                Mistura duas cores
              </small>
            </span>

            <input
              type="checkbox"
              checked={
                selection
                  .gradientEnabled
              }
              onChange={(event) =>
                editor.setGradient({
                  enabled:
                    event.target
                      .checked
                })
              }
            />
          </label>

          {selection
            .gradientEnabled ? (
            <>
              <ColorField
                label="Cor inicial"
                value={
                  selection
                    .gradientFrom
                }
                onChange={(from) =>
                  editor.setGradient({
                    from
                  })
                }
              />

              <ColorField
                label="Cor final"
                value={
                  selection
                    .gradientTo
                }
                onChange={(to) =>
                  editor.setGradient({
                    to
                  })
                }
              />

              <RangeField
                label="Ângulo"
                value={
                  selection
                    .gradientAngle
                }
                onChange={(angle) =>
                  editor.setGradient({
                    angle
                  })
                }
                min={0}
                max={360}
                suffix="°"
              />
            </>
          ) : null}
        </>
      ) : null}
    </Section>
  )
}

function ImageProperties() {
  const editor =
    useMAQuadroEditorContext()

  const selection =
    editor.selection

  if (
    selection.role !==
    'image'
  ) {
    return null
  }

  return (
    <>
      <Section
        title="Ajustar imagem"
        description="Filtros não destrutivos"
      >
        <RangeField
          label="Brilho"
          value={
            selection
              .imageFilters
              .brightness
          }
          onChange={(brightness) =>
            editor.setImageFilters({
              brightness
            })
          }
          min={-100}
          max={100}
        />

        <RangeField
          label="Contraste"
          value={
            selection
              .imageFilters
              .contrast
          }
          onChange={(contrast) =>
            editor.setImageFilters({
              contrast
            })
          }
          min={-100}
          max={100}
        />

        <RangeField
          label="Saturação"
          value={
            selection
              .imageFilters
              .saturation
          }
          onChange={(saturation) =>
            editor.setImageFilters({
              saturation
            })
          }
          min={-100}
          max={100}
        />

        <RangeField
          label="Desfoque"
          value={
            selection
              .imageFilters
              .blur
          }
          onChange={(blur) =>
            editor.setImageFilters({
              blur
            })
          }
          min={0}
          max={100}
        />

        <label className="mq-switch-row">
          <span>
            <strong>
              Preto e branco
            </strong>
          </span>

          <input
            type="checkbox"
            checked={
              selection
                .imageFilters
                .grayscale
            }
            onChange={(event) =>
              editor.setImageFilters({
                grayscale:
                  event.target
                    .checked
              })
            }
          />
        </label>

        <button
          type="button"
          className="mq-panel-action"
          onClick={
            editor
              .resetImageFilters
          }
        >
          Repor ajustes
        </button>
      </Section>

      <Section
        title="Recortar"
        description="Recorte simétrico local"
        defaultOpen={false}
      >
        <RangeField
          label="Lados"
          value={
            selection
              .cropHorizontal
          }
          onChange={(
            horizontal
          ) =>
            editor.setImageCrop(
              horizontal,
              selection
                .cropVertical
            )
          }
          min={0}
          max={45}
          suffix="%"
        />

        <RangeField
          label="Topo e fundo"
          value={
            selection
              .cropVertical
          }
          onChange={(
            vertical
          ) =>
            editor.setImageCrop(
              selection
                .cropHorizontal,
              vertical
            )
          }
          min={0}
          max={45}
          suffix="%"
        />

        <button
          type="button"
          className="mq-panel-action"
          onClick={
            editor
              .resetImageCrop
          }
        >
          Repor recorte
        </button>
      </Section>

      <Section
        title="Remover fundo"
        description="Processamento totalmente local"
        defaultOpen={false}
      >
        <p className="mq-control-note">
          Funciona melhor em
          fotografias com um fundo
          liso e uniforme. Não envia
          a imagem para servidores
          externos.
        </p>

        <button
          type="button"
          className="mq-panel-action mq-panel-action--accent"
          onClick={() =>
            void editor
              .removeImageBackground()
          }
          disabled={
            editor.busy
          }
        >
          Remover fundo
          automaticamente
        </button>
      </Section>
    </>
  )
}

function ArrangeProperties() {
  const editor =
    useMAQuadroEditorContext()

  return (
    <Section
      title="Organizar"
      defaultOpen={false}
    >
      <div className="mq-action-grid mq-action-grid--2">
        <button
          type="button"
          onClick={() =>
            editor
              .arrangeSelection(
                'front'
              )
          }
        >
          Trazer à frente
        </button>

        <button
          type="button"
          onClick={() =>
            editor
              .arrangeSelection(
                'forward'
              )
          }
        >
          Avançar
        </button>

        <button
          type="button"
          onClick={() =>
            editor
              .arrangeSelection(
                'backward'
              )
          }
        >
          Recuar
        </button>

        <button
          type="button"
          onClick={() =>
            editor
              .arrangeSelection(
                'back'
              )
          }
        >
          Enviar para trás
        </button>
      </div>

      <div className="mq-action-grid mq-action-grid--2">
        <button
          type="button"
          onClick={() =>
            void editor
              .duplicateSelection()
          }
        >
          Duplicar
        </button>

        <button
          type="button"
          className="is-danger"
          onClick={
            editor
              .deleteSelection
          }
        >
          Eliminar
        </button>
      </div>
    </Section>
  )
}

function LayersPanel() {
  const editor =
    useMAQuadroEditorContext()

  return (
    <Section
      title="Camadas"
      description={`${editor.layers.length} elementos`}
      defaultOpen={false}
    >
      <div className="mq-layer-list">
        {editor.layers.map(
          (layer) => (
            <article
              key={layer.id}
              className={`mq-layer-row${
                layer.active
                  ? ' is-active'
                  : ''
              }`}
            >
              <button
                type="button"
                className="mq-layer-row__main"
                onClick={() =>
                  editor.selectLayer(
                    layer.id
                  )
                }
              >
                <span className="mq-layer-row__type">
                  {layer.type
                    .slice(0, 1)
                    .toUpperCase()}
                </span>

                <span>
                  <strong>
                    {layer.name}
                  </strong>

                  <small>
                    {layer.type}
                  </small>
                </span>
              </button>

              <div className="mq-layer-row__actions">
                <button
                  type="button"
                  onClick={() =>
                    editor.moveLayer(
                      layer.id,
                      'up'
                    )
                  }
                  title="Subir"
                >
                  ↑
                </button>

                <button
                  type="button"
                  onClick={() =>
                    editor.moveLayer(
                      layer.id,
                      'down'
                    )
                  }
                  title="Descer"
                >
                  ↓
                </button>

                <button
                  type="button"
                  onClick={() =>
                    editor
                      .toggleLayerVisibility(
                        layer.id
                      )
                  }
                  title="Mostrar ou ocultar"
                >
                  {layer.visible
                    ? '◉'
                    : '○'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    editor
                      .toggleLayerLock(
                        layer.id
                      )
                  }
                  title="Bloquear ou desbloquear"
                >
                  {layer.locked
                    ? '🔒'
                    : '🔓'}
                </button>
              </div>
            </article>
          )
        )}
      </div>

      {editor.layers.length ===
      0 ? (
        <div className="mq-empty-state">
          Esta página ainda não
          tem elementos.
        </div>
      ) : null}
    </Section>
  )
}

export default function PropertiesPanel() {
  const editor =
    useMAQuadroEditorContext()

  const hasSelection =
    editor.selection.count >
    0

  return (
    <aside className="mq-properties-panel">
      <div className="mq-properties-panel__title">
        <span>
          <strong>
            {hasSelection
              ? 'Editar seleção'
              : 'Design'}
          </strong>

          <small>
            {hasSelection
              ? `${editor.selection.count} elemento${
                  editor.selection
                    .count === 1
                    ? ''
                    : 's'
                }`
              : editor.activePage
                  ?.name ||
                'Página'}
          </small>
        </span>

        {hasSelection ? (
          <button
            type="button"
            onClick={
              editor
                .deleteSelection
            }
            title="Eliminar seleção"
          >
            ⌫
          </button>
        ) : null}
      </div>

      <div className="mq-properties-panel__scroll">
        {hasSelection ? (
          <>
            {editor.selection
              .count === 1 ? (
              <Section
                title="Camada"
                defaultOpen={false}
              >
                <label className="mq-field">
                  <span>
                    Nome
                  </span>

                  <input
                    type="text"
                    value={
                      editor.selection
                        .name
                    }
                    onChange={(
                      event
                    ) =>
                      editor
                        .setSelectionName(
                          event.target
                            .value
                        )
                    }
                  />
                </label>
              </Section>
            ) : null}

            <SelectionGeometry />
            <AppearanceProperties />
            <TextProperties />
            <ImageProperties />
            <EffectsProperties />
            <ArrangeProperties />
          </>
        ) : (
          <BackgroundProperties />
        )}

        <LayersPanel />
      </div>
    </aside>
  )
}
