import type {
  MAQuadroTextEffectPreset
} from '../../lib/maQuadro/textEffectPresets'

export default function TextEffectPresetCard({
  preset,
  active,
  disabled,
  onApply
}: {
  preset: MAQuadroTextEffectPreset
  active: boolean
  disabled: boolean
  onApply: (
    preset: MAQuadroTextEffectPreset
  ) => void
}) {
  return (
    <button
      type="button"
      className={`mq-text-effect-card mq-text-effect-card--${preset.id}${
        active
          ? ' is-active'
          : ''
      }`}
      disabled={disabled}
      onClick={() =>
        onApply(
          preset
        )
      }
      aria-pressed={
        active
      }
      title={
        preset.description
      }
    >
      <span
        className="mq-text-effect-card__preview"
        aria-hidden="true"
      >
        Aa
      </span>

      <span className="mq-text-effect-card__copy">
        <strong>
          {preset.name}
        </strong>

        <small>
          {preset.description}
        </small>
      </span>
    </button>
  )
}
