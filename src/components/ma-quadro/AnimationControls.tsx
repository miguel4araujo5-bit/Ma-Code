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

export default function AnimationControls({
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
    <div>
      <div className="mq-action-grid mq-action-grid--2">
        {ANIMATION_TYPES.map(
          (
            item
          ) => (
            <button
              key={
                item.kind
              }
              type="button"
              className={`mq-panel-action${
                animation.kind ===
                item.kind
                  ? ' is-active'
                  : ''
              }`}
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
          <p className="mq-control-note">
            Escolha se o elemento entra ou sai e ajuste a duração da animação.
          </p>

          <div className="mq-action-grid mq-action-grid--2">
            {PHASES.map(
              (
                item
              ) => (
                <button
                  key={
                    item.phase
                  }
                  type="button"
                  className={`mq-panel-action${
                    animation.phase ===
                    item.phase
                      ? ' is-active'
                      : ''
                  }`}
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
            step={0.1}
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
            className="mq-panel-action mq-panel-action--accent"
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

          <p className="mq-control-note">
            A pré-visualização é temporária: no fim, o elemento regressa exatamente à posição, escala e opacidade do design.
          </p>
        </>
      ) : (
        <p className="mq-control-note">
          Selecione um efeito para animar este elemento.
        </p>
      )}
    </div>
  )
}
