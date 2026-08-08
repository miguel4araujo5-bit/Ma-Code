import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  isMAQuadroTextShadowPresetActive,
  MA_QUADRO_TEXT_EFFECT_PRESETS,
  type MAQuadroTextEffectPreset
} from '../../lib/maQuadro/textEffectPresets'

import {
  useMAQuadroEditorContext
} from './editorContext'

import TextEffectPresetCard from './TextEffectPresetCard'

import './maQuadroTextEffects.css'

function effectSummary({
  shadowEnabled,
  strokeWidth
}: {
  shadowEnabled: boolean
  strokeWidth: number
}) {
  if (
    shadowEnabled &&
    strokeWidth > 0
  ) {
    return 'Sombra + contorno'
  }

  if (shadowEnabled) {
    return 'Sombra ativa'
  }

  if (strokeWidth > 0) {
    return 'Contorno ativo'
  }

  return 'Sem efeito rápido'
}

export default function TextEffectsToolbar() {
  const editor =
    useMAQuadroEditorContext()

  const rootRef =
    useRef<HTMLDivElement | null>(
      null
    )

  const [
    open,
    setOpen
  ] = useState(
    false
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

  const summary =
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

  useEffect(() => {
    if (!textSelected) {
      setOpen(
        false
      )
    }
  }, [
    textSelected
  ])

  useEffect(() => {
    if (!open) {
      return
    }

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
        setOpen(
          false
        )
      }
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key ===
        'Escape'
      ) {
        setOpen(
          false
        )
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
  }, [
    open
  ])

  if (!textSelected) {
    return null
  }

  const applyPreset = (
    preset:
      MAQuadroTextEffectPreset
  ) => {
    if (locked) {
      return
    }

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
          open
            ? ' is-open'
            : ''
        }`}
        disabled={locked}
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span aria-hidden="true">
          ✦
        </span>

        <span>
          Efeitos
        </span>

        <small>
          {summary}
        </small>
      </button>

      {open ? (
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
                setOpen(
                  false
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
                    applyPreset
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
                  enabled: false
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
