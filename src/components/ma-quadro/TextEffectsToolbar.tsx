import { useEffect, useMemo, useRef, useState } from 'react'

import {
  isMAQuadroTextShadowPresetActive,
  MA_QUADRO_TEXT_EFFECT_PRESETS,
  type MAQuadroTextEffectPreset
} from '../../lib/maQuadro/textEffectPresets'

import { useMAQuadroEditorContext } from './editorContext'
import TextEffectPresetCard from './TextEffectPresetCard'
import './maQuadroTextEffects.css'

type ToolbarPanel = 'styles' | 'effects'
type TypographyFontMode = 'primary' | 'secondary' | 'serif' | 'sans'

type TypographyPreset = {
  id: string
  name: string
  description: string
  fontMode: TypographyFontMode
  fontWeight: string
  fontStyle: string
  textAlign: string
  lineHeight: number
  charSpacing: number
}

const TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  {
    id: 'brand-title',
    name: 'Título de marca',
    description: 'Fonte principal, forte e compacta para títulos.',
    fontMode: 'primary',
    fontWeight: '700',
    fontStyle: 'normal',
    textAlign: 'left',
    lineHeight: 0.98,
    charSpacing: -20
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Serif elegante com ritmo apertado para manchetes.',
    fontMode: 'serif',
    fontWeight: '700',
    fontStyle: 'normal',
    textAlign: 'left',
    lineHeight: 1.02,
    charSpacing: -10
  },
  {
    id: 'modern-center',
    name: 'Moderno',
    description: 'Sans limpa, centrada e equilibrada.',
    fontMode: 'sans',
    fontWeight: '700',
    fontStyle: 'normal',
    textAlign: 'center',
    lineHeight: 1.05,
    charSpacing: 0
  },
  {
    id: 'elegant',
    name: 'Elegante',
    description: 'Serif em itálico para citações e destaques.',
    fontMode: 'serif',
    fontWeight: '400',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 1.16,
    charSpacing: 10
  },
  {
    id: 'body-readable',
    name: 'Leitura',
    description: 'Texto confortável para parágrafos e informação.',
    fontMode: 'secondary',
    fontWeight: '400',
    fontStyle: 'normal',
    textAlign: 'left',
    lineHeight: 1.42,
    charSpacing: 0
  },
  {
    id: 'label',
    name: 'Etiqueta',
    description: 'Pequenos destaques com maior espaçamento visual.',
    fontMode: 'sans',
    fontWeight: '600',
    fontStyle: 'normal',
    textAlign: 'left',
    lineHeight: 1.12,
    charSpacing: 90
  }
]

function effectSummary({
  shadowEnabled,
  strokeWidth
}: {
  shadowEnabled: boolean
  strokeWidth: number
}) {
  if (shadowEnabled && strokeWidth > 0) return 'Sombra + contorno'
  if (shadowEnabled) return 'Sombra ativa'
  if (strokeWidth > 0) return 'Contorno ativo'
  return 'Sem efeito rápido'
}

function normalizeFontName(value: string) {
  return value.trim().toLocaleLowerCase('pt-PT')
}

function resolveFontFamily(
  mode: TypographyFontMode,
  availableFonts: Array<{ name: string; family: string }>
) {
  const first = availableFonts[0]?.family || 'Arial'
  const second = availableFonts[1]?.family || first

  if (mode === 'primary') return first
  if (mode === 'secondary') return second

  const serifTokens = [
    'serif',
    'georgia',
    'times',
    'garamond',
    'baskerville',
    'palatino',
    'cambria',
    'didot'
  ]

  const sansTokens = [
    'sans',
    'arial',
    'inter',
    'helvetica',
    'montserrat',
    'poppins',
    'roboto',
    'lato'
  ]

  const tokens =
    mode === 'serif'
      ? serifTokens
      : sansTokens

  const match =
    availableFonts.find((font) => {
      const haystack =
        normalizeFontName(
          `${font.name} ${font.family}`
        )

      return tokens.some((token) =>
        haystack.includes(token)
      )
    })

  if (match) return match.family

  return mode === 'serif'
    ? second
    : first
}

export default function TextEffectsToolbar() {
  const editor =
    useMAQuadroEditorContext()

  const rootRef =
    useRef<HTMLDivElement | null>(
      null
    )

  const [
    openPanel,
    setOpenPanel
  ] =
    useState<ToolbarPanel | null>(
      null
    )

  const selection =
    editor.selection

  const textSelected =
    selection.count === 1 &&
    selection.role === 'text'

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  const effectStatus =
    useMemo(
      () =>
        effectSummary({
          shadowEnabled:
            selection.shadowEnabled,
          strokeWidth:
            selection.strokeWidth
        }),
      [
        selection.shadowEnabled,
        selection.strokeWidth
      ]
    )

  const currentFontName =
    useMemo(
      () =>
        editor.availableFonts.find(
          (font) =>
            font.family ===
            selection.fontFamily
        )?.name ||
        selection.fontFamily ||
        'Fonte atual',
      [
        editor.availableFonts,
        selection.fontFamily
      ]
    )

  useEffect(() => {
    if (!textSelected) {
      setOpenPanel(null)
    }
  }, [textSelected])

  useEffect(() => {
    if (!openPanel) return

    const handlePointerDown = (
      event: PointerEvent
    ) => {
      const root =
        rootRef.current

      if (
        root &&
        event.target instanceof Node &&
        !root.contains(
          event.target
        )
      ) {
        setOpenPanel(null)
      }
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key ===
        'Escape'
      ) {
        setOpenPanel(null)
      }
    }

    window.addEventListener(
      'pointerdown',
      handlePointerDown
    )

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      window.removeEventListener(
        'pointerdown',
        handlePointerDown
      )

      window.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [openPanel])

  if (!textSelected) {
    return null
  }

  const applyEffectPreset = (
    preset:
      MAQuadroTextEffectPreset
  ) => {
    if (locked) return

    if (
      preset.kind ===
      'outline'
    ) {
      editor
        .setSelectionStrokeWidth(
          preset.outlineWidth ||
            3
        )

      return
    }

    if (preset.shadow) {
      editor.setShadow(
        preset.shadow
      )
    }
  }

  const typographyFontFamily = (
    preset:
      TypographyPreset
  ) =>
    resolveFontFamily(
      preset.fontMode,
      editor.availableFonts
    )

  const typographyPresetActive = (
    preset:
      TypographyPreset
  ) => {
    const family =
      typographyFontFamily(
        preset
      )

    return (
      selection.fontFamily ===
        family &&
      String(
        selection.fontWeight
      ) ===
        preset.fontWeight &&
      selection.fontStyle ===
        preset.fontStyle &&
      selection.textAlign ===
        preset.textAlign &&
      Math.abs(
        selection.lineHeight -
          preset.lineHeight
      ) <= 0.03 &&
      Math.abs(
        selection.charSpacing -
          preset.charSpacing
      ) <= 5
    )
  }

  const applyTypographyPreset = (
    preset:
      TypographyPreset
  ) => {
    if (locked) return

    editor.setTextProperty(
      'fontFamily',
      typographyFontFamily(
        preset
      )
    )

    editor.setTextProperty(
      'fontWeight',
      preset.fontWeight
    )

    editor.setTextProperty(
      'fontStyle',
      preset.fontStyle
    )

    editor.setTextProperty(
      'textAlign',
      preset.textAlign
    )

    editor.setTextProperty(
      'lineHeight',
      preset.lineHeight
    )

    editor.setTextProperty(
      'charSpacing',
      preset.charSpacing
    )
  }

  const togglePanel = (
    panel:
      ToolbarPanel
  ) => {
    setOpenPanel(
      (current) =>
        current === panel
          ? null
          : panel
    )
  }

  return (
    <div
      ref={rootRef}
      className="mq-text-effects-toolbar"
    >
      <span className="mq-text-effects-toolbar__label">
        Texto
      </span>

      <button
        type="button"
        className={`mq-text-effects-trigger${
          openPanel ===
          'styles'
            ? ' is-open'
            : ''
        }`}
        disabled={locked}
        onClick={() =>
          togglePanel(
            'styles'
          )
        }
        aria-haspopup="dialog"
        aria-expanded={
          openPanel ===
          'styles'
        }
      >
        <span aria-hidden="true">
          Aa
        </span>

        <span>
          Estilos
        </span>

        <small>
          {currentFontName}
        </small>
      </button>

      <button
        type="button"
        className={`mq-text-effects-trigger${
          openPanel ===
          'effects'
            ? ' is-open'
            : ''
        }`}
        disabled={locked}
        onClick={() =>
          togglePanel(
            'effects'
          )
        }
        aria-haspopup="dialog"
        aria-expanded={
          openPanel ===
          'effects'
        }
      >
        <span aria-hidden="true">
          ✦
        </span>

        <span>
          Efeitos
        </span>

        <small>
          {effectStatus}
        </small>
      </button>

      {openPanel ===
      'styles' ? (
        <div
          className="mq-text-effects-popover"
          role="dialog"
          aria-label="Estilos tipográficos rápidos"
        >
          <div className="mq-text-effects-popover__heading">
            <div>
              <strong>
                Estilos tipográficos
              </strong>

              <small>
                Aplique combinações rápidas de fonte, peso, alinhamento e espaçamento. O tamanho atual do texto é preservado.
              </small>
            </div>

            <button
              type="button"
              className="mq-text-effects-popover__close"
              onClick={() =>
                setOpenPanel(
                  null
                )
              }
              aria-label="Fechar estilos tipográficos"
            >
              ×
            </button>
          </div>

          <div className="mq-text-effects-grid">
            {TYPOGRAPHY_PRESETS.map(
              (preset) => {
                const family =
                  typographyFontFamily(
                    preset
                  )

                const active =
                  typographyPresetActive(
                    preset
                  )

                return (
                  <button
                    key={
                      preset.id
                    }
                    type="button"
                    className={`mq-text-effect-card${
                      active
                        ? ' is-active'
                        : ''
                    }`}
                    disabled={locked}
                    aria-pressed={
                      active
                    }
                    title={
                      preset.description
                    }
                    onClick={() =>
                      applyTypographyPreset(
                        preset
                      )
                    }
                  >
                    <span
                      className="mq-text-effect-card__preview"
                      style={{
                        fontFamily:
                          family,
                        fontWeight:
                          preset.fontWeight,
                        fontStyle:
                          preset.fontStyle,
                        textAlign:
                          preset.textAlign,
                        lineHeight:
                          preset.lineHeight,
                        letterSpacing:
                          `${preset.charSpacing / 1000}em`
                      }}
                      aria-hidden="true"
                    >
                      Aa
                    </span>

                    <span className="mq-text-effect-card__copy">
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
                )
              }
            )}
          </div>

          <div className="mq-text-effects-popover__footer">
            <span
              style={{
                color:
                  '#64748b',
                fontSize:
                  '0.6rem',
                lineHeight:
                  1.35
              }}
            >
              Os estilos usam apenas as fontes já disponíveis no projeto e na marca atual.
            </span>
          </div>
        </div>
      ) : null}

      {openPanel ===
      'effects' ? (
        <div
          className="mq-text-effects-popover"
          role="dialog"
          aria-label="Efeitos rápidos de texto"
        >
          <div className="mq-text-effects-popover__heading">
            <div>
              <strong>
                Efeitos de texto
              </strong>

              <small>
                Presets rápidos. Os controlos detalhados continuam disponíveis no painel lateral.
              </small>
            </div>

            <button
              type="button"
              className="mq-text-effects-popover__close"
              onClick={() =>
                setOpenPanel(
                  null
                )
              }
              aria-label="Fechar efeitos de texto"
            >
              ×
            </button>
          </div>

          <div className="mq-text-effects-grid">
            {MA_QUADRO_TEXT_EFFECT_PRESETS.map(
              (preset) => (
                <TextEffectPresetCard
                  key={
                    preset.id
                  }
                  preset={
                    preset
                  }
                  disabled={
                    locked
                  }
                  active={
                    isMAQuadroTextShadowPresetActive(
                      preset,
                      selection
                    )
                  }
                  onApply={
                    applyEffectPreset
                  }
                />
              )
            )}
          </div>

          <div className="mq-text-effects-popover__footer">
            <button
              type="button"
              disabled={
                locked ||
                !selection.shadowEnabled
              }
              onClick={() =>
                editor.setShadow({
                  enabled:
                    false
                })
              }
            >
              Remover sombra
            </button>

            <button
              type="button"
              disabled={
                locked ||
                selection.strokeWidth ===
                  0
              }
              onClick={() =>
                editor
                  .setSelectionStrokeWidth(
                    0
                  )
              }
            >
              Remover contorno
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
