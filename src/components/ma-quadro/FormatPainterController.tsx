import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  publishMAQuadroFormatPainterState,
  subscribeMAQuadroFormatPainterRequest
} from '../../lib/maQuadro/formatPainter'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroFormatPainter.css'

export default function FormatPainterController() {
  const editor =
    useMAQuadroEditorContext()

  const [
    active,
    setActive
  ] = useState(
    false
  )

  const [
    sourceLayerId,
    setSourceLayerId
  ] = useState<
    string | null
  >(null)

  const [
    sourceName,
    setSourceName
  ] = useState<
    string | null
  >(null)

  const applyingRef =
    useRef(false)

  const activeLayer =
    useMemo(
      () =>
        editor.layers.find(
          (layer) =>
            layer.active
        ) ||
        null,
      [
        editor.layers
      ]
    )

  const activeLayerId =
    activeLayer?.id ||
    null

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  const cancel =
    useCallback(() => {
      applyingRef.current =
        false

      setActive(
        false
      )

      setSourceLayerId(
        null
      )

      setSourceName(
        null
      )
    }, [])

  const activate =
    useCallback(() => {
      if (
        locked ||
        editor.selection.count !==
          1 ||
        !activeLayer
      ) {
        return
      }

      editor
        .copySelectionStyle()

      setSourceLayerId(
        activeLayer.id
      )

      setSourceName(
        activeLayer.name ||
          editor.selection.name ||
          'Elemento'
      )

      setActive(
        true
      )
    }, [
      activeLayer,
      editor,
      locked
    ])

  useEffect(() => {
    return (
      subscribeMAQuadroFormatPainterRequest(
        (action) => {
          if (
            action ===
            'cancel'
          ) {
            cancel()

            return
          }

          activate()
        }
      )
    )
  }, [
    activate,
    cancel
  ])

  useEffect(() => {
    publishMAQuadroFormatPainterState({
      active,
      sourceName
    })

    if (
      typeof document ===
      'undefined'
    ) {
      return
    }

    document
      .documentElement
      .classList
      .toggle(
        'mq-format-painter-active',
        active
      )

    return () => {
      document
        .documentElement
        .classList
        .remove(
          'mq-format-painter-active'
        )
    }
  }, [
    active,
    sourceName
  ])

  useEffect(() => {
    if (!active) {
      return
    }

    const handleKeyDown = (
      event:
        KeyboardEvent
    ) => {
      if (
        event.key !==
        'Escape'
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      cancel()
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
      true
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
        true
      )
    }
  }, [
    active,
    cancel
  ])

  useEffect(() => {
    if (
      !active ||
      applyingRef.current ||
      locked ||
      editor.selection.count !==
        1 ||
      !activeLayerId ||
      !sourceLayerId ||
      activeLayerId ===
        sourceLayerId
    ) {
      return
    }

    applyingRef.current =
      true

    editor
      .pasteSelectionStyle()

    cancel()
  }, [
    active,
    activeLayerId,
    cancel,
    editor,
    locked,
    sourceLayerId
  ])

  useEffect(() => {
    cancel()
  }, [
    editor.activePage?.id,
    editor.project?.id,
    cancel
  ])

  useEffect(() => {
    if (
      active &&
      locked
    ) {
      cancel()
    }
  }, [
    active,
    cancel,
    locked
  ])

  if (!active) {
    return null
  }

  return (
    <div
      className="mq-format-painter-status"
      role="status"
      aria-live="polite"
    >
      <span
        className="mq-format-painter-status__icon"
        aria-hidden="true"
      >
        🖌
      </span>

      <span className="mq-format-painter-status__copy">
        <strong>
          Pincel de estilo ativo
        </strong>

        <small>
          Estilo de{' '}
          <b>
            {sourceName ||
              'elemento'}
          </b>
          . Clique noutro
          elemento para aplicar.
        </small>
      </span>

      <span className="mq-format-painter-status__hint">
        Esc para cancelar
      </span>
    </div>
  )
}
