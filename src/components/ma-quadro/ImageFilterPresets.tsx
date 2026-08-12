import {
  useLayoutEffect,
  useMemo,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import type {
  MAQuadroImageFilterState
} from '../../types/maQuadro'

import {
  useMAQuadroEditorContext
} from './editorContext'

type ImagePreset = {
  id: string
  label: string
  description: string
  filters: MAQuadroImageFilterState
}

const PRESETS: ImagePreset[] = [
  {
    id: 'original',
    label: 'Original',
    description: 'Sem ajustes',
    filters: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0,
      grayscale: false
    }
  },
  {
    id: 'enhance',
    label: 'Realce',
    description: 'Mais equilíbrio e presença',
    filters: {
      brightness: 8,
      contrast: 10,
      saturation: 14,
      blur: 0,
      grayscale: false
    }
  },
  {
    id: 'vivid',
    label: 'Vivo',
    description: 'Cor e contraste fortes',
    filters: {
      brightness: 4,
      contrast: 16,
      saturation: 30,
      blur: 0,
      grayscale: false
    }
  },
  {
    id: 'soft',
    label: 'Suave',
    description: 'Luz macia e tons leves',
    filters: {
      brightness: 12,
      contrast: -10,
      saturation: -8,
      blur: 0,
      grayscale: false
    }
  },
  {
    id: 'dramatic',
    label: 'Dramático',
    description: 'Contraste mais marcado',
    filters: {
      brightness: -5,
      contrast: 32,
      saturation: -8,
      blur: 0,
      grayscale: false
    }
  },
  {
    id: 'muted',
    label: 'Desaturado',
    description: 'Cor discreta e editorial',
    filters: {
      brightness: 7,
      contrast: 8,
      saturation: -52,
      blur: 0,
      grayscale: false
    }
  },
  {
    id: 'mono',
    label: 'P&B',
    description: 'Preto e branco definido',
    filters: {
      brightness: 3,
      contrast: 20,
      saturation: 0,
      blur: 0,
      grayscale: true
    }
  },
  {
    id: 'portrait',
    label: 'Retrato',
    description: 'Luz suave para pessoas',
    filters: {
      brightness: 10,
      contrast: 5,
      saturation: 9,
      blur: 0,
      grayscale: false
    }
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
    first.grayscale === second.grayscale
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

  const [host, setHost] =
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
      [currentFilters]
    )

  if (!host || !isImage) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  return createPortal(
    <section
      className="mq-properties-section mq-image-presets"
      aria-label="Predefinições de imagem"
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
          (preset) => {
            const active =
              activePresetId ===
              preset.id

            return (
              <button
                key={preset.id}
                type="button"
                className={`mq-image-preset-card mq-image-preset-card--${preset.id}${
                  active
                    ? ' is-active'
                    : ''
                }`}
                disabled={locked}
                aria-pressed={active}
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
                    {preset.label}
                  </strong>

                  <small>
                    {preset.description}
                  </small>
                </span>
              </button>
            )
          }
        )}
      </div>

      <p className="mq-image-presets__note">
        Pode começar por uma predefinição e afinar brilho, contraste, saturação e desfoque logo abaixo.
      </p>
    </section>,
    host
  )
}
