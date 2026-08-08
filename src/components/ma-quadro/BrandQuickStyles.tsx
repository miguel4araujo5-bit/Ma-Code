import {
  useLayoutEffect,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  MA_QUADRO_QUICK_STYLE_PRESETS,
  type MAQuadroQuickStylePreset
} from '../../lib/maQuadro/quickStylePresets'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroBrandQuickStyles.css'

function targetLabel(
  count: number,
  role: string | null
) {
  if (count === 0) {
    return 'fundo da página'
  }

  if (role === 'text') {
    return 'texto selecionado'
  }

  if (
    role === 'line' ||
    role === 'arrow'
  ) {
    return 'linha selecionada'
  }

  if (role === 'image') {
    return 'imagem selecionada'
  }

  return 'seleção atual'
}

export default function BrandQuickStyles() {
  const editor =
    useMAQuadroEditorContext()

  const [
    host,
    setHost
  ] = useState<HTMLElement | null>(
    null
  )

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      editor.activePanel !== 'brand'
    ) {
      setHost(null)

      return
    }

    const colorGrid =
      document.querySelector<HTMLElement>(
        '.mq-left-panel .mq-color-grid'
      )

    if (!colorGrid) {
      setHost(null)

      return
    }

    const mount =
      document.createElement('div')

    mount.className =
      'mq-brand-quick-styles-host'

    colorGrid.insertAdjacentElement(
      'afterend',
      mount
    )

    setHost(mount)

    return () => {
      mount.remove()
    }
  }, [
    editor.activePanel,
    editor.ready
  ])

  if (!host) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  const imageSelected =
    editor.selection.count > 0 &&
    editor.selection.role === 'image'

  const applyColor = (
    color: string
  ) => {
    if (
      locked ||
      imageSelected
    ) {
      return
    }

    if (
      editor.selection.role === 'line' ||
      editor.selection.role === 'arrow'
    ) {
      editor.setSelectionStroke(
        color
      )

      return
    }

    editor.applyBrandColor(
      color
    )
  }

  const applyPreset = (
    preset:
      MAQuadroQuickStylePreset
  ) => {
    if (
      locked ||
      imageSelected
    ) {
      return
    }

    if (
      editor.selection.count === 0
    ) {
      editor.setBackground({
        type: 'solid',
        color:
          preset.background
      })

      return
    }

    if (
      editor.selection.role === 'line' ||
      editor.selection.role === 'arrow'
    ) {
      editor.setSelectionStroke(
        preset.primary
      )

      return
    }

    editor.applyBrandColor(
      preset.primary
    )

    if (
      editor.selection.role === 'text'
    ) {
      editor.setTextProperty(
        'fontFamily',
        preset.fontFamily
      )

      editor.setTextProperty(
        'fontWeight',
        preset.fontWeight
      )

      if (
        preset.shadow
      ) {
        editor.setShadow(
          preset.shadow
        )
      }
    }
  }

  return createPortal(
    <section
      className="mq-brand-quick-styles"
      aria-label="Estilos rápidos"
    >
      <div className="mq-brand-quick-styles__heading">
        <div>
          <strong>
            Estilos rápidos
          </strong>

          <small>
            Aplicar a{' '}
            {targetLabel(
              editor.selection.count,
              editor.selection.role
            )}.
          </small>
        </div>

        <span>
          {
            MA_QUADRO_QUICK_STYLE_PRESETS
              .length
          }
        </span>
      </div>

      {imageSelected ? (
        <div className="mq-brand-quick-styles__notice">
          As paletas não alteram imagens. Selecione texto, formas, linhas ou deixe a seleção vazia para aplicar ao fundo.
        </div>
      ) : null}

      <div className="mq-brand-quick-styles__grid">
        {MA_QUADRO_QUICK_STYLE_PRESETS.map(
          (preset) => (
            <article
              key={preset.id}
              className="mq-brand-quick-style-card"
            >
              <button
                type="button"
                className="mq-brand-quick-style-card__main"
                disabled={
                  locked ||
                  imageSelected
                }
                onClick={() =>
                  applyPreset(
                    preset
                  )
                }
                title={`Aplicar estilo ${preset.name}`}
              >
                <span className="mq-brand-quick-style-card__swatches">
                  {preset.colors.map(
                    (
                      color,
                      index
                    ) => (
                      <span
                        key={`${preset.id}-${color}-${index}`}
                        style={{
                          background:
                            color
                        }}
                      />
                    )
                  )}
                </span>

                <span className="mq-brand-quick-style-card__copy">
                  <strong>
                    {preset.name}
                  </strong>

                  <small>
                    {
                      preset.description
                    }
                  </small>
                </span>
              </button>

              <div className="mq-brand-quick-style-card__colors">
                {preset.colors.map(
                  (
                    color,
                    index
                  ) => (
                    <button
                      key={`${preset.id}-color-${color}-${index}`}
                      type="button"
                      disabled={
                        locked ||
                        imageSelected
                      }
                      style={{
                        background:
                          color
                      }}
                      onClick={() =>
                        applyColor(
                          color
                        )
                      }
                      aria-label={`Aplicar ${color}`}
                      title={`Aplicar ${color}`}
                    />
                  )
                )}
              </div>
            </article>
          )
        )}
      </div>
    </section>,
    host
  )
}
