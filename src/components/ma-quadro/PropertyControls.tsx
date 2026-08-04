import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'

function clamp(
  value: number,
  minimum?: number,
  maximum?: number
) {
  let next = value

  if (
    minimum !== undefined
  ) {
    next = Math.max(
      minimum,
      next
    )
  }

  if (
    maximum !== undefined
  ) {
    next = Math.min(
      maximum,
      next
    )
  }

  return next
}

function formatNumber(
  value: number
) {
  if (
    !Number.isFinite(value)
  ) {
    return ''
  }

  return String(
    Math.round(
      value * 1000
    ) / 1000
  )
}

function isValidCssColour(
  value: string
) {
  const trimmed =
    value.trim()

  if (!trimmed) {
    return false
  }

  if (
    typeof CSS !==
      'undefined' &&
    typeof CSS.supports ===
      'function'
  ) {
    return CSS.supports(
      'color',
      trimmed
    )
  }

  return /^(#[\da-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent)$/iu.test(
    trimmed
  )
}

function cssColourToHex(
  value: string,
  fallback = '#0F172A'
) {
  if (
    typeof document ===
      'undefined'
  ) {
    return fallback
  }

  const canvas =
    document.createElement(
      'canvas'
    )

  const context =
    canvas.getContext('2d')

  if (!context) {
    return fallback
  }

  context.fillStyle = fallback
  context.fillStyle = value

  const normalised =
    context.fillStyle

  if (
    /^#[\da-f]{6}$/iu.test(
      normalised
    )
  ) {
    return normalised
  }

  const match =
    normalised.match(
      /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/iu
    )

  if (!match) {
    return fallback
  }

  return `#${[
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  ]
    .map((channel) =>
      Math.max(
        0,
        Math.min(
          255,
          Math.round(channel)
        )
      )
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  suffix,
  disabled = false
}: {
  label: string
  value: number
  onCommit: (
    value: number
  ) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
}) {
  const [
    draft,
    setDraft
  ] = useState(
    formatNumber(value)
  )

  const [
    editing,
    setEditing
  ] = useState(false)

  useEffect(() => {
    if (!editing) {
      setDraft(
        formatNumber(value)
      )
    }
  }, [
    editing,
    value
  ])

  const commit = () => {
    const trimmed =
      draft.trim()

    if (!trimmed) {
      setDraft(
        formatNumber(value)
      )

      setEditing(false)
      return
    }

    const parsed =
      Number(trimmed)

    if (
      !Number.isFinite(parsed)
    ) {
      setDraft(
        formatNumber(value)
      )

      setEditing(false)
      return
    }

    const next =
      clamp(
        parsed,
        min,
        max
      )

    setDraft(
      formatNumber(next)
    )

    setEditing(false)

    if (next !== value) {
      onCommit(next)
    }
  }

  const handleKeyDown = (
    event:
      KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      event.key === 'Enter'
    ) {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (
      event.key === 'Escape'
    ) {
      event.preventDefault()

      setDraft(
        formatNumber(value)
      )

      setEditing(false)
      event.currentTarget.blur()
    }
  }

  return (
    <label className="mq-field">
      <span>
        {label}
      </span>

      <span className="mq-number-field">
        <input
          type="number"
          value={draft}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          inputMode="decimal"
          onFocus={() =>
            setEditing(true)
          }
          onChange={(event) =>
            setDraft(
              event.target.value
            )
          }
          onBlur={commit}
          onKeyDown={
            handleKeyDown
          }
        />

        {suffix ? (
          <small>
            {suffix}
          </small>
        ) : null}
      </span>
    </label>
  )
}

export function RangeField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  suffix = ''
}: {
  label: string
  value: number
  onCommit: (
    value: number
  ) => void
  min: number
  max: number
  step?: number
  suffix?: string
}) {
  const [
    draft,
    setDraft
  ] = useState(value)

  const [
    editing,
    setEditing
  ] = useState(false)

  const lastCommittedRef =
    useRef(value)

  useEffect(() => {
    lastCommittedRef.current =
      value

    if (!editing) {
      setDraft(value)
    }
  }, [
    editing,
    value
  ])

  const commit = () => {
    const next =
      clamp(
        Number(draft),
        min,
        max
      )

    setEditing(false)
    setDraft(next)

    if (
      next !==
      lastCommittedRef.current
    ) {
      lastCommittedRef.current =
        next

      onCommit(next)
    }
  }

  return (
    <label className="mq-range-field">
      <span>
        <strong>
          {label}
        </strong>

        <output>
          {draft}
          {suffix}
        </output>
      </span>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        onPointerDown={() =>
          setEditing(true)
        }
        onChange={(event) => {
          setEditing(true)

          setDraft(
            Number(
              event.target.value
            )
          )
        }}
        onPointerUp={commit}
        onPointerCancel={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </label>
  )
}

export function ColorField({
  label,
  value,
  onCommit,
  allowTransparent = false
}: {
  label: string
  value: string
  onCommit: (
    value: string
  ) => void
  allowTransparent?: boolean
}) {
  const [
    draft,
    setDraft
  ] = useState(value)

  const [
    editing,
    setEditing
  ] = useState(false)

  useEffect(() => {
    if (!editing) {
      setDraft(value)
    }
  }, [
    editing,
    value
  ])

  const pickerValue =
    useMemo(
      () =>
        cssColourToHex(
          value,
          '#0F172A'
        ),
      [value]
    )

  const commit = () => {
    const next =
      draft.trim()

    setEditing(false)

    if (
      !isValidCssColour(next)
    ) {
      setDraft(value)
      return
    }

    setDraft(next)

    if (next !== value) {
      onCommit(next)
    }
  }

  return (
    <label className="mq-field mq-field--color">
      <span>
        {label}
      </span>

      <span>
        <input
          type="color"
          value={pickerValue}
          aria-label={`${label}: escolher cor`}
          onChange={(event) => {
            const next =
              event.target.value

            setDraft(next)
            setEditing(false)
            onCommit(next)
          }}
        />

        <input
          type="text"
          value={draft}
          spellCheck={false}
          onFocus={() =>
            setEditing(true)
          }
          onChange={(event) =>
            setDraft(
              event.target.value
            )
          }
          onBlur={commit}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter'
            ) {
              event.preventDefault()
              event.currentTarget.blur()
            } else if (
              event.key === 'Escape'
            ) {
              event.preventDefault()

              setDraft(value)
              setEditing(false)
              event.currentTarget.blur()
            }
          }}
        />

        {allowTransparent ? (
          <button
            type="button"
            className="mq-color-transparent"
            onClick={() => {
              setDraft(
                'rgba(0, 0, 0, 0)'
              )

              setEditing(false)

              onCommit(
                'rgba(0, 0, 0, 0)'
              )
            }}
          >
            Sem cor
          </button>
        ) : null}
      </span>
    </label>
  )
}
