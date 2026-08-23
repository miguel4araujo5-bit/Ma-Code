import {
  useLayoutEffect,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import AnimationControls from './AnimationControls'
import MatchMoveControl from './MatchMoveControl'
import PageAnimationToolbar from './PageAnimationToolbar'

import {
  useMAQuadroAnimations
} from './useMAQuadroAnimations'

import './maQuadroAnimations.css'

export default function
AnimationPanel() {
  const animations =
    useMAQuadroAnimations()

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
      !animations.available
    ) {
      setHost(
        null
      )

      return
    }

    const scroll =
      document.querySelector<
        HTMLElement
      >(
        '.mq-properties-panel .mq-properties-panel__scroll'
      )

    if (
      !scroll
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
      'mq-animation-panel-host'

    scroll.prepend(
      mount
    )

    setHost(
      mount
    )

    return () => {
      mount.remove()
    }
  }, [
    animations.available,
    animations.selectedName
  ])

  return (
    <>
      <PageAnimationToolbar />
      <MatchMoveControl />

      {host &&
      animations.available
        ? createPortal(
            <section
              className="mq-animation-panel"
              aria-label="Animação do elemento"
            >
              <div className="mq-animation-panel__heading">
                <span>
                  <strong>
                    Animação
                  </strong>

                  <small
                    title={
                      animations.selectedName
                    }
                  >
                    {
                      animations.selectedName ||
                      'Elemento selecionado'
                    }
                  </small>
                </span>

                {animations
                  .animation
                  .kind !==
                'none' ? (
                  <span className="mq-animation-panel__badge">
                    Ativa
                  </span>
                ) : null}
              </div>

              <AnimationControls
                animation={
                  animations.animation
                }
                disabled={
                  animations.disabled
                }
                previewing={
                  animations.previewing
                }
                onChange={
                  animations.setAnimation
                }
                onPreview={() => {
                  void animations
                    .preview()
                }}
              />
            </section>,
            host
          )
        : null}
    </>
  )
}
