import {
  useEffect,
  useState
} from 'react'

import {
  requestMAQuadroFormatPainter,
  subscribeMAQuadroFormatPainterState,
  type MAQuadroFormatPainterState
} from '../../lib/maQuadro/formatPainter'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroFormatPainter.css'

const INITIAL_STATE:
  MAQuadroFormatPainterState = {
    active: false,
    sourceName: null
  }

export default function FormatPainterButton() {
  const editor =
    useMAQuadroEditorContext()

  const [
    state,
    setState
  ] = useState<
    MAQuadroFormatPainterState
  >(
    INITIAL_STATE
  )

  useEffect(() => {
    return (
      subscribeMAQuadroFormatPainterState(
        setState
      )
    )
  }, [])

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  const disabled =
    !state.active &&
    (
      locked ||
      editor.selection.count !==
        1
    )

  const handleClick = () => {
    requestMAQuadroFormatPainter(
      state.active
        ? 'cancel'
        : 'activate'
    )
  }

  return (
    <button
      type="button"
      className={`mq-button mq-format-painter-button${
        state.active
          ? ' is-active'
          : ''
      }`}
      onClick={
        handleClick
      }
      disabled={
        disabled
      }
      aria-pressed={
        state.active
      }
      title={
        state.active
          ? 'Cancelar Pincel de Estilo (Esc)'
          : 'Copiar o estilo da seleção e aplicá-lo ao próximo elemento'
      }
    >
      <span
        className="mq-format-painter-button__icon"
        aria-hidden="true"
      >
        🖌
      </span>

      <span className="mq-format-painter-button__label">
        {state.active
          ? 'Cancelar pincel'
          : 'Pincel'}
      </span>
    </button>
  )
}
