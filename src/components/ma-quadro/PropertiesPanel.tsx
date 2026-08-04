import {
  useState,
  type ReactNode
} from 'react'

import {
  ColorField,
  NumberField,
  RangeField
} from './PropertyControls'
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

        <span aria-hidden="true">
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

function BackgroundProperties() {
  const editor =
    useMAQuadroEditorContext()

  const page =
    editor.activePage

  if (!page) {
    return null
  }

  const resizePages = () => {
    const widthInput =
      window.prompt(
        'Nova largura em píxeis:',
        String(page.width)
      )

    if (
      widthInput === null
    ) {
      return
    }

    const heightInput =
      window.prompt(
        'Nova altura em píxeis:',
        String(page.height)
      )

    if (
      heightInput === null
    ) {
      return
    }

    const width =
      Number(widthInput)

    const height =
      Number(heightInput)

    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 100 ||
      height < 100 ||
      width > 8000 ||
      height > 8000
    ) {
      window.alert(
        'Use medidas entre 100 e 8000 píxeis.'
      )

      return
    }

    void editor.resizeAllPages(
      Math.round(width),
      Math.round(height)
    )
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
            ([type, label]) => (
              <button
                key={type}
                type="button"
                className={
                  page.background.type ===
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
              page.background.color
            }
            onCommit={(color) =>
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
              onCommit={(gradientFrom) =>
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
              onCommit={(gradientTo) =>
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
              onCommit={(gradientAngle) =>
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
            onCommit={() =>
              undefined
            }
            suffix="px"
            disabled
          />

          <NumberField
            label="Altura"
            value={page.height}
            onCommit={() =>
              undefined
            }
            suffix="px"
            disabled
          />
        </div>

        <p className="mq-control-note">
          Para evitar alterações
          acidentais, o redimensionamento
          é aplicado a todas as páginas.
        </p>

        <button
          type="button"
          className="mq-panel-action"
          onClick={resizePages}
        >
          Redimensionar todas as páginas
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

  const textSelected =
    selection.count === 1 &&
    selection.role === 'text'

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
          onCommit={(value) =>
            editor.setSelectionGeometry(
              'x',
              value
            )
          }
          suffix="px"
        />

        <NumberField
          label="Y"
          value={selection.y}
          onCommit={(value) =>
            editor.setSelectionGeometry(
              'y',
              value
            )
          }
          suffix="px"
        />

        {!textSelected ? (
          <>
            <NumberField
              label="Largura"
              value={
                selection.width
              }
              onCommit={(value) =>
                editor.setSelectionGeometry(
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
              onCommit={(value) =>
                editor.setSelectionGeometry(
                  'height',
                  value
                )
              }
              min={1}
              suffix="px"
            />
          </>
        ) : null}
      </div>

      {textSelected ? (
        <p className="mq-control-note">
          Para alterar a caixa de texto sem
          deformar as letras, use os
          controlos diretamente no quadro.
        </p>
      ) : null}

      <RangeField
        label="Rotação"
        value={selection.angle}
        onCommit={(value) =>
          editor.setSelectionGeometry(
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
            editor.setSelectionFlip('x')
          }
        >
          Virar horizontal
        </button>

        <button
          type="button"
          onClick={() =>
            editor.setSelectionFlip('y')
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
    selection.role !== 'image' &&
    selection.role !== 'group'

  const normalisedName =
    selection.name
      .toLocaleLowerCase(
        'pt-PT'
      )

  const supportsCornerRadius =
    selection.count === 1 &&
    selection.role === 'shape' &&
    (
      normalisedName.includes(
        'retângulo'
      ) ||
      normalisedName.includes(
        'rectangle'
      )
    )

  return (
    <Section
      title="Aspeto"
      description="Cores, contorno, opacidade e efeitos"
    >
      {supportsFill ? (
        <ColorField
          label="Preenchimento"
          value={selection.fill}
          onCommit={
            editor.setSelectionFill
          }
          allowTransparent
        />
      ) : null}

      <ColorField
        label="Contorno"
        value={selection.stroke}
        onCommit={
          editor.setSelectionStroke
        }
        allowTransparent
      />

      <RangeField
        label="Espessura do contorno"
        value={
          selection.strokeWidth
        }
        onCommit={
          editor.setSelectionStrokeWidth
        }
        min={0}
        max={100}
        suffix="px"
      />

      <RangeField
        label="Opacidade"
        value={selection.opacity}
        onCommit={
          editor.setSelectionOpacity
        }
        min={0}
        max={100}
        suffix="%"
      />

      {supportsCornerRadius ? (
        <RangeField
          label="Cantos arredondados"
          value={
            selection.cornerRadius
          }
          onCommit={
            editor.setCornerRadius
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
    selection.role !== 'text'
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
                key={font.family}
                value={font.family}
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
          value={selection.fontSize}
          onCommit={(value) =>
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
              selection.fontWeight ===
              '700'
                ? '400'
                : '700'
            )
          }
          aria-label="Negrito"
          title="Negrito"
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
              selection.fontStyle ===
              'italic'
                ? 'normal'
                : 'italic'
            )
          }
          aria-label="Itálico"
          title="Itálico"
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
              !selection.underline
            )
          }
          aria-label="Sublinhado"
          title="Sublinhado"
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
              !selection.linethrough
            )
          }
          aria-label="Riscado"
          title="Riscado"
        >
          <s>
            S
          </s>
        </button>
      </div>

      <RangeField
        label="Altura da linha"
        value={selection.lineHeight}
        onCommit={(value) =>
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
        value={selection.charSpacing}
        onCommit={(value) =>
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
            editor.transformTextCase(
              'upper'
            )
          }
        >
          ABC
        </button>

        <button
          type="button"
          onClick={() =>
            editor.transformTextCase(
              'lower'
            )
          }
        >
          abc
        </button>

        <button
          type="button"
          onClick={() =>
            editor.transformTextCase(
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
    selection.count === 1 &&
    [
      'shape',
      'text'
    ].includes(
      selection.role || ''
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
            Cria profundidade visual
          </small>
        </span>

        <input
          type="checkbox"
          checked={
            selection.shadowEnabled
          }
          onChange={(event) =>
            editor.setShadow({
              enabled:
                event.target.checked
            })
          }
        />
      </label>

      {selection.shadowEnabled ? (
        <>
          <ColorField
            label="Cor da sombra"
            value={
              selection.shadowColor
            }
            onCommit={(color) =>
              editor.setShadow({
                color
              })
            }
          />

          <RangeField
            label="Desfoque"
            value={
              selection.shadowBlur
            }
            onCommit={(blur) =>
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
                selection.shadowOffsetX
              }
              onCommit={(offsetX) =>
                editor.setShadow({
                  offsetX
                })
              }
              suffix="px"
            />

            <NumberField
              label="Deslocamento Y"
              value={
                selection.shadowOffsetY
              }
              onCommit={(offsetY) =>
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
                selection.gradientEnabled
              }
              onChange={(event) =>
                editor.setGradient({
                  enabled:
                    event.target.checked
                })
              }
            />
          </label>

          {selection.gradientEnabled ? (
            <>
              <ColorField
                label="Cor inicial"
                value={
                  selection.gradientFrom
                }
                onCommit={(from) =>
                  editor.setGradient({
                    from
                  })
                }
              />

              <ColorField
                label="Cor final"
                value={
                  selection.gradientTo
                }
                onCommit={(to) =>
                  editor.setGradient({
                    to
                  })
                }
              />

              <RangeField
                label="Ângulo"
                value={
                  selection.gradientAngle
                }
                onCommit={(angle) =>
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
    selection.role !== 'image'
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
            selection.imageFilters
              .brightness
          }
          onCommit={(brightness) =>
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
            selection.imageFilters
              .contrast
          }
          onCommit={(contrast) =>
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
            selection.imageFilters
              .saturation
          }
          onCommit={(saturation) =>
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
            selection.imageFilters.blur
          }
          onCommit={(blur) =>
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
              selection.imageFilters
                .grayscale
            }
            onChange={(event) =>
              editor.setImageFilters({
                grayscale:
                  event.target.checked
              })
            }
          />
        </label>

        <button
          type="button"
          className="mq-panel-action"
          onClick={
            editor.resetImageFilters
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
            selection.cropHorizontal
          }
          onCommit={(horizontal) =>
            editor.setImageCrop(
              horizontal,
              selection.cropVertical
            )
          }
          min={0}
          max={45}
          suffix="%"
        />

        <RangeField
          label="Topo e fundo"
          value={
            selection.cropVertical
          }
          onCommit={(vertical) =>
            editor.setImageCrop(
              selection.cropHorizontal,
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
            editor.resetImageCrop
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
          Funciona melhor em fotografias
          com um fundo liso e uniforme.
          Não envia a imagem para
          servidores externos.
        </p>

        <button
          type="button"
          className="mq-panel-action mq-panel-action--accent"
          onClick={() =>
            void editor.removeImageBackground()
          }
          disabled={editor.busy}
        >
          Remover fundo automaticamente
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
            editor.arrangeSelection(
              'front'
            )
          }
        >
          Trazer à frente
        </button>

        <button
          type="button"
          onClick={() =>
            editor.arrangeSelection(
              'forward'
            )
          }
        >
          Avançar
        </button>

        <button
          type="button"
          onClick={() =>
            editor.arrangeSelection(
              'backward'
            )
          }
        >
          Recuar
        </button>

        <button
          type="button"
          onClick={() =>
            editor.arrangeSelection(
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
            void editor.duplicateSelection()
          }
        >
          Duplicar
        </button>

        <button
          type="button"
          className="is-danger"
          onClick={
            editor.deleteSelection
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
                  aria-label={`Subir ${layer.name}`}
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
                  aria-label={`Descer ${layer.name}`}
                >
                  ↓
                </button>

                <button
                  type="button"
                  onClick={() =>
                    editor.toggleLayerVisibility(
                      layer.id
                    )
                  }
                  title="Mostrar ou ocultar"
                  aria-label={`${
                    layer.visible
                      ? 'Ocultar'
                      : 'Mostrar'
                  } ${layer.name}`}
                >
                  {layer.visible
                    ? '◉'
                    : '○'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    editor.toggleLayerLock(
                      layer.id
                    )
                  }
                  title="Bloquear ou desbloquear"
                  aria-label={`${
                    layer.locked
                      ? 'Desbloquear'
                      : 'Bloquear'
                  } ${layer.name}`}
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

      {editor.layers.length === 0 ? (
        <div className="mq-empty-state">
          Esta página ainda não tem
          elementos.
        </div>
      ) : null}
    </Section>
  )
}

export default function PropertiesPanel() {
  const editor =
    useMAQuadroEditorContext()

  const [
    drawerOpen,
    setDrawerOpen
  ] = useState(false)

  const hasSelection =
    editor.selection.count > 0

  return (
    <>
      {drawerOpen ? (
        <button
          type="button"
          className="mq-properties-backdrop"
          onClick={() =>
            setDrawerOpen(false)
          }
          aria-label="Fechar painel de edição"
        />
      ) : null}

      <aside
        className={`mq-properties-panel${
          drawerOpen
            ? ' is-open'
            : ''
        }`}
        aria-label="Painel de propriedades"
      >
        <button
          type="button"
          className="mq-properties-toggle"
          onClick={() =>
            setDrawerOpen(
              (current) =>
                !current
            )
          }
          aria-expanded={drawerOpen}
          aria-label={
            drawerOpen
              ? 'Fechar painel de edição'
              : 'Abrir painel de edição'
          }
        >
          {drawerOpen
            ? '×'
            : 'Editar'}
        </button>

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
                    editor.selection.count === 1
                      ? ''
                      : 's'
                  }`
                : editor.activePage?.name ||
                  'Página'}
            </small>
          </span>

          {hasSelection ? (
            <button
              type="button"
              onClick={
                editor.deleteSelection
              }
              title="Eliminar seleção"
              aria-label="Eliminar seleção"
            >
              ⌫
            </button>
          ) : null}
        </div>

        <div className="mq-properties-panel__scroll">
          {hasSelection ? (
            <>
              {editor.selection.count ===
              1 ? (
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
                        editor.selection.name
                      }
                      maxLength={180}
                      onChange={(event) =>
                        editor.setSelectionName(
                          event.target.value
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
    </>
  )
}
