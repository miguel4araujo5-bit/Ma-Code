import {
  useLayoutEffect,
  useMemo,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  DEFAULT_IMAGE_FILTERS
} from '../../lib/maQuadro/imageFilters'

import type {
  MAQuadroImageFilterState
} from '../../types/maQuadro'

import {
  ColorField,
  RangeField
} from './PropertyControls'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroPhotoPro.css'

type ImagePreset = {
  id: string
  label: string
  description: string
  filters: MAQuadroImageFilterState
}

type DuotonePreset = {
  id: string
  label: string
  shadows: string
  highlights: string
}

const PRESETS: ImagePreset[] = [
  {
    id: 'original',
    label: 'Original',
    description: 'Sem ajustes',
    filters: {
      ...DEFAULT_IMAGE_FILTERS
    }
  },
  {
    id: 'enhance',
    label: 'Realce',
    description: 'Mais equilíbrio e presença',
    filters: {
      ...DEFAULT_IMAGE_FILTERS,
      brightness: 8,
      contrast: 10,
      saturation: 14,
      shadows: 8,
      highlights: -6
    }
  },
  {
    id: 'vivid',
    label: 'Vivo',
    description: 'Cor e contraste fortes',
    filters: {
      ...DEFAULT_IMAGE_FILTERS,
      brightness: 4,
      contrast: 16,
      saturation: 30,
      shadows: -5,
      vignette: 8
    }
  },
  {
    id: 'soft',
    label: 'Suave',
    description: 'Luz macia e tons leves',
    filters: {
      ...DEFAULT_IMAGE_FILTERS,
      brightness: 12,
      contrast: -10,
      saturation: -8,
      fade: 10,
      shadows: 12,
      highlights: -10
    }
  },
  {
    id: 'dramatic',
    label: 'Dramático',
    description: 'Contraste mais marcado',
    filters: {
      ...DEFAULT_IMAGE_FILTERS,
      brightness: -5,
      contrast: 32,
      saturation: -8,
      shadows: -16,
      highlights: -8,
      vignette: 22
    }
  },
  {
    id: 'muted',
    label: 'Desaturado',
    description: 'Cor discreta e editorial',
    filters: {
      ...DEFAULT_IMAGE_FILTERS,
      brightness: 7,
      contrast: 8,
      saturation: -52,
      fade: 8,
      highlights: -8,
      vignette: 6
    }
  },
  {
    id: 'mono',
    label: 'P&B',
    description: 'Preto e branco definido',
    filters: {
      ...DEFAULT_IMAGE_FILTERS,
      brightness: 3,
      contrast: 20,
      grayscale: true,
      shadows: 8,
      highlights: -12,
      vignette: 10
    }
  },
  {
    id: 'portrait',
    label: 'Retrato',
    description: 'Luz suave para pessoas',
    filters: {
      ...DEFAULT_IMAGE_FILTERS,
      brightness: 10,
      contrast: 5,
      saturation: 9,
      temperature: 8,
      shadows: 14,
      highlights: -12,
      vignette: 5
    }
  }
]

const DUOTONE_PRESETS: DuotonePreset[] = [
  {
    id: 'midnight',
    label: 'Noite',
    shadows: '#0F172A',
    highlights: '#67E8F9'
  },
  {
    id: 'violet',
    label: 'Violeta',
    shadows: '#312E81',
    highlights: '#F5D0FE'
  },
  {
    id: 'sunset',
    label: 'Pôr do sol',
    shadows: '#7C2D12',
    highlights: '#FDE68A'
  },
  {
    id: 'forest',
    label: 'Floresta',
    shadows: '#052E16',
    highlights: '#A7F3D0'
  }
]

function filtersMatch(
  first: MAQuadroImageFilterState,
  second: MAQuadroImageFilterState
) {
  return (
    first.brightness === second.brightness &&
    first.contrast === second.contrast &&
    first.saturation === second.saturation &&
    first.blur === second.blur &&
    first.grayscale === second.grayscale &&
    first.temperature === second.temperature &&
    first.hue === second.hue &&
    first.fade === second.fade &&
    first.shadows === second.shadows &&
    first.highlights === second.highlights &&
    first.vignette === second.vignette &&
    first.duotoneEnabled === second.duotoneEnabled &&
    first.duotoneShadows === second.duotoneShadows &&
    first.duotoneHighlights === second.duotoneHighlights
  )
}

function findAdjustSection() {
  const sections =
    document.querySelectorAll<HTMLElement>(
      '.mq-properties-panel__scroll > .mq-properties-section'
    )

  for (const section of sections) {
    const title =
      section.querySelector<HTMLElement>(
        '.mq-properties-section__header strong'
      )

    if (
      title?.textContent?.trim() ===
      'Ajustar imagem'
    ) {
      return section
    }
  }

  return null
}

export default function ImageFilterPresets() {
  const editor =
    useMAQuadroEditorContext()

  const [
    host,
    setHost
  ] =
    useState<HTMLElement | null>(
      null
    )

  const isImage =
    editor.selection.count === 1 &&
    editor.selection.role === 'image'

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      !isImage ||
      editor.imageCropEditing
    ) {
      setHost(null)
      return
    }

    const adjustSection =
      findAdjustSection()

    if (!adjustSection) {
      setHost(null)
      return
    }

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-image-presets-host'

    adjustSection.insertAdjacentElement(
      'beforebegin',
      mount
    )

    setHost(mount)

    return () => {
      mount.remove()
    }
  }, [
    editor.imageCropEditing,
    editor.ready,
    editor.selection.count,
    editor.selection.role
  ])

  const currentFilters =
    editor.selection.imageFilters

  const activePresetId =
    useMemo(
      () =>
        PRESETS.find(
          (preset) =>
            filtersMatch(
              currentFilters,
              preset.filters
            )
        )?.id || null,
      [
        currentFilters
      ]
    )

  if (
    !host ||
    !isImage
  ) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  return createPortal(
    <section
      className="mq-properties-section mq-image-presets"
      aria-label="Filtros e edição fotográfica"
    >
      <div className="mq-image-presets__heading">
        <span>
          <strong>
            Filtros rápidos
          </strong>

          <small>
            Predefinições não destrutivas
          </small>
        </span>

        <button
          type="button"
          disabled={locked}
          onClick={
            editor.resetImageFilters
          }
        >
          Repor
        </button>
      </div>

      <div className="mq-image-presets__grid">
        {PRESETS.map(
          (
            preset
          ) => {
            const active =
              activePresetId ===
              preset.id

            return (
              <button
                key={
                  preset.id
                }
                type="button"
                className={`mq-image-preset-card mq-image-preset-card--${preset.id}${
                  active
                    ? ' is-active'
                    : ''
                }`}
                disabled={
                  locked
                }
                aria-pressed={
                  active
                }
                title={
                  preset.description
                }
                onClick={() =>
                  editor.setImageFilters({
                    ...preset.filters
                  })
                }
              >
                <span
                  className="mq-image-preset-card__preview"
                  aria-hidden="true"
                >
                  <span />
                </span>

                <span className="mq-image-preset-card__copy">
                  <strong>
                    {
                      preset.label
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
          }
        )}
      </div>

      <div className="mq-photo-pro">
        <div className="mq-photo-pro__heading">
          <span>
            <strong>
              Edição fotográfica Pro
            </strong>

            <small>
              Cor e luz avançadas, totalmente editáveis e guardadas com o projeto
            </small>
          </span>

          <span
            className="mq-photo-pro__badge"
            aria-hidden="true"
          >
            PRO
          </span>
        </div>

        <fieldset
          className="mq-photo-pro__controls"
          disabled={
            locked
          }
        >
          <RangeField
            label="Temperatura"
            value={
              currentFilters.temperature
            }
            onCommit={(
              temperature
            ) =>
              editor.setImageFilters({
                temperature
              })
            }
            min={-100}
            max={100}
          />

          <div className="mq-photo-pro__scale-labels">
            <span>
              Frio
            </span>

            <span>
              Quente
            </span>
          </div>

          <RangeField
            label="Tonalidade"
            value={
              currentFilters.hue
            }
            onCommit={(
              hue
            ) =>
              editor.setImageFilters({
                hue
              })
            }
            min={-180}
            max={180}
            suffix="°"
          />

          <RangeField
            label="Sombras"
            value={
              currentFilters.shadows
            }
            onCommit={(
              shadows
            ) =>
              editor.setImageFilters({
                shadows
              })
            }
            min={-100}
            max={100}
          />

          <div className="mq-photo-pro__scale-labels">
            <span>
              Escurecer
            </span>

            <span>
              Recuperar
            </span>
          </div>

          <RangeField
            label="Luzes"
            value={
              currentFilters.highlights
            }
            onCommit={(
              highlights
            ) =>
              editor.setImageFilters({
                highlights
              })
            }
            min={-100}
            max={100}
          />

          <div className="mq-photo-pro__scale-labels">
            <span>
              Recuperar
            </span>

            <span>
              Iluminar
            </span>
          </div>

          <RangeField
            label="Fade"
            value={
              currentFilters.fade
            }
            onCommit={(
              fade
            ) =>
              editor.setImageFilters({
                fade
              })
            }
            min={0}
            max={100}
            suffix="%"
          />

          <RangeField
            label="Vinheta"
            value={
              currentFilters.vignette
            }
            onCommit={(
              vignette
            ) =>
              editor.setImageFilters({
                vignette
              })
            }
            min={0}
            max={100}
            suffix="%"
          />

          <div className="mq-photo-pro__divider" />

          <label className="mq-switch-row mq-photo-pro__switch">
            <span>
              <strong>
                Duotone
              </strong>

              <small>
                Mapeia sombras e luzes para duas cores
              </small>
            </span>

            <input
              type="checkbox"
              checked={
                currentFilters.duotoneEnabled
              }
              disabled={
                locked
              }
              onChange={(
                event
              ) =>
                editor.setImageFilters({
                  duotoneEnabled:
                    event.target
                      .checked
                })
              }
            />
          </label>

          {currentFilters.duotoneEnabled ? (
            <>
              <div className="mq-photo-pro__duotones">
                {DUOTONE_PRESETS.map(
                  (
                    preset
                  ) => {
                    const active =
                      currentFilters
                        .duotoneShadows ===
                        preset.shadows &&
                      currentFilters
                        .duotoneHighlights ===
                        preset.highlights

                    return (
                      <button
                        key={
                          preset.id
                        }
                        type="button"
                        className={
                          active
                            ? 'is-active'
                            : ''
                        }
                        disabled={
                          locked
                        }
                        aria-pressed={
                          active
                        }
                        title={
                          preset.label
                        }
                        onClick={() =>
                          editor.setImageFilters({
                            duotoneEnabled:
                              true,

                            duotoneShadows:
                              preset.shadows,

                            duotoneHighlights:
                              preset.highlights
                          })
                        }
                      >
                        <span
                          style={{
                            background:
                              `linear-gradient(135deg, ${preset.shadows}, ${preset.highlights})`
                          }}
                          aria-hidden="true"
                        />

                        <small>
                          {
                            preset.label
                          }
                        </small>
                      </button>
                    )
                  }
                )}
              </div>

              <div className="mq-photo-pro__colors">
                <ColorField
                  label="Sombras"
                  value={
                    currentFilters
                      .duotoneShadows
                  }
                  onCommit={(
                    duotoneShadows
                  ) =>
                    editor.setImageFilters({
                      duotoneShadows
                    })
                  }
                />

                <ColorField
                  label="Luzes"
                  value={
                    currentFilters
                      .duotoneHighlights
                  }
                  onCommit={(
                    duotoneHighlights
                  ) =>
                    editor.setImageFilters({
                      duotoneHighlights
                    })
                  }
                />
              </div>
            </>
          ) : null}
        </fieldset>
      </div>

      <p className="mq-image-presets__note">
        Pode começar por uma predefinição, recuperar sombras e luzes, controlar a vinheta e continuar a ajustar brilho, contraste, saturação e desfoque logo abaixo.
      </p>
    </section>,
    host
  )
}
