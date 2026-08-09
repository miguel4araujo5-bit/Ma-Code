import {
  NumberField
} from './PropertyControls'

import {
  MA_QUADRO_ANIMATION_MAX_DURATION_MS,
  MA_QUADRO_ANIMATION_MIN_DURATION_MS,
  type MAQuadroAnimationKind,
  type MAQuadroAnimationPhase,
  type MAQuadroObjectAnimation
} from '../../lib/maQuadro/objectAnimations'

const ANIMATION_TYPES:
  Array<{
    kind:
      MAQuadroAnimationKind

    label:
      string
  }> = [
    {
      kind:
        'none',

      label:
        'Sem animação'
    },

    {
      kind:
        'fade',

      label:
        'Fade'
    },

    {
      kind:
        'slide',

      label:
        'Slide'
    },

    {
      kind:
        'scale',

      label:
        'Scale'
    },

    {
      kind:
        'pop',

      label:
        'Pop'
    }
  ]

const PHASES:
  Array<{
    phase:
      MAQuadroAnimationPhase

    label:
      string
  }> = [
    {
      phase:
        'in',

      label:
        'Entrada'
    },

    {
      phase:
        'out',

      label:
        'Saída'
    }
  ]

export default function
AnimationControls({
  animation,
  disabled,
  previewing,
  onChange,
  onPreview
}: {
  animation:
    MAQuadroObjectAnimation

  disabled:
    boolean

  previewing:
    boolean

  onChange: (
    values:
      Partial<
        MAQuadroObjectAnimation
      >
  ) => void

  onPreview:
    () => void
}) {
  const animationDisabled =
    animation.kind ===
      'none'

  return (
    <div className="mq-animation-controls">
      <div
        className="mq-animation-controls__effects"
        role="group"
        aria-label="Efeito de animação"
      >
        {ANIMATION_TYPES.map(
          (
            item
          ) => (
            <button
              key={
                item.kind
              }
              type="button"
              className={`mq-animation-choice${
                animation.kind ===
                item.kind
                  ? ' is-active'
                  : ''
              }`}
              aria-pressed={
                animation.kind ===
                item.kind
              }
              disabled={
                disabled ||
                previewing
              }
              onClick={() =>
                onChange({
                  kind:
                    item.kind
                })
              }
            >
              {
                item.label
              }
            </button>
          )
        )}
      </div>

      {!animationDisabled ? (
        <>
          <div className="mq-animation-controls__section">
            <span className="mq-animation-controls__label">
              Momento
            </span>

            <div
              className="mq-animation-controls__phases"
              role="group"
              aria-label="Momento da animação"
            >
              {PHASES.map(
                (
                  item
                ) => (
                  <button
                    key={
                      item.phase
                    }
                    type="button"
                    className={`mq-animation-phase${
                      animation.phase ===
                      item.phase
                        ? ' is-active'
                        : ''
                    }`}
                    aria-pressed={
                      animation.phase ===
                      item.phase
                    }
                    disabled={
                      disabled ||
                      previewing
                    }
                    onClick={() =>
                      onChange({
                        phase:
                          item.phase
                      })
                    }
                  >
                    {
                      item.label
                    }
                  </button>
                )
              )}
            </div>
          </div>

          <NumberField
            label="Duração"
            value={
              animation.durationMs /
              1000
            }
            min={
              MA_QUADRO_ANIMATION_MIN_DURATION_MS /
              1000
            }
            max={
              MA_QUADRO_ANIMATION_MAX_DURATION_MS /
              1000
            }
            step={
              0.1
            }
            suffix="s"
            disabled={
              disabled ||
              previewing
            }
            onCommit={(
              seconds
            ) =>
              onChange({
                durationMs:
                  Math.round(
                    seconds *
                      1000
                  )
              })
            }
          />

          <button
            type="button"
            className="mq-animation-preview"
            disabled={
              disabled ||
              previewing
            }
            onClick={
              onPreview
            }
          >
            {previewing
              ? 'A pré-visualizar…'
              : 'Pré-visualizar animação'}
          </button>

          <p className="mq-animation-note">
            A pré-visualização é temporária. O elemento regressa à posição, escala e opacidade originais quando termina.
          </p>
        </>
      ) : (
        <p className="mq-animation-note">
          Escolha Fade, Slide, Scale ou Pop para animar o elemento selecionado.
        </p>
      )}
    </div>
  )
}
