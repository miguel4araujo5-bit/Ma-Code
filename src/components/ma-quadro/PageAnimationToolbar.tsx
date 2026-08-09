import {
  useLayoutEffect,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  type MAQuadroPageAnimationMode
} from '../../lib/maQuadro/pageAnimations'

import {
  useMAQuadroEditorContext
} from './editorContext'

import {
  useMAQuadroPageAnimations
} from './useMAQuadroPageAnimations'

import './maQuadroPageAnimations.css'

export default function
PageAnimationToolbar() {
  const editor =
    useMAQuadroEditorContext()

  const pageAnimations =
    useMAQuadroPageAnimations()

  const [
    host,
    setHost
  ] = useState<
    HTMLElement |
    null
  >(
    null
  )

  useLayoutEffect(() => {
    if (
      !editor.ready
    ) {
      setHost(
        null
      )

      return
    }

    const toolbar =
      document.querySelector<
        HTMLElement
      >(
        '.mq-context-toolbar'
      )

    if (
      !toolbar
    ) {
      setHost(
        null
      )

      return
    }

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-page-animation-toolbar-host'

    toolbar.append(
      mount
    )

    setHost(
      mount
    )

    return () => {
      mount.remove()
    }
  }, [
    editor.activePage?.id,
    editor.project?.id,
    editor.ready
  ])

  if (
    !host
  ) {
    return null
  }

  const locked =
    pageAnimations.disabled

  const countLabel =
    pageAnimations.animationCount ===
      1
      ? '1 animação'
      : `${pageAnimations.animationCount} animações`

  return createPortal(
    <div
      className="mq-page-animation-toolbar"
      aria-label="Pré-visualização das animações da página"
    >
      <span
        className="mq-page-animation-toolbar__count"
        title="Elementos animados nesta página"
      >
        {
          countLabel
        }
      </span>

      <label className="mq-page-animation-toolbar__field">
        <span className="sr-only">
          Reprodução das animações
        </span>

        <select
          value={
            pageAnimations.mode
          }
          disabled={
            locked ||
            pageAnimations.playing
          }
          aria-label="Modo de reprodução das animações"
          onChange={(
            event
          ) =>
            pageAnimations.setMode(
              event.target.value as
                MAQuadroPageAnimationMode
            )
          }
        >
          <option value="sequence">
            Sequencial
          </option>

          <option value="together">
            Simultâneo
          </option>
        </select>
      </label>

      {pageAnimations.mode ===
        'sequence' ? (
        <label className="mq-page-animation-toolbar__field">
          <span className="sr-only">
            Intervalo entre animações
          </span>

          <select
            value={
              pageAnimations.gapMs
            }
            disabled={
              locked ||
              pageAnimations.playing
            }
            aria-label="Intervalo entre animações"
            title="Intervalo entre elementos"
            onChange={(
              event
            ) =>
              pageAnimations.setGapMs(
                Number(
                  event
                    .target
                    .value
                )
              )
            }
          >
            <option value="0">
              Sem intervalo
            </option>

            <option value="100">
              0,1 s
            </option>

            <option value="120">
              0,12 s
            </option>

            <option value="200">
              0,2 s
            </option>

            <option value="350">
              0,35 s
            </option>

            <option value="500">
              0,5 s
            </option>
          </select>
        </label>
      ) : null}

      <button
        type="button"
        className={`mq-page-animation-toolbar__play${
          pageAnimations.playing
            ? ' is-playing'
            : ''
        }`}
        disabled={
          !pageAnimations.playing &&
          (
            locked ||
            pageAnimations.animationCount ===
              0
          )
        }
        title={
          pageAnimations.playing
            ? 'Parar pré-visualização'
            : 'Pré-visualizar todas as animações desta página'
        }
        onClick={() => {
          if (
            pageAnimations.playing
          ) {
            pageAnimations.stop()

            return
          }

          void pageAnimations
            .play()
        }}
      >
        <span aria-hidden="true">
          {pageAnimations.playing
            ? '■'
            : '▶'}
        </span>

        <span>
          {pageAnimations.playing
            ? 'Parar'
            : 'Página'}
        </span>
      </button>
    </div>,
    host
  )
}
