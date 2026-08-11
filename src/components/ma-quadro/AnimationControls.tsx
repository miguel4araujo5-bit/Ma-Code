import {
  NumberField
} from './PropertyControls'

import {
  MA_QUADRO_ANIMATION_MAX_DELAY_MS,
  MA_QUADRO_ANIMATION_MAX_DURATION_MS,
  MA_QUADRO_ANIMATION_MAX_ORDER,
  MA_QUADRO_ANIMATION_MIN_DELAY_MS,
  MA_QUADRO_ANIMATION_MIN_DURATION_MS,
  MA_QUADRO_ANIMATION_MIN_ORDER,
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

          <NumberField
            label="Ordem"
            value={
              animation.order
            }
            min={
              MA_QUADRO_ANIMATION_MIN_ORDER
            }
            max={
              MA_QUADRO_ANIMATION_MAX_ORDER
            }
            step={
              1
            }
            disabled={
              disabled ||
              previewing
            }
            onCommit={(
              order
            ) =>
              onChange({
                order:
                  Math.round(
                    order
                  )
              })
            }
          />

          <p className="mq-animation-note">
            Ordem 0 segue automaticamente a posição do elemento nas camadas. Um valor entre 1 e 99 permite definir manualmente a posição na reprodução sequencial.
          </p>

          <NumberField
            label="Atraso"
            value={
              animation.delayMs /
              1000
            }
            min={
              MA_QUADRO_ANIMATION_MIN_DELAY_MS /
              1000
            }
            max={
              MA_QUADRO_ANIMATION_MAX_DELAY_MS /
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
                delayMs:
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
            O atraso também é respeitado na pré-visualização. No fim, o elemento regressa à posição, escala e opacidade originais.
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
